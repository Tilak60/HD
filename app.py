from flask import Flask, request, jsonify, render_template
from werkzeug.utils import secure_filename
import os
import librosa
import numpy as np
import joblib
import tensorflow as tf

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = './uploads'
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# --- Model Loading ---
# Make sure these paths are correct and point to where your models are saved
# After running the Colab notebook, download these from your Google Drive
RANDOM_FOREST_MODEL_PATH = 'models/random_forest_model.joblib'
CNN_LSTM_MODEL_PATH = 'models/cnn_lstm_model.h5'
LABEL_ENCODER_PATH = 'models/label_encoder.joblib'
FEATURE_SCALER_PATH = 'models/feature_scaler.joblib'

rf_model = None
cnn_lstm_model = None
label_encoder = None
feature_scaler = None

def load_models():
    global rf_model, cnn_lstm_model, label_encoder, feature_scaler
    try:
        rf_model = joblib.load(RANDOM_FOREST_MODEL_PATH)
        cnn_lstm_model = tf.keras.models.load_model(CNN_LSTM_MODEL_PATH)
        label_encoder = joblib.load(LABEL_ENCODER_PATH)
        feature_scaler = joblib.load(FEATURE_SCALER_PATH)
        print("Models loaded successfully!")
        print(f"Label Encoder classes: {label_encoder.classes_}")
    except Exception as e:
        print(f"Error loading models: {e}")
        print("Please ensure models are saved in the 'models/' directory relative to app.py")

# Ensure models directory exists
os.makedirs('models', exist_ok=True)

# Load models on startup
with app.app_context():
    load_models()

# --- Preprocessing Function (Same as in Colab Notebook) ---
def extract_features(file_path, n_mfcc=40):
    try:
        audio, sample_rate = librosa.load(file_path, res_type='kaiser_fast')
        mfccs = librosa.feature.mfcc(y=audio, sr=sample_rate, n_mfcc=n_mfcc)
        mfccs_processed = np.mean(mfccs.T, axis=0)
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return None
    return mfccs_processed

def get_recommendation(prediction_label):
    recommendations = {
        "Normal": "Maintain a healthy lifestyle with regular exercise and balanced diet.",
        "Murmur": "Consider consulting a doctor for further evaluation and maintain daily walking/exercise.",
        "Noisy": "It is highly recommended to consult a doctor immediately for a detailed check-up."
    }
    return recommendations.get(prediction_label, "Consult a healthcare professional for advice.")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files['audio']
    if audio_file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if audio_file:
        filename = secure_filename(audio_file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        audio_file.save(filepath)

        # Preprocess the uploaded audio
        features = extract_features(filepath)

        if features is None:
            # Only remove file if feature extraction failed, as it might be corrupt/unreadable
            os.remove(filepath)
            return jsonify({"error": "Could not extract features from audio or audio file is corrupt."}), 500

        os.remove(filepath) # Clean up uploaded file only after successful feature extraction

        # Ensure scaler is loaded
        if feature_scaler is None:
            return jsonify({"error": "Feature scaler not loaded. Please check model files."}), 500

        # Scale features
        features_scaled = feature_scaler.transform(features.reshape(1, -1))

        # Predict with Random Forest
        rf_prediction_encoded = rf_model.predict(features_scaled)
        rf_prediction_label = label_encoder.inverse_transform(rf_prediction_encoded)[0]

        # Predict with CNN+LSTM
        cnn_input = np.expand_dims(features_scaled, axis=2) # Reshape for CNN
        cnn_lstm_prediction_prob = cnn_lstm_model.predict(cnn_input)[0]
        cnn_lstm_prediction_encoded = np.argmax(cnn_lstm_prediction_prob)
        cnn_lstm_prediction_label = label_encoder.inverse_transform([cnn_lstm_prediction_encoded])[0]

        # For simplicity, let's use the Random Forest prediction as the primary for now.
        # You can implement a more sophisticated ensemble or choose one based on performance.
        predicted_condition = rf_prediction_label
        recommendation = get_recommendation(predicted_condition)

        # Optionally, you can return both predictions or a weighted average
        return jsonify({
            "predicted_condition": predicted_condition,
            "recommendation": recommendation,
            "rf_prediction": rf_prediction_label,
            "cnn_lstm_prediction": cnn_lstm_prediction_label
        })
