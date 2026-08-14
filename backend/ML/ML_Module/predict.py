import os
import json
import numpy as np
import tensorflow as tf
from PIL import Image


BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MODEL_PATH = os.path.join(BASE_DIR, "skin_disease_model.keras")
CLASS_NAMES_PATH = os.path.join(BASE_DIR, "class_names.json")

IMG_SIZE = (224, 224)

with open(CLASS_NAMES_PATH, "r", encoding="utf-8") as f:
    CLASS_NAMES = json.load(f)

print("Loading skin disease model...")

model = tf.keras.models.load_model(
    MODEL_PATH,
    compile=False
)

print("Model loaded successfully.")


def predict_skin_disease(image_path: str):
    """
    Run the EfficientNetB0 skin-lesion classifier.

    Returns:
      - top_prediction: top-1 class, disease name and model score
      - distribution: all seven model output scores, descending
    """
    image = Image.open(image_path).convert("RGB")
    image = image.resize(IMG_SIZE)

    image_array = np.asarray(image, dtype=np.float32)
    image_array = np.expand_dims(image_array, axis=0)

    predictions = np.asarray(
        model.predict(image_array, verbose=0)[0],
        dtype=np.float32
    )

    if predictions.ndim != 1 or len(predictions) != len(CLASS_NAMES):
        raise ValueError(
            f"Expected {len(CLASS_NAMES)} model outputs, got {len(predictions)}."
        )

    # EfficientNet model is expected to emit class scores/probabilities.
    # Do not call these calibrated probabilities unless calibration is verified.
    if np.any(predictions < 0) or not np.isclose(
        float(predictions.sum()), 1.0, atol=1e-3
    ):
        # Defensive normalization for models that expose non-normalized scores.
        exp_scores = np.exp(predictions - np.max(predictions))
        predictions = exp_scores / exp_scores.sum()

    ranked_indices = np.argsort(predictions)[::-1]

    distribution = []
    for index in ranked_indices:
        info = CLASS_NAMES[str(int(index))]
        distribution.append({
            "code": info["code"],
            "name": info["name"],
            "score": round(float(predictions[index]) * 100, 2)
        })

    top = distribution[0]

    return {
        "class": top["code"],
        "disease": top["name"],
        "confidence": top["score"],
        "distribution": distribution
    }


if __name__ == "__main__":
    print("\nSkin Disease Prediction Module")
    print("==============================")
    print("Model:", MODEL_PATH)
    print("\nAvailable classes:")

    for index, info in CLASS_NAMES.items():
        print(f"{index}: {info['code']} - {info['name']}")

    print("\nUse:")
    print("predict_skin_disease('path_to_image.jpg')")
