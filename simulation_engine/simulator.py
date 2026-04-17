import asyncio
import time
import json
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import List

from config import Config
from signals.gsr import GSRGenerator
from signals.hrv import HRVGenerator
from signals.imu import IMUGenerator
from signals.respiration import RespirationGenerator

app = FastAPI(title="Smart Vest Simulation Engine")

# Global state
class SimulationState:
    def __init__(self):
        self.stress_active = False
        self.latest_data = {}
        self.active_connections: List[WebSocket] = []
        
        # Generator instances
        self.gsr_gen = GSRGenerator(Config.GSR_BASE_CALM, Config.GSR_BASE_STRESS)
        self.hrv_gen = HRVGenerator(Config.HR_BASE_CALM, Config.HR_BASE_STRESS)
        self.imu_gen = IMUGenerator()
        self.resp_gen = RespirationGenerator(Config.RESP_RATE_CALM, Config.RESP_RATE_STRESS)

state = SimulationState()

class StressModeRequest(BaseModel):
    active: bool

@app.post("/api/stress")
async def toggle_stress(request: StressModeRequest):
    state.stress_active = request.active
    return {"status": "success", "stress_active": state.stress_active}

@app.get("/api/stress")
async def get_stress():
    return {"stress_active": state.stress_active}

@app.get("/api/data")
async def get_latest_data():
    return state.latest_data

@app.websocket("/ws/stream")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    state.active_connections.append(websocket)
    try:
        while True:
            # wait for messages (optional client pings to keep alive)
            await websocket.receive_text()
    except WebSocketDisconnect:
        state.active_connections.remove(websocket)

async def simulation_loop():
    while True:
        # Generate new data
        stress = state.stress_active
        hr, hrv = state.hrv_gen.generate(stress)
        
        data = {
            "timestamp": int(time.time() * 1000),  # epoch ms for higher precision
            "gsr": state.gsr_gen.generate(stress),
            "hr": hr,
            "hrv": hrv,
            "imu": state.imu_gen.generate(stress),
            "respiration": state.resp_gen.generate(stress)
        }
        
        state.latest_data = data
        
        # Broadcast to all connected websocket clients
        if state.active_connections:
            message = json.dumps(data)
            # Send to all clients
            for connection in list(state.active_connections):
                try:
                    await connection.send_text(message)
                except Exception:
                    # Remove dead connections if send fails
                    if connection in state.active_connections:
                        state.active_connections.remove(connection)
                    
        await asyncio.sleep(Config.UPDATE_INTERVAL_MS / 1000.0)

@app.on_event("startup")
async def startup_event():
    # Start the continuous simulation loop in the background
    asyncio.create_task(simulation_loop())

if __name__ == "__main__":
    uvicorn.run("simulator:app", host=Config.HOST, port=Config.PORT, reload=True)
