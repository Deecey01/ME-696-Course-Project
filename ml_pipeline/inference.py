from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Optional
import uvicorn
import os

from features import FeatureExtractor
from baseline import BaselineCalibrator
from model import StressModel

app = FastAPI(title="Stress Detection ML Pipeline")

# Buffer setup
extractor = FeatureExtractor(window_size=50) 
calibrator = BaselineCalibrator(required_samples=300) 
MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")

# Warm start the model if it doesnt exist to prevent cold start failures
if not os.path.exists(MODEL_PATH):
    import train
    train.warm_start_model()

ml_model = StressModel(MODEL_PATH)

class SensorData(BaseModel):
    timestamp: int
    gsr: float
    hr: float
    hrv: float
    imu: Dict[str, float]
    respiration: float

class TrainData(BaseModel):
    features: List[float]
    label: int

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
            "raw_features": features
        }
    
    normalized_vec = calibrator.normalize(features)
    score = ml_model.predict(normalized_vec)
    
    return {
        "status": "success",
        "stress_score": round(score, 2),
        "normalized_features": [round(f, 4) for f in normalized_vec]
    }

@app.post("/baseline")
async def start_baseline():
    calibrator.reset()
    return {"status": "success", "message": "Baseline calibration restarted. Send data to /predict."}

@app.get("/baseline/status")
async def baseline_status():
    return calibrator.format_calibration()

@app.post("/train")
async def trigger_training(samples: List[TrainData]):
    """Accepts a batch of normalized feature vectors and their labels (0 or 1) to incrementally train."""
    if not samples:
        raise HTTPException(status_code=400, detail="Empty samples array")
        
    X = [s.features for s in samples]
    y = [s.label for s in samples]
    
    ml_model.train(X, y)
    return {"status": "success", "message": f"Model incrementally retrained on {len(samples)} samples."}

if __name__ == "__main__":
    uvicorn.run("inference:app", host="0.0.0.0", port=8001, reload=True)
