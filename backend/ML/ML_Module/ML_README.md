\# Skin Disease Detection — ML Module



\## 1. Model



Model: EfficientNetB0 with transfer learning



Input size:

224 × 224 × 3 RGB image



Framework:

TensorFlow / Keras



Model file:

skin\_disease\_model.keras



\---



\## 2. Dataset



Dataset:

HAM10000



Total images:

10,015



Unique lesions:

7,470



The dataset was split by lesion\_id rather than by individual image to prevent

the same lesion from appearing in multiple splits.



\### Dataset split



Train: 6,981 images

Validation: 1,532 images

Test: 1,502 images



Leakage checks:



Train ∩ Validation = 0

Train ∩ Test = 0

Validation ∩ Test = 0



\---



\## 3. Classes



The model predicts 7 skin-lesion classes:



| Code | Disease |

|------|---------|

| akiec | Actinic keratoses / intraepithelial carcinoma |

| bcc | Basal cell carcinoma |

| bkl | Benign keratosis-like lesions |

| df | Dermatofibroma |

| mel | Melanoma |

| nv | Melanocytic nevi |

| vasc | Vascular lesions |



The class mapping is stored in:



class\_names.json



\---



\## 4. Model Performance



Validation Accuracy:

72.52%



Test Accuracy:

71.77%



These results are from the held-out validation and test datasets.



\---



\## 5. Prediction



The prediction module is:



predict.py



The main prediction function is:



predict\_skin\_disease(image\_path)



Example:



from predict import predict\_skin\_disease



result = predict\_skin\_disease("image.jpg")



print(result)



Expected output:



{

&#x20;   "class": "nv",

&#x20;   "disease": "Melanocytic nevi",

&#x20;   "confidence": 99.74

}



\---



\## 6. Backend Integration



The backend should:



1\. Receive an uploaded skin image.

2\. Temporarily store the image.

3\. Pass the image path to predict\_skin\_disease().

4\. Receive the prediction result.

5\. Return the result to the frontend.



The prediction result contains:



\- class

\- disease

\- confidence



\---



\## 7. Input Requirements



The model expects:



\- A skin-lesion image

\- JPG or PNG format

\- RGB image



The prediction module automatically resizes the image to 224 × 224.



\---



\## 8. Important Medical Disclaimer



This model is an AI research/prototype system and should not be presented

as a medical diagnostic tool.



Model confidence is not equivalent to medical certainty.



The application should clearly state that predictions are for

informational/educational purposes and that users should consult a

qualified medical professional for diagnosis.



\---



\## 9. Files to Share With Backend Team



The backend team needs:



1\. skin\_disease\_model.keras

2\. class\_names.json

3\. predict.py

4\. ML\_README.md



These files contain the trained model, class mapping,

prediction logic, and integration instructions.

