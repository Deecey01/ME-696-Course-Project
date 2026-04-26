# Smart Vest Project: Real-Time Physiological Stress Detection

The Smart Vest Project is an end-to-end, real-time physiological telemetry and machine learning system. It simulates a smart wearable vest equipped with sensors (Galvanic Skin Response, Heart Rate Variability, IMU, Respiration) and uses an offline-trained, highly accurate **XGBoost Classifier** to detect and alert on physiological stress events in real-time.

The project is split into several microservices:
1. **Simulation Engine**: Generates real-time synthetic biological signals.
2. **ML Pipeline**: A sliding-window feature extractor and XGBoost inference server that computes dynamic stress scores.
3. **Web Dashboard**: A React frontend and FastAPI proxy backend that visualizes the data and controls the system.
4. **Companion Apps**: A Mobile Web App and a Native Android Expo App with Bluetooth and system notification integrations.

---

## Tech Stack
- **Languages**: Python 3.10+, JavaScript / JSX, React Native
- **Backend & APIs**: FastAPI, Uvicorn, WebSockets
- **Machine Learning**: XGBoost, Scikit-Learn, NumPy, Joblib
- **Frontend / Dashboard**: React, Vite, Tailwind CSS, Recharts, Lucide Icons
- **Mobile Native**: React Native (Expo), `expo-notifications`, `expo-haptics`
- **Bluetooth**: Python `bless` (GATT Server), Web Bluetooth API

---

## Project Architecture

```
smart-vest-project/
├── simulation_engine/     # Python FastAPI app simulating 10Hz synthetic physiological data.
│   ├── signals/           # Data generators for GSR, HRV, IMU, and Respiration
│   └── simulator.py       # Main websocket and REST streamer (Port 8000)
│
├── ml_pipeline/           # Python FastAPI Machine Learning inference server
│   ├── features.py        # Sliding window tracking (5s) for peak matching / variance
│   ├── baseline.py        # 30-second Z-score normalization logic with physiological floors
│   ├── model.py           # Core XGBoost wrapper for model.pkl
│   └── inference.py       # ML API Endpoints (Port 8001)
│
├── notebooks/             # Offline GPU/CPU training environment
│   └── Train_Model.ipynb  # Generates 180k synthetic samples and trains the XGBoost model
│
├── dashboard/             
│   ├── backend/           # Proxy (Port 8002) coordinating simulation & ML
│   │   ├── app.py
│   │   └── ble_server.py  # BLE GATT Server broadcasting stress over Bluetooth
│   └── frontend/          # Desktop Vite + React monitoring dashboard (Port 5173)
│
├── mobile_app/            # Mobile-optimized Vite Web App (Port 5174)
└── native_app/            # True React Native Expo App (Push Notifications, Haptics)
```

---

## Getting Started

To simplify launching the ecosystem, you can use the unified control scripts.

> **Prerequisites**: Python 3.10+, Node.js v20+, macOS/Linux

### 1. Booting the Ecosystem

Start all backend services, the Desktop Dashboard, and the Mobile Web App:
```bash
./start.sh
```
Or, start the backend services, Desktop Dashboard, and launch the **Native Expo App** (requires the Expo Go app on your Android phone):
```bash
./start.sh native
```

### 2. Stopping the Ecosystem
To gracefully kill all Python, Node, and Vite processes running in the background:
```bash
./stop.sh
```

---

## How to Use the System

### 1. Desktop Dashboard (`http://localhost:5173`)
- **Run Calibration**: Click the **Start 30s Baseline Calibration** button. The ML pipeline will record a 300-point historical window to establish your unique resting mean and standard deviation.
- **Trigger Stress Incident**: Tap the circular **Tap to Stress** button repeatedly. The simulation engine will smoothly escalate heart rate, sweat (GSR), and movement variance. The XGBoost model will catch the variance and trigger a red UI alert.

### 2. Companion Apps
You can access the telemetry on your mobile device via three connection methods (Local WiFi, Cloud Proxy via Ngrok, or Bluetooth LE).
- **Mobile Web App:** Go to `http://<YOUR_LOCAL_IP>:5174` on your phone browser.
- **Native Expo App:** Run `./start.sh native` and scan the QR code using the **Expo Go** Android App. 
  - *Native Features:* You can configure a threshold slider (e.g., 75). If the stress score breaches it, the Native App triggers deep hardware vibration (haptics) and drops a high-priority push notification with a system alarm sound.

### 3. Training the Model
The inference server requires a `model.pkl` file. 
- Open `notebooks/Train_Model.ipynb` in Jupyter Notebook, VSCode, or Google Colab.
- Run the cells to synthesize 180,000 biological data points and train an XGBoost ensemble of 1,000 deep trees.
- Move the resulting `model.pkl` into the `ml_pipeline/` directory.
