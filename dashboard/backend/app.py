import asyncio
import json
import uvicorn
import httpx
import websockets
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Dashboard Backend proxy")

# CORS so the react frontend can hit endpoints
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SIMULATOR_WS = "ws://localhost:8000/ws/stream"
ML_PREDICT_URL = "http://localhost:8001/predict"
ML_BASELINE_URL = "http://localhost:8001/baseline"
SIMULATOR_STRESS_URL = "http://localhost:8000/api/stress"

class State:
    def __init__(self):
        self.active_connections = []
        
state = State()

@app.websocket("/ws/frontend")
async def websocket_frontend(websocket: WebSocket):
    await websocket.accept()
    state.active_connections.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        state.active_connections.remove(websocket)

async def data_proxy_loop():
    async with httpx.AsyncClient() as client:
        while True:
            try:
                # connect to simulator
                async with websockets.connect(SIMULATOR_WS) as ws:
                    print("Connected to simulator WS...")
                    while True:
                        msg = await ws.recv()
                        raw_data = json.loads(msg)
                        
                        # query ML
                        try:
                            # send to ML predict
                            resp = await client.post(ML_PREDICT_URL, json=raw_data, timeout=2.0)
                            ml_data = resp.json()
                        except Exception as e:
                            ml_data = {"status": "error", "error": str(e)}
                            
                        # merge packet
                        merged = {
                            "raw": raw_data,
                            "ml": ml_data
                        }
                        
                        # broadcast
                        if state.active_connections:
                            out_msg = json.dumps(merged)
                            for conn in list(state.active_connections):
                                try:
                                    await conn.send_text(out_msg)
                                except Exception:
                                    if conn in state.active_connections:
                                        state.active_connections.remove(conn)
            except Exception as e:
                print(f"WS error: {e}. Reconnecting in 5s...")
                await asyncio.sleep(5)

@app.on_event("startup")
async def on_startup():
    asyncio.create_task(data_proxy_loop())

class GenericRequest(BaseModel):
    active: bool = False

@app.post("/api/baseline")
async def trigger_baseline():
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(ML_BASELINE_URL)
            return resp.json()
        except Exception as e:
            return {"status": "error", "message": str(e)}

@app.post("/api/stress")
async def trigger_stress(req: GenericRequest):
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(SIMULATOR_STRESS_URL, json={"active": req.active})
            return resp.json()
        except Exception as e:
            return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8002, reload=True)
