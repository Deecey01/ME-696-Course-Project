import random
import math


class IMUGenerator:
    """
    IMU (accelerometer + gyroscope) generator.
    Per-axis EMA state prevents sample-to-sample jumps.
    Noise amplitude and burst magnitude scale linearly with stress_level.
    """

    def __init__(self):
        self.t = 0.0
        self._alpha = 0.06   # slightly faster EMA since IMU reacts faster

        # EMA state for each axis
        self.ax = 0.0
        self.ay = 0.0
        self.az = 1.0   # gravity baseline
        self.gx = 0.0
        self.gy = 0.0
        self.gz = 0.0

    def generate(self, stress_level: float) -> dict:
        self.t += 0.1   # 100ms step

        # Scale noise std linearly: near-zero when calm, grows with stress
        accel_std = 0.018 + stress_level * 0.16
        gyro_std  = 0.04  + stress_level * 0.55

        # Sinusoidal burst factor simulates agitated movement
        burst = math.sin(self.t * 2.5) * stress_level * 0.75

        # Compute noisy targets
        t_ax = random.gauss(0,   accel_std)       + burst * 0.14
        t_ay = random.gauss(0,   accel_std)       + burst * 0.10
        t_az = random.gauss(1.0, accel_std * 0.5) + burst * 0.18
        t_gx = random.gauss(0,   gyro_std)        + burst * 1.4
        t_gy = random.gauss(0,   gyro_std)        + burst * 1.1
        t_gz = random.gauss(0,   gyro_std * 0.7)  + burst * 0.7

        # EMA smooth each axis
        self.ax += self._alpha * (t_ax - self.ax)
        self.ay += self._alpha * (t_ay - self.ay)
        self.az += self._alpha * (t_az - self.az)
        self.gx += self._alpha * (t_gx - self.gx)
        self.gy += self._alpha * (t_gy - self.gy)
        self.gz += self._alpha * (t_gz - self.gz)

        return {
            "ax": round(self.ax, 3),
            "ay": round(self.ay, 3),
            "az": round(self.az, 3),
            "gx": round(self.gx, 3),
            "gy": round(self.gy, 3),
            "gz": round(self.gz, 3),
        }
