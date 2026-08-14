from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from PIL import Image, UnidentifiedImageError
import cv2
import numpy as np
from uuid import uuid4

import os
import shutil
import math
import requests
import secrets

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


# ============================================================
# TEMPORARY STORAGE
# ============================================================

assessments = {}

UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
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


def _extract_source_url(text: str):
    for line in text.splitlines():
        line = line.strip()

        if line.startswith("http://") or line.startswith("https://"):
            return line

    return None


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
        "question_variation_token": secrets.token_hex(8)
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
            detail="Only JPG, PNG, and WebP images are supported"
        )

    safe_filename = os.path.basename(
        file.filename or "image.jpg"
    )

    # Prevent arbitrary extensions from reaching the filesystem.
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

                    if os.path.exists(file_path):
                        os.remove(file_path)

                    raise HTTPException(
                        status_code=413,
                        detail=(
                            "Image exceeds the 10 MB "
                            "upload limit"
                        )
                    )

                buffer.write(chunk)

        # Verify actual image contents rather than
        # relying only on MIME type.
        try:

            with Image.open(
                file_path
            ) as image:

                image.verify()

            # Re-open after verify() before reading pixel data.
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

            if os.path.exists(file_path):
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

        if os.path.exists(file_path):
            os.remove(file_path)

        raise HTTPException(
            status_code=500,
            detail=f"Failed to save image: {str(e)}"
        )

    assessments[
        assessment_id
    ]["image_path"] = file_path

    # --------------------------------------------------------
    # ML inference
    # --------------------------------------------------------

    try:

        ml_result = analyze_image(
            file_path
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"ML analysis failed: {str(e)}"
        )

    # --------------------------------------------------------
    # Uncertainty / ambiguity gate
    # --------------------------------------------------------

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

        ml_result["gradcam_path"] = (
            gradcam.get(
                "heatmap_path"
            )
        )

        ml_result[
            "gradcam_target_layer"
        ] = gradcam.get(
            "target_layer"
        )

    except Exception as exc:

        # Grad-CAM failure must never break
        # the primary ML assessment flow.
        ml_result["gradcam_path"] = None

        ml_result[
            "gradcam_error"
        ] = str(exc)

    assessments[
        assessment_id
    ]["ml_result"] = ml_result

    return {
        "message": "Image analyzed successfully",
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

    # Generate the questionnaire once
    # per assessment.
    if assessment["questions"]:

        return {
            "questions": (
                assessment["questions"]
            )
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
- Dynamically choose which questions are most useful.
- Use clinical-context categories.
- Vary question selection and ordering.
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
                "AI question generation failed: "
                f"{str(e)}"
            )
        )

    # Additional server-side randomization.
    rng = secrets.SystemRandom()

    generated_questions = []

    for question in questions.questions:

        options = list(
            question.options
        )

        rng.shuffle(
            options
        )

        generated_questions.append({
            "question_id": question.question_id,
            "question": question.question,
            "category": question.category,
            "options": options,
        })

    rng.shuffle(
        generated_questions
    )

    assessments[
        assessment_id
    ]["questions"] = generated_questions

    return {
        "questions": (
            assessments[
                assessment_id
            ]["questions"]
        )
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
        "question_id": request.question_id
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

    # --------------------------------------------------------
    # Make sure every generated question was answered.
    # --------------------------------------------------------

    required_ids = {
        q["question_id"]
        for q in questions
    }

    answered_ids = set(
        assessment["answers"].keys()
    )

    if required_ids != answered_ids:

        missing = sorted(
            required_ids - answered_ids
        )

        raise HTTPException(
            status_code=400,
            detail=(
                "Please answer all questions "
                "before viewing the result. "
                f"Missing: {missing}"
            )
        )

    # --------------------------------------------------------
    # Preserve actual question text/category.
    # This is important because question IDs
    # may be generated arbitrarily by Gemini.
    # --------------------------------------------------------

    enriched_answers = []

    for question in questions:

        enriched_answers.append({
            "question_id": (
                question["question_id"]
            ),
            "question": (
                question["question"]
            ),
            "category": (
                question.get(
                    "category",
                    "general"
                )
            ),
            "answer": (
                assessment[
                    "answers"
                ][question["question_id"]]
            )
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

Do not assume the ML prediction is a
confirmed diagnosis.
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
                "Medical information retrieval "
                f"failed: {str(e)}"
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

    # --------------------------------------------------------
    # Store source metadata for UI / PDF.
    # --------------------------------------------------------

    assessment[
        "medical_sources"
    ] = [
        {
            "id": item["id"],
            "title": (
                item["id"]
                .replace(
                    ".txt",
                    ""
                )
                .replace(
                    "_",
                    " "
                )
                .title()
            ),
            "score": round(
                item["score"],
                4
            ),
            "url": _extract_source_url(
                item["text"]
            )
        }

        for item in retrieved
    ]

    # ========================================================
    # DETERMINISTIC SCREENING PRIORITY SIGNAL
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
    # FINAL AI CONTEXT
    # ========================================================

    context = f"""
Skinova final screening assessment.

ML MODEL RESULT:
{assessment["ml_result"]}

DETERMINISTIC SCREENING PRIORITY SIGNAL:
{deterministic_priority}

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
- Treat the deterministic screening-priority
  signal as a guardrail, not as a clinically
  validated score.
- Do not invent numerical medical risk probabilities.
- If the model is uncertain, do not downgrade
  that uncertainty merely because the user
  context appears reassuring.
- Do not prescribe medication.
- Do not recommend invasive treatment.
- Keep the result understandable to a normal user.

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
                "Final AI assessment failed: "
                f"{str(e)}"
            )
        )

    final_result = (
        result.model_dump()
    )

    assessment[
        "final_result"
    ] = final_result

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
                "PDF generation failed: "
                f"{str(e)}"
            )
        )

    # ========================================================
    # FINAL RESPONSE
    # ========================================================

    return {
        "assessment": final_result,

        "ml_result": assessment[
            "ml_result"
        ],

        "model_uncertainty": (
            assessment[
                "ml_result"
            ].get(
                "uncertainty"
            )
        ),

        "gradcam_url": (
            "/media/"
            + os.path.basename(
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

        "medical_sources": (
            assessment[
                "medical_sources"
            ]
        ),

        "pdf_available": True,

        "pdf_url": (
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

    """
    Returns nearby hospitals, clinics and
    dermatology-related healthcare facilities
    using OpenStreetMap / Overpass.

    Approximate browser coordinates are used.
    Location is not stored in the assessment.
    """

    # --------------------------------------------------------
    # Coordinate validation
    # --------------------------------------------------------

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

    # --------------------------------------------------------
    # Overpass query
    # Search approximately 5 km.
    # --------------------------------------------------------

    query = f"""
[out:json][timeout:20];

(
  node["amenity"="hospital"](around:5000,{lat},{lng});
  way["amenity"="hospital"](around:5000,{lat},{lng});
  relation["amenity"="hospital"](around:5000,{lat},{lng});

  node["healthcare"="clinic"](around:5000,{lat},{lng});
  way["healthcare"="clinic"](around:5000,{lat},{lng});
  relation["healthcare"="clinic"](around:5000,{lat},{lng});

  node["healthcare"="doctor"]
      ["healthcare:speciality"="dermatology"]
      (around:5000,{lat},{lng});

  way["healthcare"="doctor"]
      ["healthcare:speciality"="dermatology"]
      (around:5000,{lat},{lng});

  relation["healthcare"="doctor"]
      ["healthcare:speciality"="dermatology"]
      (around:5000,{lat},{lng});

  node["amenity"="doctors"]
      ["healthcare:speciality"="dermatology"]
      (around:5000,{lat},{lng});

  way["amenity"="doctors"]
      ["healthcare:speciality"="dermatology"]
      (around:5000,{lat},{lng});
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
                "Nearby healthcare service "
                f"unavailable: {str(e)}"
            )
        )

    places = []

    seen_names = set()

    # --------------------------------------------------------
    # Parse results
    # --------------------------------------------------------

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

        # ----------------------------------------------------
        # Resolve coordinates.
        # ----------------------------------------------------

        if (
            element.get("lat") is not None
            and
            element.get("lon") is not None
        ):

            place_lat = (
                element["lat"]
            )

            place_lng = (
                element["lon"]
            )

        else:

            center = element.get(
                "center",
                {}
            )

            place_lat = (
                center.get("lat")
            )

            place_lng = (
                center.get("lon")
            )

        if (
            place_lat is None
            or
            place_lng is None
        ):
            continue

        # ----------------------------------------------------
        # Distance
        # ----------------------------------------------------

        distance_km = (
            calculate_distance_km(
                lat,
                lng,
                place_lat,
                place_lng
            )
        )

        # ----------------------------------------------------
        # Address
        # ----------------------------------------------------

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

        # ----------------------------------------------------
        # Determine place type
        # ----------------------------------------------------

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
            "dermat"
            in speciality
            or
            "dermat"
            in name.lower()
        )

        if is_dermatology:

            place_type = "Dermatology"

        elif amenity == "hospital":

            place_type = "Hospital"

        else:

            place_type = "Clinic"

        places.append({
            "name": name.strip(),

            "address": (
                address
                if address
                else "Address unavailable"
            ),

            "distance": (
                f"{distance_km:.1f} km"
            ),

            # OpenStreetMap does not reliably provide
            # a rating here.
            "rating": None,

            "type": place_type,

            "url": (
                "https://www.google.com/maps/search/"
                "?api=1"
                f"&query={place_lat},{place_lng}"
            ),

            "_distance_km": (
                distance_km
            )
        })

    # --------------------------------------------------------
    # Nearest first
    # --------------------------------------------------------

    places.sort(
        key=lambda item:
            item["_distance_km"]
    )

    # --------------------------------------------------------
    # Remove internal sorting field
    # --------------------------------------------------------

    for place in places:

        place.pop(
            "_distance_km",
            None
        )

    return {
        "places": places[:10]
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
                "PDF generation failed: "
                f"{str(e)}"
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
# IMAGE QUALITY CHECK
# ============================================================

@router.post("/{assessment_id}/quality")
async def check_image_quality(
    assessment_id: str,
    file: UploadFile = File(...)
):

    """
    Lightweight pre-analysis image quality check.

    This is a usability/CV quality heuristic.
    It is NOT a medical validity guarantee.

    Checks:
      - image type
      - file size
      - minimum resolution
      - blur
      - brightness
      - overexposure
    """

    if assessment_id not in assessments:

        raise HTTPException(
            status_code=404,
            detail="Assessment not found"
        )

    if file.content_type not in ALLOWED_IMAGE_TYPES:

        raise HTTPException(
            status_code=400,
            detail=(
                "Only JPG, PNG, and WebP "
                "images are supported"
            )
        )

    chunks = []

    total_bytes = 0

    try:

        while True:

            chunk = await file.read(
                1024 * 1024
            )

            if not chunk:
                break

            total_bytes += len(
                chunk
            )

            if (
                total_bytes
                > MAX_UPLOAD_BYTES
            ):

                raise HTTPException(
                    status_code=413,
                    detail=(
                        "Image exceeds "
                        "the 10 MB limit"
                    )
                )

            chunks.append(
                chunk
            )

        data = b"".join(
            chunks
        )

    except HTTPException:
        raise

    except Exception as exc:

        raise HTTPException(
            status_code=400,
            detail=(
                "Unable to read image: "
                f"{exc}"
            )
        )

    # --------------------------------------------------------
    # Decode and inspect image
    # --------------------------------------------------------

    try:

        image_array = np.frombuffer(
            data,
            dtype=np.uint8
        )

        image = cv2.imdecode(
            image_array,
            cv2.IMREAD_COLOR
        )

        if image is None:

            raise ValueError(
                "The uploaded file is "
                "not a readable image."
            )

        height, width = image.shape[:2]

        if (
            width < 224
            or
            height < 224
        ):

            raise ValueError(
                "Image resolution is below "
                "the minimum 224 × 224 pixels."
            )

        gray = cv2.cvtColor(
            image,
            cv2.COLOR_BGR2GRAY
        )

        # Variance of Laplacian:
        # lower values generally indicate
        # weaker focus / blur.
        blur_score = float(
            cv2.Laplacian(
                gray,
                cv2.CV_64F
            ).var()
        )

        # Mean grayscale brightness.
        brightness = float(
            np.mean(gray)
        )

    except ValueError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc)
        )

    except Exception as exc:

        raise HTTPException(
            status_code=400,
            detail=(
                "Unable to analyze image "
                f"quality: {exc}"
            )
        )

    issues: list[str] = []

    # --------------------------------------------------------
    # Prototype quality heuristics
    #
    # These thresholds are usability heuristics,
    # NOT medically validated thresholds.
    # --------------------------------------------------------

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
            "Avoid harsh direct lighting."
        )

    quality = (
        "good"
        if not issues
        else "needs_improvement"
    )

    return {
        "quality": quality,

        "blur_score": round(
            blur_score,
            2
        ),

        "brightness": round(
            brightness,
            2
        ),

        "width": width,

        "height": height,

        "issues": issues
    }