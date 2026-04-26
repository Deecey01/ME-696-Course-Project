import asyncio
import json
import logging
import websockets
from bless import (
    BlessServer,
    BlessGATTCharacteristic,
    GATTCharacteristicProperties,
    GATTAttributePermissions
)

SIMULATOR_WS = "ws://localhost:8000/ws/stream"

SERVICE_UUID = "12345678-1234-5678-1234-56789abcdef0"
CHAR_UUID = "12345678-1234-5678-1234-56789abcdef1"

logging.basicConfig(level=logging.INFO)

async def run(loop):
    # Initialize the GATT server
    server = BlessServer(name="SmartVest")
    
    def read_request(characteristic: BlessGATTCharacteristic, **kwargs) -> bytearray:
        return characteristic.value

    def write_request(characteristic: BlessGATTCharacteristic, value: bytearray, **kwargs):
        characteristic.value = value
        
    server.read_request_func = read_request
    server.write_request_func = write_request
    
    # Add service and characteristic
    await server.add_new_service(SERVICE_UUID)
    char_flags = (
        GATTCharacteristicProperties.read |
        GATTCharacteristicProperties.notify
    )
    permissions = (
        GATTAttributePermissions.readable
    )
    
    await server.add_new_characteristic(
        SERVICE_UUID,
        CHAR_UUID,
        char_flags,
        bytearray("0.0".encode('utf-8')),
        permissions,
        "Stress Score"
    )
    
    await server.start()
    logging.info("BLE Server started. Broadcasting as 'SmartVest'")
    
    while True:
        try:
            async with websockets.connect(SIMULATOR_WS) as ws:
                logging.info("Connected to simulator WS...")
                while True:
                    msg = await ws.recv()
                    data = json.loads(msg)
                    score = data.get("stress_level", 0.0) * 100.0
                    
                    # Update BLE characteristic
                    val = bytearray(str(round(score, 1)).encode('utf-8'))
                    server.get_characteristic(CHAR_UUID).value = val
                    server.update_value(SERVICE_UUID, CHAR_UUID)
                    
        except Exception as e:
            logging.error(f"WS error: {e}. Reconnecting in 5s...")
            await asyncio.sleep(5)

if __name__ == "__main__":
    loop = asyncio.get_event_loop()
    try:
        loop.run_until_complete(run(loop))
    except KeyboardInterrupt:
        pass
