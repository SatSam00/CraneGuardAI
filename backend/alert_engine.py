import os
import httpx
import time
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

supabase: Client = None

def init_supabase():
    global supabase
    if not SUPABASE_URL or not SUPABASE_KEY or "your_supabase" in SUPABASE_URL:
        print("Supabase URL or Key missing or using placeholder. Running in offline/mock mode.")
        return None
    
    try:
        url = SUPABASE_URL.strip()
        if not url.startswith("http"):
             print(f"Invalid Supabase URL: {url}. Needs http/https.")
             return None
             
        client = create_client(url, SUPABASE_KEY)
        return client
    except Exception as e:
        print(f"Failed to initialize Supabase client: {e}")
        return None

supabase = init_supabase()

class AlertEngine:
    def __init__(self):
        self.cooldown_period = 5 # Reduced to 5s for better real-time feedback
        self.last_alerts = {} # {zone_id: timestamp}
        self.mock_incidents = [] # Local cache for offline mode

    async def upload_snapshot(self, frame, incident_id):
        """Uploads a frame to Supabase Storage and returns the public URL."""
        if not supabase:
            return None
            
        try:
            import cv2
            
            # Encode frame to JPEG
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            
            # Use a unique filename
            file_path = f"snapshots/{incident_id}.jpg"
            
            # Upload to Supabase Storage (assuming bucket 'incidents' exists)
            res = supabase.storage.from_("incidents").upload(
                path=file_path,
                file=buffer.tobytes(),
                file_options={"content-type": "image/jpeg"}
            )
            
            # Get public URL
            url = supabase.storage.from_("incidents").get_public_url(file_path)
            return url
        except Exception as e:
            print(f"Upload failed: {e}")
            return None

    async def save_incident(self, zone_id, zone_name, type="WORKER_IN_DANGER", severity="CRITICAL", frame=None):
        timestamp = datetime.utcnow().isoformat()
        
        # Check cooldown (per zone to avoid spamming)
        current_time = time.time()
        if zone_id in self.last_alerts:
            if current_time - self.last_alerts[zone_id] < self.cooldown_period:
                return # Still in cooldown

        self.last_alerts[zone_id] = current_time
        
        # Create a unique ID
        import uuid
        incident_uuid = str(uuid.uuid4())
        
        frame_url = None
        if frame is not None:
            frame_url = await self.upload_snapshot(frame, incident_uuid)
        
        data = {
            "id": incident_uuid,
            "zone_id": zone_id,
            "zone_name": zone_name,
            "type": type,
            "severity": severity,
            "timestamp": timestamp,
            "acknowledged": False,
            "frame_url": frame_url
        }
        
        # Store locally regardless of Supabase state for snappier real-time response
        self.mock_incidents.insert(0, data)
        # Keep only last 100
        self.mock_incidents = self.mock_incidents[:100]

        if supabase:
            try:
                supabase.table("incidents").insert(data).execute()
            except Exception as e:
                print(f"Supabase save failed: {e}")
        
        # Enhanced Telegram message with Image if available
        await self.send_telegram_alert(zone_name, timestamp, frame_url)

    async def send_telegram_alert(self, zone_name, timestamp, frame_url=None):
        if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
            return
            
        message = f"⚠️ *CRITICAL ALERT*\n📍 Zone: {zone_name}\n⏰ Time: {timestamp}\n\n🚨 Worker detected in hazard zone during machine operation!"
        
        async with httpx.AsyncClient() as client:
            if frame_url:
                url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendPhoto"
                await client.post(url, json={
                    "chat_id": TELEGRAM_CHAT_ID,
                    "photo": frame_url,
                    "caption": message,
                    "parse_mode": "Markdown"
                })
            else:
                url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
                await client.post(url, json={
                    "chat_id": TELEGRAM_CHAT_ID,
                    "text": message,
                    "parse_mode": "Markdown"
                })

    async def get_incidents(self, limit=100):
        if not supabase:
            return self.mock_incidents[:limit]
        
        try:
            response = supabase.table("incidents").select("*").order("timestamp", desc=True).limit(limit).execute()
            return response.data
        except Exception as e:
            print(f"Supabase fetch incidents failed: {e}")
            return self.mock_incidents[:limit]

    async def get_stats(self):
        try:
            now = datetime.utcnow()
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
            
            # Fetch today's data from DB if possible
            if supabase:
                try:
                    response = supabase.table("incidents").select("*").gte("timestamp", today_start).execute()
                    db_data = response.data
                except Exception as e:
                    print(f"Supabase fetch stats failed: {e}")
                    db_data = []
            else:
                db_data = []
            
            # Merge with local cache (mock_incidents) to catch new ones immediately
            # Use set of IDs to avoid duplicates
            local_today = [inc for inc in self.mock_incidents if inc['timestamp'] >= today_start]
            
            seen_ids = set(inc['id'] for inc in db_data)
            all_data = db_data + [inc for inc in local_today if inc['id'] not in seen_ids]
            
            count = len(all_data)
            
            # Simple safety score: 100 - (violations * 2)
            score = max(0, 100 - (count * 2))
            
            # Calculate distribution
            distribution = {}
            for inc in all_data:
                zn = inc.get('zone_name', 'Unknown')
                distribution[zn] = distribution.get(zn, 0) + 1
            
            # Trend calculation (last 12 hours)
            trend = []
            import datetime as dt
            for i in range(12, -1, -2):
                h_start_dt = (now - dt.timedelta(hours=i)).replace(minute=0, second=0, microsecond=0)
                h_end_dt = (now - dt.timedelta(hours=i-2)).replace(minute=0, second=0, microsecond=0)
                h_start = h_start_dt.isoformat()
                h_end = h_end_dt.isoformat()
                
                h_count = sum(1 for inc in all_data if inc['timestamp'] >= h_start and inc['timestamp'] < h_end)
                time_label = h_start_dt.strftime('%H:%M')
                trend.append({
                    "time": time_label,
                    "violations": h_count,
                    "safety": max(0, 100 - (h_count * 10))
                })

            return {
                "today_violations": count,
                "safety_score": score,
                "avg_reaction_time": 1.2,
                "monitored_zones": 4, 
                "distribution": distribution,
                "trend": trend if trend else [{"time": '08:00', "violations": 0, "safety": 100}]
            }
        except Exception as e:
            print(f"Stats error: {e}")
            return {"today_violations": 0, "safety_score": 100, "avg_reaction_time": 0, "distribution": {}, "trend": []}

    async def save_zone(self, zone_data):
        if not supabase:
            return
        supabase.table("zones").upsert(zone_data).execute()

    async def get_zones(self):
        if not supabase:
            # Default fallback for POC
            return [
                {"id": "A1", "name": "Zone A1", "polygon": [[100,100], [400,100], [400,400], [100,400]], "active": True},
                {"id": "A2", "name": "Zone A2", "polygon": [[600,100], [900,100], [900,400], [600,400]], "active": True}
            ]
        response = supabase.table("zones").select("*").execute()
        return response.data
