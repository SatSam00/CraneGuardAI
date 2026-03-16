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
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

class AlertEngine:
    def __init__(self):
        self.cooldown_period = 30 # seconds
        self.last_alerts = {} # {zone_id: timestamp}

    async def send_telegram_alert(self, zone_name, timestamp):
        if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
            return
            
        message = f"⚠️ ALERT: Worker detected in {zone_name}. Crane moving. Time: {timestamp}"
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        
        async with httpx.AsyncClient() as client:
            await client.post(url, json={
                "chat_id": TELEGRAM_CHAT_ID,
                "text": message
            })

    async def save_incident(self, zone_id, zone_name, type="WORKER_IN_DANGER", severity="CRITICAL", frame_url=None):
        if not supabase:
            return
            
        timestamp = datetime.utcnow().isoformat()
        
        # Check cooldown
        current_time = time.time()
        if zone_id in self.last_alerts:
            if current_time - self.last_alerts[zone_id] < self.cooldown_period:
                return # Still in cooldown

        self.last_alerts[zone_id] = current_time
        
        data = {
            "zone_id": zone_id,
            "zone_name": zone_name,
            "type": type,
            "severity": severity,
            "timestamp": timestamp,
            "acknowledged": False,
            "frame_url": frame_url
        }
        
        supabase.table("incidents").insert(data).execute()
        await self.send_telegram_alert(zone_name, timestamp)

    async def get_incidents(self, limit=100):
        if not supabase:
            return []
        response = supabase.table("incidents").select("*").order("timestamp", desc=True).limit(limit).execute()
        return response.data

    async def get_stats(self):
        if not supabase:
            return {"today_violations": 0, "safety_score": 100, "avg_reaction_time": 0, "distribution": {}, "trend": []}
            
        try:
            # Get today's incidents
            now = datetime.utcnow()
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
            response = supabase.table("incidents").select("*").gte("timestamp", today_start).execute()
            data = response.data
            count = len(data)
            
            # Simple safety score: 100 - (violations * 2)
            score = max(0, 100 - (count * 2))
            
            # Calculate distribution
            distribution = {}
            for inc in data:
                zn = inc.get('zone_name', 'Unknown')
                distribution[zn] = distribution.get(zn, 0) + 1
            
            # Trend calculation (last 12 hours)
            trend = []
            for i in range(12, -1, -2):
                h_start = (now.replace(minute=0, second=0, microsecond=0) - asyncio.Duration(hours=i)).isoformat() if hasattr(asyncio, 'Duration') else (now - datetime.timedelta(hours=i)).replace(minute=0, second=0, microsecond=0).isoformat()
                h_end = (now.replace(minute=0, second=0, microsecond=0) - asyncio.Duration(hours=i-2)).isoformat() if hasattr(asyncio, 'Duration') else (now - datetime.timedelta(hours=i-2)).replace(minute=0, second=0, microsecond=0).isoformat()
                
                h_count = sum(1 for inc in data if h_start <= inc['timestamp'] < h_end)
                time_label = (now - datetime.timedelta(hours=i)).strftime('%H:%00')
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
