
# Live Sign Wall — NLC Neyveli Book Fair

Fully offline, local-network interactive digital signature wall.

## Quick Start

### 1. Install Python deps & start server
```
start_server.bat
```

### 2. Build frontend (first time or after changes)
```
build_frontend.bat
```

### 3. Access from any device on the same Wi-Fi

| URL | Purpose |
|-----|---------|
| `http://YOUR_IP:8000/` | Visitor input page (phone/tablet) |
| `http://YOUR_IP:8000/display` | Big screen display wall |
| `http://YOUR_IP:8000/health` | Health check |

Replace `YOUR_IP` with the server laptop's local IP (e.g. `192.168.1.10`).

## Development (hot reload)

**Terminal 1 — Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Frontend dev server runs on `http://localhost:5173` and proxies API/WS to `:8000`.

## Architecture

```
[ Phone/Tablet ]  →  POST /submit  →  [ FastAPI :8000 ]  →  WS broadcast  →  [ Display TV ]
```

- **Backend**: FastAPI + WebSockets, in-memory storage, moderation
- **Frontend**: React + Vite + TypeScript, HTML5 Canvas animation
- **Zero internet dependency** — runs entirely on local Wi-Fi

## Moderation

- Duplicate name within 60s → rejected
- Rate limit: 5 submissions per IP per minute
- Profanity blocklist (edit `backend/moderation.py` → `PROFANITY_BLOCKLIST`)

## Display Wall

- Up to 500 floating signatures on canvas (GPU-friendly)
- 60fps animation: float, drift, gentle rotation
- New entries: scale-in + cyan glow pulse for 2 seconds
- Aging: older signatures fade and shrink into background
