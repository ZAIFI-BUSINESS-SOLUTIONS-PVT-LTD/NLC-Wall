
# Live Sign Wall — NLC Neyveli Book Fair

Fully offline, local-network interactive digital signature wall.
Visitors sign on tablets → signatures appear live on the big display screen in real-time.

---

## Quick Start

### 1. Install Python deps & start server
```
start_server.bat
```

### 2. Build frontend (first time or after code changes)
```
build_frontend.bat
```

### 3. Find the server's local IP
```
ipconfig
```
Look for **IPv4 Address** under your active Wi-Fi adapter (e.g. `192.168.1.10`).

### 4. Open on devices (all must be on the same Wi-Fi)

| URL | Purpose |
|-----|---------|
| `http://YOUR_IP:8000/` | Visitor input page — open on each tablet |
| `http://YOUR_IP:8000/display` | Big screen display wall — open fullscreen (F11) |
| `http://YOUR_IP:8000/admin` | Admin panel — clear wall, switch theme |
| `http://YOUR_IP:8000/health` | Health check + live signature count |

---

## Multi-Tablet Setup

For the full 4–5 tablet deployment procedure (network setup, kiosk mode, pre-event checklist, troubleshooting), see [TABLET_DEPLOYMENT.md](TABLET_DEPLOYMENT.md).

---

## Signature Storage

Every signature is **automatically saved to disk** the moment it is submitted — no manual export needed.

```
07_signboard/
  signatures/
    2026-05-07/        ← one folder per day, rolls over at midnight
      1746600000_Rishi.png
      1746600100_Alice.png
    2026-05-08/
      ...
```

- Folders are named `YYYY-MM-DD` and created automatically
- Clearing the live wall (`/admin`) does **not** delete saved PNGs
- To check what's on disk: `POST http://YOUR_IP:8000/admin/save-images`

---

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

---

## Architecture

```
[ Tablet 1 ] ─┐
[ Tablet 2 ] ─┤
[ Tablet 3 ] ─┼──► POST /submit ──► [ FastAPI :8000 ] ──► WS broadcast ──► [ Display TV ]
[ Tablet 4 ] ─┤                           │
[ Tablet 5 ] ─┘                    signatures/YYYY-MM-DD/
                                    (auto-saved PNGs)
```

- **Backend**: FastAPI + WebSockets, in-memory store + auto disk persistence
- **Frontend**: React + Vite + TypeScript, HTML5 Canvas animation
- **Zero internet dependency** — runs entirely on local Wi-Fi

---

## Moderation

- Duplicate name within 60s → rejected
- Rate limit: 5 submissions per IP per minute
- Profanity blocklist — edit `backend/moderation.py` → `PROFANITY_BLOCKLIST`

---

## Display Wall

- Up to 500 floating signatures on canvas (GPU-friendly)
- 60fps animation: float, drift, gentle rotation
- New entries: scale-in + cyan glow pulse for 2 seconds
- Aging: older signatures fade and shrink into background
- Two themes: **sky** (day) and **space** (night) — switchable from `/admin`
