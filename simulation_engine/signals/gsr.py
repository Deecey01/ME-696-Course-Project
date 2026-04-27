import random
import time


class GSRGenerator:
    """
    Galvanic Skin Response generator.
    Uses EMA smoothing to produce gradual, physiologically plausible drift.
    Accepts a continuous stress_level (0.0–1.0) instead of a binary flag.
    """

    def __init__(self, base_calm=2.0, base_stress=6.5):
        self.base_calm = base_calm
        self.base_stress = base_stress
        self.current_value = base_calm
        self.last_spike_time = 0
        self._alpha = 0.03          # very slow EMA — value drifts, not jumps
        self._noise_std = 0.008     # tight noise band for uniform appearance

    def generate(self, stress_level: float) -> float:
        # Interpolate target based on continuous stress level
        target = self.base_calm + stress_level * (self.base_stress - self.base_calm)

        # EMA toward target
        self.current_value += self._alpha * (target - self.current_value)

        # Tiny Gaussian noise for realism
        self.current_value += random.gauss(0, self._noise_std)

        # Occasional electrodermal spikes only at moderate-high stress
        current_time = time.time()
        if stress_level > 0.5 and (current_time - self.last_spike_time > random.uniform(4, 9)):
            spike = random.uniform(0.25, 0.75) * stress_level
            self.current_value += spike
            self.last_spike_time = current_time

        return round(max(0.1, self.current_value), 3)
