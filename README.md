# 🏗️ CraneGuard AI: Safety Monitoring System

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![YOLOv8](https://img.shields.io/badge/YOLOv8-00FFAA?style=for-the-badge)](https://ultralytics.com/)

**CraneGuard AI** is a cutting-edge, full-stack safety monitoring solution designed for industrial environments. By combining deep learning (YOLOv8 + DeepSORT) with a modern web interface, it provides real-time protection for workers in high-risk zones near heavy machinery.

---

## 🚀 Key Features

*   **📺 Live AI Feed**: Real-time person, crane, and forklift detection with low-latency WebSocket streaming.
*   **📐 Dynamic Safety Zones**: Draw and manage safety polygons directly in the web UI.
*   **📊 Analytics Dashboard**: Comprehensive view of safety trends, violation logs, and performance metrics.
*   **🔥 Risk Heatmaps**: Spatial visualization of high-incident areas based on historical bridge violations.
*   **📱 Instant Alerts**: Multi-channel notifications via Telegram and local UI banners with captured snapshots.
*   **☁️ Cloud Integration**: Persistent storage of configurations and incident logs via Supabase.

---

## 🛠️ Tech Stack

### Backend
- **Framework**: FastAPI
- **AI/ML**: YOLOv8, DeepSORT
- **Computer Vision**: OpenCV
- **Database**: Supabase (Postgres)

### Frontend
- **Framework**: React + Vite
- **Styling**: TailwindCSS + Framer Motion
- **Charts**: Recharts

---

## 📖 Documentation

For a deep dive into the architecture, API reference, and troubleshooting, check out our:
👉 **[Detailed Project Documentation](./documentation.md)**

---

## 🛠️ Quick Start

### 1. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### 3. Environment Configuration
Create a `.env` in the `backend/` folder:
```env
SUPABASE_URL=your_url
SUPABASE_KEY=your_key
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_CHAT_ID=your_chat_id
CAMERA_SOURCE=0  # index or rtsp://
```

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
</p>

cd craneai   
PS D:\PERS PROJECTS\CraneGuard AI\craneai> cd .\frontend\                                             
PS D:\PERS PROJECTS\CraneGuard AI\craneai\frontend> npm run dev   
>> 

