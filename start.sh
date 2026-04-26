#!/bin/bash

# Default to 'web' if no argument is passed
APP_MODE=${1:-web}

if [[ "$APP_MODE" != "web" && "$APP_MODE" != "native" ]]; then
    echo "Error: Invalid argument."
    echo "Usage: ./start.sh [web|native]"
    echo "  web    : Starts the Vite Mobile Web App (Default)"
    echo "  native : Starts the React Native Expo App (--tunnel) in the foreground"
    exit 1
fi

# Create logs directory
mkdir -p logs

echo "Starting Smart Vest Ecosystem (Mode: $APP_MODE)..."

# Function to check and setup python venv
setup_python_env() {
    DIR=$1
    if [ ! -d "$DIR/venv" ]; then
        echo "Creating venv for $DIR..."
        python3 -m venv "$DIR/venv"
    fi
    source "$DIR/venv/bin/activate"
    pip install -r "$DIR/requirements.txt" --quiet
    deactivate
}

# 1. Simulation Engine
echo "Starting Simulation Engine (Port 8000)..."
setup_python_env "simulation_engine"
cd simulation_engine
source venv/bin/activate
python3 simulator.py > ../logs/simulator.log 2>&1 &
SIM_PID=$!
deactivate
cd ..

# 2. ML Pipeline
echo "Starting ML Pipeline (Port 8001)..."
setup_python_env "ml_pipeline"
cd ml_pipeline
source venv/bin/activate
python3 inference.py > ../logs/ml_pipeline.log 2>&1 &
ML_PID=$!
deactivate
cd ..

# 3. Dashboard Backend Proxy
echo "Starting Dashboard Backend Proxy (Port 8002)..."
setup_python_env "dashboard/backend"
cd dashboard/backend
source venv/bin/activate
python3 app.py > ../../logs/dashboard_backend.log 2>&1 &
BACKEND_PID=$!
python3 ble_server.py > ../../logs/ble_server.log 2>&1 &
BLE_PID=$!
deactivate
cd ../..

# 4. Dashboard Frontend
echo "Starting Dashboard Frontend (Port 5173)..."
cd dashboard/frontend
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install > ../../logs/npm_install.log 2>&1
fi
npm run dev > ../../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ../..

# 5. Mobile / Native Apps
if [ "$APP_MODE" == "web" ]; then
    echo "Starting Mobile Web App (Port 5174)..."
    cd mobile_app
    npm run dev -- --port 5174 --host > ../logs/mobile_app.log 2>&1 &
    MOBILE_PID=$!
    cd ..

    # Save PIDs to a file for easy stopping
    echo $SIM_PID > .pids
    echo $ML_PID >> .pids
    echo $BACKEND_PID >> .pids
    echo $BLE_PID >> .pids
    echo $FRONTEND_PID >> .pids
    echo $MOBILE_PID >> .pids

    echo ""
    echo "✅ All systems started!"
    echo "Simulation Engine:    http://localhost:8000"
    echo "ML Pipeline:          http://localhost:8001"
    echo "Dashboard Proxy:      http://localhost:8002"
    echo "Dashboard Frontend:   http://localhost:5173"
    echo "Mobile Web App:       http://localhost:5174 (Network available)"
    echo ""
    echo "To view the desktop dashboard, open: http://localhost:5173"
    echo "To view the mobile app, open: http://<YOUR_LOCAL_IP>:5174 on your phone."
    echo "To stop all services, run: ./stop.sh"

elif [ "$APP_MODE" == "native" ]; then
    # Save background PIDs before starting Expo (since Expo runs in foreground)
    echo $SIM_PID > .pids
    echo $ML_PID >> .pids
    echo $BACKEND_PID >> .pids
    echo $BLE_PID >> .pids
    echo $FRONTEND_PID >> .pids

    echo ""
    echo "✅ Background systems started!"
    echo "To view the desktop dashboard, open: http://localhost:5173"
    echo "To stop the background services later, open a new terminal and run: ./stop.sh"
    echo ""
    echo "🚀 Launching Native Expo App..."
    echo "Scan the QR code below with the Expo Go app on your phone."
    echo "Press Ctrl+C to stop the Expo server."
    echo ""
    
    cd native_app
    npx expo start --tunnel
fi
