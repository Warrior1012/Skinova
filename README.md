# Skinova

---

# `README.md`

````md
# SKINOVA

### AI-Assisted Skin Lesion Screening & Care Navigation

> **From skin image to informed next step.**

Skinova is an AI-assisted skin lesion screening prototype that combines a dedicated computer-vision model, explainable AI, contextual questioning, medical knowledge retrieval, and care navigation into a single workflow.

Instead of returning only a disease label from an image, Skinova combines:

- A dedicated 7-class skin-lesion classifier
- Model confidence and class distribution
- Grad-CAM visual attribution
- Image-quality analysis
- Dynamically generated contextual MCQs
- User-reported symptoms and lesion history
- Retrieval-Augmented Generation (RAG)
- Gemini-powered structured reasoning
- Screening priority and urgency guidance
- Medical evidence sources
- Downloadable PDF screening summaries
- Nearby healthcare discovery

> **Important:** Skinova is a screening and informational prototype. It does **not** provide a medical diagnosis, does not replace a dermatologist, and model confidence must not be interpreted as medical certainty.

---

## Why Skinova?

Generic AI systems can provide useful visual or conversational opinions, but a medical screening workflow requires more than a single model response.

Skinova is designed as a controlled pipeline:

```text
Skin Image
    ↓
Image Quality Check
    ↓
Dedicated 7-Class ML Classifier
    ↓
Confidence + Class Distribution
    ↓
Grad-CAM Explainability
    ↓
Dynamic Contextual Questions
    ↓
User Answers
    ↓
Medical Knowledge Retrieval (RAG)
    ↓
Gemini Structured Reasoning
    ↓
Screening Priority + Urgency
    ↓
Explanation + Evidence + Recommendations
    ↓
PDF Report + Nearby Professional Care
````

The goal is not to replace general-purpose AI models.

The goal is to build a purpose-specific screening workflow around specialized vision, context and evidence.

---

# Core Features

## 1. Dedicated Skin-Lesion Classification

Skinova uses an EfficientNetB0-based TensorFlow/Keras model trained for seven skin-lesion categories.

The model produces:

* Predicted class
* Disease label
* Confidence
* Seven-class output distribution

### Supported classes

| Code    | Class                                         |
| ------- | --------------------------------------------- |
| `akiec` | Actinic keratoses / intraepithelial carcinoma |
| `bcc`   | Basal cell carcinoma                          |
| `bkl`   | Benign keratosis-like lesions                 |
| `df`    | Dermatofibroma                                |
| `mel`   | Melanoma                                      |
| `nv`    | Melanocytic nevi                              |
| `vasc`  | Vascular lesions                              |

---

## 2. Explainable Vision with Grad-CAM

Skinova does not expose only the classifier's final prediction.

Grad-CAM is used to generate a visual attribution map showing the image regions that contributed to the classifier output.

This allows the workflow to surface:

```text
Prediction
     +
Confidence
     +
Model Attribution
```

> Grad-CAM is an attribution visualization and should not be interpreted as a clinical lesion boundary or medical explanation.

---

## 3. Image Quality Assistant

Before analysis, Skinova performs basic image-quality checks using OpenCV.

Current checks include:

* Blur / focus
* Brightness
* Image resolution
* Basic image validity

The user receives feedback when the uploaded image may be difficult to analyze.

These checks are usability-oriented heuristics and are **not medically validated quality scores**.

---

## 4. Dynamic Contextual Assessment

After image analysis, Skinova generates a set of multiple-choice follow-up questions relevant to the assessment.

Questions can capture information such as:

* Recent change
* Growth
* Bleeding
* Crusting
* Pain
* Itching
* Duration
* Other relevant history or context

Questions are generated dynamically and option ordering can vary between assessments.

---

## 5. Context-Aware Screening Priority

Skinova does not treat the image classifier's prediction as the final answer.

The screening workflow combines:

```text
Visual Model Output
        +
User Context
        +
Medical Evidence
        ↓
Screening Priority
```

The current prototype uses:

* Lower
* Moderate
* Higher
* Uncertain

This is a **screening-priority signal**, not a clinically validated cancer-risk score.

### Example

The same image may receive different guidance when the reported context changes:

```text
Same image
   │
   ├── No recent change
   ├── No bleeding
   └── No significant symptoms
          ↓
     Lower priority

Same image
   │
   ├── Recent change
   ├── Bleeding reported
   └── Symptoms present
          ↓
     Higher priority
```

---

# Medical Knowledge Retrieval (RAG)

Skinova contains a curated medical knowledge base used to retrieve relevant supporting information before the final assessment is generated.

The current prototype includes curated dermatology documents covering topics such as:

* Melanoma
* Basal cell carcinoma
* General skin-cancer information

The retrieval pipeline uses stored embeddings and similarity-based retrieval to select relevant passages.

The retrieved information is then supplied to the structured AI reasoning layer.

---

# AI Reasoning Layer

Google Gemini is used as the generative reasoning component of the workflow.

Gemini is responsible for:

* Generating contextual questions
* Structuring the final assessment
* Synthesizing model output
* Incorporating user-provided context
* Using retrieved medical evidence
* Producing explanation and recommendations

The model is constrained using structured Pydantic schemas so the application receives predictable fields instead of unrestricted free-form output.

### Important architectural distinction

Gemini is **not the dedicated skin-lesion classifier**.

The architecture separates:

```text
Computer Vision
EfficientNetB0
       ↓
Visual prediction

Generative AI
Gemini
       ↓
Question generation + contextual synthesis
```

This separation is intentional.

---

# Evidence Trail

The final result can expose supporting medical sources used by the retrieval layer.

The user can see:

* Source title
* Relevant source information
* Available source URL
* Recommendations derived from the combined assessment

This helps make the final explanation more traceable than an unsupported free-form answer.

---

# PDF Screening Summary

After the assessment is completed, Skinova can generate a structured PDF report containing relevant screening information.

The report can include:

* Model prediction
* Model output distribution
* User-provided context
* Screening priority
* Urgency
* Explanation
* Key factors
* Precautions
* Recommended next steps
* Medical knowledge sources
* Responsible-use disclaimer

The PDF is generated by the backend using ReportLab.

---

# Nearby Professional Care

Skinova can retrieve nearby healthcare facilities using location coordinates.

The backend uses OpenStreetMap / Overpass for nearby healthcare search.

The interface can also provide Google Maps links for directions/search.

The healthcare lookup is intentionally separate from the core screening flow so that a location/API failure does not invalidate the assessment itself.

---

# System Architecture

```text
                    USER
                      │
                      ▼
          React + TypeScript Frontend
                      │
                HTTP / JSON
                      │
                      ▼
                FastAPI Backend
                      │
       ┌──────────────┼───────────────┐
       │              │               │
       ▼              ▼               ▼
 Image Quality      ML Engine       AI Layer
   OpenCV        EfficientNetB0      Gemini
                    │                  │
                    ▼                  ▼
                7-Class Model     Dynamic Questions
                + Distribution    + Final Reasoning
                    │                  │
                    └────────┬─────────┘
                             ▼
                         RAG Layer
                             │
                             ▼
                  Curated Medical Knowledge
                             │
                             ▼
                     Screening Result
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
          Explanation       PDF        Nearby Care
          + Evidence       Report       + Maps
```

---

# End-to-End Workflow

```text
1. Start Assessment
        ↓
2. Upload Skin Image
        ↓
3. Image Quality Check
        ↓
4. ML Inference
   ├─ 7-Class Prediction
   ├─ Confidence
   ├─ Distribution
   └─ Grad-CAM
        ↓
5. Dynamic AI Questions
        ↓
6. User Answers
        ↓
7. Medical Evidence Retrieval
        ↓
8. Gemini Structured Reasoning
        ↓
9. Screening Result
   ├─ Priority
   ├─ Urgency
   ├─ Explanation
   ├─ Key Factors
   └─ Recommendations
        ↓
10. PDF Screening Report
        ↓
11. Nearby Professional Care
```

---

# Technology Stack

## Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* Lucide React

## Backend

* Python
* FastAPI
* Pydantic
* Uvicorn

## Machine Learning

* TensorFlow
* Keras
* EfficientNetB0
* NumPy

## Explainability

* Grad-CAM
* TensorFlow/Keras model attribution

## Computer Vision

* OpenCV
* Pillow
* NumPy

## Generative AI

* Google Gemini API
* Structured JSON outputs
* Pydantic schema validation

## Retrieval

* Curated dermatology knowledge base
* Embedding-based retrieval
* NumPy vector similarity

## Reporting

* ReportLab

## Healthcare / Maps

* OpenStreetMap
* Overpass API
* Google Maps links

---

# Machine Learning

## Dataset

The ML module is based on the HAM10000 dataset.

The training setup documented for the model contains:

* **10,015 images**
* **7,470 unique lesions**
* Seven skin-lesion classes

The dataset split is performed by `lesion_id` rather than by individual image to reduce the risk of the same lesion appearing across multiple splits.

### Dataset split

| Split      | Images |
| ---------- | -----: |
| Training   |  6,981 |
| Validation |  1,532 |
| Test       |  1,502 |

The documented checks report no overlap between the train, validation and test lesion sets.

---

# Model Performance

The current ML module reports:

| Metric              |     Result |
| ------------------- | ---------: |
| Validation Accuracy | **72.52%** |
| Test Accuracy       | **71.77%** |

These are held-out dataset results documented by the ML module.

> Accuracy alone does not describe model performance equally well across all classes. Per-class precision, recall and F1-score should be reviewed before making clinical-performance claims.

---

# ML Model Input

The model expects:

```text
224 × 224 RGB image
```

The prediction pipeline resizes the uploaded image to the required input dimensions.

---

# Project Structure

```text
SKINOVA/
│
├── frontend/
│   └── React + TypeScript + Tailwind application
│
├── backend/
│   │
│   ├── ai/
│   │   ├── agent.py
│   │   ├── prompts.py
│   │   ├── schemas.py
│   │   ├── tools.py
│   │   └── rag/
│   │       ├── document/
│   │       ├── data/
│   │       ├── ingest.py
│   │       └── retriever.py
│   │
│   ├── ML/
│   │   └── ML_Module/
│   │       ├── predict.py
│   │       ├── class_names.json
│   │       ├── skin_disease_model.keras
│   │       └── ML_README.md
│   │
│   ├── routes/
│   │   └── assessment.py
│   │
│   ├── services/
│   │   ├── ai_service.py
│   │   ├── ml_service.py
│   │   └── pdf_service.py
│   │
│   ├── main.py
│   └── requirements.txt
│
├── screenshots/
│
├── README.md
└── .gitignore
```

---

# API Flow

The core backend flow uses endpoints such as:

```text
POST /assessment/start

POST /assessment/{id}/quality

POST /assessment/{id}/image

GET  /assessment/{id}/questions

POST /assessment/{id}/answer

GET  /assessment/{id}/result

GET  /assessment/{id}/report

GET  /assessment/hospitals
```

---

# Local Setup

## Requirements

Recommended environment:

* Python 3.10+
* Node.js 18+
* npm

---

## 1. Clone the repository

```bash
git clone https://github.com/<your-username>/skinova.git
cd skinova
```

---

## 2. Backend Setup

```bash
cd backend
```

Create a virtual environment:

### Windows

```bash
python -m venv venv
venv\Scripts\activate
```

### macOS / Linux

```bash
python3 -m venv venv
source venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create your environment file:

```bash
copy .env.example .env
```

or on macOS/Linux:

```bash
cp .env.example .env
```

Set your Gemini API key:

```env
GEMINI_API_KEY=your_gemini_api_key
```

Run the backend:

```bash
uvicorn main:app --reload --port 8000
```

Backend:

```text
http://localhost:8000
```

Health check:

```text
http://localhost:8000/health
```

API documentation:

```text
http://localhost:8000/docs
```

---

# 3. Frontend Setup

Open a second terminal:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Create `.env` from `.env.example`:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_DEMO_MODE=false
```

Run:

```bash
npm run dev
```

Frontend:

```text
http://localhost:5173
```

---

# Responsible AI & Safety

Skinova is intentionally positioned as a **screening-support prototype**, not a diagnostic product.

### Important limitations

* Model confidence is not medical certainty.
* The classifier can make incorrect predictions.
* The model is trained on a specific dataset and class distribution.
* User-provided information can be incomplete or inaccurate.
* Grad-CAM is not a clinical explanation.
* Screening priority is not a clinically validated risk score.
* Nearby-care availability depends on external services.
* The system should not replace professional medical evaluation.

### User-facing principle

> **Predicting a screening priority, not diagnosing a disease.**

For concerning, changing, bleeding, painful, or otherwise suspicious lesions, users should seek evaluation from a qualified healthcare professional.

---

# Data & External Resources

Skinova uses external datasets, libraries, models and information sources.

Examples include:

* HAM10000 skin-lesion dataset
* TensorFlow / Keras EfficientNetB0
* Google Gemini API
* OpenCV
* OpenStreetMap / Overpass
* ReportLab
* Curated dermatology sources used by the RAG layer

All external datasets, models, libraries and referenced resources should be credited according to their respective licenses and terms.


---

# Future Scope

Potential future extensions include:

* Broader validated lesion coverage
* Stronger per-class model evaluation
* Longitudinal image comparison
* Improved calibration of model confidence
* Expanded and clinically reviewed medical knowledge base
* More robust deployment infrastructure
* Privacy-preserving persistent patient sessions
* Clinical workflow integration

These are future directions and are not required for the current prototype.

---

# Team

**Skinova Team**

Built as an Open Innovation hackathon project.
Team members are: 
TANISHQ AGARWAL
SHRADDHA GUPTA
YASHICA AGARWAL
S SRI LASHIKA
---

# License

Add the appropriate project license before publishing the repository.

If external datasets, model weights or resources have separate licenses, those terms remain applicable to the respective resources.

---

## Disclaimer

**Skinova is not a medical device or diagnostic system.**

This project is an experimental AI-assisted screening prototype intended for demonstration and informational purposes.

Do not use Skinova as a substitute for professional medical diagnosis or treatment.

```


```
