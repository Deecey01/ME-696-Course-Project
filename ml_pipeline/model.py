import joblib
import os
import numpy as np
from sklearn.linear_model import SGDClassifier

class StressModel:
    def __init__(self, model_path="model.pkl"):
        self.model_path = model_path
        if os.path.exists(self.model_path):
            self.model = joblib.load(self.model_path)
            self.is_trained = True
        else:
            self.model = SGDClassifier(loss='log_loss', random_state=42)
            self.is_trained = False
            
    def predict(self, feature_vector: list) -> float:
        if not self.is_trained:
            return 0.0
            
        X = np.array([feature_vector])
        
        try:
            proba = self.model.predict_proba(X)[0][1]
            return float(proba * 100.0)
        except Exception:
            return 0.0
            
    def train(self, X: list, y: list):
        """Perform an incremental partial fit"""
        self.model.partial_fit(X, y, classes=np.array([0, 1]))
        self.is_trained = True
        self.save()
        
    def save(self):
        joblib.dump(self.model, self.model_path)
