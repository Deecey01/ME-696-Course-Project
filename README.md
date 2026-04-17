# Smart Vest Project: Real-Time Physiological Stress Detection

The Smart Vest Project is an end-to-end, real-time physiological telemetry and machine learning system. It simulates a smart wearable vest equipped with sensors (Galvanic Skin Response, Heart Rate Variability, IMU, Respiration) and uses an incrementally trainable machine learning model to detect and alert on physiological stress events.

The project is split into three main microservices:
1. **Simulation Engine**: Generates real-time synthetic biological signals.
2. **ML Pipeline**: A sliding-window feature extractor and Logistic Regression classifier that computes dynamic stress scores.
3. **Web Dashboard**: A React frontend and FastAPI proxy backend that visualizes the data and controls the system.

---

## Tech Stack
- **Languages**: Python 3.10+, JavaScript / JSX
- **Backend & APIs**: FastAPI, Uvicorn, WebSockets
- **Machine Learning**: Scikit-Learn (SGDClassifier), NumPy
- **Frontend**: React, Vite, Tailwind CSS, Recharts, Lucide Icons

---

## Project Architecture

```
smart-vest-project/
├── simulation_engine/     # Python FastAPI app simulating 10Hz synthetic physiological data.
│   ├── signals/           # Data generators for GSR, HRV, IMU, and Respiration
│   ├── simulator.py       # Main websocket and REST streamer (Port 8000)
│   └── config.py          # Tuning parameters matching physiological limits
│
├── ml_pipeline/           # Python FastAPI Machine Learning inference server
│   ├── features.py        # Sliding window tracking (5s) for peak matching / variance
│   ├── baseline.py        # 30-second Z-score normalization logic
│   ├── model.py           # Core SGDClassifier wrapper with .partial_fit() support
│   └── inference.py       # ML API Endpoints (Port 8001)
│
├── dashboard/             
│   ├── backend/           # Python FastAPI proxy (Port 8002) coordinating simulation & ML
│   └── frontend/          # Vite + React dynamic monitoring dashboard (Port 5173)
```

---

## Getting Started

To run the entire ecosystem locally, you will need to start the three individual backend servers alongside the Vite UI. 

> **Prerequisites**: Python 3.10+, Node.js v20+

### 1. Start the Simulation Engine
This component mocks the physical vest sensors.
```bash
cd simulation_engine
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python simulator.py
```
*(Runs on http://localhost:8000)*

### 2. Start the Machine Learning Pipeline
This component handles the buffer context, z-score calibration, and stress extraction.
```bash
cd ml_pipeline
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python inference.py
```
*(Runs on http://localhost:8001)*

### 3. Start the Dashboard Proxy
Connects the simulation streams to the inference endpoints seamlessly.
```bash
cd dashboard/backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python app.py
```
*(Runs on http://localhost:8002)*

### 4. Start the Web Dashboard
Provides the realtime visualization and control GUI.
```bash
cd dashboard/frontend
npm install
npm run dev
```
*(Runs on http://localhost:5173)*

---

## How to Use the Dashboard

Once all nodes are running, open your web browser to http://localhost:5173.

1. **Dashboard Overview**: 
   - A stream of telemetry data will begin generating on the graphs almost immediately.
   - The ML Pipeline dictates the "Stress Score". Out of the box, it requires initial calibration.
2. **Run Calibration**:
   - Click the **Start 30s Baseline** button on the bottom left. 
   - The ML pipeline will record a 300-point historical window to create strict mean and standard deviation thresholds specific to the current physiological state.
3. **Trigger Stress Incident**:
   - Click the **Inject Stress Event** button.
   - The simulation engine will abruptly alter the physical telemetry generating chaotic IMU bursts, erratic respiration, elevated heart-rate, and climbing GSR voltages.
   - The React dashboard will alert in real-time once the ml_pipeline notices the values significantly exceeding normal baseline variance!
