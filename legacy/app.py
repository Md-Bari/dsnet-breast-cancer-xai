import os
import numpy as np
import cv2
import tensorflow as tf
from flask import Flask, request, render_template
from tensorflow.keras.models import load_model

# ==============================
# Flask setup
# ==============================
app = Flask(__name__)

# Folders for uploads and explain images
UPLOAD_FOLDER = os.path.join("static", "uploads")
EXPLAIN_FOLDER = os.path.join("static", "explain")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(EXPLAIN_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# ==============================
# Load model
# ==============================
MODEL_PATH = "Ds-Net-p3-final_fold5_best.h5"
model = load_model(MODEL_PATH)
CLASS_NAMES = {0: "Benign", 1: "Malignant"}

# ==============================
# Image preprocessing
# ==============================
IMG_SIZE = (224, 224)

def preprocess(img_path):
    img = cv2.imread(img_path)
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img_resized = cv2.resize(img_rgb, IMG_SIZE)
    input_tensor = np.expand_dims(img_resized / 255.0, axis=0).astype(np.float32)
    return img_resized, input_tensor

# ==============================
# Grad-CAM
# ==============================
def find_last_conv(model):
    for layer in reversed(model.layers):
        if 'conv' in layer.name:
            return layer.name
    raise ValueError("No convolutional layer found!")

def grad_cam(model, img_array, layer_name, class_index):
    img_tensor = tf.convert_to_tensor(img_array, dtype=tf.float32)
    grad_model = tf.keras.models.Model(
        inputs=model.inputs,
        outputs=[model.get_layer(layer_name).output, model.output]
    )

    with tf.GradientTape() as tape:
        tape.watch(img_tensor)
        conv_outputs, preds = grad_model(img_tensor)
        preds = tf.squeeze(preds)
        if len(preds.shape) == 1:
            loss = preds[class_index]
        else:
            loss = preds[0, class_index]

    grads = tape.gradient(loss, conv_outputs)
    weights = tf.reduce_mean(grads, axis=(0,1,2))
    cam = np.zeros(conv_outputs.shape[1:3], dtype=np.float32)
    conv_outputs_np = conv_outputs[0].numpy() if isinstance(conv_outputs, tf.Tensor) else conv_outputs[0]

    for i, w in enumerate(weights):
        cam += w * conv_outputs_np[:, :, i]

    cam = np.maximum(cam, 0)
    cam = cv2.resize(cam, IMG_SIZE)
    cam = cam - cam.min()
    cam = cam / (cam.max() + 1e-8)
    return cam

def overlay(img, cam):
    heatmap = cv2.applyColorMap(np.uint8(255*cam), cv2.COLORMAP_JET)
    overlay_img = cv2.addWeighted(img, 0.5, heatmap, 0.5, 0)
    return overlay_img

# ==============================
# Flask route
# ==============================
@app.route("/", methods=["GET","POST"])
def index():
    result = None
    gradcam_filename = None

    if request.method == "POST":
        file = request.files["file"]
        filename = file.filename

        # Save original image
        upload_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(upload_path)

        # Preprocess and predict
        img_resized, input_tensor = preprocess(upload_path)
        preds = model.predict(input_tensor)[0]
        class_idx = int(np.argmax(preds))
        confidence = float(np.max(preds)) * 100

        # ==============================
        # Unknown / Not Matched Decision
        # ==============================
        CONFIDENCE_THRESHOLD = 0.5  # 50%
        if confidence/100 < CONFIDENCE_THRESHOLD:
            class_idx = 2  # Unknown / Not Matched
            CLASS_NAMES[2] = "Unknown"

        result = {
            "image": filename,
            "prediction": CLASS_NAMES[class_idx],
            "confidence": confidence
        }

        # Grad-CAM only if matched class (0 or 1)
        if class_idx in [0,1]:
            last_conv = find_last_conv(model)
            cam = grad_cam(model, input_tensor, last_conv, class_idx)
            overlay_img = overlay(img_resized, cam)

            # Save Grad-CAM image
            gradcam_filename = "gradcam_" + filename
            gradcam_path = os.path.join(EXPLAIN_FOLDER, gradcam_filename)
            cv2.imwrite(gradcam_path, cv2.cvtColor(overlay_img, cv2.COLOR_RGB2BGR))
        else:
            gradcam_filename = None  # no Grad-CAM for unknown

    return render_template("index.html", result=result, gradcam_path=gradcam_filename)

# ==============================
if __name__ == "__main__":
    app.run(debug=True)
