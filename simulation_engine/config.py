# simulation_engine/config.py

class Config:
    # Sampling parameters
    SAMPLE_RATE_HZ = 10
    UPDATE_INTERVAL_MS = 100

    # Server configuration
    HOST = "localhost"
    PORT = 8000

    # EMA smoothing alpha for all signal generators (lower = slower/smoother)
    SIGNAL_SMOOTH_ALPHA = 0.04

    # Stress level decay per tick (100ms). 0.003/tick → ~33s to drain from 1.0 → 0
    STRESS_DECAY_RATE = 0.003

    # How much each tap adds to stress_level. Reduced for gradual build-up.
    STRESS_TAP_INCREMENT = 0.06

    # Physiological base parameters
    GSR_BASE_CALM = 2.0      # µS
    GSR_BASE_STRESS = 6.5    # µS

    HR_BASE_CALM = 70.0      # BPM
    HR_BASE_STRESS = 100.0   # BPM

    RESP_RATE_CALM = 14.0    # cycles/min
    RESP_RATE_STRESS = 26.0  # cycles/min
