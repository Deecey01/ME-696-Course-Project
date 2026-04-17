import random

class HRVGenerator:
    def __init__(self, calm_hr=70, stress_hr=95):
        self.calm_hr = calm_hr
        self.stress_hr = stress_hr
        self.current_hr = calm_hr
        # HRV is inversely related to HR and stress. We'll use RMSSD proxy in ms.
        # Calm HRV ~ 40-60 ms. Stress HRV ~ 10-25 ms.
        self.current_hrv = 50.0

    def generate(self, stress_active: bool) -> tuple[int, int]:
        target_hr = self.stress_hr + random.uniform(-5, 5) if stress_active else self.calm_hr + random.uniform(-3, 3)
        target_hrv = random.uniform(10, 25) if stress_active else random.uniform(40, 60)
        
        # Slowly adapt HR and HRV to targets (simulate physiological persistence)
        self.current_hr += (target_hr - self.current_hr) * 0.1
        self.current_hrv += (target_hrv - self.current_hrv) * 0.1
        
        return int(round(self.current_hr)), int(round(self.current_hrv))
