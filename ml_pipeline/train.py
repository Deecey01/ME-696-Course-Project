import numpy as np
import os
from model import StressModel

def warm_start_model():
    model_path = os.path.join(os.path.dirname(__file__), "model.pkl")
    model = StressModel(model_path)
    
    # 7 features sorted alphabetically:
    # 0: combined_motion
    # 1: gsr_peak_count
    # 2: gyro_variance
    # 3: imu_variance
    # 4: mean_gsr
    # 5: mean_hrv
    # 6: respiration_mean
    
    X_calm = np.random.randn(100, 7) * 0.1
    y_calm = np.zeros(100)
    
    X_stress = np.random.randn(100, 7) * 0.5
    X_stress[:, 4] += 2.0 # mean_gsr high
    X_stress[:, 5] -= 1.0 # mean_hrv drops
    X_stress[:, 0] += 1.0 # high motion
    
    y_stress = np.ones(100)
    
    X = np.vstack((X_calm, X_stress))
    y = np.concatenate((y_calm, y_stress))
    
    # shuffle
    idx = np.random.permutation(200)
    X = X[idx]
    y = y[idx]
    
    model.train(X, y)
    print(f"Pre-trained model saved to {model_path}")

if __name__ == "__main__":
    warm_start_model()

