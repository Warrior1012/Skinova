import os

from dotenv import load_dotenv
from google import genai
from google.genai import types

from ai.schemas import QuestionResponse, AssessmentResult
from ai.prompts import SYSTEM_INSTRUCTIONS


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, ".env"))

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY not found in backend/.env")

client = genai.Client(api_key=GEMINI_API_KEY)

# Gemini handles all generative reasoning in Skinova.
MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")


def generate_question_response(context: str) -> QuestionResponse:
    last_error = None

    for attempt in range(2):
        try:
            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=context,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_INSTRUCTIONS,
                    response_mime_type="application/json",
                    response_json_schema=QuestionResponse.model_json_schema(),
                    temperature=0.9 if attempt == 0 else 0.6,
                )
            )
            return QuestionResponse.model_validate_json(response.text)
        except Exception as exc:
            last_error = exc

    raise RuntimeError(f"Gemini question generation failed after retry: {last_error}")


def generate_final_assessment_response(
    context: str
) -> AssessmentResult:
    last_error = None

    for attempt in range(2):
        try:
            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=context,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_INSTRUCTIONS,
                    response_mime_type="application/json",
                    response_json_schema=AssessmentResult.model_json_schema(),
                    temperature=0.35 if attempt == 0 else 0.2,
                )
            )
            return AssessmentResult.model_validate_json(response.text)
        except Exception as exc:
            last_error = exc

    raise RuntimeError(f"Gemini final assessment failed after retry: {last_error}")
