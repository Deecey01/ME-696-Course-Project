import random
import math

class IMUGenerator:
    def __init__(self):
        self.t = 0
        
    def generate(self, stress_active: bool) -> dict:
        self.t += 0.1  # 100ms step
        
        if stress_active:
            # high variance and bursts
            burst_factor = math.sin(self.t * 3) * random.uniform(0.5, 1.5)
            ax = random.gauss(0, 0.2) + burst_factor * 0.2
            ay = random.gauss(0, 0.2) + burst_factor * 0.1
            az = 1.0 + random.gauss(0, 0.2) + burst_factor * 0.3
            
            gx = random.gauss(0, 0.5) + burst_factor * 2.0
            gy = random.gauss(0, 0.5) + burst_factor * 1.5
            gz = random.gauss(0, 0.5) + burst_factor * 1.0
        else:
            # calm
            ax = random.gauss(0, 0.02)
            ay = random.gauss(0, 0.02)
            az = 1.0 + random.gauss(0, 0.02)
            
            gx = random.gauss(0, 0.05)
            gy = random.gauss(0, 0.05)
            gz = random.gauss(0, 0.05)
            
        return {
            "ax": round(ax, 3),
            "ay": round(ay, 3),
            "az": round(az, 3),
            "gx": round(gx, 3),
            "gy": round(gy, 3),
            "gz": round(gz, 3)
        }
