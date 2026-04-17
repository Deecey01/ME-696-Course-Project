import math
import random

class RespirationGenerator:
    def __init__(self, calm_rate=15, stress_rate=25):
        self.calm_rate = calm_rate
        self.stress_rate = stress_rate
        self.t = 0.0
        
    def generate(self, stress_active: bool) -> float:
        rate = self.stress_rate if stress_active else self.calm_rate
        
        # Add slight variation to breathing rate
        rate += random.uniform(-2, 2) if stress_active else random.uniform(-0.5, 0.5)
        
        # Convert cycles per minute to hz
        hz = rate / 60.0
        
        # step time (approx 100ms updates)
        self.t += 0.1 
        
        # Sinusoidal breathing pattern
        amplitude = random.uniform(0.4, 0.8) if stress_active else random.uniform(0.8, 1.0)
        
        # Irregularities in stress
        noise = random.uniform(-0.1, 0.1) if stress_active else random.uniform(-0.02, 0.02)
        
        val = amplitude * math.sin(2 * math.pi * hz * self.t) + noise
        return round(val, 3)
