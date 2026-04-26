import numpy as np


class FeatureExtractor:
    """
    Extracts 14 physiological features from a 5-second sliding window (50 samples @ 10 Hz).

    Feature names (alphabetical — must stay sorted to match BaselineCalibrator):
        combined_motion, gsr_peak_count, gsr_slope, gsr_std,
        gyro_variance, hr_mean, hrv_std, imu_peak_count,
        imu_variance, mean_gsr, mean_hrv, respiration_mean,
        respiration_variability, resp_zero_crossings
    """

    def __init__(self, window_size: int = 50):
        self.window_size = window_size
        self.buffer: list = []

    def add_data(self, data: dict) -> None:
        self.buffer.append(data)
        if len(self.buffer) > self.window_size:
            self.buffer.pop(0)

    def compute_features(self) -> dict | None:
        if len(self.buffer) < self.window_size:
            return None

        gsr_vals  = np.array([d["gsr"]         for d in self.buffer])
        hrv_vals  = np.array([d["hrv"]         for d in self.buffer])
        hr_vals   = np.array([d["hr"]          for d in self.buffer])
        resp_vals = np.array([d["respiration"] for d in self.buffer])

        imu_mags = np.array([
            np.sqrt(d["imu"]["ax"]**2 + d["imu"]["ay"]**2 + d["imu"]["az"]**2)
            for d in self.buffer
        ])
        gyro_mags = np.array([
            np.sqrt(d["imu"]["gx"]**2 + d["imu"]["gy"]**2 + d["imu"]["gz"]**2)
            for d in self.buffer
        ])

        # ── GSR features ────────────────────────────────────────────────────
        mean_gsr      = float(np.mean(gsr_vals))
        gsr_std       = float(np.std(gsr_vals))
        gsr_diffs     = np.diff(gsr_vals)
        gsr_peak_count = float(np.sum(gsr_diffs > 0.12))
        # Linear slope over the window (positive = rising GSR → sympathetic activation)
        t = np.arange(len(gsr_vals), dtype=float)
        gsr_slope = float(np.polyfit(t, gsr_vals, 1)[0])

        # ── HRV / HR features ────────────────────────────────────────────────
        mean_hrv = float(np.mean(hrv_vals))
        hrv_std  = float(np.std(hrv_vals))
        hr_mean  = float(np.mean(hr_vals))

        # ── IMU features ─────────────────────────────────────────────────────
        imu_variance  = float(np.var(imu_mags))
        gyro_variance = float(np.var(gyro_mags))
        combined_motion = float(np.mean(imu_mags) + np.mean(gyro_mags))
        # Peaks = samples more than 1.5 std above window mean
        imu_threshold  = np.mean(imu_mags) + 1.5 * np.std(imu_mags)
        imu_peak_count = float(np.sum(imu_mags > imu_threshold))

        # ── Respiration features ─────────────────────────────────────────────
        respiration_mean        = float(np.mean(resp_vals))
        respiration_variability = float(np.std(resp_vals))
        # Zero-crossing rate ≈ 2× breathing frequency
        signs = np.sign(resp_vals)
        signs[signs == 0] = 1   # treat zero as positive
        resp_zero_crossings = float(np.sum(np.diff(signs) != 0))

        return {
            "combined_motion":          combined_motion,
            "gsr_peak_count":           gsr_peak_count,
            "gsr_slope":                gsr_slope,
            "gsr_std":                  gsr_std,
            "gyro_variance":            gyro_variance,
            "hr_mean":                  hr_mean,
            "hrv_std":                  hrv_std,
            "imu_peak_count":           imu_peak_count,
            "imu_variance":             imu_variance,
            "mean_gsr":                 mean_gsr,
            "mean_hrv":                 mean_hrv,
            "respiration_mean":         respiration_mean,
            "respiration_variability":  respiration_variability,
            "resp_zero_crossings":      resp_zero_crossings,
        }
