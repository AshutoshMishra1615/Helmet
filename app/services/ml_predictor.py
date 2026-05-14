"""
ml_predictor.py — Machine Learning predictive logic for early anomaly warnings.
"""

import logging
import numpy as np
from sklearn.linear_model import LinearRegression

logger = logging.getLogger(__name__)

# We use the same WARNING threshold as our deterministic logic, 
# but we aim to predict it before it actually happens.
GAS_WARNING_THRESHOLD = 200

# Number of points to project into the future. 
# Depending on sensor transmit frequency, 10 units = ~20-30 seconds.
TREND_PREDICTION_STEPS = 10  

def predict_gas_trend_anomaly(recent_gas_levels: list[int]) -> bool:
    """
    Returns True if a Linear Regression on `recent_gas_levels` projects
    that the gas level will cross GAS_WARNING_THRESHOLD in the near future.
    """
    if len(recent_gas_levels) < 5:
        # Not enough data points to form a reliable trend line
        return False

    # recent_gas_levels is ordered newest-first from get_recent_gas_levels()
    # Reverse it so the data is chronological: [oldest, ..., newest]
    chronological_gas = recent_gas_levels[::-1]
    
    y = np.array(chronological_gas).reshape(-1, 1)
    X = np.arange(len(y)).reshape(-1, 1)

    # Fit ordinary least squares linear regression
    model = LinearRegression()
    model.fit(X, y)

    # Predict the gas level `TREND_PREDICTION_STEPS` into the future
    future_X = np.array([[len(y) - 1 + TREND_PREDICTION_STEPS]])
    future_y_pred = model.predict(future_X)[0][0]
    
    # Check the slope (rate of change)
    slope = model.coef_[0][0]

    # Only flag an anomaly if the gas is actively rising and projected to breach the threshold
    anomaly = (future_y_pred > GAS_WARNING_THRESHOLD) and (slope > 0)
    
    if anomaly:
        logger.warning(
            "ML PREDICTIVE ANOMALY ⚠ | Slope=%.2f | Projected gas in %d ticks: %.1f > %d",
            slope, TREND_PREDICTION_STEPS, future_y_pred, GAS_WARNING_THRESHOLD
        )
        
    return bool(anomaly)
