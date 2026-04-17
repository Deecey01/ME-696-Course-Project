import subprocess
import time
import urllib.request
import json
import socket
import os

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

if is_port_in_use(8000):
    print("Port 8000 is already in use, please free it up before running verify.py")
    exit(1)

print("Starting simulator...")
# Set environment so Python doesn't buffer output
env = os.environ.copy()
env['PYTHONUNBUFFERED'] = '1'

python_exe = os.path.join("venv", "Scripts", "python.exe")
if not os.path.exists(python_exe):
    python_exe = "python" # fallback

p = subprocess.Popen([python_exe, 'simulator.py'], env=env)
time.sleep(5) # wait for uvicorn to start

try:
    print("\n--- Testing calm state (/api/data) ---")
    req = urllib.request.urlopen('http://localhost:8000/api/data')
    data = json.loads(req.read())
    print(json.dumps(data, indent=2))
    
    print("\n--- Activating stress mode... ---")
    req = urllib.request.Request('http://localhost:8000/api/stress', data=b'{"active": true}', headers={'Content-Type': 'application/json'}, method='POST')
    urllib.request.urlopen(req)
    
    time.sleep(1) # wait for some stress logic to cycle
    print("\n--- Testing stress state (/api/data) ---")
    req = urllib.request.urlopen('http://localhost:8000/api/data')
    data = json.loads(req.read())
    print(json.dumps(data, indent=2))
finally:
    p.terminate()
    print("\nSimulator terminated.")
