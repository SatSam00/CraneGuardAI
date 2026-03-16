import cv2
import base64
import json
import asyncio
import os
import time
import numpy as np
from datetime import datetime
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from detector import CraneDetector
from zone_logic import check_zones
from alert_engine import AlertEngine
from dotenv import load_dotenv

load_dotenv()

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Attempt to load zones from Supabase
    try:
        zones = await alert_engine.get_zones()
        if zones: 
            global current_zones
            current_zones = zones
    except Exception as e:
        print(f"Error loading zones: {e}")
    yield

app = FastAPI(title="CraneAI Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

detector = CraneDetector()
alert_engine = AlertEngine()
camera_source = os.getenv("CAMERA_SOURCE", 0)

# Zones config (fallback to mock if DB empty)
# Typically loaded from DB on startup and refreshed
current_zones = [
    {"id": "A1", "name": "Zone A1", "polygon": [[100,100], [400,100], [400,400], [100,400]], "active": True},
    {"id": "A2", "name": "Zone A2", "polygon": [[600,100], [900,100], [900,400], [600,400]], "active": True}
]

# State management - machine active per zone
machine_states = {"A1": False, "A2": False}
last_movement_time = {"A1": 0, "A2": 0}

@app.get("/incidents")
async def get_incidents():
    return await alert_engine.get_incidents()

@app.get("/stats")
async def get_stats():
    return await alert_engine.get_stats()

@app.post("/machine/state")
async def set_machine_state(data: dict):
    global machine_states, last_movement_time
    zone_id = data.get("zone_id")
    active = data.get("active", False)
    
    if zone_id:
        machine_states[zone_id] = active
        if active: last_movement_time[zone_id] = time.time()
    else:
        # Toggle all if no zone id
        for zid in machine_states:
            machine_states[zid] = active
            if active: last_movement_time[zid] = time.time()
            
    return {"status": "success", "machine_states": machine_states}

@app.get("/machine/state")
async def get_machine_state(zone_id: str = None):
    if zone_id:
        return {"active": machine_states.get(zone_id, False)}
    return machine_states

@app.post("/zones")
async def update_zones(zones: list):
    global current_zones, machine_states
    current_zones = zones
    for zone in zones:
        await alert_engine.save_zone(zone)
        if zone['id'] not in machine_states:
            machine_states[zone['id']] = False
    return {"status": "Zones updated"}

@app.get("/zones")
async def get_zones():
    return current_zones

@app.websocket("/ws/feed")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    cap = None
    try:
        src = camera_source
        if str(src).isdigit():
            src = int(src)
            
        print(f"Attempting to open camera source: {src}")
        # Use CAP_DSHOW on Windows for faster/better camera access
        cap = cv2.VideoCapture(src, cv2.CAP_DSHOW) if isinstance(src, int) else cv2.VideoCapture(src)
        
        if not cap.isOpened() and isinstance(src, int):
            for i in range(3):
                if i == src: continue
                print(f"Index {src} failed, trying {i}...")
                cap = cv2.VideoCapture(i, cv2.CAP_DSHOW)
                if cap.isOpened():
                    print(f"Successfully opened camera at index {i}")
                    break

        if not cap.isOpened():
            print(f"CRITICAL: Could not open any camera source.")
            await websocket.send_json({"error": "Camera source unreachable"})
            return

        # Optimize for performance: set resolution
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cap.set(cv2.CAP_PROP_FPS, 30)

        while True:
            success, frame = cap.read()
            if not success:
                break
                
            # Run Inference
            detections = detector.detect_and_track(frame)
            
            # Check Zones
            zone_results = check_zones(detections, current_zones)
            
            # Process Alerts
            alerts = []
            curr_time = time.time()
            for zone_id, status in zone_results.items():
                # AUTOMATIC ACTIVATION: If crane detected or movement detected, start machine for this zone
                if status['movement']:
                    machine_states[zone_id] = True
                    last_movement_time[zone_id] = curr_time
                elif curr_time - last_movement_time.get(zone_id, 0) > 2.0:
                    # After 2 seconds of stillness, revert to IDLE
                    machine_states[zone_id] = False
                
                zone_machine_active = machine_states.get(zone_id, False)
                # DANGER condition: Person in zone AND (Machine active via AI or manual)
                is_danger = status['worker_count'] > 0 and zone_machine_active
                status['danger'] = is_danger 
                status['machine_active'] = zone_machine_active
                status['warning'] = status['worker_count'] > 0 # Warning if person is in zone at all
                
                if is_danger:
                    alerts.append(f"CRITICAL: {status['name']} - Worker in Danger Zone!")
                    asyncio.create_task(alert_engine.save_incident(zone_id, status['name']))
                elif status['warning']:
                    alerts.append(f"WARNING: {status['name']} - Worker touching boundary")

            # Draw Overlay
            for det in detections:
                bbox = det['bbox']
                color = (0, 255, 0)
                if det['class'] == 'person': color = (0, 255, 255) # Yellow for persons
                cv2.rectangle(frame, (bbox[0], bbox[1]), (bbox[2], bbox[3]), color, 2)
                cv2.putText(frame, f"{det['class']} {det['id']}", (bbox[0], bbox[1]-10), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

            for zone in current_zones:
                points = [tuple(p) for p in zone['polygon']]
                is_danger = zone_results[zone['id']]['danger']
                # Red if danger, Teal if person in zone but no machine, Yellow/Amber otherwise
                if is_danger: color = (0, 0, 255) # RED
                elif zone_results[zone['id']]['worker_count'] > 0: color = (0, 255, 255) # YELLOW
                else: color = (0, 255, 0) # GREEN
                
                for i in range(len(points)):
                    cv2.line(frame, points[i], points[(i+1)%len(points)], color, 2)
                    cv2.putText(frame, zone['name'], (points[0][0], points[0][1] - 10), 
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

            # Encode and Send
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            frame_base64 = base64.b64encode(buffer).decode('utf-8')
            
            payload = {
                "frame": frame_base64,
                "alerts": alerts,
                "detections": detections,
                "zone_status": zone_results,
                "machine_states": machine_states,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            await websocket.send_json(payload)
            await asyncio.sleep(0.01) 

    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"WS error: {e}")
    finally:
        if cap:
            cap.release()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8200)
