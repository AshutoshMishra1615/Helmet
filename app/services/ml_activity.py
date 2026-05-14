"""
ml_activity.py — Random Forest ML Activity Classifier.

Trains a synthetic model to classify 'Idling', 'Walking', 'Running', and 'Fall'
based on acceleration magnitude computed from raw X, Y, Z accelerometer inputs.

Magnitude ranges (m/s²) for a real MPU-6050:
    Idling  :  ~9.5 – 10.2   (helmet resting or stationary on head)
    Walking :  ~10.5 – 13.5  (rhythmic foot-strike bumps)
    Running :  ~13.5 – 20.0  (aggressive bouncing)
    Fall    :  ~20.0 – 40.0+ (sudden impact spike)
"""

import logging
import math

import numpy as np
from sklearn.ensemble import RandomForestClassifier

logger = logging.getLogger(__name__)

# Initialize a global model
_model = None


def _generate_synthetic_data():
    """Generate synthetic (magnitude-based) training dataset tuned to real MPU-6050 readings."""
    X = []
    y = []

    # 1. Idling — magnitude ≈ 9.81 (1 g), tight spread
    for _ in range(300):
        X.append([np.random.normal(9.81, 0.3)])
        y.append("Idling")

    # 2. Walking — magnitude ≈ 10.5–13.5 (light periodic bumps)
    for _ in range(250):
        val = np.random.uniform(10.5, 13.5)
        X.append([val])
        y.append("Walking")

    # 3. Running — magnitude ≈ 13.5–20.0 (strong periodic bumps)
    for _ in range(200):
        val = np.random.uniform(13.5, 20.0)
        X.append([val])
        y.append("Running")

    # 4. Fall — magnitude > 20 (sudden impact spike)
    for _ in range(150):
        val = np.random.uniform(20.0, 45.0)
        X.append([val])
        y.append("Fall")

    return np.array(X), np.array(y)


def predict_activity(accel_x: float, accel_y: float, accel_z: float) -> str:
    global _model

    # Lazy train model if not present
    if _model is None:
        logger.info("Training activity classifier …")
        X_train, y_train = _generate_synthetic_data()
        _model = RandomForestClassifier(n_estimators=50, max_depth=6, random_state=42)
        _model.fit(X_train, y_train)
        logger.info("Activity classifier ready.")

    # Compute rotation-invariant magnitude
    magnitude = math.sqrt(accel_x**2 + accel_y**2 + accel_z**2)

    # Predict
    prediction = _model.predict([[magnitude]])[0]

    logger.info(
        "Activity ML — accel=(%.2f, %.2f, %.2f)  mag=%.2f  → %s",
        accel_x, accel_y, accel_z, magnitude, prediction,
    )

    return prediction
