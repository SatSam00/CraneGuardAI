# CraneGuard AI — Industrial Safety Monitoring System

## Resume Ready Section

Copy-paste ready bullet points and project summaries for software engineering, computer vision, and machine learning resumes.

### Project Entry (Full Format)
**CraneGuard AI — Real-Time Computer Vision Industrial Safety System**  
*Tech Stack: Python, FastAPI, YOLOv8, DeepSORT, OpenCV, MediaPipe, React, Vite, TailwindCSS, Supabase (PostgreSQL), WebSockets, Docker*

- Engineered an end-to-end computer vision pipeline processing 1080p RTSP camera streams at 30+ FPS to detect, track, and prevent worker-machinery collisions in industrial environments.
- Implemented multi-object detection and tracking using YOLOv8 and DeepSORT, maintaining persistent entity IDs across severe visual occlusions and variable lighting conditions.
- Integrated SAHI (Sliced Aided Hyper Inference) for small-object detection and YOLOv8-Pose for real-time proximity risk scoring between worker anatomical keypoints and heavy equipment.
- Developed a 30-frame predictive trajectory forecasting model using Kalman filtering and motion vector analysis to preemptively alert on boundary incursions before contact occurs.
- Built a multi-modal operator fatigue detection subsystem using MediaPipe FaceMesh to compute Eye Aspect Ratio (EAR) and PERCLOS metrics, flagging micro-sleep events within 2 seconds.
- Architected an asynchronous FastAPI backend streaming annotated video frames and telemetry over WebSockets with sub-50ms latency to a React dashboard.
- Configured dynamic polygonal geofencing using ray-casting point-in-polygon algorithms, enabling site managers to draw custom danger zones via an HTML5 Canvas interface.
- Designed an automated alert and audit logging pipeline with Telegram Bot API webhooks, Supabase S3 frame snapshot storage, and PostgreSQL relational violation logs.

---

### Project Entry (Concise 3-Bullet Format)
**CraneGuard AI — Real-Time Computer Vision Safety System**
- Engineered an asynchronous computer vision system using YOLOv8, DeepSORT, and OpenCV to monitor industrial machinery zones and track personnel across 30+ FPS video feeds.
- Built real-time safety mechanisms including dynamic polygonal geofencing, 30-frame predictive trajectory forecasting, and MediaPipe-based operator fatigue monitoring (EAR/PERCLOS).
- Developed a full-stack platform using FastAPI, WebSockets, React, and Supabase (PostgreSQL) delivering sub-50ms telemetry streaming and automated multi-channel Telegram incident alerts.

---

### Project Entry (Short / 2-Bullet Format)
**CraneGuard AI — Computer Vision Safety Monitoring Platform**
- Built an edge-ready vision pipeline with YOLOv8, DeepSORT, and OpenCV for real-time hazard detection, operator fatigue tracking, and predictive zone-violation modeling.
- Developed an asynchronous FastAPI and React WebSocket streaming architecture integrated with Supabase and Telegram Bot API for instant site incident alerting and spatial risk heatmaps.

---

## Technical Specifications

### Core Pipeline
- **Object Detection**: YOLOv8 (Ultralytics) for person, crane, and forklift localization
- **Multi-Object Tracking**: DeepSORT algorithm with Kalman filtering for persistent track ID retention
- **Fine-Grained Inference**: SAHI (Sliced Aided Hyper Inference) for small-scale distant object detection
- **Pose Estimation**: YOLOv8-Pose for tracking critical keypoints (head, shoulders) relative to machinery boundaries
- **Trajectory Forecasting**: Linear regression and Kalman velocity vectors calculated over a 30-frame horizon
- **Operator Monitoring**: MediaPipe FaceMesh evaluating 468 landmarks for Eye Aspect Ratio (EAR) and PERCLOS fatigue indices
- **Acoustic Detection**: Sound event classification for sirens, impacts, and mechanical distress triggers

### Backend Infrastructure
- **Framework**: Python 3.10+, FastAPI (Asynchronous ASGI)
- **Real-Time Transport**: Native WebSockets for concurrent video frame encoding and telemetry push
- **Zone Geometry**: Vector math and ray-casting algorithms for arbitrary convex/concave polygon collision checks
- **Database**: Supabase PostgreSQL for relational incident tables and zone coordinates
- **Object Storage**: Supabase Storage for incident frame captures
- **Alert Dispatch**: Asynchronous Telegram Bot API notifications with rate-limiting cooldown logic

### Frontend Architecture
- **Framework**: React 18, Vite
- **Styling**: TailwindCSS
- **Visualization**: Recharts for historical metrics; HTML5 Canvas for interactive zone boundary definitions
- **State & Data**: Real-time WebSocket subscriptions, RESTful configuration endpoints

---

## System Architecture

```
[ CCTV / IP Cameras (RTSP/USB) ]
               │
               ▼
┌────────────────────────────────────────────────────────┐
│               FastAPI Asynchronous Engine              │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Vision & Sensor Processing Pipeline               │  │
│  │ - YOLOv8 Object Detection                        │  │
│  │ - DeepSORT Multi-Object Tracking                 │  │
│  │ - SAHI Sliced High-Res Inference                 │  │
│  │ - YOLOv8-Pose Anatomical Proximity Analysis      │  │
│  │ - 30-Frame Trajectory Forecasting Engine         │  │
│  │ - MediaPipe FaceMesh Fatigue Detection (EAR)     │  │
│  │ - Acoustic Distress Classification               │  │
│  └──────────────────────────────────────────────────┘  │
│                          │                             │
│                          ▼                             │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Spatial Logic & Hazard Assessment                │  │
│  │ - Polygonal Geofencing (Ray-Casting Algorithm)   │  │
│  │ - Dynamic Motion & Machine Vibration Detection   │  │
│  │ - Tri-State Hazard Classification (Safe/Warn/Hit)│  │
│  └──────────────────────────────────────────────────┘  │
└───────────────┬────────────────────────┬───────────────┘
                │                        │
       WebSocket (Telemetry)       REST / Webhooks
                │                        │
                ▼                        ▼
┌───────────────────────────────┐ ┌──────────────────────┐
│ React 18 Command Center       │ │ External Services    │
│ - Live Annotated Stream       │ │ - Telegram Bot API   │
│ - HTML5 Canvas Zone Editor    │ │ - Supabase DB        │
│ - Incident Spatial Heatmaps   │ │ - Supabase Storage   │
│ - Recharts Analytics          │ │ - Docker Deployment  │
└───────────────────────────────┘ └──────────────────────┘
```

---

## Core Modules

| Module | File | Implementation Details |
| :--- | :--- | :--- |
| Detection Engine | `backend/detector.py` | Runs YOLOv8 inference, SAHI sliced prediction, DeepSORT tracking, and 30-frame predictive trajectory calculations. |
| Operator Fatigue | `backend/fatigue_detector.py` | MediaPipe FaceMesh tracking eye landmark aspect ratio (EAR) and rolling 60-second PERCLOS window. |
| Acoustic Analysis | `backend/acoustic_detector.py` | Background audio processing classifying mechanical impacts, screams, and sirens. |
| Spatial Hazard Logic | `backend/zone_logic.py` | Executes point-in-polygon ray casting and machine vibration/motion state classification. |
| Alert Engine | `backend/alert_engine.py` | Dispatches rate-limited Telegram alerts, captures violation frames, and logs incidents to Supabase. |
| API & WebSockets | `backend/main.py` | Serves REST endpoints for configuration and WebSocket streams for real-time video feeds. |

---

## Setup and Installation

### Backend Setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Environment Variables
Configure `.env` in the `backend/` directory:
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_api_key
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_target_chat_id
CAMERA_SOURCE=0
CONF_TEMPERATURE=1.15
```

---

## License
MIT
