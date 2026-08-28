import os
import json
import numpy as np

from dotenv import load_dotenv
from google import genai


# ============================================================
# ENV
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

DOCUMENTS_DIR = os.path.join(
    BASE_DIR,
    "document"
)

OUTPUT_DIR = os.path.join(
    BASE_DIR,
    "data"
)

os.makedirs(
    OUTPUT_DIR,
    exist_ok=True
)


EMBEDDINGS_PATH = os.path.join(
    OUTPUT_DIR,
    "embeddings.npy"
)

METADATA_PATH = os.path.join(
    OUTPUT_DIR,
    "metadata.json"
)


# ============================================================
# MODEL
# ============================================================

MODEL_NAME = "gemini-embedding-001"


# ============================================================
# LOAD DOCUMENTS
# ============================================================

documents = []

for filename in os.listdir(DOCUMENTS_DIR):

    if not filename.lower().endswith(".txt"):
        continue

    path = os.path.join(
        DOCUMENTS_DIR,
        filename
    )

    with open(
        path,
        "r",
        encoding="utf-8"
    ) as file:

        text = file.read().strip()

    if not text:
        continue

    documents.append({
        "id": filename,
        "text": text
    })


if not documents:
    raise RuntimeError(
        "No medical documents found."
    )


print(
    f"Found {len(documents)} medical documents."
)


# ============================================================
# CREATE EMBEDDINGS
# ============================================================

embeddings = []

for index, document in enumerate(documents):

    print(
        f"Embedding {index + 1}/{len(documents)}: "
        f"{document['id']}"
    )

    response = client.models.embed_content(
        model=MODEL_NAME,
        contents=document["text"]
    )

    embedding = np.array(
        response.embeddings[0].values,
        dtype=np.float32
    )

    embeddings.append(
        embedding
    )


embeddings = np.array(
    embeddings,
    dtype=np.float32
)


# ============================================================
# SAVE EMBEDDINGS
# ============================================================

np.save(
    EMBEDDINGS_PATH,
    embeddings
)


# ============================================================
# SAVE METADATA
# ============================================================

with open(
    METADATA_PATH,
    "w",
    encoding="utf-8"
) as file:

    json.dump(
        documents,
        file,
        indent=2,
        ensure_ascii=False
    )


print("\nRAG ingestion completed.")

print(
    "Embeddings:",
    EMBEDDINGS_PATH
)

print(
    "Metadata:",
    METADATA_PATH
)