
# Skinova Backend

### AI-Assisted Skin Lesion Screening & Care Navigation API

The Skinova backend provides the API and AI-processing layer for the Skinova screening platform.

It handles image processing, machine-learning inference, explainability, contextual assessment, evidence retrieval, structured AI reasoning, screening results, PDF report generation, and healthcare navigation.

> **Medical Disclaimer:** Skinova is a screening and informational prototype. The backend does not provide a medical diagnosis and should not replace evaluation by a qualified healthcare professional.

---

## Overview

The backend is responsible for coordinating the different components of the Skinova screening pipeline.

A typical assessment follows this flow:

```text
Image Upload
     │
     ▼
Image Validation & Quality Analysis
     │
     ▼
EfficientNetB0 Inference
     │
     ├──────────────► Grad-CAM Explainability
     │
     ▼
Contextual Assessment
     │
     ▼
Medical Evidence Retrieval
     │
     ▼
Structured AI Reasoning
     │
     ▼
Screening Result
     │
     ├──────────────► PDF Report
     │
     └──────────────► Healthcare Search
````

---

## Core Responsibilities

### 🧠 Machine Learning Inference

The backend loads and executes the Skinova skin-lesion classification model.

The current model uses:

* EfficientNetB0
* TensorFlow / Keras
* Seven skin-lesion classes
* HAM10000-based training/evaluation

The inference layer returns:

* Predicted class
* Model confidence
* Class probabilities
* Screening-oriented metadata

Model confidence is treated as model output and **not as a medical probability or diagnosis**.

---

### 🔍 Grad-CAM Explainability

The backend supports Grad-CAM generation for model predictions.

Grad-CAM produces a visual representation of the image regions that contributed most strongly to the model's prediction.

This allows the frontend to present an interpretable visualization alongside the model output.

---

### 📷 Image Quality Analysis

Uploaded images are processed before inference.

The backend performs image-quality checks such as:

* Image dimensions
* Blur detection
* Brightness analysis
* Basic image usability checks

This helps identify unsuitable images before they are passed through the screening pipeline.

---

### 📝 Contextual Assessment

The backend supports contextual questions that supplement the image-based prediction.

Relevant user-provided information can be incorporated into the screening workflow before generating the final assessment.

This creates a multi-input screening process rather than relying exclusively on computer-vision inference.

---

### 📚 Retrieval-Augmented Generation

Skinova uses a curated medical knowledge base as part of its evidence-grounding workflow.

The backend retrieves relevant information and provides it as context for the subsequent reasoning stage.

This helps keep informational recommendations grounded in retrieved medical references rather than relying solely on free-form language-model generation.

---

### 🤖 Structured AI Reasoning

Gemini is used for contextual reasoning and structured output generation.

The backend combines:

* Computer-vision predictions
* Contextual responses
* Retrieved medical evidence
* Screening rules

to generate a structured screening assessment.

The language model is **not used as the skin-lesion classifier**.

---

### 🏥 Healthcare Navigation

The backend provides healthcare-search functionality to help users identify nearby professional care options following a screening assessment.

The purpose is to support the transition from:

```text
Screening
   ↓
Understanding
   ↓
Appropriate Professional Care
```

---

### 📄 PDF Report Generation

Completed screening assessments can be converted into a downloadable PDF summary.

The generated report can contain relevant assessment information, model results, contextual information, and recommended next steps.

---

## Technology Stack

### API

* FastAPI
* Python
* Pydantic

### Machine Learning

* TensorFlow
* Keras
* EfficientNetB0
* OpenCV
* Grad-CAM

### Generative AI

* Gemini
* Structured AI outputs

### Knowledge Retrieval

* Retrieval-Augmented Generation (RAG)
* Curated medical knowledge base
* Evidence retrieval

### Utilities

* PDF generation
* Image processing
* Healthcare/location search

---

## Project Structure

```text
backend/
├── ...
├── requirements.txt
├── .env.example
└── README.md
```

The backend is organized around API endpoints, processing services, machine-learning inference, and supporting utilities.

---

## API Responsibilities

The backend exposes functionality for the frontend to interact with the screening system.

Major API responsibilities include:

| Area             | Responsibility                          |
| ---------------- | --------------------------------------- |
| Assessment       | Coordinate the screening workflow       |
| Image Processing | Validate and analyze uploaded images    |
| ML Inference     | Generate skin-lesion predictions        |
| Explainability   | Generate Grad-CAM visualizations        |
| Context          | Process contextual assessment responses |
| Evidence         | Retrieve relevant medical information   |
| AI Reasoning     | Generate structured screening output    |
| Reports          | Generate PDF screening summaries        |
| Healthcare       | Find nearby professional care options   |

---

## Machine Learning

### Dataset

The model was developed using the HAM10000 dataset.

* 10,015 dermatoscopic images
* 7,470 unique lesions
* 7 diagnostic categories

### Reported Evaluation

| Metric              | Result |
| ------------------- | -----: |
| Validation Accuracy | 72.52% |
| Test Accuracy       | 71.77% |

These metrics represent the project's evaluation setup and should not be interpreted as clinical diagnostic performance.

---

## Environment Configuration

The backend uses environment variables for external services and application configuration.

Create a local environment file using the provided example configuration where applicable.

For example:

```text
GEMINI_API_KEY=your_key_here
```

Use the actual variables defined by the project in `.env.example`.

> **Never commit `.env` files, API keys, credentials, or other secrets to GitHub.**

---

## Local Development

### 1. Clone the repository

```bash
git clone https://github.com/Warrior1012/Skinova.git
cd Skinova/backend
```

### 2. Create a virtual environment

```bash
python -m venv .venv
```

Activate it on Windows:

```powershell
.venv\Scripts\Activate.ps1
```

On macOS/Linux:

```bash
source .venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment variables

Create the required environment file based on `.env.example`.

Do not commit the resulting `.env` file.

### 5. Start the API

Run the FastAPI application using the project's configured entry point.

For a standard FastAPI setup this may look like:

```bash
uvicorn main:app --reload
```

If the project uses a different application module, use the entry point defined in the backend source.

---

## Development Notes

The backend separates the major stages of the screening process so that:

* Image processing can be evaluated independently.
* ML inference remains separate from generative AI reasoning.
* Explainability can be generated alongside predictions.
* Retrieved evidence can be inspected independently.
* Final screening output can combine multiple sources of information.

This separation helps make the system easier to test, debug, and extend.

---

## Limitations

The Skinova backend is an experimental prototype.

It does not:

* Provide a medical diagnosis
* Replace a dermatologist or healthcare professional
* Guarantee the correctness of model predictions
* Treat model confidence as cancer probability
* Prescribe treatment
* Replace professional medical evaluation

Any concerning, changing, painful, bleeding, or otherwise suspicious lesion should be evaluated by a qualified healthcare professional.

---

## Project Context

Skinova was developed and showcased as a prototype during the **Ascended Agents Hackathon at Netaji Subhas University of Technology (NSUT)**.

The project explores the integration of:

* Computer vision
* Explainable AI
* Retrieval-augmented generation
* Structured language-model reasoning
* Healthcare navigation

into a unified screening-support workflow.

---

## Future Scope

Potential backend improvements include:

* Improved model performance and calibration
* Larger and more diverse datasets
* Stronger clinical validation
* Expanded multilingual capabilities
* Improved clinician-review workflows
* Longitudinal lesion tracking
* Additional healthcare integrations
* More robust evaluation and monitoring

---

## Security

The backend may interact with external AI and healthcare services.

For development and deployment:

* Store secrets in environment variables.
* Never commit API keys.
* Never commit production credentials.
* Validate uploaded files.
* Restrict access to sensitive endpoints.
* Avoid storing unnecessary personal or medical information.

---

## License

This project is licensed under the **MIT License**.

See the `LICENSE` file for details.

---

## Repository

GitHub:

[https://github.com/Warrior1012/Skinova](https://github.com/Warrior1012/Skinova)


Agar tum mujhe **current `backend` folder ka tree** de do (`tree /F` ka output), main is README ko **100% exact** bana dunga—project structure, entry point, actual APIs, env variables, sab kuch.
```
