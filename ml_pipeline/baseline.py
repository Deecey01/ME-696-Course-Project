import numpy as np

class BaselineCalibrator:
    # Physiological floors for standard deviations. 
    # If the user is perfectly still/calm during baseline, the math std approaches 0.
    # We enforce these minimums so that a tiny change doesn't result in a massive Z-score.
    MIN_STDS = {
        "combined_motion": 0.05,
        "gsr_peak_count": 0.5,
        "gsr_slope": 0.005,
        "gsr_std": 0.02,
        "gyro_variance": 0.005,
        "hr_mean": 2.0,
        "hrv_std": 2.0,
        "imu_peak_count": 0.5,
        "imu_variance": 0.005,
        "mean_gsr": 0.2,
        "mean_hrv": 2.0,
        "respiration_mean": 0.05,
        "respiration_variability": 0.05,
        "resp_zero_crossings": 1.0,
    }

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
            # Use physiological floor or math std, whichever is higher
            min_floor = self.MIN_STDS.get(k, 0.01)
            self.stds[k] = max(np.std(vals), min_floor)
            
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
            # Clamp the Z-score to [-8.0, 8.0] to prevent extreme outliers from blowing up model probabilities
            val = max(-8.0, min(8.0, val))
            normalized.append(float(val))
        return normalized

    def reset(self):
        self.samples = []
        self.is_calibrated = False
