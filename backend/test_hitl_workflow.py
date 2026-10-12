
from app.interrupt_store import InterruptStore


def create_test_review(tmp_path):
    store = InterruptStore(tmp_path / "test_reviews.db")
    review = store.create_review(
        query="Test PEP onboarding",
        context={"case_type": "pep_onboarding"},
    )
    return store, review["id"]


def test_pending_review_cannot_proceed(tmp_path):
    store, review_id = create_test_review(tmp_path)

    review = store.get_review(review_id)

    assert review["status"] == "pending"
    assert review["edd_status"] == "not_started"


def test_rejected_review_cannot_complete_edd(tmp_path):
    store, review_id = create_test_review(tmp_path)

    store.decide(
        review_id=review_id,
        decision="rejected",
        reviewer_id="test-officer",
        reason="Test rejection",
    )

    updated = store.update_edd_status(
        review_id=review_id,
        edd_status="completed",
    )

    assert updated is None


def test_approved_review_can_record_edd_completion(tmp_path):
    store, review_id = create_test_review(tmp_path)

    store.decide(
        review_id=review_id,
        decision="approved",
        reviewer_id="test-officer",
        reason="Test approval",
    )

    updated = store.update_edd_status(
        review_id=review_id,
        edd_status="completed",
    )

    assert updated is not None
    assert updated["status"] == "approved"
    assert updated["edd_status"] == "completed"


def test_invalid_edd_status_is_rejected(tmp_path):
    store, review_id = create_test_review(tmp_path)

    try:
        store.update_edd_status(
            review_id=review_id,
            edd_status="invalid",
        )
        assert False, "Expected ValueError for invalid EDD status"
    except ValueError:
        pass


def test_senior_approval_blocked_until_edd_completed(tmp_path):
    store, review_id = create_test_review(tmp_path)
    store.decide(review_id, "approved", "officer", "Initial approval")

    result = store.record_senior_approval(
        review_id, "approved", "senior", "Senior approval"
    )

    assert result is None


def test_senior_management_can_approve_after_edd(tmp_path):
    store, review_id = create_test_review(tmp_path)
    store.decide(review_id, "approved", "officer", "Initial approval")
    store.update_edd_status(review_id, "completed")

    result = store.record_senior_approval(
        review_id, "approved", "senior", "Senior approval"
    )

    assert result is not None
    assert result["senior_approval_status"] == "approved"
    assert result["senior_reviewer_id"] == "senior"


def test_senior_management_can_reject_after_edd(tmp_path):
    store, review_id = create_test_review(tmp_path)
    store.decide(review_id, "approved", "officer", "Initial approval")
    store.update_edd_status(review_id, "completed")

    result = store.record_senior_approval(
        review_id, "rejected", "senior", "Senior rejection"
    )

    assert result is not None
    assert result["senior_approval_status"] == "rejected"


def test_senior_decision_cannot_be_overwritten(tmp_path):
    store, review_id = create_test_review(tmp_path)
    store.decide(review_id, "approved", "officer", "Initial approval")
    store.update_edd_status(review_id, "completed")

    first = store.record_senior_approval(
        review_id, "approved", "senior", "First decision"
    )
    second = store.record_senior_approval(
        review_id, "rejected", "another-senior", "Second decision"
    )

    assert first is not None
    assert second is None

    saved = store.get_review(review_id)
    assert saved["senior_approval_status"] == "approved"
    assert saved["senior_reviewer_id"] == "senior"
