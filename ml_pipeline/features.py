import numpy as np

class FeatureExtractor:
    def __init__(self, window_size=50): 
        # Assuming 10Hz data, 50 points = 5 seconds window
        self.window_size = window_size
        self.buffer = []
        
    def add_data(self, data: dict):
        self.buffer.append(data)
        if len(self.buffer) > self.window_size:
            self.buffer.pop(0)
            
    def compute_features(self) -> dict:
        if len(self.buffer) < self.window_size:
            return None
            
        gsr_vals = [d["gsr"] for d in self.buffer]
        hrv_vals = [d["hrv"] for d in self.buffer]
        resp_vals = [d["respiration"] for d in self.buffer]
        
        imu_mags = [np.sqrt(d["imu"]["ax"]**2 + d["imu"]["ay"]**2 + d["imu"]["az"]**2) for d in self.buffer]
        gyro_mags = [np.sqrt(d["imu"]["gx"]**2 + d["imu"]["gy"]**2 + d["imu"]["gz"]**2) for d in self.buffer]
        
        mean_gsr = np.mean(gsr_vals)
        gsr_diffs = np.diff(gsr_vals)
        peak_count = np.sum(gsr_diffs > 0.5) 
        
        mean_hrv = np.mean(hrv_vals)
        imu_var = np.var(imu_mags)
        gyro_var = np.var(gyro_mags)
        
        mean_resp = np.mean(resp_vals)
        comb_mag = np.mean(imu_mags) + np.mean(gyro_mags)
        
        return {
            "combined_motion": float(comb_mag),
            "gsr_peak_count": float(peak_count),
            "gyro_variance": float(gyro_var),
            "imu_variance": float(imu_var),
            "mean_gsr": float(mean_gsr),
            "mean_hrv": float(mean_hrv),
            "respiration_mean": float(mean_resp)
        }
