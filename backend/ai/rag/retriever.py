import os
import json
import numpy as np

from dotenv import load_dotenv
from google import genai


# ============================================================
# ENVIRONMENT
# ============================================================

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv(os.path.join(BASE_DIR, ".env"))

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError(
        "GEMINI_API_KEY not found in backend/.env"
    )

client = genai.Client(
    api_key=GEMINI_API_KEY
)


# ============================================================
# PATHS
# ============================================================

BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

DATA_DIR = os.path.join(
    BASE_DIR,
    "data"
)

EMBEDDINGS_PATH = os.path.join(
    DATA_DIR,
    "embeddings.npy"
)

METADATA_PATH = os.path.join(
    DATA_DIR,
    "metadata.json"
)


# ============================================================
# MODEL
# ============================================================

MODEL_NAME = "gemini-embedding-001"


# ============================================================
# LOAD PRE-COMPUTED DATA
# ============================================================

if not os.path.exists(EMBEDDINGS_PATH):
    raise FileNotFoundError(
        "embeddings.npy not found. "
        "Run: python -m ai.rag.ingest"
    )

if not os.path.exists(METADATA_PATH):
    raise FileNotFoundError(
        "metadata.json not found. "
        "Run: python -m ai.rag.ingest"
    )


DOCUMENT_EMBEDDINGS = np.load(
    EMBEDDINGS_PATH
)

with open(
    METADATA_PATH,
    "r",
    encoding="utf-8"
) as file:

    DOCUMENTS = json.load(file)


# ============================================================
# COSINE SIMILARITY
# ============================================================

def cosine_similarity(a, b):

    denominator = (
        np.linalg.norm(a) *
        np.linalg.norm(b)
    )

    if denominator == 0:
        return 0.0

    return float(
        np.dot(a, b) / denominator
    )


# ============================================================
# QUERY EMBEDDING
# ============================================================

def get_query_embedding(
    query: str
):

    response = client.models.embed_content(
        model=MODEL_NAME,
        contents=query
    )

    return np.array(
        response.embeddings[0].values,
        dtype=np.float32
    )


# ============================================================
# MEDICAL CONTEXT RETRIEVAL
# ============================================================

def retrieve_medical_context(
    query: str,
    top_k: int = 3
):

    if not query or not query.strip():
        return []

    query_embedding = get_query_embedding(
        query
    )

    scores = []

    for index, document_embedding in enumerate(
        DOCUMENT_EMBEDDINGS
    ):

        score = cosine_similarity(
            query_embedding,
            document_embedding
        )

        scores.append({
            "index": index,
            "score": score
        })


    # Highest similarity first
    scores.sort(
        key=lambda x: x["score"],
        reverse=True
    )


    results = []

    for item in scores[:top_k]:

        document = DOCUMENTS[
            item["index"]
        ]

        results.append({
            "id": document["id"],
            "text": document["text"],
            "score": item["score"]
        })


    return results