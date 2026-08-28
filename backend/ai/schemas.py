from typing import Literal
from pydantic import BaseModel, Field


class FollowUpQuestion(BaseModel):
    question_id: str = Field(description="Stable unique ID for this question")
    question: str = Field(description="Clear user-facing question")
    options: list[str] = Field(
        min_length=2,
        max_length=5,
        description="2-5 concise multiple-choice options"
    )
    category: str = Field(
        description="One of: duration, change, growth, bleeding, crusting, non_healing, symptoms, pain, itching, exposure, history, general"
    )
    reason: str = Field(
        description="Short internal reason explaining why this question is useful"
    )


class QuestionResponse(BaseModel):
    questions: list[FollowUpQuestion] = Field(
        min_length=4,
        max_length=7
    )


class EvidenceSource(BaseModel):
    id: str
    title: str
    url: str | None = None


class AssessmentResult(BaseModel):
    screening_priority: Literal["Lower", "Moderate", "Higher", "Uncertain"] = Field(
        description="Priority for professional evaluation; not a clinical risk score"
    )
    urgency: str = Field(
        description="Plain-language recommendation about how soon professional evaluation may be appropriate"
    )
    summary: str
    explanation: str
    key_factors: list[str]
    precautions: list[str]
    recommendation: str
    disclaimer: str
