from ML.ML_Module.predict import predict_skin_disease


def analyze_image(image_path: str):
    return predict_skin_disease(image_path)