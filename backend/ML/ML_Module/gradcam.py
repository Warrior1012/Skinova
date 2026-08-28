import os
import numpy as np
import tensorflow as tf
from PIL import Image

from ML.ML_Module.predict import model, IMG_SIZE, CLASS_NAMES


def _find_target_layer():
    """
    Find a suitable final convolutional/feature layer without requiring
    the original training notebook.

    Preference:
      1. Last layer whose output is a 4D tensor.
      2. Search backwards through nested layers if needed.
    """
    for layer in reversed(model.layers):
        try:
            shape = layer.output.shape
            if len(shape) == 4:
                return layer
        except Exception:
            continue

    raise RuntimeError(
        "Could not automatically find a 4D feature layer for Grad-CAM."
    )


def generate_gradcam(image_path: str, output_path: str | None = None):
    """
    Generate a Grad-CAM heatmap overlay for the model's top prediction.

    Returns metadata and the saved overlay path.
    """
    target_layer = _find_target_layer()

    image = Image.open(image_path).convert("RGB")
    image = image.resize(IMG_SIZE)

    image_array = np.asarray(image, dtype=np.float32)
    batch = np.expand_dims(image_array, axis=0)

    # Build a model that exposes the target feature map and final prediction.
    grad_model = tf.keras.models.Model(
        inputs=model.inputs,
        outputs=[target_layer.output, model.output],
    )

    with tf.GradientTape() as tape:
        feature_maps, predictions = grad_model(batch, training=False)
        class_index = tf.argmax(predictions[0])
        class_score = predictions[:, class_index]

    gradients = tape.gradient(class_score, feature_maps)

    if gradients is None:
        raise RuntimeError(
            "Gradients could not be computed for the selected feature layer."
        )

    # Global-average-pool gradients to obtain channel weights.
    weights = tf.reduce_mean(gradients, axis=(1, 2))
    feature_map = feature_maps[0]
    channel_weights = weights[0]

    heatmap = tf.reduce_sum(
        feature_map * channel_weights[tf.newaxis, tf.newaxis, :],
        axis=-1,
    )

    heatmap = tf.maximum(heatmap, 0)
    max_value = tf.reduce_max(heatmap)

    if float(max_value.numpy()) > 0:
        heatmap = heatmap / max_value

    heatmap = tf.image.resize(
        heatmap[..., tf.newaxis],
        IMG_SIZE,
    )[..., 0]

    heatmap_np = (heatmap.numpy() * 255).astype(np.uint8)

    # Create an RGB heatmap using a standard colormap through Pillow/TensorFlow.
    # Avoid adding a new plotting dependency to the backend.
    heatmap_rgb = np.zeros(
        (IMG_SIZE[0], IMG_SIZE[1], 3),
        dtype=np.uint8,
    )
    heatmap_rgb[..., 0] = heatmap_np
    heatmap_rgb[..., 1] = np.clip(255 - np.abs(heatmap_np.astype(np.int16) - 128) * 2, 0, 255)
    heatmap_rgb[..., 2] = 255 - heatmap_np

    original = np.asarray(image, dtype=np.uint8)
    overlay = (
        0.55 * original.astype(np.float32)
        + 0.45 * heatmap_rgb.astype(np.float32)
    ).clip(0, 255).astype(np.uint8)

    if output_path is None:
        output_path = os.path.join(
            os.path.dirname(os.path.abspath(image_path)),
            f"gradcam_{os.path.splitext(os.path.basename(image_path))[0]}.jpg",
        )

    Image.fromarray(overlay).save(output_path, quality=92)

    class_info = CLASS_NAMES[str(int(class_index.numpy()))]

    return {
        "class": class_info["code"],
        "disease": class_info["name"],
        "target_layer": target_layer.name,
        "heatmap_path": output_path,
    }
