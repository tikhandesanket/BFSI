"""Usage + cost metrics store.

Records one event per answered chat request and rolls them up into windowed
summaries (last 7 / 15 / 30 days) for the Analytics dashboard. The key thing we
track is *where the answer came from*:

  - "llm"        : a fresh model call was made (the expensive path)
  - "cache"      : a semantically-similar question was already answered (free)
  - "extractive" : deterministic no-API fallback (cheap, but not a cache hit)
  - "router"     : short-circuited by the router (smalltalk / out_of_scope)

From that we compute how much money the semantic cache saved: every cache hit
avoids the cost the equivalent LLM call would have incurred.

Events persist to a small JSON file. Cost is estimated from token counts using a
configurable per-1K-token price (defaults approximate a small chat model).
"""

from __future__ import annotations

import json
import os
import random
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional

from . import policy

# Events recorded before policy versioning existed carry no identifier. They are
# labelled rather than back-filled — guessing which rules were in force at the
# time is exactly the misattribution this is meant to prevent.
UNVERSIONED = "unversioned"

# Rough price estimate ($ per 1K tokens). Override via env for your model/region.
COST_PER_1K_INPUT = float(os.environ.get("LLM_COST_PER_1K_INPUT", "0.005"))
COST_PER_1K_OUTPUT = float(os.environ.get("LLM_COST_PER_1K_OUTPUT", "0.015"))

# ~4 characters per token is the usual English rule of thumb.
CHARS_PER_TOKEN = 4

# Human-agent deflection model: every question the assistant resolves on its own
# is one a support agent didn't have to handle. Value that at a typical handling
# time and loaded agent cost. Override via env to match your contact-centre.
AGENT_MINUTES_PER_QUERY = float(os.environ.get("AGENT_MINUTES_PER_QUERY", "5"))
AGENT_HOURLY_RATE_USD = float(os.environ.get("AGENT_HOURLY_RATE_USD", "20"))

# Reasons a KB query failed to produce a grounded, model-generated answer.
FALLBACK_REASONS = ("no_llm", "guard_rejected", "kb_gap")


def estimate_tokens(text: str) -> int:
    return max(1, len(text or "") // CHARS_PER_TOKEN)


def cost_from_tokens(prompt_tokens: int, completion_tokens: int) -> float:
    """USD cost from real token counts reported by the API."""
    return (prompt_tokens / 1000) * COST_PER_1K_INPUT + (
        completion_tokens / 1000
    ) * COST_PER_1K_OUTPUT


def estimate_cost(input_text: str, output_text: str) -> float:
    """Estimated USD cost of an LLM call from text length. Only used as a fallback
    when the provider does not return token usage."""
    return cost_from_tokens(estimate_tokens(input_text), estimate_tokens(output_text))


def _day_key(ts: float) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")


class MetricsStore:
    def __init__(self, path: Optional[Path] = None, seed_if_empty: bool = False):
        self.path = path
        self._events: List[dict] = []
        self._lock = threading.Lock()
        self._load()
        if seed_if_empty and not self._events:
            self._seed_demo()

    # -------------------------------------------------------------------- record
    def record(
        self,
        *,
        source: str,
        route: str,
        latency_ms: int,
        cost_usd: float = 0.0,
        cost_saved_usd: float = 0.0,
        similarity: Optional[float] = None,
        query: str = "",
        fallback_reason: Optional[str] = None,
        needs_human: bool = False,
        ts: Optional[float] = None,
        escalation_policy: Optional[str] = None,
        policy_version: Optional[str] = None,
        sources: Optional[List[dict]] = None,
        corpus_version: Optional[str] = None,
        grounding_score: Optional[float] = None,
        overlap: Optional[float] = None,
        sources_changed: Optional[bool] = None,
    ) -> None:
        # Stamped here rather than at each call site: a caller that forgot would
        # silently produce an unattributable record. Callers may pass the id they
        # captured at decision time, which is preferred — it is the version that
        # actually produced the outcome, not whatever is loaded now.
        with self._lock:
            self._events.append(
                {
                    "ts": ts if ts is not None else time.time(),
                    "source": source,
                    "route": route,
                    "latency_ms": int(latency_ms),
                    "cost_usd": round(float(cost_usd), 6),
                    "cost_saved_usd": round(float(cost_saved_usd), 6),
                    "similarity": similarity,
                    "query": (query or "")[:200],
                    "fallback_reason": fallback_reason,
                    "needs_human": bool(needs_human),
                    "policy_version": policy_version or policy.policy_id(),
                    "escalation_policy": escalation_policy
                    or policy.escalation_policy_id(),
                    # Provenance: which document *versions* backed this answer,
                    # the scores the guard measured, and whether a replayed
                    # answer's sources have since changed underneath it.
                    "sources": sources or [],
                    "corpus_version": corpus_version,
                    "grounding_score": (
                        None if grounding_score is None else round(float(grounding_score), 4)
                    ),
                    "overlap": None if overlap is None else round(float(overlap), 4),
                    "sources_changed": sources_changed,
                }
            )
            self._persist_locked()

    def reset(self) -> int:
        with self._lock:
            n = len(self._events)
            self._events = []
            self._persist_locked()
            return n

    # ------------------------------------------------------------------- summary
    def summary(self, days: int = 30) -> dict:
        cutoff = time.time() - days * 86400
        with self._lock:
            events = [e for e in self._events if e["ts"] >= cutoff]

        total = len(events)
        cache_hits = sum(1 for e in events if e["source"] == "cache")
        llm_calls = sum(1 for e in events if e["source"] == "llm")
        cost_incurred = sum(e["cost_usd"] for e in events)
        cost_saved = sum(e["cost_saved_usd"] for e in events)
        cost_baseline = cost_incurred + cost_saved  # cost with no cache at all
        latencies = [e["latency_ms"] for e in events]

        # Source breakdown for the pie chart.
        by_source: dict[str, int] = {}
        for e in events:
            by_source[e["source"]] = by_source.get(e["source"], 0) + 1

        # Per-day series for the bar charts — one bucket per calendar day so the
        # frontend can render a continuous timeline even for days with no traffic.
        buckets: dict[str, dict] = {}
        for i in range(days):
            d = _day_key(time.time() - (days - 1 - i) * 86400)
            buckets[d] = {
                "date": d,
                "cache": 0,
                "llm": 0,
                "other": 0,
                "total": 0,
                "cost_incurred": 0.0,
                "cost_saved": 0.0,
            }
        for e in events:
            key = _day_key(e["ts"])
            b = buckets.get(key)
            if b is None:
                continue
            b["total"] += 1
            if e["source"] == "cache":
                b["cache"] += 1
            elif e["source"] == "llm":
                b["llm"] += 1
            else:
                b["other"] += 1
            b["cost_incurred"] += e["cost_usd"]
            b["cost_saved"] += e["cost_saved_usd"]

        by_day = []
        for b in buckets.values():
            b["cost_incurred"] = round(b["cost_incurred"], 6)
            b["cost_saved"] = round(b["cost_saved"], 6)
            by_day.append(b)

        # Fallbacks — questions that never got a grounded, model-generated answer.
        fallback_events = [e for e in events if e.get("fallback_reason") in FALLBACK_REASONS]
        by_reason: dict[str, int] = {}
        for e in fallback_events:
            r = e["fallback_reason"]
            by_reason[r] = by_reason.get(r, 0) + 1
        recent_fallbacks = [
            {
                "ts": e["ts"],
                "query": e.get("query", ""),
                "reason": e["fallback_reason"],
                "route": e["route"],
            }
            for e in sorted(fallback_events, key=lambda x: x["ts"], reverse=True)[:50]
        ]

        # Policy attribution. Escalations are broken out separately because they
        # are the records most likely to be re-read during a compliance review,
        # and the question asked of them is always "under which rules?".
        by_policy: dict[str, int] = {}
        by_escalation_policy: dict[str, int] = {}
        for e in events:
            pv = e.get("policy_version") or UNVERSIONED
            by_policy[pv] = by_policy.get(pv, 0) + 1
            if e.get("needs_human"):
                ep = e.get("escalation_policy") or UNVERSIONED
                by_escalation_policy[ep] = by_escalation_policy.get(ep, 0) + 1

        # Human-agent deflection: anything not flagged needs_human was auto-resolved.
        needs_human = sum(1 for e in events if e.get("needs_human"))
        auto_resolved = total - needs_human
        minutes_saved = auto_resolved * AGENT_MINUTES_PER_QUERY
        agent_cost_saved = (minutes_saved / 60) * AGENT_HOURLY_RATE_USD

        return {
            "days": days,
            "total_queries": total,
            "cache_hits": cache_hits,
            "llm_calls": llm_calls,
            "hit_rate": round(cache_hits / total, 4) if total else 0.0,
            "cost_incurred_usd": round(cost_incurred, 4),
            "cost_saved_usd": round(cost_saved, 4),
            "cost_baseline_usd": round(cost_baseline, 4),
            "savings_pct": round(cost_saved / cost_baseline, 4) if cost_baseline else 0.0,
            "avg_latency_ms": round(sum(latencies) / len(latencies)) if latencies else 0,
            "by_source": by_source,
            "by_day": by_day,
            "fallbacks": {
                "total": len(fallback_events),
                "rate": round(len(fallback_events) / total, 4) if total else 0.0,
                "by_reason": by_reason,
                "recent": recent_fallbacks,
            },
            "deflection": {
                "auto_resolved": auto_resolved,
                "needs_human": needs_human,
                "deflection_rate": round(auto_resolved / total, 4) if total else 0.0,
                "agent_minutes_saved": round(minutes_saved, 1),
                "agent_hours_saved": round(minutes_saved / 60, 2),
                "agent_cost_saved_usd": round(agent_cost_saved, 2),
                "minutes_per_query": AGENT_MINUTES_PER_QUERY,
                "agent_hourly_rate_usd": AGENT_HOURLY_RATE_USD,
            },
            "policy": {
                "current": policy.policy_id(),
                "current_escalation": policy.escalation_policy_id(),
                "by_version": by_policy,
                "escalations_by_version": by_escalation_policy,
                "unversioned_events": by_policy.get(UNVERSIONED, 0),
                # More than one version in a window means the rules changed
                # mid-window, so the aggregate rates above are a blend.
                "versions_in_window": len(by_policy),
            },
        }

    # --------------------------------------------------------------- persistence
    def _load(self) -> None:
        if not self.path or not Path(self.path).exists():
            return
        try:
            with open(self.path, "r", encoding="utf-8") as f:
                self._events = json.load(f)
        except Exception as e:  # noqa: BLE001
            print(f"[metrics] failed to load {self.path}: {e}")
            self._events = []

    def _persist_locked(self) -> None:
        if not self.path:
            return
        try:
            tmp = Path(str(self.path) + ".tmp")
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(self._events, f)
            tmp.replace(self.path)
        except Exception as e:  # noqa: BLE001
            print(f"[metrics] failed to persist {self.path}: {e}")

    # ---------------------------------------------------------------- demo seed
    def _seed_demo(self) -> None:
        """Populate ~30 days of synthetic traffic. OFF by default — the store only
        records real requests. Opt in for a demo by setting SEED_DEMO_METRICS=1.
        Seeded events are flagged with "seeded": True.
        """
        if os.environ.get("SEED_DEMO_METRICS", "0") != "1":
            return
        rng = random.Random(42)
        now = time.time()
        events: List[dict] = []
        for day in range(30, -1, -1):
            day_ts = now - day * 86400
            # Gently growing traffic + weekend dip.
            wd = datetime.fromtimestamp(day_ts, tz=timezone.utc).weekday()
            base = 14 + (30 - day) // 2
            volume = int(base * (0.55 if wd >= 5 else 1.0)) + rng.randint(-3, 4)
            volume = max(3, volume)
            # Cache warms up over time -> hit rate climbs from ~15% to ~55%.
            hit_rate = min(0.55, 0.15 + (30 - day) * 0.013)
            for _ in range(volume):
                ts = day_ts + rng.uniform(0, 86400)
                roll = rng.random()
                if roll < 0.08:
                    events.append(self._seed_event("router", "smalltalk", ts, rng, 0.0, 0.0))
                elif roll < hit_rate + 0.08:
                    saved = estimate_cost("x" * rng.randint(1600, 3200), "y" * rng.randint(400, 1200))
                    events.append(self._seed_event("cache", "kb", ts, rng, 0.0, saved))
                else:
                    cost = estimate_cost("x" * rng.randint(1600, 3200), "y" * rng.randint(400, 1200))
                    events.append(self._seed_event("llm", "kb", ts, rng, cost, 0.0))
        events.sort(key=lambda e: e["ts"])
        self._events = events
        self._persist_locked()

    @staticmethod
    def _seed_event(source, route, ts, rng, cost, saved) -> dict:
        latency = rng.randint(40, 120) if source in ("cache", "router") else rng.randint(600, 2200)
        return {
            "ts": ts,
            "source": source,
            "route": route,
            "latency_ms": latency,
            "cost_usd": round(cost, 6),
            "cost_saved_usd": round(saved, 6),
            "similarity": round(rng.uniform(0.92, 0.99), 3) if source == "cache" else None,
            "seeded": True,
        }
