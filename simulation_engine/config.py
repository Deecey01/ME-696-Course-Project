# simulation_engine/config.py

class Config:
    # Sampling parameters
    SAMPLE_RATE_HZ = 10
    UPDATE_INTERVAL_MS = 100
    
    # Server configuration
    HOST = "localhost"
    PORT = 8000
    
    # Physiological base parameters
    GSR_BASE_CALM = 2.0      # uS
    GSR_BASE_STRESS = 5.0    # uS
    
    HR_BASE_CALM = 70.0      # BPM
    HR_BASE_STRESS = 95.0    # BPM
    
    RESP_RATE_CALM = 15.0    # cycles/min
    RESP_RATE_STRESS = 25.0  # cycles/min
