# How to Use — Live Sign Wall

Visitors sign on tablets → signatures float live on the big display screen in real time.
Runs entirely on local Wi-Fi. No internet required.

---

## 1. First-Time Setup

### Install dependencies

**Backend (Python):**
```powershell
cd backend
pip install -r requirements.txt
```

**Frontend (build once, or after code changes):**
```powershell
build_frontend.bat
```

---

## 2. Starting the Server

Double-click `start_server.bat`, or run:
```powershell
cd f:\07_signboard
start_server.bat
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

Keep this terminal open for the duration of the event.

---

## 3. Find Your Server's Local IP

```powershell
ipconfig
```

Look for **IPv4 Address** under your active Wi-Fi adapter:
```
IPv4 Address. . . . . . : 192.168.1.10
```

Write this down — every tablet and the display screen will use this IP.

---

## 4. Allow Port 8000 Through Firewall (first time only)

Run PowerShell as **Administrator**:
```powershell
New-NetFirewallRule -DisplayName "SignWall" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow
```

Skip this and tablets on other devices won't be able to reach the server.

---

## 5. Network Setup

All devices (server laptop, tablets, display laptop) must be on the **same Wi-Fi network**.

| Option | When to use |
|--------|-------------|
| **Dedicated Wi-Fi router** | Event day — most stable, no single point of failure |
| **Laptop hotspot** | Quick testing / backup. Enable via Settings → Mobile Hotspot. Server IP is typically `192.168.137.1` |

---

## 6. Open on Devices

Replace `192.168.1.10` with your actual server IP.

| Device | URL | Notes |
|--------|-----|-------|
| Tablet (input) | `http://192.168.1.10:8000/` | One per signing table |
| Big screen / TV | `http://192.168.1.10:8000/display` | Press F11 for fullscreen |
| Admin panel | `http://192.168.1.10:8000/admin` | Any browser on the network |
| Health check | `http://192.168.1.10:8000/health` | Shows live signature count |

---

## 7. Tablet Setup

### Connect to Wi-Fi
Connect each tablet to the same network as the server.

### Open the input page
Open Chrome (Android) or Safari (iPad) and go to:
```
http://192.168.1.10:8000/
```

### Tablet display settings
- Brightness → maximum
- Screen timeout → Never (or longest available)
- Keep charger plugged in

### Lock in Kiosk Mode (so visitors can't navigate away)

**Android (Chrome):**
1. Open the URL in Chrome
2. 3-dot menu → Add to Home Screen
3. Settings → Security → Screen Pinning → On
4. Open the shortcut, hold the Overview button → Pin

**iPad (Safari):**
1. Open URL in Safari
2. Settings → Accessibility → Guided Access → On (set a passcode)
3. Triple-click Side/Home button → tap Start

**Android with Fully Kiosk Browser:**
Install the app and point it to `http://192.168.1.10:8000/`

---

## 8. Display Screen Setup

1. Connect display laptop to the TV/projector via HDMI
2. Connect it to the same Wi-Fi as the server
3. Open Chrome and go to `http://192.168.1.10:8000/display`
4. Press **F11** for fullscreen
5. Set screen sleep → **Never** in Windows display settings

The display page auto-connects via WebSocket and auto-refreshes every 2 minutes
to keep the wall fresh during long-running events.

---

## 9. Admin Panel

Open `http://192.168.1.10:8000/admin` in any browser.

| Action | What it does |
|--------|-------------|
| **Clear wall** | Removes audience signatures from the live display. Does NOT delete saved PNGs. |
| **Switch theme** | Changes the display wall background live (no page reload needed) |
| **Chief Guest mode** | Toggle to mark a signature as chief guest — stays pinned on display |
| **Set pledge text** | Shown on the input page below the signature canvas |

### Themes

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

## 10. Signature Storage

Every signature is saved to disk automatically when submitted:

```
07_signboard/
  signatures/
    2026-06-04/
      1746600000_Rishi.png
      1746600100_Alice.png
    2026-06-05/
      ...
```

- Folders roll over at midnight automatically
- Clearing the live wall does **not** delete saved PNGs
- To force-save any in-memory signatures: `POST http://192.168.1.10:8000/admin/save-images`

---

## 11. Pre-Event Checklist

| Check | Done? |
|-------|-------|
| `start_server.bat` running, no errors | ☐ |
| Server IP noted (from `ipconfig`) | ☐ |
| Port 8000 allowed through Windows Firewall | ☐ |
| All tablets on same Wi-Fi | ☐ |
| Input page loads on all tablets | ☐ |
| Display page loads fullscreen on TV | ☐ |
| Test submission from tablet — appears on display | ☐ |
| Tablets in kiosk mode | ☐ |
| Tablets plugged into charger | ☐ |
| Display laptop plugged in, screen sleep disabled | ☐ |

---

## 12. Troubleshooting

**"This site can't be reached" on tablet**
- Confirm tablet is on the same Wi-Fi as the server
- Confirm the server terminal is still running
- Check Windows Firewall (see section 4)

**Display wall not updating / blank**
- Refresh the display page once
- Open browser console (F12 → Console) — look for WebSocket errors

**Signatures not appearing on display after submit**
- Test from the server laptop itself (`http://localhost:8000/`) — if that works, the issue is network-side on the tablet

**Server IP changed (router restarted)**
- Run `ipconfig` on the server laptop to get the new IP
- Update the URL on all tablets and the display laptop
- To avoid this: reserve a static IP for the server in your router's DHCP settings (use the server's MAC address)

**Server crashed mid-event**
- Re-run `start_server.bat`
- All signatures already written to `signatures/YYYY-MM-DD/` are safe
- The live wall will be empty until new signatures come in (in-memory state resets on restart)

**Moderation — if a name is blocked**
- Rate limit: 15 submissions per IP per minute
- Duplicate name: same name blocked for 8 seconds (prevents double-taps)
- Profanity blocklist: edit `backend/moderation.py` → `PROFANITY_BLOCKLIST`
