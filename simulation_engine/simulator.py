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


# ---------------------------------------------------------------------------
# Global state
# ---------------------------------------------------------------------------
class SimulationState:
    def __init__(self):
        # Continuous stress level: 0.0 = fully calm, 1.0 = full stress
        self.stress_level: float = 0.0
        self.latest_data: dict = {}
        self.active_connections: List[WebSocket] = []

        # Signal generators
        self.gsr_gen  = GSRGenerator(Config.GSR_BASE_CALM, Config.GSR_BASE_STRESS)
        self.hrv_gen  = HRVGenerator(Config.HR_BASE_CALM, Config.HR_BASE_STRESS)
        self.imu_gen  = IMUGenerator()
        self.resp_gen = RespirationGenerator(Config.RESP_RATE_CALM, Config.RESP_RATE_STRESS)


state = SimulationState()


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------
class StressModeRequest(BaseModel):
    active: bool


@app.post("/api/stress")
async def toggle_stress(request: StressModeRequest):
    """Binary toggle kept for backward compatibility — sets level to 1.0 or 0.0."""
    state.stress_level = 1.0 if request.active else 0.0
    return {"status": "success", "stress_level": state.stress_level}


@app.get("/api/stress")
async def get_stress():
    return {
        "stress_level": round(state.stress_level, 3),
        "stress_active": state.stress_level > 0.1,
    }


@app.post("/api/stress/tap")
async def tap_stress():
    """Each tap injects a fixed increment; the decay loop drains it over time."""
    state.stress_level = min(1.0, state.stress_level + Config.STRESS_TAP_INCREMENT)
    return {"status": "success", "stress_level": round(state.stress_level, 3)}


@app.get("/api/data")
async def get_latest_data():
    return state.latest_data


# ---------------------------------------------------------------------------
# WebSocket streaming
# ---------------------------------------------------------------------------
@app.websocket("/ws/stream")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    state.active_connections.append(websocket)
    try:
        while True:
            await websocket.receive_text()   # keep-alive pings from client
    except WebSocketDisconnect:
        if websocket in state.active_connections:
            state.active_connections.remove(websocket)


# ---------------------------------------------------------------------------
# Background tasks
# ---------------------------------------------------------------------------
async def simulation_loop():
    """Generates sensor data at Config.SAMPLE_RATE_HZ and broadcasts to WS clients."""
    while True:
        level = state.stress_level
        hr, hrv = state.hrv_gen.generate(level)

        data = {
            "timestamp":   int(time.time() * 1000),
            "stress_level": round(level, 3),
            "gsr":         state.gsr_gen.generate(level),
            "hr":          hr,
            "hrv":         hrv,
            "imu":         state.imu_gen.generate(level),
            "respiration": state.resp_gen.generate(level),
        }

        state.latest_data = data

        if state.active_connections:
            message = json.dumps(data)
            for conn in list(state.active_connections):
                try:
                    await conn.send_text(message)
                except Exception:
                    if conn in state.active_connections:
                        state.active_connections.remove(conn)

        await asyncio.sleep(Config.UPDATE_INTERVAL_MS / 1000.0)


async def decay_loop():
    """Continuously drains stress_level toward 0 at STRESS_DECAY_RATE per tick."""
    while True:
        if state.stress_level > 0:
            state.stress_level = max(0.0, state.stress_level - Config.STRESS_DECAY_RATE)
        await asyncio.sleep(Config.UPDATE_INTERVAL_MS / 1000.0)


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(simulation_loop())
    asyncio.create_task(decay_loop())


if __name__ == "__main__":
    uvicorn.run("simulator:app", host=Config.HOST, port=Config.PORT, reload=True)
