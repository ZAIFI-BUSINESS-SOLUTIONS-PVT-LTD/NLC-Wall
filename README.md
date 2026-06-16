
# Live Sign Wall — NLC Neyveli Book Fair

Fully offline, local-network interactive digital signature wall.  
Visitors sign on tablets → signatures appear live on the big display screen in real-time.  
Handles **80+ signatures per minute** seamlessly. No internet required.

---

## Running the App (no technical knowledge needed)

Use the prebuilt `SignWall.exe` — no Python, no Node, no installs.

1. Copy `SignWall.exe` into its own folder, e.g. `C:\SignWall\`
2. Double-click it — a black console window opens with the server address
3. If Windows SmartScreen warns "Windows protected your PC": click **More info → Run anyway**
4. On any device on the same Wi-Fi, open a browser and go to `http://<server-ip>:8000/`

Full step-by-step guide (firewall, tablet kiosk mode, display setup, troubleshooting):  
[`packaging/DEPLOY_README.txt`](packaging/DEPLOY_README.txt)

To rebuild the exe after code changes: run [`packaging/build_exe.bat`](packaging/build_exe.bat)

---

## Quick URL Reference

Replace `192.168.1.10` with your server's actual IP (`ipconfig` → IPv4 Address).

| URL | Purpose |
|-----|---------|
| `http://192.168.1.10:8000/` | Visitor signing page — open on each tablet |
| `http://192.168.1.10:8000/display` | Live signature wall — open fullscreen (F11) on the big screen |
| `http://192.168.1.10:8000/admin` | Admin panel — theme, clear wall, chief guest, pledge text |
| `http://192.168.1.10:8000/health` | Health check + live signature count |

---

## Development Setup

For developers running from source. Full guide: [`docs/HOW_TO_USE.md`](docs/HOW_TO_USE.md)

**Backend (FastAPI):**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Frontend (React + Vite):**
```bash
cd frontend
npm install
npm run dev          # dev server on :5173, proxies API/WS to :8000
```

**Build for production (serves from :8000 directly):**
```bash
build_frontend.bat   # runs npm install + npm run build → frontend/dist/
start_server.bat     # installs Python deps + starts uvicorn
```

---

## Architecture

```
[ Tablet 1 ] ─┐
[ Tablet 2 ] ─┤
[ Tablet 3 ] ─┼──► POST /submit ──► [ FastAPI :8000 ] ──► WS broadcast ──► [ Display TV ]
[ Tablet N ] ─┘                           │
                                   signatures/YYYY-MM-DD/
                                   (auto-saved PNGs)
```

- **Backend**: FastAPI + WebSockets, in-memory store (cap 500) + auto disk persistence to SQLite + PNG
- **Frontend**: React 18 + TypeScript + Vite, HTML5 Canvas 60 fps animation
- **Zero internet dependency** — runs entirely on local Wi-Fi

---

## Signature Storage

Every signature is saved automatically the moment it is submitted.

```
signwall/
  signwall.db            ← SQLite, full history
  signatures/
    2026-06-04/          ← one folder per day, rolls over at midnight
      1746600000_Rishi.png
      1746600100_Alice.png
```

- Clearing the live wall (`/admin → Clear wall`) does **not** delete saved PNGs
- To force-flush in-memory items to disk: `POST http://<ip>:8000/admin/save-images`

---

## Admin Panel

| Action | What it does |
|--------|-------------|
| **Clear wall** | Removes audience signatures from the live display. Saved PNGs are untouched. |
| **Switch theme** | Changes the display wall background live — no page reload |
| **Chief Guest mode** | Marks a signature as chief guest — stays pinned on the display |
| **Set pledge text** | Shown on the tablet input page below the signature canvas |

---

## Display Wall

Cards recede into the background by count, not by time:

| Position from newest | Size | Opacity |
|---|---|---|
| 1 – 10 (front row) | 100% | 100% |
| 11 – 32 (recession zone) | shrinks to 50% | 92% → 12% |
| 33+ | evicted from canvas | — |

The newest arrival enters with a scale-in zoom + glow pulse. Canvas is capped at **32 live items** — the renderer stays smooth even at 80 signs/min.

### Themes

Seven themes switchable live from `/admin` with no page reload:

| Theme | Feel |
|-------|------|
| Sky | Bright day sky with drifting clouds |
| Space | Deep space with twinkling stars |
| Aurora | Dark sky with animated aurora bands |
| Ocean | Deep ocean with rising bubbles |
| Neon | Black with neon grid and streaks |
| Forest | Dark forest with falling leaves and fireflies |
| Sunset | Warm gradient with rising embers |

---

## Moderation

| Rule | Value | Notes |
|------|-------|-------|
| Rate limit | 15 submissions / IP / minute | Allows burst from a busy tablet |
| Duplicate name | 8-second window | Prevents double-taps; same name from a different IP is accepted after 8 s |
| Profanity | blocklist | Edit `backend/moderation.py` → `PROFANITY_BLOCKLIST` |

---

## Testing

237 automated tests (172 backend / 65 frontend). See [`docs/TESTING.md`](docs/TESTING.md) for how to run them.

---

## Docs

| File | Contents |
|------|----------|
| [`docs/HOW_TO_USE.md`](docs/HOW_TO_USE.md) | Full developer setup and event deployment guide |
| [`docs/TESTING.md`](docs/TESTING.md) | How to run the test suites |
| [`docs/TEST_CASES.md`](docs/TEST_CASES.md) | Complete catalog of all 237 test cases |
| [`packaging/DEPLOY_README.txt`](packaging/DEPLOY_README.txt) | Non-techie guide shipped with SignWall.exe |
