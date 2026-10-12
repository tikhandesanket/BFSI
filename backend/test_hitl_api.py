from fastapi.testclient import TestClient

from app.main import app, hitl_store

client = TestClient(app)


def create_approved_review():
    review = hitl_store.create_review(
        query="Test PEP onboarding",
        context={"case_type": "pep_onboarding"},
    )
    review = hitl_store.decide(
        review_id=review["id"],
        decision="approved",
        reviewer_id="initial-reviewer",
        reason="Approved for EDD",
    )
    assert review is not None
    return review["id"]


def test_senior_approval_blocked_until_edd_completed():
    review_id = create_approved_review()

    response = client.post(
        f"/human-reviews/{review_id}/senior-approval",
        json={
            "decision": "approved",
            "reviewer_id": "senior-reviewer",
            "reason": "Reviewed case",
        },
    )

    assert response.status_code == 409


def test_senior_approval_after_edd():
    review_id = create_approved_review()

    edd_response = client.post(
        f"/human-reviews/{review_id}/edd-completion"
    )
    assert edd_response.status_code == 200

    response = client.post(
        f"/human-reviews/{review_id}/senior-approval",
        json={
            "decision": "approved",
            "reviewer_id": "senior-reviewer",
            "reason": "EDD completed; approval recorded",
        },
    )

    assert response.status_code == 200
    assert response.json()["senior_approval_status"] == "approved"
    assert response.json()["can_proceed"] is False


def test_senior_rejection_stops_workflow():
    review_id = create_approved_review()

    client.post(f"/human-reviews/{review_id}/edd-completion")

    response = client.post(
        f"/human-reviews/{review_id}/senior-approval",
        json={
            "decision": "rejected",
            "reviewer_id": "senior-reviewer",
            "reason": "Senior management rejected the case",
        },
    )

    assert response.status_code == 200
    assert response.json()["workflow_status"] == "stopped"
    assert response.json()["can_proceed"] is False


def test_senior_decision_cannot_be_overwritten():
    review_id = create_approved_review()

    client.post(f"/human-reviews/{review_id}/edd-completion")

    payload = {
        "decision": "approved",
        "reviewer_id": "senior-reviewer",
        "reason": "Approved after EDD",
    }

    first_response = client.post(
        f"/human-reviews/{review_id}/senior-approval",
        json=payload,
    )
    assert first_response.status_code == 200

    payload["decision"] = "rejected"
    payload["reason"] = "Attempted second decision"

    second_response = client.post(
        f"/human-reviews/{review_id}/senior-approval",
        json=payload,
    )

    assert second_response.status_code == 409
