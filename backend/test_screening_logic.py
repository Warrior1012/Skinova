from services.screening_logic import assess_model_uncertainty, determine_screening_priority


def test_uncertain_distribution():
    result = assess_model_uncertainty([
        {"score": 42},
        {"score": 39},
        {"score": 10},
    ])
    assert result["status"] == "uncertain"


def test_usable_distribution():
    result = assess_model_uncertainty([
        {"score": 82},
        {"score": 8},
        {"score": 4},
    ])
    assert result["status"] == "usable"


def test_context_flip_lower():
    result = determine_screening_priority(
        [
            {"category": "change", "answer": "No"},
            {"category": "bleeding", "answer": "No"},
            {"category": "symptoms", "answer": "Neither"},
        ],
        {"status": "usable"},
    )
    assert result == "Lower"


def test_context_flip_higher():
    result = determine_screening_priority(
        [
            {"category": "change", "answer": "Yes"},
            {"category": "bleeding", "answer": "Yes"},
            {"category": "symptoms", "answer": "Pain"},
        ],
        {"status": "usable"},
    )
    assert result == "Higher"


def test_uncertain_overrides_context():
    result = determine_screening_priority(
        [
            {"category": "change", "answer": "Yes"},
            {"category": "bleeding", "answer": "Yes"},
        ],
        {"status": "uncertain"},
    )
    assert result == "Uncertain"
