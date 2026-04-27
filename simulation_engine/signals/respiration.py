import math
import random


class RespirationGenerator:
    """
    Respiration waveform generator.
    Breathing rate and amplitude are EMA-smoothed state variables so they
    drift gradually between calm and stressed targets — never jump abruptly.
    """

    def __init__(self, calm_rate=14.0, stress_rate=26.0):
        self.calm_rate = calm_rate
        self.stress_rate = stress_rate
        self.t = 0.0
        self.current_rate = float(calm_rate)
        self.current_amplitude = 0.95
        self._alpha = 0.03    # very slow rate/amplitude drift

    def generate(self, stress_level: float) -> float:
        # Interpolated physiological targets
        target_rate = self.calm_rate + stress_level * (self.stress_rate - self.calm_rate)
        # Shallower, faster breathing under stress
        target_amplitude = 0.95 - stress_level * 0.35

        # EMA smooth both
        self.current_rate      += self._alpha * (target_rate      - self.current_rate)
        self.current_amplitude += self._alpha * (target_amplitude - self.current_amplitude)

        hz = self.current_rate / 60.0
        self.t += 0.1

        # Tiny noise only — no per-tick amplitude re-randomisation
        noise = random.gauss(0, 0.004)
        val = self.current_amplitude * math.sin(2 * math.pi * hz * self.t) + noise
        return round(val, 3)
