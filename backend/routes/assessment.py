from fastapi import APIRouter, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from pydantic import BaseModel
from PIL import Image, UnidentifiedImageError
import cv2
import numpy as np
from uuid import uuid4

import os
import math
import requests
import secrets
import json
from datetime import datetime, timezone

from ai.rag.retriever import retrieve_medical_context

from services.screening_logic import (
    assess_model_uncertainty,
    determine_screening_priority
)

from services.ai_service import (
    generate_questions,
    generate_final_assessment
)

from services.ml_service import analyze_image
from ML.ML_Module.gradcam import generate_gradcam

from services.pdf_service import generate_pdf_report


router = APIRouter(
    prefix="/assessment",
    tags=["Assessment"]
)

ws_router = APIRouter(tags=["Realtime Consultation"])

active_ws_rooms = {}


# ============================================================
# TEMPORARY STORAGE
# ============================================================

assessments = {}
doctor_reviews = {}
chat_messages = {}
consultations = {}
home_consultations = {}
medicine_orders = {}

MEDICINES = [
    {
        "id": "med-001", "name": "Moisturizing Cream", "strength": "Fragrance-free",
        "form": "cream", "price": 299.0, "requires_prescription": False,
        "availability": "in_stock", "note": "General skin-care product; not a treatment for a diagnosed condition."
    },
    {
        "id": "med-002", "name": "Gentle Sunscreen SPF 50", "strength": "SPF 50+",
        "form": "lotion", "price": 449.0, "requires_prescription": False,
        "availability": "in_stock", "note": "Sun protection product."
    },
    {
        "id": "med-003", "name": "Prescription Dermatology Product (Demo)", "strength": "Doctor approval required",
        "form": "topical", "price": 599.0, "requires_prescription": True,
        "availability": "in_stock", "note": "Demo catalogue item. Requires clinician approval before ordering."
    },
]

UPLOAD_DIR = os.path.join(
    os.path.dirname(
        os.path.dirname(
            os.path.abspath(__file__)
        )
    ),
    "uploads"
)

MAX_UPLOAD_BYTES = 10 * 1024 * 1024

ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp"
}

os.makedirs(
    UPLOAD_DIR,
    exist_ok=True
)


# ============================================================
# ANSWER SCHEMA
# ============================================================

class AnswerRequest(BaseModel):
    question_id: str
    answer: str


# ============================================================
# DISTANCE HELPER
# ============================================================

def calculate_distance_km(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float
) -> float:

    earth_radius_km = 6371.0

    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)

    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_lat / 2) ** 2
        +
        math.cos(lat1_rad)
        * math.cos(lat2_rad)
        * math.sin(delta_lon / 2) ** 2
    )

    c = 2 * math.atan2(
        math.sqrt(a),
        math.sqrt(1 - a)
    )

    return earth_radius_km * c


# ============================================================
# SOURCE URL HELPER
# ============================================================

def _extract_source_url(text: str):

    for line in text.splitlines():

        line = line.strip()

        if (
            line.startswith("http://")
            or line.startswith("https://")
        ):
            return line

    return None


# ============================================================
# SAFETY ESCALATION ENGINE
# ============================================================

def determine_safety_escalation(
    enriched_answers,
    uncertainty
):
    """
    Safety-oriented workflow safeguard.

    IMPORTANT:
    This is NOT a clinically validated triage model.
    It must never be represented as a medical diagnosis,
    cancer probability, or clinically validated risk score.
    """

    concerning_signals = []

    for item in enriched_answers:

        question = str(
            item.get("question", "")
        ).lower()

        answer = str(
            item.get("answer", "")
        ).strip().lower()

        if not answer:
            continue

        # ----------------------------------------------------
        # Recent change / growth
        # ----------------------------------------------------

        if any(
            keyword in question
            for keyword in [
                "change",
                "changed",
                "growth",
                "growing",
                "size",
                "shape",
                "colour",
                "color"
            ]
        ):

            if answer in {
                "yes",
                "yes, recently",
                "yes - recently",
                "recently changed",
                "growing",
                "rapidly growing"
            }:
                concerning_signals.append(
                    "Recent change or growth reported"
                )

        # ----------------------------------------------------
        # Bleeding / crusting
        # ----------------------------------------------------

        if any(
            keyword in question
            for keyword in [
                "bleed",
                "bleeding",
                "crust",
                "crusted"
            ]
        ):

            if any(
                keyword in answer
                for keyword in [
                    "yes",
                    "bleed",
                    "bleeding",
                    "crust"
                ]
            ):

                concerning_signals.append(
                    "Bleeding or repeated crusting reported"
                )

        # ----------------------------------------------------
        # Non-healing
        # ----------------------------------------------------

        if any(
            keyword in question
            for keyword in [
                "heal",
                "healing",
                "wound"
            ]
        ):

            if any(
                keyword in answer
                for keyword in [
                    "yes",
                    "not healing",
                    "non-healing",
                    "doesn't heal",
                    "does not heal"
                ]
            ):

                concerning_signals.append(
                    "Non-healing feature reported"
                )

        # ----------------------------------------------------
        # Itching / pain
        # ----------------------------------------------------

        if any(
            keyword in question
            for keyword in [
                "itch",
                "itching",
                "pain",
                "painful"
            ]
        ):

            if any(
                keyword in answer
                for keyword in [
                    "itch",
                    "itching",
                    "pain",
                    "painful",
                    "both"
                ]
            ):

                concerning_signals.append(
                    "Itching or pain reported"
                )

    # Remove duplicates while preserving order
    concerning_signals = list(
        dict.fromkeys(concerning_signals)
    )

    uncertainty_status = (
        uncertainty or {}
    ).get("status", "")
    
    uncertainty_status = str(
        uncertainty_status
    ).lower()

    # --------------------------------------------------------
    # Visual uncertainty gets highest safety priority
    # --------------------------------------------------------

    if uncertainty_status == "uncertain":

        return {
            "status": "INSUFFICIENT INFORMATION",
            "level": "uncertain",
            "message": (
                "The visual model is uncertain. "
                "Do not rely on this result alone. "
                "Consider providing a clearer image or "
                "seeking professional evaluation."
            ),
            "signals": len(concerning_signals),
            "signal_details": concerning_signals
        }

    # --------------------------------------------------------
    # Multiple concerning signals
    # --------------------------------------------------------

    if len(concerning_signals) >= 2:

        return {
            "status": "PRIORITY EVALUATION",
            "level": "high",
            "message": (
                "Multiple potentially concerning features "
                "were reported. Professional evaluation "
                "is recommended."
            ),
            "signals": len(concerning_signals),
            "signal_details": concerning_signals
        }

    # --------------------------------------------------------
    # One concerning signal
    # --------------------------------------------------------

    if len(concerning_signals) == 1:

        return {
            "status": "REVIEW RECOMMENDED",
            "level": "moderate",
            "message": (
                "A potentially concerning feature was "
                "reported. Consider professional evaluation."
            ),
            "signals": 1,
            "signal_details": concerning_signals
        }

    # --------------------------------------------------------
    # No additional escalation signal
    # --------------------------------------------------------

    return {
        "status": "LOWER PRIORITY",
        "level": "lower",
        "message": (
            "No additional escalation signal was identified "
            "from the information provided."
        ),
        "signals": 0,
        "signal_details": []
    }



# ============================================================
# GEMINI HELPERS FOR NEW CARE FEATURES
# ============================================================

def _gemini_json(prompt: str):
    """Best-effort Gemini JSON call. Returns None when unavailable."""
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return None
    try:
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.2,
                response_mime_type="application/json"
            )
        )
        text = getattr(response, "text", None)
        if not text:
            return None
        return json.loads(text)
    except Exception:
        return None


def _fallback_agreement(ai_summary: str, doctor_summary: str):
    """Transparent lexical fallback when Gemini is unavailable."""
    import re
    stop = {
        "the", "and", "with", "that", "this", "from", "for", "into", "are",
        "was", "has", "have", "not", "but", "may", "can", "should", "skin",
        "lesion", "patient", "assessment", "summary", "possible"
    }
    def words(text):
        return {w for w in re.findall(r"[a-zA-Z]{4,}", text.lower()) if w not in stop}
    a, d = words(ai_summary), words(doctor_summary)
    lexical = 0 if not a or not d else int(round(100 * len(a & d) / max(1, len(a | d))))
    score = max(35, min(92, lexical + 35))
    label = "High agreement" if score >= 75 else "Moderate agreement" if score >= 55 else "Low agreement"
    return {
        "score": score,
        "label": label,
        "dimensions": {"assessment": score, "risk": score, "findings": score, "recommendation": score},
        "explanation": "Agreement is a prototype comparison signal and is not a measure of diagnostic accuracy or clinical correctness.",
        "ai_generated": False
    }


def _calculate_agreement(ai_summary: str, doctor_summary: str):
    prompt = f"""
You are evaluating agreement between an AI screening summary and a clinician's summary.
Do NOT decide which is medically correct. Do NOT diagnose. Measure only semantic agreement.
Return JSON with integer 0-100 values for assessment, risk, findings, recommendation, plus score,
label, and a one-sentence explanation. Labels: High agreement, Moderate agreement, Low agreement.
AI SUMMARY:\n{ai_summary}\n\nDOCTOR SUMMARY:\n{doctor_summary}
"""
    result = _gemini_json(prompt)
    if isinstance(result, dict):
        try:
            dims = result.get("dimensions", {})
            score = int(max(0, min(100, result.get("score", 0))))
            return {
                "score": score,
                "label": result.get("label") or ("High agreement" if score >= 75 else "Moderate agreement" if score >= 55 else "Low agreement"),
                "dimensions": {
                    "assessment": int(max(0, min(100, dims.get("assessment", score)))),
                    "risk": int(max(0, min(100, dims.get("risk", score)))),
                    "findings": int(max(0, min(100, dims.get("findings", score)))),
                    "recommendation": int(max(0, min(100, dims.get("recommendation", score))))
                },
                "explanation": str(result.get("explanation", "Semantic agreement only; not clinical correctness.")),
                "ai_generated": True
            }
        except Exception:
            pass
    return _fallback_agreement(ai_summary, doctor_summary)


def _ai_chat(message: str, language: str, assessment_context: str = ""):
    prompt = f"""
You are Skinova, a cautious skin-health screening assistant.
Respond in {"Hindi" if language == "hi" else "English"}.
The user is asking: {message}
Context: {assessment_context}
Return JSON: {{"reply": string, "summary": string}}.
Rules: never diagnose, never prescribe medicine, never claim image confidence is disease probability,
and recommend professional evaluation when concerning or uncertain. Keep the response concise and useful.
"""
    result = _gemini_json(prompt)
    if isinstance(result, dict) and result.get("reply"):
        return {"reply": str(result["reply"]), "summary": str(result.get("summary", ""))}
    if language == "hi":
        return {
            "reply": "Main screening information samjha sakta hoon, lekin diagnosis ya prescription nahi de sakta. Agar lesion badal raha hai, bleeding ho rahi hai, ya aapko concern hai, dermatologist se evaluation karayein.",
            "summary": "User requested multilingual skin-health guidance."
        }
    return {
        "reply": "I can explain screening information, but I cannot diagnose or prescribe. If the lesion is changing, bleeding, or concerning, seek professional dermatology evaluation.",
        "summary": "User requested skin-health screening guidance."
    }

# ============================================================
# START ASSESSMENT
# ============================================================

@router.post("/start")
def start_assessment():

    assessment_id = str(uuid4())

    assessments[assessment_id] = {

        "image_path": None,

        "ml_result": None,

        "answers": {},

        "questions": [],

        "final_result": None,

        "medical_sources": [],

        "image_quality": None,

        "safety_escalation": None,
        "ai_summary": None,
        "doctor_summary": None,
        "agreement": None,

        "question_variation_token": (
            secrets.token_hex(8)
        )
    }

    return {
        "assessment_id": assessment_id
    }


# ============================================================
# UPLOAD IMAGE + ML ANALYSIS
# ============================================================

@router.post("/{assessment_id}/image")
async def upload_image(
    assessment_id: str,
    file: UploadFile = File(...)
):

    if assessment_id not in assessments:

        raise HTTPException(
            status_code=404,
            detail="Assessment not found"
        )

    if file.content_type not in ALLOWED_IMAGE_TYPES:

        raise HTTPException(
            status_code=400,
            detail=(
                "Only JPG, PNG, and WebP images "
                "are supported"
            )
        )

    safe_filename = os.path.basename(
        file.filename or "image.jpg"
    )

    extension = os.path.splitext(
        safe_filename
    )[1].lower()

    if extension not in {
        ".jpg",
        ".jpeg",
        ".png",
        ".webp"
    }:

        extension = ".jpg"

    file_path = os.path.join(
        UPLOAD_DIR,
        f"{assessment_id}{extension}"
    )

    total_bytes = 0

    try:

        with open(
            file_path,
            "wb"
        ) as buffer:

            while True:

                chunk = await file.read(
                    1024 * 1024
                )

                if not chunk:
                    break

                total_bytes += len(chunk)

                if total_bytes > MAX_UPLOAD_BYTES:

                    buffer.close()

                    if os.path.exists(
                        file_path
                    ):
                        os.remove(file_path)

                    raise HTTPException(
                        status_code=413,
                        detail=(
                            "Image exceeds the "
                            "10 MB upload limit"
                        )
                    )

                buffer.write(chunk)

        # Verify actual image contents
        try:

            with Image.open(
                file_path
            ) as image:

                image.verify()

            with Image.open(
                file_path
            ) as image:

                image.convert(
                    "RGB"
                ).load()

        except (
            UnidentifiedImageError,
            OSError,
            ValueError
        ):

            if os.path.exists(
                file_path
            ):
                os.remove(file_path)

            raise HTTPException(
                status_code=400,
                detail=(
                    "The uploaded file is not "
                    "a valid readable image"
                )
            )

    except HTTPException:
        raise

    except Exception as e:

        if os.path.exists(
            file_path
        ):
            os.remove(file_path)

        raise HTTPException(
            status_code=500,
            detail=(
                f"Failed to save image: {str(e)}"
            )
        )

    assessments[
        assessment_id
    ]["image_path"] = file_path

    try:

        ml_result = analyze_image(
            file_path
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=(
                f"ML analysis failed: {str(e)}"
            )
        )

    ml_result["uncertainty"] = (
        assess_model_uncertainty(
            ml_result.get(
                "distribution",
                []
            )
        )
    )

    # --------------------------------------------------------
    # Grad-CAM
    # --------------------------------------------------------

    try:

        gradcam = generate_gradcam(
            file_path
        )

        ml_result[
            "gradcam_path"
        ] = gradcam.get(
            "heatmap_path"
        )

        ml_result[
            "gradcam_target_layer"
        ] = gradcam.get(
            "target_layer"
        )

    except Exception as exc:

        ml_result[
            "gradcam_path"
        ] = None

        ml_result[
            "gradcam_error"
        ] = str(exc)

    assessments[
        assessment_id
    ]["ml_result"] = ml_result

    return {
        "message": (
            "Image analyzed successfully"
        ),
        "ml_result": ml_result
    }


# ============================================================
# GENERATE DYNAMIC QUESTIONS
# ============================================================

@router.get("/{assessment_id}/questions")
def get_questions(
    assessment_id: str
):

    if assessment_id not in assessments:

        raise HTTPException(
            status_code=404,
            detail="Assessment not found"
        )

    assessment = assessments[
        assessment_id
    ]

    if assessment["ml_result"] is None:

        raise HTTPException(
            status_code=400,
            detail=(
                "Upload and analyze an image first"
            )
        )

    # Generate only once per assessment
    if assessment["questions"]:

        return {
            "questions":
                assessment["questions"]
        }

    context = f"""
Skinova screening assessment.

VARIATION TOKEN:
{assessment["question_variation_token"]}

ML MODEL RESULT:
{assessment["ml_result"]}

USER INFORMATION / ANSWERS:
{assessment["answers"]}

PREVIOUS QUESTIONS:
{assessment["questions"]}

Generate a fresh set of 4 to 7 high-value
follow-up questions.

IMPORTANT:

- All questions MUST be multiple-choice.
- Each question MUST have 2 to 5 concise options.
- Do not generate free-text questions.
- Dynamically choose which questions are most useful
  from available clinical-context categories.
- Vary question selection, ordering, and option ordering
  using the variation token.
- Do not repeat answered questions.
- Include "Not sure" where appropriate.
- Do not treat the ML prediction as a confirmed diagnosis.
- Do not anchor every question around the predicted class.
- Questions must be understandable to a normal user.
"""

    try:

        questions = generate_questions(
            context
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=(
                f"AI question generation failed: {str(e)}"
            )
        )

    rng = secrets.SystemRandom()

    generated_questions = []

    for question in questions.questions:

        options = list(
            question.options
        )

        rng.shuffle(options)

        generated_questions.append({

            "question_id":
                question.question_id,

            "question":
                question.question,

            "category":
                question.category,

            "options":
                options
        })

    rng.shuffle(
        generated_questions
    )

    assessments[
        assessment_id
    ]["questions"] = generated_questions

    return {
        "questions":
            assessments[
                assessment_id
            ]["questions"]
    }


# ============================================================
# SUBMIT USER ANSWER
# ============================================================

@router.post("/{assessment_id}/answer")
def submit_answer(
    assessment_id: str,
    request: AnswerRequest
):

    if assessment_id not in assessments:

        raise HTTPException(
            status_code=404,
            detail="Assessment not found"
        )

    assessment = assessments[
        assessment_id
    ]

    if assessment["ml_result"] is None:

        raise HTTPException(
            status_code=400,
            detail=(
                "Upload and analyze an image first"
            )
        )

    question = next(
        (
            q
            for q in assessment.get(
                "questions",
                []
            )
            if q.get(
                "question_id"
            ) == request.question_id
        ),
        None
    )

    if question is None:

        raise HTTPException(
            status_code=400,
            detail="Invalid question ID"
        )

    if request.answer not in question.get(
        "options",
        []
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "Answer must match one "
                "of the provided options"
            )
        )

    assessment[
        "answers"
    ][request.question_id] = (
        request.answer
    )

    return {
        "message": "Answer saved",
        "question_id":
            request.question_id
    }


# ============================================================
# GENERATE FINAL AI ASSESSMENT
# ============================================================

@router.get("/{assessment_id}/result")
def get_result(
    assessment_id: str
):

    if assessment_id not in assessments:

        raise HTTPException(
            status_code=404,
            detail="Assessment not found"
        )

    assessment = assessments[
        assessment_id
    ]

    if assessment["ml_result"] is None:

        raise HTTPException(
            status_code=400,
            detail=(
                "Upload and analyze an image first"
            )
        )

    questions = assessment.get(
        "questions",
        []
    )

    if not questions:

        raise HTTPException(
            status_code=400,
            detail=(
                "Assessment questions "
                "have not been generated"
            )
        )

    required_ids = {
        q["question_id"]
        for q in questions
    }

    answered_ids = set(
        assessment["answers"].keys()
    )

    if required_ids != answered_ids:

        missing = sorted(
            required_ids -
            answered_ids
        )

        raise HTTPException(
            status_code=400,
            detail=(
                "Please answer all questions "
                f"before viewing the result. "
                f"Missing: {missing}"
            )
        )

    # --------------------------------------------------------
    # Enriched answers
    # --------------------------------------------------------

    enriched_answers = []

    for q in questions:

        enriched_answers.append({

            "question_id":
                q["question_id"],

            "question":
                q["question"],

            "category":
                q.get(
                    "category",
                    "general"
                ),

            "answer":
                assessment[
                    "answers"
                ][
                    q["question_id"]
                ]
        })

    # ========================================================
    # RAG
    # ========================================================

    rag_query = f"""
Skin screening assessment.

ML MODEL RESULT:
{assessment["ml_result"]}

USER ANSWERS:
{enriched_answers}

Find the most relevant medical information
for evaluating this screening situation.

Focus on:

- warning signs
- relevant risk factors
- reported symptoms
- appropriate professional evaluation
- information useful for interpreting the
  screening result

Do not assume the ML prediction
is a confirmed diagnosis.
"""

    try:

        retrieved = retrieve_medical_context(
            rag_query,
            top_k=3
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=(
                "Medical information retrieval failed: "
                f"{str(e)}"
            )
        )

    medical_context = "\n\n".join(
        [
            f"""
SOURCE:
{item["id"]}

{item["text"]}
"""
            for item in retrieved
        ]
    )

    assessment[
        "medical_sources"
    ] = [

        {
            "id":
                item["id"],

            "title":
                item["id"]
                .replace(".txt", "")
                .replace("_", " ")
                .title(),

            "score":
                round(
                    item["score"],
                    4
                ),

            "url":
                _extract_source_url(
                    item["text"]
                )
        }

        for item in retrieved
    ]

    # ========================================================
    # DETERMINISTIC PRIORITY
    # ========================================================

    deterministic_priority = (
        determine_screening_priority(
            enriched_answers,
            assessment[
                "ml_result"
            ].get(
                "uncertainty",
                {}
            )
        )
    )

    # ========================================================
    # SAFETY ESCALATION
    # ========================================================

    safety_escalation = (
        determine_safety_escalation(
            enriched_answers,
            assessment[
                "ml_result"
            ].get(
                "uncertainty",
                {}
            )
        )
    )

    assessment[
        "safety_escalation"
    ] = safety_escalation

    # ========================================================
    # FINAL GEMINI CONTEXT
    # ========================================================

    context = f"""
Skinova final screening assessment.

ML MODEL RESULT:
{assessment["ml_result"]}

DETERMINISTIC SCREENING PRIORITY SIGNAL:
{deterministic_priority}

SAFETY ESCALATION GUARDRAIL:
{safety_escalation}

USER ANSWERS:
{enriched_answers}

RETRIEVED MEDICAL INFORMATION:
{medical_context}

Use the retrieved medical information
as supporting evidence.

IMPORTANT RULES:

- Do not diagnose the user.
- Do not treat the ML prediction as confirmed disease.
- Do not interpret ML confidence as disease probability.
- Do not invent medical facts.
- Do not invent symptoms or medical history.
- Use the user's answers as patient-provided information.
- Clearly communicate uncertainty.
- Recommend appropriate professional evaluation when warranted.
- Treat the deterministic screening-priority signal
  as a guardrail, not as a clinically validated score.
- Do not invent a numerical risk probability.
- If the model is uncertain, do not downgrade
  that uncertainty merely because user context
  appears reassuring.
- Do not prescribe medication.
- Do not recommend invasive treatment.
- Keep the result understandable to a normal user.

SAFETY ESCALATION RULE:

The safety escalation result is a workflow safeguard,
NOT a clinically validated triage model.

If it recommends professional evaluation,
do not contradict it with reassuring language.

Do not convert the escalation level into
a medical probability.

Generate the final screening assessment.
"""

    try:

        result = generate_final_assessment(
            context
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=(
                f"Final AI assessment failed: {str(e)}"
            )
        )

    final_result = result.model_dump()

    assessment[
        "final_result"
    ] = final_result
    assessment["ai_summary"] = (
        final_result.get("summary")
        or final_result.get("explanation")
        or "AI screening summary generated from the image, answers and retrieved information."
    )

    # ========================================================
    # GENERATE PDF
    # ========================================================

    try:

        pdf_path = generate_pdf_report(
            assessment_id=assessment_id,
            ml_result=assessment[
                "ml_result"
            ],
            answers=enriched_answers,
            final_result=final_result,
            sources=assessment[
                "medical_sources"
            ]
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=(
                f"PDF generation failed: {str(e)}"
            )
        )

    # ========================================================
    # FINAL RESPONSE
    # ========================================================

    return {

        "assessment":
            final_result,

        "ml_result":
            assessment[
                "ml_result"
            ],

        "model_uncertainty":
            assessment[
                "ml_result"
            ].get(
                "uncertainty"
            ),

        "gradcam_url": (

            "/media/"
            +
            os.path.basename(
                assessment[
                    "ml_result"
                ][
                    "gradcam_path"
                ]
            )

            if assessment[
                "ml_result"
            ].get(
                "gradcam_path"
            )

            else None
        ),

        "medical_sources":
            assessment[
                "medical_sources"
            ],

        "safety_escalation":
            assessment[
                "safety_escalation"
            ],

        "ai_summary": assessment.get("ai_summary"),
        "doctor_summary": assessment.get("doctor_summary"),
        "agreement": assessment.get("agreement"),

        "image_quality":
            assessment.get(
                "image_quality"
            ),

        "pdf_available":
            True,

        "pdf_url":
            (
                f"/assessment/"
                f"{assessment_id}"
                f"/report"
            )
    }


# ============================================================
# NEARBY HOSPITALS / CLINICS
# ============================================================

@router.get("/hospitals")
def get_nearby_hospitals(
    lat: float,
    lng: float
):

    if not (-90 <= lat <= 90):

        raise HTTPException(
            status_code=400,
            detail="Invalid latitude"
        )

    if not (-180 <= lng <= 180):

        raise HTTPException(
            status_code=400,
            detail="Invalid longitude"
        )

    query = f"""
[out:json][timeout:20];

(
  node["amenity"="hospital"](around:5000,{lat},{lng});
  way["amenity"="hospital"](around:5000,{lat},{lng});
  relation["amenity"="hospital"](around:5000,{lat},{lng});

  node["healthcare"="clinic"](around:5000,{lat},{lng});
  way["healthcare"="clinic"](around:5000,{lat},{lng});
  relation["healthcare"="clinic"](around:5000,{lat},{lng});

  node["healthcare"="doctor"]["healthcare:speciality"="dermatology"](around:5000,{lat},{lng});
  way["healthcare"="doctor"]["healthcare:speciality"="dermatology"](around:5000,{lat},{lng});
  relation["healthcare"="doctor"]["healthcare:speciality"="dermatology"](around:5000,{lat},{lng});

  node["amenity"="doctors"]["healthcare:speciality"="dermatology"](around:5000,{lat},{lng});
  way["amenity"="doctors"]["healthcare:speciality"="dermatology"](around:5000,{lat},{lng});
);

out center tags;
"""

    try:

        response = requests.post(
            "https://overpass-api.de/api/interpreter",
            data=query,
            timeout=25
        )

        response.raise_for_status()

        data = response.json()

    except requests.RequestException as e:

        raise HTTPException(
            status_code=502,
            detail=(
                "Nearby healthcare service unavailable: "
                f"{str(e)}"
            )
        )

    places = []
    seen_names = set()

    for element in data.get(
        "elements",
        []
    ):

        tags = element.get(
            "tags",
            {}
        )

        name = tags.get(
            "name"
        )

        if not name:
            continue

        normalized_name = (
            name.strip().lower()
        )

        if normalized_name in seen_names:
            continue

        seen_names.add(
            normalized_name
        )

        if (
            element.get("lat") is not None
            and
            element.get("lon") is not None
        ):

            place_lat = element["lat"]
            place_lng = element["lon"]

        else:

            center = element.get(
                "center",
                {}
            )

            place_lat = center.get(
                "lat"
            )

            place_lng = center.get(
                "lon"
            )

        if (
            place_lat is None
            or
            place_lng is None
        ):
            continue

        distance_km = calculate_distance_km(
            lat,
            lng,
            place_lat,
            place_lng
        )

        address_parts = [
            tags.get(
                "addr:housenumber"
            ),
            tags.get(
                "addr:street"
            ),
            tags.get(
                "addr:suburb"
            ),
            tags.get(
                "addr:city"
            )
        ]

        address = ", ".join(
            part
            for part in address_parts
            if part
        )

        speciality = (
            tags.get(
                "healthcare:speciality",
                ""
            )
            or ""
        ).lower()

        healthcare_type = (
            tags.get(
                "healthcare",
                ""
            )
            or ""
        ).lower()

        amenity = (
            tags.get(
                "amenity",
                ""
            )
            or ""
        ).lower()

        is_dermatology = (
            "dermat" in speciality
            or
            "dermat" in name.lower()
        )

        place_type = (
            "Dermatology"
            if is_dermatology
            else (
                "Hospital"
                if amenity == "hospital"
                else "Clinic"
            )
        )

        places.append({

            "name":
                name.strip(),

            "address":
                (
                    address
                    if address
                    else "Address unavailable"
                ),

            "distance":
                f"{distance_km:.1f} km",

            "rating":
                None,

            "type":
                place_type,

            "url":
                (
                    "https://www.google.com/maps/search/"
                    "?api=1"
                    f"&query={place_lat},{place_lng}"
                ),

            "_distance_km":
                distance_km
        })

    places.sort(
        key=lambda item:
            item["_distance_km"]
    )

    for place in places:

        place.pop(
            "_distance_km",
            None
        )

    return {
        "places":
            places[:10]
    }


# ============================================================
# DOWNLOAD PDF REPORT
# ============================================================

@router.get("/{assessment_id}/report")
def download_report(
    assessment_id: str
):

    if assessment_id not in assessments:

        raise HTTPException(
            status_code=404,
            detail="Assessment not found"
        )

    assessment = assessments[
        assessment_id
    ]

    if assessment[
        "final_result"
    ] is None:

        raise HTTPException(
            status_code=400,
            detail=(
                "Generate the final assessment first"
            )
        )

    try:

        pdf_path = generate_pdf_report(
            assessment_id=assessment_id,
            ml_result=assessment[
                "ml_result"
            ],
            answers=assessment[
                "answers"
            ],
            final_result=assessment[
                "final_result"
            ],
            sources=assessment.get(
                "medical_sources",
                []
            )
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=(
                f"PDF generation failed: {str(e)}"
            )
        )

    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=(
            f"Skinova_Report_"
            f"{assessment_id}.pdf"
        )
    )


# ============================================================
# IMAGE QUALITY ANALYSIS
# ============================================================

@router.post("/{assessment_id}/quality")
async def check_image_quality(
    assessment_id: str,
    file: UploadFile = File(...)
):

    if assessment_id not in assessments:

        raise HTTPException(
            status_code=404,
            detail="Assessment not found"
        )

    if file.content_type not in ALLOWED_IMAGE_TYPES:

        raise HTTPException(
            status_code=400,
            detail=(
                "Only JPG, PNG, and WebP images "
                "are supported"
            )
        )

    data = await file.read()

    if len(data) > MAX_UPLOAD_BYTES:

        raise HTTPException(
            status_code=413,
            detail=(
                "Image exceeds the 10 MB limit"
            )
        )

    np_image = np.frombuffer(
        data,
        np.uint8
    )

    image = cv2.imdecode(
        np_image,
        cv2.IMREAD_COLOR
    )

    if image is None:

        raise HTTPException(
            status_code=400,
            detail="Invalid image"
        )

    gray = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2GRAY
    )

    # --------------------------------------------------------
    # SHARPNESS
    # --------------------------------------------------------

    blur_score = float(
        cv2.Laplacian(
            gray,
            cv2.CV_64F
        ).var()
    )

    if blur_score >= 180:

        sharpness_score = 100

    elif blur_score <= 30:

        sharpness_score = 20

    else:

        sharpness_score = (
            20
            +
            (
                (blur_score - 30)
                / 150
            )
            * 80
        )

    sharpness_score = max(
        0,
        min(
            100,
            sharpness_score
        )
    )

    # --------------------------------------------------------
    # BRIGHTNESS
    # --------------------------------------------------------

    brightness = float(
        np.mean(gray)
    )

    brightness_distance = abs(
        brightness - 128
    )

    brightness_score = max(
        0,
        100 -
        (
            brightness_distance
            / 128
        ) * 100
    )

    # --------------------------------------------------------
    # RESOLUTION
    # --------------------------------------------------------

    width = image.shape[1]
    height = image.shape[0]

    pixels = width * height

    if pixels >= 1920 * 1080:

        resolution_score = 100

    elif pixels >= 1280 * 720:

        resolution_score = 90

    elif pixels >= 800 * 600:

        resolution_score = 75

    elif pixels >= 500 * 500:

        resolution_score = 55

    else:

        resolution_score = 25

    # --------------------------------------------------------
    # ISSUES
    # --------------------------------------------------------

    issues = []

    if blur_score < 80:

        issues.append(
            "Image appears blurry. "
            "Try holding the camera steady."
        )

    if brightness < 55:

        issues.append(
            "Image appears too dark. "
            "Use better lighting."
        )

    if brightness > 220:

        issues.append(
            "Image appears overexposed. "
            "Avoid direct harsh lighting."
        )

    if width < 224 or height < 224:

        issues.append(
            "Image resolution is too low "
            "for reliable analysis."
        )

    # --------------------------------------------------------
    # OVERALL QUALITY SCORE
    # --------------------------------------------------------

    quality_score = round(
        (
            sharpness_score * 0.45
            +
            brightness_score * 0.30
            +
            resolution_score * 0.25
        )
    )

    quality_score = max(
        0,
        min(
            100,
            quality_score
        )
    )

    quality = (
        "good"
        if quality_score >= 70
        else "needs_improvement"
    )

    result = {

        "quality":
            quality,

        "quality_score":
            quality_score,

        "blur_score":
            round(
                blur_score,
                2
            ),

        "sharpness_score":
            round(
                sharpness_score
            ),

        "brightness":
            round(
                brightness,
                2
            ),

        "brightness_score":
            round(
                brightness_score
            ),

        "resolution_score":
            round(
                resolution_score
            ),

        "resolution": {
            "width":
                width,
            "height":
                height
        },

        "issues":
            issues
    }

    assessments[
        assessment_id
    ][
        "image_quality"
    ] = result

    return result

# ============================================================
# AI SUMMARY / DOCTOR SUMMARY / AGREEMENT
# ============================================================

class DoctorSummaryRequest(BaseModel):
    doctor_name: str
    specialty: str = "Dermatology"
    summary: str
    recommendation: str = ""

@router.post("/{assessment_id}/doctor-summary")
def save_doctor_summary(assessment_id: str, request: DoctorSummaryRequest):
    if assessment_id not in assessments:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if not request.summary.strip():
        raise HTTPException(status_code=400, detail="Doctor summary cannot be empty")
    review = {
        "doctor_name": request.doctor_name.strip() or "Consulting doctor",
        "specialty": request.specialty.strip() or "Dermatology",
        "summary": request.summary.strip(),
        "recommendation": request.recommendation.strip(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    assessments[assessment_id]["doctor_summary"] = review
    doctor_reviews[assessment_id] = review
    return review

@router.get("/{assessment_id}/agreement")
def get_agreement(assessment_id: str):
    if assessment_id not in assessments:
        raise HTTPException(status_code=404, detail="Assessment not found")
    assessment = assessments[assessment_id]
    if not assessment.get("ai_summary"):
        final = assessment.get("final_result") or {}
        assessment["ai_summary"] = final.get("summary") or final.get("explanation", "")
    if not assessment.get("doctor_summary"):
        raise HTTPException(status_code=400, detail="Doctor summary is required before calculating agreement")
    agreement = _calculate_agreement(
        str(assessment.get("ai_summary", "")),
        str(assessment["doctor_summary"].get("summary", ""))
    )
    assessment["agreement"] = agreement
    return agreement

# ============================================================
# MULTILINGUAL CHAT
# ============================================================

class ChatRequest(BaseModel):
    message: str
    language: str = "en"
    assessment_id: str | None = None

@router.post("/chat/message")
def chat_message(request: ChatRequest):
    language = request.language.lower()
    if language not in {"hi", "en"}:
        raise HTTPException(status_code=400, detail="Language must be 'hi' or 'en'")
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    context = ""
    if request.assessment_id and request.assessment_id in assessments:
        a = assessments[request.assessment_id]
        context = str({"ai_summary": a.get("ai_summary"), "doctor_summary": a.get("doctor_summary"), "safety": a.get("safety_escalation")})
    answer = _ai_chat(request.message.strip(), language, context)
    chat_messages.setdefault(request.assessment_id or "general", []).append({
        "sender": "patient", "text": request.message.strip(), "language": language, "created_at": datetime.now(timezone.utc).isoformat()
    })
    chat_messages.setdefault(request.assessment_id or "general", []).append({
        "sender": "ai", "text": answer["reply"], "language": language, "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"language": language, **answer}

# ============================================================
# MEDICINE CATALOGUE + ORDERING (PROTOTYPE INTEGRATION)
# ============================================================

@router.get("/medicines")
def list_medicines(q: str = ""):
    query = q.strip().lower()
    items = [m for m in MEDICINES if not query or query in m["name"].lower() or query in m["form"].lower()]
    return {"medicines": items}

class OrderItem(BaseModel):
    medicine_id: str
    quantity: int = 1

class OrderRequest(BaseModel):
    items: list[OrderItem]
    address: str
    assessment_id: str | None = None
    doctor_approved: bool = False

@router.post("/orders")
def place_order(request: OrderRequest):
    if not request.items:
        raise HTTPException(status_code=400, detail="Order must contain at least one item")
    if not request.address.strip():
        raise HTTPException(status_code=400, detail="Delivery address is required")
    total = 0.0
    normalized = []
    for item in request.items:
        if item.quantity < 1 or item.quantity > 20:
            raise HTTPException(status_code=400, detail="Quantity must be between 1 and 20")
        med = next((m for m in MEDICINES if m["id"] == item.medicine_id), None)
        if not med:
            raise HTTPException(status_code=404, detail=f"Medicine {item.medicine_id} not found")
        if med["availability"] != "in_stock":
            raise HTTPException(status_code=409, detail=f"{med['name']} is currently out of stock")
        if med["requires_prescription"] and not request.doctor_approved:
            raise HTTPException(status_code=403, detail=f"{med['name']} requires doctor approval before ordering")
        total += med["price"] * item.quantity
        normalized.append({"medicine_id": item.medicine_id, "quantity": item.quantity})
    order_id = f"ORD-{uuid4().hex[:10].upper()}"
    order = {
        "id": order_id, "items": normalized, "total": round(total, 2), "status": "placed",
        "address": request.address.strip(), "created_at": datetime.now(timezone.utc).isoformat()
    }
    medicine_orders[order_id] = order
    return order

@router.get("/orders/{order_id}")
def get_order(order_id: str):
    order = medicine_orders.get(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

# ============================================================
# HOME DOCTOR CONSULTATION
# ============================================================

class HomeConsultationRequest(BaseModel):
    patient_name: str
    address: str
    date: str
    time: str
    reason: str
    assessment_id: str | None = None

@router.post("/home-consultations")
def create_home_consultation(request: HomeConsultationRequest):
    if not all([request.patient_name.strip(), request.address.strip(), request.date.strip(), request.time.strip(), request.reason.strip()]):
        raise HTTPException(status_code=400, detail="All home consultation fields are required")
    visit_id = f"HOME-{uuid4().hex[:10].upper()}"
    visit = {
        "id": visit_id, "patient_name": request.patient_name.strip(), "address": request.address.strip(),
        "date": request.date, "time": request.time, "reason": request.reason.strip(),
        "status": "requested", "created_at": datetime.now(timezone.utc).isoformat()
    }
    home_consultations[visit_id] = visit
    return visit

# ============================================================
# DOCTOR CONSULTATION CHAT
# ============================================================

class ConsultationRequest(BaseModel):
    patient_name: str
    doctor_name: str = "Skinova Dermatology Desk"
    assessment_id: str | None = None

class ConsultationMessageRequest(BaseModel):
    sender: str
    text: str
    language: str = "en"

@router.post("/consultations")
def create_consultation(request: ConsultationRequest):
    if not request.patient_name.strip():
        raise HTTPException(status_code=400, detail="Patient name is required")
    consultation_id = f"CONS-{uuid4().hex[:10].upper()}"
    consultation = {
        "id": consultation_id,
        "assessment_id": request.assessment_id,
        "patient_name": request.patient_name.strip(),
        "doctor_name": request.doctor_name.strip() or "Skinova Dermatology Desk",
        "status": "waiting",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    consultations[consultation_id] = consultation
    chat_messages[consultation_id] = []
    return consultation

@router.get("/consultations/{consultation_id}/messages")
def get_consultation_messages(consultation_id: str):
    if consultation_id not in consultations:
        raise HTTPException(status_code=404, detail="Consultation not found")
    return {"messages": chat_messages.get(consultation_id, [])}

@router.post("/consultations/{consultation_id}/messages")
def post_consultation_message(consultation_id: str, request: ConsultationMessageRequest):
    if consultation_id not in consultations:
        raise HTTPException(status_code=404, detail="Consultation not found")
    if request.sender not in {"patient", "doctor"}:
        raise HTTPException(status_code=400, detail="Sender must be patient or doctor")
    if request.language not in {"hi", "en"}:
        raise HTTPException(status_code=400, detail="Language must be 'hi' or 'en'")
    if not request.text.strip() or len(request.text) > 4000:
        raise HTTPException(status_code=400, detail="Message must be 1-4000 characters")
    message = {
        "id": uuid4().hex, "sender": request.sender, "text": request.text.strip(),
        "language": request.language, "created_at": datetime.now(timezone.utc).isoformat()
    }
    chat_messages.setdefault(consultation_id, []).append(message)
    consultations[consultation_id]["status"] = "active"
    return message

# ============================================================
# WEBRTC SIGNALING
# ============================================================

@ws_router.websocket("/ws/consultations/{consultation_id}")
async def consultation_socket(websocket: WebSocket, consultation_id: str):
    await websocket.accept()
    room = active_ws_rooms.setdefault(consultation_id, set())
    room.add(websocket)
    try:
        while True:
            message = await websocket.receive_text()
            for peer in list(room):
                if peer is websocket:
                    continue
                try:
                    await peer.send_text(message)
                except Exception:
                    room.discard(peer)
    except WebSocketDisconnect:
        room.discard(websocket)
    finally:
        if not room:
            active_ws_rooms.pop(consultation_id, None)

# ============================================================
# GEMINI HELPERS FOR NEW CARE FEATURES
# ============================================================

def _gemini_json(prompt: str):
    """Best-effort Gemini JSON call. Returns None when unavailable."""
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return None
    try:
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.2,
                response_mime_type="application/json"
            )
        )
        text = getattr(response, "text", None)
        if not text:
            return None
        return json.loads(text)
    except Exception:
        return None


def _fallback_agreement(ai_summary: str, doctor_summary: str):
    """Transparent lexical fallback when Gemini is unavailable."""
    import re
    stop = {
        "the", "and", "with", "that", "this", "from", "for", "into", "are",
        "was", "has", "have", "not", "but", "may", "can", "should", "skin",
        "lesion", "patient", "assessment", "summary", "possible"
    }
    def words(text):
        return {w for w in re.findall(r"[a-zA-Z]{4,}", text.lower()) if w not in stop}
    a, d = words(ai_summary), words(doctor_summary)
    lexical = 0 if not a or not d else int(round(100 * len(a & d) / max(1, len(a | d))))
    score = max(35, min(92, lexical + 35))
    label = "High agreement" if score >= 75 else "Moderate agreement" if score >= 55 else "Low agreement"
    return {
        "score": score,
        "label": label,
        "dimensions": {"assessment": score, "risk": score, "findings": score, "recommendation": score},
        "explanation": "Agreement is a prototype comparison signal and is not a measure of diagnostic accuracy or clinical correctness.",
        "ai_generated": False
    }


def _calculate_agreement(ai_summary: str, doctor_summary: str):
    prompt = f"""
You are evaluating agreement between an AI screening summary and a clinician's summary.
Do NOT decide which is medically correct. Do NOT diagnose. Measure only semantic agreement.
Return JSON with integer 0-100 values for assessment, risk, findings, recommendation, plus score,
label, and a one-sentence explanation. Labels: High agreement, Moderate agreement, Low agreement.
AI SUMMARY:\n{ai_summary}\n\nDOCTOR SUMMARY:\n{doctor_summary}
"""
    result = _gemini_json(prompt)
    if isinstance(result, dict):
        try:
            dims = result.get("dimensions", {})
            score = int(max(0, min(100, result.get("score", 0))))
            return {
                "score": score,
                "label": result.get("label") or ("High agreement" if score >= 75 else "Moderate agreement" if score >= 55 else "Low agreement"),
                "dimensions": {
                    "assessment": int(max(0, min(100, dims.get("assessment", score)))),
                    "risk": int(max(0, min(100, dims.get("risk", score)))),
                    "findings": int(max(0, min(100, dims.get("findings", score)))),
                    "recommendation": int(max(0, min(100, dims.get("recommendation", score))))
                },
                "explanation": str(result.get("explanation", "Semantic agreement only; not clinical correctness.")),
                "ai_generated": True
            }
        except Exception:
            pass
    return _fallback_agreement(ai_summary, doctor_summary)


def _ai_chat(message: str, language: str, assessment_context: str = ""):
    prompt = f"""
You are Skinova, a cautious skin-health screening assistant.
Respond in {"Hindi" if language == "hi" else "English"}.
The user is asking: {message}
Context: {assessment_context}
Return JSON: {{"reply": string, "summary": string}}.
Rules: never diagnose, never prescribe medicine, never claim image confidence is disease probability,
and recommend professional evaluation when concerning or uncertain. Keep the response concise and useful.
"""
    result = _gemini_json(prompt)
    if isinstance(result, dict) and result.get("reply"):
        return {"reply": str(result["reply"]), "summary": str(result.get("summary", ""))}
    if language == "hi":
        return {
            "reply": "Main screening information samjha sakta hoon, lekin diagnosis ya prescription nahi de sakta. Agar lesion badal raha hai, bleeding ho rahi hai, ya aapko concern hai, dermatologist se evaluation karayein.",
            "summary": "User requested multilingual skin-health guidance."
        }
    return {
        "reply": "I can explain screening information, but I cannot diagnose or prescribe. If the lesion is changing, bleeding, or concerning, seek professional dermatology evaluation.",
        "summary": "User requested skin-health screening guidance."
    }

