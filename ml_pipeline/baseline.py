import numpy as np

class BaselineCalibrator:
    def __init__(self, required_samples=300):
        # 30 seconds at 10Hz
        self.required_samples = required_samples
        self.samples = []
        self.means = {}
        self.stds = {}
        self.is_calibrated = False

    def add_features(self, features: dict) -> bool:
        """Returns True if calibration completes"""
        if self.is_calibrated:
            return True
            
        self.samples.append(features)
        if len(self.samples) >= self.required_samples:
            self.calibrate()
            return True
        return False
        
    def calibrate(self):
        keys = self.samples[0].keys()
        for k in keys:
            vals = [s[k] for s in self.samples]
            self.means[k] = np.mean(vals)
            # Add small epsilon to prevent div by zero
            self.stds[k] = max(np.std(vals), 1e-6)
            
        self.is_calibrated = True
        self.samples = []

    def format_calibration(self):
        return {
            "is_calibrated": self.is_calibrated,
            "means": self.means,
            "stds": self.stds
        }
        
    def normalize(self, features: dict) -> list:
        """Returns normalized feature list mapping alphabetically to feature names deterministically."""
        keys = sorted(features.keys())
        
        if not self.is_calibrated:
            return [float(features[k]) for k in keys]
            
        normalized = []
        for k in keys:
            val = (features[k] - self.means.get(k, 0)) / self.stds.get(k, 1)
            normalized.append(float(val))
        return normalized

    def reset(self):
        self.samples = []
        self.is_calibrated = False
