
# Live Sign Wall — NLC Neyveli Book Fair

Fully offline, local-network interactive digital signature wall.
Visitors sign on tablets → signatures appear live on the big display screen in real-time.
Designed for high-throughput multi-table events — handles up to **80+ signatures per minute** seamlessly.

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

For the full deployment procedure (network setup, kiosk mode, pre-event checklist, troubleshooting), see [TABLET_DEPLOYMENT.md](TABLET_DEPLOYMENT.md).

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
[ Tablet N ] ─┘                    signatures/YYYY-MM-DD/
                                    (auto-saved PNGs)
```

- **Backend**: FastAPI + WebSockets, in-memory store (cap 500) + auto disk persistence
- **Frontend**: React + Vite + TypeScript, HTML5 Canvas 60fps animation
- **Zero internet dependency** — runs entirely on local Wi-Fi

---

## Moderation

| Rule | Value | Notes |
|------|-------|-------|
| Rate limit | **15 submissions / IP / minute** | Allows burst from a busy tablet |
| Duplicate name | **8 second** window | Prevents double-taps; same name from a different table is accepted after 8s |
| Profanity | blocklist | Edit `backend/moderation.py` → `PROFANITY_BLOCKLIST` |

---

## Display Wall

### Floating card behaviour

Cards recede into the background by **count**, not by time:

| Position from newest | Size | Opacity |
|---|---|---|
| 1 – 10 (front row) | 100% — all identical | 100% |
| 11 – 32 (recession zone) | gradually shrinks to 50% | 92% → 12% |
| 33+ | evicted from canvas | — |

- The newest arrival always enters with a scale-in zoom + glow pulse
- Scale transitions are smoothly animated (~0.4 s) so displacement never looks jarring
- Canvas is capped at **32 live items** — the renderer stays smooth even at 80 signs/min

### Themes

Seven themes switchable live from `/admin` with no page reload:

| Theme | Feel |
|-------|------|
| ☁ Sky | Bright day sky with drifting clouds |
| 🌌 Space | Deep space with twinkling stars |
| 🌠 Aurora | Dark sky with animated aurora bands |
| 🌊 Ocean | Deep ocean with rising bubbles |
| ⚡ Neon | Black with neon grid and streaks |
| 🌿 Forest | Dark forest with falling leaves & fireflies |
| 🌅 Sunset | Warm gradient with rising embers |
