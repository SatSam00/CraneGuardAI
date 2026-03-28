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
from zone_logic import check_zones, is_box_in_zone
from alert_engine import AlertEngine
from dotenv import load_dotenv

load_dotenv()

from contextlib import asynccontextmanager

# State management - machine active per zone
machine_states = {"A1": False, "A2": False}
last_movement_time = {"A1": 0, "A2": 0}

# Real-time analytics cache
cached_stats = {"today_violations": 0, "safety_score": 100, "avg_reaction_time": 0, "distribution": {}, "trend": []}
cached_incidents = []

async def update_analytics_loop():
    """Background loop to update analytics from DB every 5 seconds."""
    global cached_stats, cached_incidents
    while True:
        try:
            # Update incidents and stats in parallel
            inc_task = alert_engine.get_incidents()
            stat_task = alert_engine.get_stats()
            
            inc_res, stat_res = await asyncio.gather(inc_task, stat_task)
            
            cached_incidents = inc_res
            cached_stats = stat_res
        except Exception as e:
            print(f"Analytics background loop error: {e}")
        
        await asyncio.sleep(5)

async def refresh_analytics_now():
    """Immediately refresh cached stats and incidents."""
    global cached_stats, cached_incidents
    try:
        inc_res, stat_res = await asyncio.gather(
            alert_engine.get_incidents(),
            alert_engine.get_stats()
        )
        cached_incidents = inc_res
        cached_stats = stat_res
    except Exception as e:
        print(f"Immediate refresh error: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start analytics loop
    asyncio.create_task(update_analytics_loop())
    
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

@app.post("/zones/toggle")
async def toggle_zone(data: dict):
    global current_zones
    zone_id = data.get("zone_id")
    enabled = data.get("enabled", True)
    
    for zone in current_zones:
        if zone['id'] == zone_id:
            zone['active'] = enabled
            break
            
    return {"status": "success", "zones": current_zones}

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
        
        # Try different backends for Windows if it's an index
        backends = [cv2.CAP_ANY, cv2.CAP_DSHOW, cv2.CAP_MSMF]
        
        def try_open(source, backend_list):
            for b in backend_list:
                c = cv2.VideoCapture(source, b) if isinstance(source, int) else cv2.VideoCapture(source)
                if c.isOpened():
                    return c
            return None

        cap = try_open(src, backends)
        
        if not cap and isinstance(src, int):
            for i in range(5): # Try more indices
                if i == src: continue
                print(f"Index {i} ... ", end="")
                cap = try_open(i, backends)
                if cap:
                    print(f"Success!")
                    break
                print("Failed")

        if not cap or not cap.isOpened():
            print(f"CRITICAL: Could not open any camera source.")
            error_msg = "No camera found. Please connect a camera or set CAMERA_SOURCE to a video file path in .env"
            await websocket.send_json({"error": error_msg})
            return

        # Optimize for performance: set resolution
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cap.set(cv2.CAP_PROP_FPS, 30)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1) # Minimize latency by keeping only the latest frame

        while True:
            success, frame = cap.read()
            if not success:
                break
                
            # Run Inference
            detections = detector.detect_and_track(frame)
            
            # Check Zones (All zones, logic handles internal skipping)
            zone_results = check_zones(detections, current_zones)
            
            # Process Alerts
            alerts = []
            curr_time = time.time()
            for zone_id, status in zone_results.items():
                has_worker = status['worker_count'] > 0
                
                # AUTOMATIC ACTIVATION: If crane detected or movement detected, start machine for this zone
                # AUTO-FIX: Do not allow AI to start machine if a worker is in the zone!
                if status['movement'] and not has_worker:
                    machine_states[zone_id] = True
                    last_movement_time[zone_id] = curr_time
                elif curr_time - last_movement_time.get(zone_id, 0) > 0.8:
                    # After 0.8 seconds of stillness, revert to IDLE for snappy response
                    machine_states[zone_id] = False
                
                zone_machine_active = machine_states.get(zone_id, False)
                # DANGER condition: Person in zone AND (Machine active via AI or manual)
                is_danger = has_worker and zone_machine_active
                
                # CRITICAL: If person is literally TOUCHING/INSIDE the machine (collision_risk)
                if status.get('collision_risk'):
                    is_danger = True
                    alerts.append(f"CRITICAL: {status['name']} - Person TOUCHING Machine!")
                    asyncio.create_task(alert_engine.save_incident(zone_id, status['name'], type="PROXIMITY_VIOLATION", frame=frame))
                    # Trigger immediate analytics refresh
                    asyncio.create_task(refresh_analytics_now())

                # AUTOMATIC FIX: If danger is detected, instantly cut off the machine
                if is_danger:
                    machine_states[zone_id] = False
                    zone_machine_active = False
                    last_movement_time[zone_id] = 0

                status['danger'] = is_danger 
                status['machine_active'] = zone_machine_active
                status['warning'] = status['worker_count'] > 0 # Warning if person is in zone at all
                
                if is_danger and not status.get('collision_risk'):
                    alerts.append(f"CRITICAL: {status['name']} - Worker in Danger Zone!")
                    asyncio.create_task(alert_engine.save_incident(zone_id, status['name'], frame=frame))
                    # Trigger immediate analytics refresh
                    asyncio.create_task(refresh_analytics_now())
                elif status['warning'] and not is_danger:
                    alerts.append(f"WARNING: {status['name']} - Worker touching boundary")

            # Encode and Send
            for det in detections:
                # SKIP detection if it is inside a DISABLED zone
                skip_det = False
                for zone in current_zones:
                    if not zone.get('active', True):
                        if is_box_in_zone(det['bbox'], zone['polygon']):
                            skip_det = True
                            break
                if skip_det: continue

                bbox = det['bbox']
                color = (0, 255, 0)
                if det['class'] == 'person': color = (0, 255, 255) # Yellow for persons
                cv2.rectangle(frame, (bbox[0], bbox[1]), (bbox[2], bbox[3]), color, 2)
                cv2.putText(frame, f"{det['class']} {det['id']}", (bbox[0], bbox[1]-10), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

            for zone in current_zones:
                is_active = zone.get('active', True)
                points = [tuple(p) for p in zone['polygon']]
                
                # Determine Color
                if not is_active:
                    color = (128, 128, 128) # GRAY for OFF zones
                else:
                    result = zone_results.get(zone['id'], {})
                    is_danger = result.get('danger', False)
                    worker_count = result.get('worker_count', 0)
                    
                    if is_danger: color = (0, 0, 255) # RED
                    elif worker_count > 0: color = (0, 255, 255) # YELLOW
                    else: color = (0, 255, 0) # GREEN
                
                for i in range(len(points)):
                    cv2.line(frame, points[i], points[(i+1)%len(points)], color, 2)
                    label = f"{zone['name']} [OFF]" if not is_active else zone['name']
                    cv2.putText(frame, label, (points[0][0], points[0][1] - 10), 
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
                "stats": cached_stats,
                "incidents": cached_incidents,
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
