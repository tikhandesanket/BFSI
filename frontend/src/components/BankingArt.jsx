/**
 * Inline SVG banking illustrations. Themed in cyan/navy to match the dashboard.
 * Each illustration is responsive (preserveAspectRatio) and can be sized by the
 * parent container.
 */

const defs = (
  <defs>
    <linearGradient id="cyan-grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor="#22d3ee" />
      <stop offset="100%" stopColor="#0ea5e9" />
    </linearGradient>
    <linearGradient id="cyan-grad-soft" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.85" />
      <stop offset="100%" stopColor="#0891b2" stopOpacity="0.95" />
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.45" />
      <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
    </radialGradient>
  </defs>
);

function Frame({ children, className = "" }) {
  return (
    <svg
      viewBox="0 0 320 220"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
    >
      {defs}
      {/* dark backdrop */}
      <rect width="320" height="220" fill="#020617" />
      {/* glow */}
      <circle cx="170" cy="100" r="140" fill="url(#glow)" />
      {/* grid */}
      <g stroke="rgba(34,211,238,0.08)" strokeWidth="0.5">
        {[...Array(11)].map((_, i) => (
          <line key={`v${i}`} x1={i * 32} y1="0" x2={i * 32} y2="220" />
        ))}
        {[...Array(8)].map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 32} x2="320" y2={i * 32} />
        ))}
      </g>
      {children}
    </svg>
  );
}

export function DigitalVaultArt({ className }) {
  return (
    <Frame className={className}>
      {/* vault outer */}
      <g transform="translate(160 110)">
        <circle r="80" fill="#0b1426" stroke="url(#cyan-grad)" strokeWidth="2.5" />
        <circle r="68" fill="none" stroke="rgba(34,211,238,0.35)" strokeWidth="1" strokeDasharray="2 4" />
        <circle r="52" fill="#0f172a" stroke="url(#cyan-grad-soft)" strokeWidth="2" />
        {/* dial markings */}
        {[...Array(12)].map((_, i) => {
          const a = (i * Math.PI) / 6;
          const x1 = Math.cos(a) * 62;
          const y1 = Math.sin(a) * 62;
          const x2 = Math.cos(a) * 70;
          const y2 = Math.sin(a) * 70;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#22d3ee"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.8"
            />
          );
        })}
        {/* dial indicator */}
        <line x1="0" y1="0" x2="0" y2="-44" stroke="url(#cyan-grad)" strokeWidth="3" strokeLinecap="round" />
        <circle r="6" fill="url(#cyan-grad)" />
        {/* spokes */}
        {[0, 1, 2, 3].map((i) => {
          const a = (Math.PI / 2) * i + Math.PI / 4;
          return (
            <line
              key={`s${i}`}
              x1={Math.cos(a) * 80}
              y1={Math.sin(a) * 80}
              x2={Math.cos(a) * 96}
              y2={Math.sin(a) * 96}
              stroke="#22d3ee"
              strokeWidth="3"
              strokeLinecap="round"
            />
          );
        })}
      </g>
      {/* floor reflection */}
      <ellipse cx="160" cy="200" rx="100" ry="6" fill="rgba(34,211,238,0.15)" />
    </Frame>
  );
}

export function SmartCardArt({ className }) {
  return (
    <Frame className={className}>
      {/* back card */}
      <g transform="translate(60 60) rotate(-8)">
        <rect width="180" height="110" rx="14" fill="#0b1426" stroke="rgba(34,211,238,0.4)" strokeWidth="1" />
        <rect x="0" y="22" width="180" height="14" fill="rgba(255,255,255,0.06)" />
      </g>
      {/* front card */}
      <g transform="translate(80 80)">
        <rect width="180" height="110" rx="14" fill="url(#cyan-grad-soft)" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
        {/* chip */}
        <rect x="18" y="22" width="32" height="24" rx="4" fill="#fde68a" opacity="0.95" />
        <line x1="18" y1="34" x2="50" y2="34" stroke="#92400e" strokeWidth="1" opacity="0.5" />
        <line x1="34" y1="22" x2="34" y2="46" stroke="#92400e" strokeWidth="1" opacity="0.5" />
        {/* wifi */}
        <g transform="translate(62 24) rotate(90)" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.6" strokeLinecap="round">
          <path d="M0 0 a 8 8 0 0 1 8 8" />
          <path d="M-4 0 a 12 12 0 0 1 12 12" />
          <path d="M-8 0 a 16 16 0 0 1 16 16" />
        </g>
        {/* number */}
        <g fill="rgba(255,255,255,0.95)" fontFamily="monospace" fontSize="13">
          <text x="18" y="72">4242</text>
          <text x="58" y="72">7891</text>
          <text x="98" y="72">2024</text>
          <text x="138" y="72">8801</text>
        </g>
        {/* name */}
        <text x="18" y="96" fill="rgba(255,255,255,0.85)" fontFamily="sans-serif" fontSize="9" letterSpacing="1.5">
          BANK.IN PRIVILEGE
        </text>
      </g>
    </Frame>
  );
}

export function MobileBankingArt({ className }) {
  return (
    <Frame className={className}>
      {/* phone */}
      <g transform="translate(125 32)">
        <rect width="76" height="156" rx="14" fill="#0b1426" stroke="rgba(34,211,238,0.5)" strokeWidth="1.5" />
        <rect x="4" y="12" width="68" height="132" rx="8" fill="#020617" />
        {/* status bar */}
        <line x1="34" y1="6" x2="42" y2="6" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" />
        {/* balance card */}
        <rect x="10" y="20" width="56" height="32" rx="6" fill="url(#cyan-grad-soft)" />
        <text x="14" y="32" fill="rgba(255,255,255,0.7)" fontSize="5">Balance</text>
        <text x="14" y="46" fill="white" fontSize="10" fontWeight="700">₹ 84,250</text>
        {/* tiles */}
        {[
          [0, 0, "Pay"],
          [1, 0, "FD"],
          [0, 1, "Card"],
          [1, 1, "Loan"],
        ].map(([col, row, label], i) => (
          <g key={i} transform={`translate(${10 + col * 30} ${60 + row * 30})`}>
            <rect width="26" height="26" rx="5" fill="rgba(34,211,238,0.12)" stroke="rgba(34,211,238,0.35)" />
            <circle cx="13" cy="11" r="4" fill="#22d3ee" opacity="0.85" />
            <text x="13" y="22" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="4">{label}</text>
          </g>
        ))}
        {/* tx rows */}
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(10 ${122 + i * 8})`}>
            <rect width="56" height="5" rx="1.5" fill="rgba(255,255,255,0.06)" />
            <rect width={20 + i * 8} height="5" rx="1.5" fill="rgba(34,211,238,0.4)" />
          </g>
        ))}
      </g>
      {/* floating particles */}
      {[
        [60, 50, 3],
        [240, 60, 2],
        [80, 160, 2],
        [250, 150, 3],
        [40, 110, 2],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#22d3ee" opacity="0.6" />
      ))}
    </Frame>
  );
}

export function SkylineBankArt({ className }) {
  return (
    <Frame className={className}>
      {/* skyline buildings */}
      <g>
        {/* building 1 */}
        <rect x="20" y="100" width="50" height="90" fill="#0f172a" stroke="rgba(34,211,238,0.3)" />
        {[...Array(5)].map((_, r) =>
          [...Array(3)].map((__, c) => (
            <rect
              key={`b1-${r}-${c}`}
              x={26 + c * 14}
              y={108 + r * 14}
              width="8"
              height="8"
              fill={(r + c) % 2 ? "#22d3ee" : "rgba(34,211,238,0.25)"}
            />
          )),
        )}
      </g>
      {/* central bank — Greek columns */}
      <g transform="translate(110 60)">
        {/* roof */}
        <polygon points="0,30 100,30 50,8" fill="url(#cyan-grad-soft)" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
        <rect x="-4" y="28" width="108" height="6" fill="#0f172a" stroke="rgba(34,211,238,0.5)" />
        {/* columns */}
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={6 + i * 22} y="34" width="10" height="86" fill="#0b1426" stroke="rgba(34,211,238,0.5)" />
        ))}
        {/* base */}
        <rect x="-6" y="118" width="112" height="8" fill="url(#cyan-grad-soft)" />
        {/* sign */}
        <text x="50" y="22" textAnchor="middle" fill="white" fontSize="8" fontWeight="700" letterSpacing="2">
          BANK
        </text>
      </g>
      {/* building 3 */}
      <g>
        <rect x="240" y="80" width="60" height="110" fill="#0f172a" stroke="rgba(34,211,238,0.3)" />
        {[...Array(7)].map((_, r) =>
          [...Array(4)].map((__, c) => (
            <rect
              key={`b3-${r}-${c}`}
              x={246 + c * 12}
              y={88 + r * 12}
              width="7"
              height="7"
              fill={(r * c) % 3 === 0 ? "#22d3ee" : "rgba(34,211,238,0.2)"}
            />
          )),
        )}
        {/* spire */}
        <polygon points="270,80 280,80 275,60" fill="url(#cyan-grad)" />
      </g>
      {/* ground */}
      <rect x="0" y="190" width="320" height="30" fill="#020617" />
      <line x1="0" y1="190" x2="320" y2="190" stroke="rgba(34,211,238,0.5)" />
      {/* moon */}
      <circle cx="280" cy="40" r="14" fill="rgba(34,211,238,0.6)" />
      <circle cx="280" cy="40" r="20" fill="rgba(34,211,238,0.15)" />
    </Frame>
  );
}

export function SecureTransferArt({ className }) {
  return (
    <Frame className={className}>
      {/* network nodes */}
      {(() => {
        const nodes = [
          [60, 80, "A"],
          [260, 60, "B"],
          [160, 110, "•"],
          [70, 170, "C"],
          [250, 160, "D"],
        ];
        const edges = [
          [2, 0],
          [2, 1],
          [2, 3],
          [2, 4],
          [0, 1],
          [3, 4],
        ];
        return (
          <>
            {edges.map(([a, b], i) => (
              <line
                key={`e${i}`}
                x1={nodes[a][0]}
                y1={nodes[a][1]}
                x2={nodes[b][0]}
                y2={nodes[b][1]}
                stroke="url(#cyan-grad)"
                strokeWidth="1.4"
                opacity="0.55"
                strokeDasharray="3 3"
              />
            ))}
            {/* animated packet */}
            <circle cx={nodes[2][0]} cy={nodes[2][1]} r="22" fill="url(#glow)" />
            {nodes.map(([x, y, label], i) => (
              <g key={i}>
                <circle cx={x} cy={y} r="14" fill="#0b1426" stroke="url(#cyan-grad)" strokeWidth="1.5" />
                <text x={x} y={y + 4} textAnchor="middle" fill="#67e8f9" fontSize="10" fontWeight="700">
                  {label}
                </text>
              </g>
            ))}
            {/* center shield */}
            <g transform={`translate(${nodes[2][0] - 10} ${nodes[2][1] - 10})`}>
              <path
                d="M10 0 L0 4 V11 C0 16 4 19 10 21 C16 19 20 16 20 11 V4 Z"
                fill="url(#cyan-grad-soft)"
                stroke="white"
                strokeWidth="0.8"
                opacity="0.95"
              />
              <path d="M6 11 l3 3 5-6" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          </>
        );
      })()}
      {/* corner tags */}
      <g fontFamily="monospace" fontSize="8" fill="rgba(103,232,249,0.7)">
        <text x="12" y="20">NEFT</text>
        <text x="270" y="20">RTGS</text>
        <text x="12" y="210">IMPS</text>
        <text x="266" y="210">UPI</text>
      </g>
    </Frame>
  );
}

export function GrowthInvestArt({ className }) {
  return (
    <Frame className={className}>
      {/* axes */}
      <line x1="40" y1="180" x2="290" y2="180" stroke="rgba(34,211,238,0.45)" />
      <line x1="40" y1="40" x2="40" y2="180" stroke="rgba(34,211,238,0.45)" />
      {/* bars */}
      {[
        [60, 55],
        [100, 80],
        [140, 65],
        [180, 95],
        [220, 75],
        [260, 115],
      ].map(([x, h], i) => (
        <g key={i}>
          <rect x={x} y={180 - h} width="22" height={h} rx="3" fill="url(#cyan-grad-soft)" opacity="0.9" />
          <rect x={x} y={180 - h} width="22" height="3" fill="white" opacity="0.6" />
        </g>
      ))}
      {/* trend line */}
      <polyline
        points="71,125 111,100 151,115 191,85 231,105 271,65"
        fill="none"
        stroke="#22d3ee"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {[71, 111, 151, 191, 231, 271].map((x, i) => (
        <circle key={i} cx={x} cy={[125, 100, 115, 85, 105, 65][i]} r="3.5" fill="white" stroke="#22d3ee" strokeWidth="1.5" />
      ))}
      {/* arrow */}
      <polygon points="282,60 282,72 295,65" fill="#22d3ee" />
      <text x="48" y="30" fill="rgba(255,255,255,0.8)" fontSize="11" fontWeight="700" fontFamily="sans-serif">
        Portfolio Growth
      </text>
      <text x="48" y="44" fill="rgba(34,211,238,0.9)" fontSize="9" fontFamily="monospace">
        +24.6% YoY
      </text>
    </Frame>
  );
}

export const BANKING_ART = {
  vault: DigitalVaultArt,
  card: SmartCardArt,
  mobile: MobileBankingArt,
  skyline: SkylineBankArt,
  transfer: SecureTransferArt,
  growth: GrowthInvestArt,
};
