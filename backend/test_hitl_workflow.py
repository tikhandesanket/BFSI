
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
