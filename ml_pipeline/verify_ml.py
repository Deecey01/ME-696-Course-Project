import subprocess
import time
import urllib.request
import json
import socket
import os
from contextlib import closing

def is_port_in_use(port):
    with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as s:
        return s.connect_ex(('localhost', port)) == 0

if is_port_in_use(8001):
    print("Port 8001 is already in use")
    exit(1)

env = os.environ.copy()
env['PYTHONUNBUFFERED'] = '1'

python_exe = os.path.join("venv", "Scripts", "python.exe")
if not os.path.exists(python_exe):
    python_exe = "python"

print("Starting ML inference server...")
p = subprocess.Popen([python_exe, 'inference.py'], env=env)
time.sleep(5)

dummy_data = {
  "timestamp": 1234567890,
  "gsr": 2.1,
  "hr": 78,
  "hrv": 42,
  "imu": {
    "ax": 0.02, "ay": -0.01, "az": 0.98,
    "gx": 0.5, "gy": -0.2, "gz": 0.1
  },
  "respiration": 0.35
}

def post(url, payload):
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'}, method='POST')
    res = urllib.request.urlopen(req)
    return json.loads(res.read())

try:
    print("\n--- Push single point (should buffer) ---")
    print(post('http://localhost:8001/predict', dummy_data))
    
    print("\n--- Pushing 50 points to trigger feature extraction but wait for calibration ---")
    for _ in range(50):
        resp = post('http://localhost:8001/predict', dummy_data)
    print(resp)
    
    print("\n--- Pushing 250 more points to finish baseline calibration ---")
    for _ in range(250):
        resp = post('http://localhost:8001/predict', dummy_data)
    print("Baseline status:")
    print(resp.get('status'))
    
    print("\n--- Push final point to get actual prediction Stress Score ---")
    # Increase GSR a bit to mimic a change
    dummy_data["gsr"] = 4.5
    final_pred = post('http://localhost:8001/predict', dummy_data)
    print(json.dumps(final_pred, indent=2))
finally:
    p.terminate()
    print("\nML Server terminated.")
