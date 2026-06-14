# Tablet Deployment Guide — Live Sign Wall

Multi-tablet input setup for the NLC Neyveli Book Fair installation.

---

## Overview

```
[ Tablet 1 ] ─┐
[ Tablet 2 ] ─┤
[ Tablet 3 ] ─┼──► [ Wi-Fi Router ] ──► [ Server Laptop :8000 ] ──► [ Display TV/Projector ]
[ Tablet 4 ] ─┤
[ Tablet 5 ] ─┘
```

- **Server laptop** — runs FastAPI, saves signatures, broadcasts in real-time
- **Tablets (4–5)** — visitor input; open the input page in a browser
- **Display screen** — connected to a second laptop or directly via HDMI; shows `/display` in fullscreen
- **Router** — everything connects to the same Wi-Fi network (no internet needed)

---

## Step 1 — Server Laptop Setup

### 1.1 Start the server

Double-click `start_server.bat` (or run from terminal):

```
cd f:\07_signboard
start_server.bat
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 1.2 Find the server's local IP

Open PowerShell or CMD and run:
```
ipconfig
```

Look for **IPv4 Address** under your active Wi-Fi adapter. It will look like:
```
IPv4 Address. . . . . . : 192.168.1.10
```

> Write this IP down — every tablet and the display will use it.

### 1.3 Allow port 8000 through Windows Firewall (first time only)

Run this in PowerShell as Administrator:
```powershell
New-NetFirewallRule -DisplayName "SignWall" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow
```

If you skip this, tablets on other devices won't reach the server.

---

## Step 2 — Network Setup

### Option A — Dedicated Wi-Fi Router (recommended for event day)

1. Connect all devices (server laptop, tablets, display laptop) to the router's Wi-Fi
2. No internet needed — router just routes LAN traffic
3. Most stable, no dependency on any one device

### Option B — Laptop Hotspot (quick testing / backup)

1. On the server laptop: Settings → Mobile Hotspot → Turn On
2. Connect all tablets to that hotspot
3. The server IP will typically be `192.168.137.1`
4. Works fine for short sessions; not ideal for 6+ hours at an event

---

## Step 3 — Configure the Display Screen

1. Open the display laptop (connected to the TV/projector via HDMI)
2. Connect it to the same Wi-Fi as the server
3. Open Chrome (or any browser)
4. Navigate to:
   ```
   http://192.168.1.10:8000/display
   ```
   _(replace with your actual server IP)_
5. Press **F11** to go fullscreen
6. Set screen sleep/screensaver to **Never** in Windows display settings

> The display page connects via WebSocket and updates automatically — no refresh needed.

---

## Step 4 — Configure Each Tablet

### 4.1 Connect to Wi-Fi

Connect each tablet to the same router the server is on.

### 4.2 Open the input page

Open Chrome (or Safari on iPad) and navigate to:
```
http://192.168.1.10:8000/
```

The visitor input page will load — name field + signature canvas.

### 4.3 Lock the tablet (Kiosk Mode)

Visitors should not be able to navigate away or access other apps.

**Android tablets (Chrome):**
1. Open the URL in Chrome
2. Tap the 3-dot menu → **Add to Home Screen** (gives a full-screen shortcut)
3. Enable **Screen Pinning**: Settings → Security → Screen Pinning → On
4. Open the shortcut, then hold the Overview button to pin the screen
5. Tablets can now only be unpinned with PIN/pattern

**iPads (Safari):**
1. Open the URL in Safari
2. Settings → Accessibility → **Guided Access** → Turn On, set a passcode
3. Open Safari with the input page loaded
4. Triple-click the Side/Home button → tap **Start**
5. Guided Access is now active — the tablet is locked to this screen

**Android — MDM / Kiosk app (if available):**
Use any free kiosk app (e.g., Fully Kiosk Browser) and point it to `http://192.168.1.10:8000/`.

### 4.4 Tablet display settings

- Set brightness to **maximum**
- Set screen timeout to **Never** (or the longest available)
- Keep the charger plugged in during the event

---

## Step 5 — Final Checklist Before Event

| Check | Done? |
|-------|-------|
| Server laptop is on and `start_server.bat` is running | ☐ |
| Server IP is known and noted | ☐ |
| All tablets on same Wi-Fi | ☐ |
| Input page loads on all tablets | ☐ |
| Display page loads fullscreen on TV | ☐ |
| Test submission from one tablet — appears on display | ☐ |
| Tablets locked in kiosk mode | ☐ |
| Tablets on charge | ☐ |
| Display laptop on charge, sleep disabled | ☐ |

---

## Day-to-Day Data

Signatures are automatically saved to disk as soon as they are submitted:

```
07_signboard/
  signatures/
    2026-05-07/       ← folder per day, rolls over at midnight
      1746600000000_Rishi.png
      1746600100000_Alice.png
    2026-05-08/
      ...
```

- No manual export needed
- After midnight a new date folder is created automatically
- To view a summary of what's saved: `POST http://192.168.1.10:8000/admin/save-images`

---

## Admin Controls

Open from any browser on the same network:

| URL | What it does |
|-----|-------------|
| `http://192.168.1.10:8000/admin` | Admin panel (clear wall, switch theme) |
| `http://192.168.1.10:8000/health` | Signature count + server status |
| `POST /admin/signatures` (DELETE) | Clears the live wall (does not delete saved PNGs) |

---

## Troubleshooting

**Tablet says "This site can't be reached"**
- Check the tablet is on the same Wi-Fi as the server
- Confirm the server is still running (`start_server.bat` terminal should be open)
- Check Windows Firewall — see Step 1.3

**Display wall is blank / not updating**
- Refresh the display page once
- Check the WebSocket connection (browser console: F12 → Console — look for WS errors)

**Signatures not appearing on display after submit**
- Try submitting from the same laptop the server runs on (`http://localhost:8000/`) — if that works, it's a network issue on the tablet

**Server IP changed (router restarted)**
- Reassign a static IP to the server laptop: Router admin panel → DHCP → Reserve IP for the server's MAC address
- Or just re-run `ipconfig` and update the URL on all devices

**Server crashed mid-event**
- Re-run `start_server.bat`
- All signatures already saved to `signatures/YYYY-MM-DD/` are safe
- The live wall will be empty until people sign again (in-memory only resets on restart)
