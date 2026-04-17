import random
import time

class GSRGenerator:
    def __init__(self, base_calm=2.0, base_stress=5.0):
        self.base_calm = base_calm
        self.base_stress = base_stress
        self.current_value = base_calm
        self.last_spike_time = 0
        
    def generate(self, stress_active: bool) -> float:
        # A slow random walk toward the target base
        target = self.base_stress if stress_active else self.base_calm
        
        # move slowly towards target
        self.current_value += (target - self.current_value) * 0.05
        
        # add constant low-level noise
        noise = random.uniform(-0.05, 0.05)
        self.current_value += noise
        
        # Occasional spikes during stress
        current_time = time.time()
        if stress_active and (current_time - self.last_spike_time > random.uniform(2, 5)):
            self.current_value += random.uniform(0.5, 1.5)
            self.last_spike_time = current_time
            
        return round(max(0.1, self.current_value), 3)
