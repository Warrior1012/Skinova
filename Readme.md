
# Skinova

### AI-Assisted Skin Lesion Screening & Care Navigation

Skinova is an AI-assisted screening and care-navigation prototype designed to help users understand potentially concerning skin lesions and identify appropriate next steps.

The platform combines computer vision, explainable AI, contextual questioning, retrieval-augmented generation, and structured AI reasoning into a single screening workflow.

> **Medical Disclaimer:** Skinova is a screening and informational prototype. It does not provide a medical diagnosis and should not replace evaluation by a qualified healthcare professional.

---

## Overview

Skinova follows a multi-stage assessment workflow rather than relying solely on an image classifier.

Users can:

1. Upload an image of a skin lesion.
2. Run image-quality checks before analysis.
3. Receive a skin-lesion classification from a dedicated computer-vision model.
4. View model confidence and class probabilities.
5. Explore Grad-CAM visualizations for model explainability.
6. Answer contextual questions about symptoms and relevant history.
7. Receive a structured screening assessment with recommended next steps.
8. Access supporting medical evidence retrieved through the system's knowledge base.
9. Download a generated screening summary.
10. Explore nearby healthcare options for further professional evaluation.

---

## Key Features

### 🧠 AI-Assisted Skin Lesion Screening

Skinova uses an **EfficientNetB0-based computer vision model** trained for seven skin-lesion classes.

The model provides:

- Predicted lesion class
- Confidence score
- Class probability distribution
- Screening-oriented interpretation

The model's confidence is presented as model confidence, **not as a cancer-risk percentage or medical diagnosis**.

---

### 🔍 Explainable AI with Grad-CAM

Skinova uses **Grad-CAM** to visualize the regions of an image that contributed most strongly to the model's prediction.

This provides an additional layer of interpretability instead of presenting the model output as a black-box result.

---

### 📷 Image Quality Analysis

Before analysis, uploaded images are checked for basic usability characteristics such as:

- Image dimensions
- Blur
- Brightness
- Readability

This helps identify images that may not be suitable for meaningful screening.

---

### 📝 Contextual Assessment

Image-based predictions are supplemented with dynamically generated questions covering relevant symptoms and contextual information.

This allows the screening workflow to consider more than the image alone.

---

### 📚 Evidence-Grounded AI

Skinova combines **Retrieval-Augmented Generation (RAG)** with a curated medical knowledge base.

Retrieved evidence is used alongside the screening result to provide more grounded informational context.

The platform also exposes an evidence trail so users can understand the basis of the informational guidance.

---

### 🤖 Structured AI Reasoning

Gemini is used for contextual reasoning and structured outputs within the screening workflow.

The system separates model prediction from contextual reasoning rather than treating a general-purpose language model as the image classifier.

---

### 🏥 Care Navigation

Following screening, Skinova provides informational next-step guidance and can surface nearby healthcare options through its configured healthcare search functionality.

The goal is to help users move from **screening → understanding → appropriate professional care**.

---

### 📄 Screening Report

Completed assessments can be exported as a generated PDF screening summary containing the relevant assessment information and recommendations.

---

## Assessment Workflow

```text
Upload Skin Image
        │
        ▼
Image Quality Check
        │
        ▼
Skin Lesion Classification
        │
        ├──────────────► Grad-CAM Explainability
        │
        ▼
Contextual Questions
        │
        ▼
Evidence Retrieval (RAG)
        │
        ▼
Structured AI Reasoning
        │
        ▼
Screening Summary
        │
        ├──────────────► PDF Report
        │
        └──────────────► Healthcare Navigation
````

---

## Machine Learning

Skinova uses a dedicated **EfficientNetB0** image-classification model.

### Dataset

The model was developed using the **HAM10000** dataset.

* 10,015 dermatoscopic images
* 7,470 unique lesions
* 7 diagnostic categories

### Reported Performance

| Metric              | Result |
| ------------------- | -----: |
| Validation Accuracy | 72.52% |
| Test Accuracy       | 71.77% |

These results are reported for the project's evaluation setup and should not be interpreted as clinical diagnostic performance.

---

## Technology Stack

### Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* Lucide Icons

### Backend

* FastAPI
* Python

### Computer Vision & Machine Learning

* TensorFlow
* Keras
* EfficientNetB0
* OpenCV
* Grad-CAM

### AI & Knowledge Retrieval

* Gemini
* Retrieval-Augmented Generation (RAG)
* Structured Outputs

### Data & Infrastructure

* Curated medical knowledge base
* Healthcare search integration
* PDF report generation

---

## Project Structure

```text
Skinova/
├── frontend/
│   └── src/
│       ├── App.tsx
│       ├── index.css
│       ├── main.tsx
│       └── lib/
│
├── backend/
│   └── ...
│
├── README.md
└── ...
```

---

## Getting Started

### Prerequisites

Make sure the following are installed:

* Node.js
* npm
* Python 3.x
* pip

### 1. Clone the repository

```bash
git clone https://github.com/Warrior1012/Skinova.git
cd Skinova
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The Vite development server will provide the local frontend URL.

### 3. Backend Setup

From the backend directory:

```bash
cd backend
pip install -r requirements.txt
```

Configure the required environment variables using the provided environment example file.

Then start the FastAPI server according to the backend configuration.




---

## Important Limitations

Skinova is a **prototype intended for screening and informational support**.

It does not:

* Provide a medical diagnosis
* Replace a dermatologist or other qualified healthcare professional
* Guarantee the correctness of model predictions
* Treat model confidence as cancer probability
* Determine treatment or prescribe medication

Any concerning, changing, painful, bleeding, or otherwise suspicious lesion should be evaluated by an appropriate healthcare professional.

---

## Project Context

Skinova was developed and showcased as a prototype during the **Ascended Agents Hackathon at Netaji Subhas University of Technology (NSUT)**.

The project explores how computer vision, explainable AI, retrieval-based medical knowledge, and structured language-model reasoning can be combined into a practical screening-support workflow.

---

## Future Scope

Potential future improvements include:

* Improved model performance and calibration
* Larger and more diverse datasets
* Stronger clinical validation
* Expanded multilingual support
* Improved clinician-review workflows
* Longitudinal lesion tracking
* More comprehensive healthcare integrations

---

## Disclaimer

Skinova is an experimental software prototype created for educational, research, and demonstration purposes.

**It is not a medical device and does not provide medical diagnosis or treatment.**

Always consult a qualified healthcare professional for medical concerns.

---

## License

This project is licensed under the **MIT License**.

See the `LICENSE` file for details.

---

## Repository

GitHub:
[https://github.com/Warrior1012/Skinova](https://github.com/Warrior1012/Skinova)

