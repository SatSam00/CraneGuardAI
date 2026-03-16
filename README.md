# CraneAI: Crane Aisle Safety Monitoring System

CraneAI is a full-stack AI-powered safety monitoring system designed for industrial environments. It uses YOLOv8 for real-time person and vehicle detection, DeepSORT for tracking, and provides a modern web interface for live monitoring, analytics, and heatmap visualization.

## Features
- **Live AI Feed**: Real-time person/crane/forklift detection with zone violation alerts.
- **Dynamic Zones**: Define safety polygons directly in the UI.
- **Dashboard**: Track violations, safety scores, and reaction times.
- **Heatmap**: Visualize high-risk factory areas based on historical data.
- **Alerts**: Instant Telegram notifications on safety breaches.
- **Persistence**: Incidents and configurations saved via Supabase.

## Tech Stack
- **Backend**: FastAPI, YOLOv8 (Ultralytics), DeepSORT, OpenCV, Supabase.
- **Frontend**: React, Vite, TailwindCSS, Recharts, Framer Motion.
- **Alerts**: Telegram Bot API.

## Setup Instructions

### 1. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Or venv\Scripts\activate on Windows
pip install -r requirements.txt
```

### 2. Configure Environment
Create a `.env` file in the `backend/` folder based on `.env.example`:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
CAMERA_SOURCE=0  # 0 for webcam, or rtsp://... for IP cam
```

### 3. Database Setup (Supabase)
Create the following tables in Supabase:

**Table: `incidents`**
- `id` (uuid, primary key)
- `zone_id` (text)
- `zone_name` (text)
- `type` (text)
- `severity` (text)
- `timestamp` (timestamptz)
- `acknowledged` (bool)
- `frame_url` (text, optional)

**Table: `zones`**
- `id` (text, primary key)
- `name` (text)
- `polygon` (jsonb)
- `active` (bool)

### 4. Telegram Bot Setup
1. Chat with [@BotFather](https://t.me/botfather) to create a new bot.
2. Get the `TELEGRAM_BOT_TOKEN`.
3. Get your `TELEGRAM_CHAT_ID` by messaging [@userinfobot](https://t.me/userinfobot).

### 5. Running the Application
**Backend:**
```bash
uvicorn main:app --reload
```
**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Deployment (Render.com)
1. **Backend**: 
   - New Web Service.
   - Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`.
   - Add environment variables.
2. **Frontend**:
   - New Static Site.
   - Build Command: `npm run build`.
   - Publish Directory: `dist`.

## License
MIT
