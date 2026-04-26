import joblib
import os
import numpy as np
import xgboost as xgb
from xgboost import XGBClassifier


class StressModel:
    """
    XGBClassifier wrapper for inference.
    """

    # Expected number of input features — used to detect stale model files
    N_FEATURES = 14

    def __init__(self, model_path: str = "model.pkl"):
        self.model_path = model_path
        self.is_trained = False
        self.model: XGBClassifier | None = None

        # Load model, validating feature count to detect stale .pkl files
        if os.path.exists(self.model_path):
            try:
                candidate = joblib.load(self.model_path)
                # Reject model if trained on wrong number of features
                if hasattr(candidate, "n_features_in_") and candidate.n_features_in_ != self.N_FEATURES:
                    print(f"[StressModel] Stale model ({candidate.n_features_in_} features). Inference unavailable until new model is trained.")
                    self.model = None
                else:
                    self.model = candidate
                    self.is_trained = True
                    print(f"[StressModel] Loaded existing model from {self.model_path}")
            except Exception as e:
                print(f"[StressModel] Load failed ({e}).")
        else:
            print(f"[StressModel] Model file {self.model_path} not found.")

    # ── Public API ──────────────────────────────────────────────────────────

    def predict(self, feature_vector: list) -> float:
        """Return stress probability as 0–100 float."""
        if not self.is_trained or self.model is None:
            return 0.0

        X = np.array([feature_vector])
        if X.shape[1] != self.N_FEATURES:
            return 0.0

        try:
            proba = self.model.predict_proba(X)[0][1]
            return float(proba * 100.0)
        except Exception:
            return 0.0
