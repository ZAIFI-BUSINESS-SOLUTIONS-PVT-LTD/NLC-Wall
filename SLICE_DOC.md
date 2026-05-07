# Live Sign Wall — Slice Doc
> Code-verified bugs, risk mitigations, improvements, and hotspot deployment plan.
> All line references checked against actual source files as of 2026-05-07.

---

## Part 1 — Bug Inventory & Risk Mitigation

### Severity key
| Level | Meaning |
|-------|---------|
| **P0 — Critical** | Wrong output or data loss today |
| **P1 — High** | Feature broken under realistic conditions |
| **P2 — Medium** | Degraded experience; could surface at event |
| **P3 — Low** | Polish / edge-case |

---

### P0 — Critical

#### BUG-01 · Admin "Save Images" shows `undefined` in feedback
**File:** [frontend/src/pages/AdminPage.tsx:96](frontend/src/pages/AdminPage.tsx#L96)

**What's wrong:**
```ts
// AdminPage.tsx line 96
setExportMsg(`Saved ${data.saved} image${data.saved !== 1 ? "s" : ""} → ${data.dir}`);
```
The API at `/admin/save-images` returns `{ newly_saved, signatures_dir, folders }` (verified in [backend/main.py:114](backend/main.py#L114)).
The UI reads `data.saved` and `data.dir` — both are always `undefined`.
Every click shows: **"Saved undefined images → undefined"**.

**Fix:** Change `data.saved` → `data.newly_saved` and `data.dir` → `data.signatures_dir`.

---

#### BUG-02 · Download Signature Sheet — signature images are never drawn
**File:** [frontend/src/pages/AdminPage.tsx:142–171](frontend/src/pages/AdminPage.tsx#L142)

**What's wrong:**
The sheet generation loop draws a card background and the visitor's name. It checks `sig.signature` to shift the name text upward (line 170), leaving room for the drawing — but the actual drawing is **never rendered**. Every card in the exported PNG shows a blank white space where the signature should be.

**Fix:** After the `ctx.fillText(sig.name …)` call, load the base64 image and `drawImage` it into the reserved `sigH` space. Needs async image loading or a pre-load step before canvas generation starts.

---

### P1 — High

#### BUG-03 · Disk save failures are completely silent
**File:** [backend/storage.py:36](backend/storage.py#L36)

**What's wrong:**
```python
except Exception:
    pass   # ← no log, no raise, no retry
```
If the `signatures/` folder is full, the path has a permission error, or `base64.b64decode` fails on a corrupted payload, the signature is accepted and broadcast to the display wall but **never written to disk**. The admin and operator have no indication anything went wrong.

**Fix:** Replace with `except Exception as e: logging.error("save_to_disk failed for %s: %s", sig.id, e)`. Add Python `logging.basicConfig` at the top of `main.py`.

---

#### BUG-04 · Image cache on the display wall grows forever
**File:** [frontend/src/utils/canvas.ts:124](frontend/src/utils/canvas.ts#L124)

**What's wrong:**
```ts
const _imgCache = new Map<string, HTMLImageElement>();
```
One entry per signature, keyed by the full base64 string (hundreds of KB each). Over a 6-hour event with 500 signatures the display browser tab accumulates hundreds of MB of `Image` objects. No eviction, no cap. Chrome will eventually GC-pause or OOM-kill the tab mid-event.

**Fix:** Add an LRU cap. Simple version: after inserting, if `_imgCache.size > 300`, delete the oldest key (`_imgCache.delete(_imgCache.keys().next().value)`).

---

### P2 — Medium

#### BUG-05 · WebSocket reconnect hammers the server with fixed 2s retry
**File:** [frontend/src/hooks/useWebSocket.ts:33](frontend/src/hooks/useWebSocket.ts#L33)

**What's wrong:**
```ts
reconnectTimer.current = setTimeout(connect, 2000);
```
If the server restarts mid-event (power blip, crash), every connected tablet and the display screen immediately fires reconnects every 2 seconds in lockstep. Under 5 simultaneous clients this is fine; at 10+ with a slow restart it's a thundering-herd.

**Fix:** Exponential backoff with jitter:
```ts
const delay = Math.min(30000, 2000 * Math.pow(2, retries)) + Math.random() * 1000;
```
Also show a "Reconnecting…" indicator on the input page so visitors know to wait rather than refresh.

---

#### BUG-06 · Disk filename silently corrupts non-ASCII names
**File:** [backend/storage.py:29–32](backend/storage.py#L29)

**What's wrong:**
```python
safe_name = "".join(
    c if c.isalnum() or c in (" ", "-", "_") else "_"
    for c in sig.name
)[:30].strip()
```
Tamil script (e.g., `மணிகண்டன்`) → becomes `______________________________` → stripped to empty string → `safe_name or 'sig'` → file saved as `{timestamp}_sig.png`.
All Tamil names on disk become indistinguishable. The fallback prevents a crash but the files are mislabelled.

**Fix:** Transliterate using `anyascii` (one pip install, zero dependencies) or use the UUID instead: `filename = f"{sig.timestamp}_{sig.id[:8]}.png"`. The UUID is already in the Signature model.

---

### P3 — Low / Polish

#### BUG-07 · Cloud animation teleports on wrap-around
**File:** [frontend/src/components/FloatingWall.tsx:100](frontend/src/components/FloatingWall.tsx#L100)

```ts
if (cloud.x > W + cloud.size * 2) cloud.x = -cloud.size * 2;
```
When a cloud drifts off the right edge it instantly pops to the left at full opacity. Visible on the big screen. Fix: reset `alpha` to 0 at the same time and let it tick back up over ~1 second.

---

#### BUG-08 · Signature canvas not DPI-aware — blurry on Retina/high-DPI tablets
**File:** [frontend/src/components/SignatureCanvas.tsx:107](frontend/src/components/SignatureCanvas.tsx#L107)

```tsx
<canvas ref={canvasRef} width={560} height={200} ... />
```
On a 2× display the canvas logical pixels map to physical 560×200 regardless of screen density, so the signature looks blurry both on the tablet and when displayed on screen.

**Fix:**
```ts
const dpr = window.devicePixelRatio || 1;
canvas.width = 560 * dpr;
canvas.height = 200 * dpr;
canvas.style.width = "560px";
canvas.style.height = "200px";
ctx.scale(dpr, dpr);
```

---

#### UX-01 · No visual feedback on display when admin clears the wall
**File:** [frontend/src/pages/DisplayPage.tsx:31](frontend/src/pages/DisplayPage.tsx#L31)

The `clear` WS event clears signatures and count but shows nothing. From the audience's perspective cards just vanish. Add a brief full-screen toast ("Wall cleared — sign again!") for 3 seconds.

---

#### UX-02 · No "Reconnecting…" indicator when WebSocket drops
**File:** [frontend/src/hooks/useWebSocket.ts](frontend/src/hooks/useWebSocket.ts)

Visitors on tablets see a frozen submit page with no indication the server is down. Expose a `connected: boolean` from the hook and show a dismissible banner: "Connection lost — reconnecting…".

---

#### PERF-01 · O(n²) collision detection — acceptable up to ~300 items
**File:** [frontend/src/utils/animation.ts:109](frontend/src/utils/animation.ts#L109)

The `separateItems` function is a nested loop over all items. 300 items = 45k comparisons per frame; 500 = 125k. At 60fps and pure JS arithmetic this is fine on a modern laptop. If the event exceeds 400+ signatures and the display screen lags, the easy fix is to cap `separateItems` to run only every other frame.

---

### Confirmed Non-Issues (false alarms corrected)

| Claim | Reality |
|-------|---------|
| `_display_theme` race condition | FastAPI asyncio is single-threaded cooperative; the assignment is synchronous. No race possible. |
| IP rate limiting breaks behind router | Each device on LAN gets its own IP from the router/hotspot DHCP. `request.client.host` is correct per-device. |
| Theme HTTP fetch races with WS `display_theme` event | Both return the same server-side value, so whichever wins sets the correct state. |
| Form clears name on submission error | Name is preserved on error; only cleared on success (lines 35–37). |

---

## Part 2 — Improvement Opportunities

These are not bugs — they are enhancements that would make the installation more robust.

| # | Area | What | Why |
|---|------|------|-----|
| I-01 | Reliability | Add `logging.basicConfig(level=INFO, filename="signwall.log")` to backend | Post-event diagnosis without guessing |
| I-02 | Reliability | On server restart, reload existing disk signatures into `_store` | Wall isn't blank if server crashes and restarts mid-event |
| I-03 | UX | Show signer number on success: "You're signer #247!" | Crowd engagement, shareable moment |
| I-04 | UX | Auto-focus the name input on page load | Saves one tap per visitor; critical for kiosk flow |
| I-05 | Admin | Show disk folder sizes in admin panel | Know early if you're running low on disk space |
| I-06 | Admin | Clarify "Save Signature Images to Server" button label | Rename to "Flush In-Memory Signatures to Disk" — current name implies internet upload |
| I-07 | Display | Preload `Noto Sans Tamil` font on display page | First Tamil name won't flash in default serif before font loads |
| I-08 | Config | Move port, `MAX_SIGNATURES`, rate-limit constants to a `.env` file with `python-dotenv` | Change limits without editing source code |
| I-09 | Performance | Offscreen canvas: pre-render card images once, blit to main canvas each frame | Reduces per-frame drawing cost at high signature counts |
| I-10 | QR code | Generate and display a QR code on the display wall pointing to the input page URL | Visitors can scan directly from the big screen instead of typing an IP |

---

## Part 3 — Hotspot Deployment Plan

> Goal: Run the entire installation from a single Windows 10 laptop — no separate router needed.
> The laptop runs the FastAPI server AND acts as the Wi-Fi hotspot that tablets connect to.

### How it works

```
[ Server Laptop ]
  ├── FastAPI :8000  (backend)
  ├── Built frontend  (served by FastAPI from /frontend/dist)
  ├── Windows Mobile Hotspot  (192.168.137.1 — fixed, always this IP)
  │
  └── Wi-Fi Hotspot broadcast
        ├── [ Tablet 1 ]  192.168.137.xxx
        ├── [ Tablet 2 ]  192.168.137.xxx
        ├── [ Tablet 3 ]  192.168.137.xxx
        └── [ Display Laptop / TV HDMI ]  192.168.137.xxx
```

The server IP is always `192.168.137.1` when using Windows Mobile Hotspot — no `ipconfig` lookup needed on event day.

---

### Step-by-step setup

#### Step 1 — Enable Windows Mobile Hotspot (do once, save settings)

1. Open **Settings → Network & Internet → Mobile Hotspot**
2. Set a memorable **Network name** (e.g., `NLC-SignWall`) and **Password**
3. Set **Share my Internet connection from:** to your Ethernet or Wi-Fi adapter (the one that has the internet, if any — doesn't matter if there's no internet)
4. Turn **Mobile Hotspot** ON
5. The server IP is now permanently `192.168.137.1`

> Write the hotspot name and password on a physical label on the laptop for event day.

---

#### Step 2 — Prevent the hotspot from sleeping

Windows turns off the hotspot after a few minutes of no clients. Disable this:

1. **Settings → Network & Internet → Mobile Hotspot**
2. Turn OFF **"When no devices are connected, automatically turn off mobile hotspot"**

Also disable laptop sleep while plugged in:
- **Settings → System → Power & Sleep** → set both dropdowns to **Never** (when plugged in)

---

#### Step 3 — Open the firewall (run once as Administrator)

```powershell
New-NetFirewallRule -DisplayName "SignWall-8000" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow
```

This allows tablets on the hotspot network to reach port 8000.

---

#### Step 4 — Start the server

```
start_server.bat
```

Verify it says:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

`0.0.0.0` means it listens on all interfaces including the hotspot interface. No change to the server code needed.

---

#### Step 5 — Connect tablets

On each Android tablet or iPad:
1. Go to Wi-Fi settings
2. Connect to `NLC-SignWall` with your password
3. Open Chrome / Safari and navigate to:
   ```
   http://192.168.137.1:8000/
   ```
4. Bookmark it or add to home screen

The URL never changes — `192.168.137.1` is fixed by Windows.

---

#### Step 6 — Connect the display screen

**Option A — Laptop with HDMI to projector/TV:**
1. Connect the display laptop to `NLC-SignWall` hotspot
2. Open Chrome → `http://192.168.137.1:8000/display`
3. Press **F11** (fullscreen)

**Option B — Server laptop drives the display directly:**
1. Extend the server laptop's display to the TV via HDMI
2. Move Chrome to the second screen
3. Open `http://localhost:8000/display` on the second screen
4. Press **F11**
5. Advantage: one fewer device, one fewer Wi-Fi client

---

#### Step 7 — Pre-event checklist (hotspot edition)

| Check | Done? |
|-------|-------|
| Hotspot ON, name + password set | ☐ |
| "Auto-off when no clients" disabled | ☐ |
| Laptop sleep disabled (plugged in) | ☐ |
| Firewall rule for port 8000 added | ☐ |
| `start_server.bat` running — shows `0.0.0.0:8000` | ☐ |
| Test from laptop browser: `http://192.168.137.1:8000/` loads | ☐ |
| All tablets on `NLC-SignWall` hotspot | ☐ |
| Input page loads on every tablet | ☐ |
| Display page loads fullscreen on TV | ☐ |
| Test submission: appears on display within 1s | ☐ |
| Admin page accessible: `http://192.168.137.1:8000/admin` | ☐ |
| Tablets on charge | ☐ |
| Display laptop / TV on charge, sleep disabled | ☐ |

---

### Hotspot vs. router — trade-offs

| Factor | Hotspot (this plan) | Separate router |
|--------|---------------------|-----------------|
| Setup complexity | Low — built into Windows | Medium — needs router config |
| Extra hardware | None | Router + cables |
| Server IP | Always `192.168.137.1` | Varies unless static reserved |
| Max clients | ~8 comfortably | 20+ |
| Reliability risk | Laptop must stay awake | Router is independent |
| Recovery on crash | Restart `start_server.bat` | Same |
| Best for | Compact / travel setup | Large events, 6+ tablets |

**Recommendation for NLC Book Fair (4–5 tablets):** Hotspot is sufficient and simpler. Bring a small travel router as backup.

---

### Troubleshooting — hotspot specific

**Tablet says "Connected, no internet" — is that okay?**
Yes. There is no internet. The tablet is only talking to `192.168.137.1`. This warning is normal and safe to ignore.

**Hotspot turned itself off mid-event**
- Check "Auto-off when no clients" is disabled (Step 2)
- Re-enable hotspot from Settings; tablets will reconnect automatically within ~10s
- The server keeps running; no data is lost

**Server IP changed after restart**
It won't — `192.168.137.1` is the fixed gateway IP for Windows Mobile Hotspot. This is hardcoded by Windows, not by DHCP.

**Tablet can't reach `192.168.137.1:8000` even though it's on the hotspot**
Run this check on the server laptop:
```powershell
netstat -an | findstr 8000
```
Should show `0.0.0.0:8000  LISTENING`. If not, the server isn't running or is bound to `127.0.0.1` only. Check `start_server.bat` passes `--host 0.0.0.0`.

**Display wall WebSocket disconnects repeatedly**
Windows may be throttling the hotspot radio. Plug the server laptop into power (not battery) and ensure "High performance" power plan is active:
```
Settings → System → Power & Sleep → Additional power settings → High performance
```
