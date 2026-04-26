import random


class HRVGenerator:
    """
    Heart Rate + HRV generator.
    HR and HRV are interpolated linearly from calm to stress targets
    and updated via slow EMA to avoid rapid oscillation.
    HRV (RMSSD proxy) is inversely proportional to stress.
    """

    def __init__(self, calm_hr=70, stress_hr=100):
        self.calm_hr = float(calm_hr)
        self.stress_hr = float(stress_hr)
        self.current_hr = float(calm_hr)
        self.current_hrv = 52.0   # calm RMSSD ~40-60ms
        self._alpha = 0.04        # slow EMA (~25 ticks to close 63% of gap)

    def generate(self, stress_level: float) -> tuple[int, int]:
        # Interpolate physiological targets
        target_hr = self.calm_hr + stress_level * (self.stress_hr - self.calm_hr)
        # Small biological jitter on the target, not on the output
        target_hr += random.gauss(0, 1.2)

        # HRV: calm ~50ms, full stress ~15ms
        target_hrv = 50.0 - stress_level * 35.0
        target_hrv += random.gauss(0, 0.8)

        # EMA update
        self.current_hr += self._alpha * (target_hr - self.current_hr)
        self.current_hrv += self._alpha * (target_hrv - self.current_hrv)

        return int(round(self.current_hr)), int(round(max(5.0, self.current_hrv)))
