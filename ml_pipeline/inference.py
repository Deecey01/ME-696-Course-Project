from fastapi import FastAPI
from pydantic import BaseModel
from typing import Dict, Optional
import uvicorn
import os

from features import FeatureExtractor
from baseline import BaselineCalibrator
from model import StressModel

app = FastAPI(title="Stress Detection ML Pipeline")

# Buffer setup
extractor  = FeatureExtractor(window_size=50)
calibrator = BaselineCalibrator(required_samples=300)
MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")

ml_model = StressModel(MODEL_PATH)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class SensorData(BaseModel):
    timestamp: int
    gsr: float
    hr: float
    hrv: float
    imu: Dict[str, float]
    respiration: float
    stress_level: Optional[float] = None   # forwarded from simulator for logging


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.post("/predict")
async def predict_stress(data: SensorData):
    extractor.add_data(data.model_dump())

    features = extractor.compute_features()
    if not features:
        return {"status": "buffering", "message": "Gathering initial window data."}

    is_calibrated = calibrator.add_features(features)

    if not is_calibrated:
        return {
            "status": "calibrating",
            "progress": len(calibrator.samples) / calibrator.required_samples,
            "raw_features": features,
        }

    normalized_vec = calibrator.normalize(features)

    # Safety: reject if feature count doesn't match the model
    if len(normalized_vec) != StressModel.N_FEATURES:
        return {"status": "error", "message": f"Feature count mismatch ({len(normalized_vec)} vs {StressModel.N_FEATURES})"}

    score = ml_model.predict(normalized_vec)

    return {
        "status": "success",
        "stress_score": round(score, 2),
        "normalized_features": [round(f, 4) for f in normalized_vec],
    }


@app.post("/baseline")
async def start_baseline():
    calibrator.reset()
    return {"status": "success", "message": "Baseline calibration restarted. Send data to /predict."}


@app.get("/baseline/status")
async def baseline_status():
    return calibrator.format_calibration()


if __name__ == "__main__":
    uvicorn.run("inference:app", host="0.0.0.0", port=8001, reload=True)
