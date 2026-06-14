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

---

## Part 4 — Installation Experience Upgrade Plan

> Added 2026-05-14 after full UX/installation audit.
> This is NOT a web-app feature list. Every item is evaluated as a live public installation.

---

### Philosophy shift

The system must stop being a "web app on a big screen" and become an **interactive installation** where:

- Every person who signs sees a **ceremony moment**, not a form submit
- Every bystander sees **something they want to join**
- The display wall has **visual life** independent of new submissions
- Operators can diagnose problems **at a glance** from across the room
- The system **survives 6 hours, power blips, and network hiccups** without operator intervention

---

### Severity key (mirrors Part 1)

| Level | Meaning |
|-------|---------|
| **P0 — Critical** | Will cause visible failure or immersion break at the event |
| **P1 — High** | Significantly degrades crowd experience or participation |
| **P2 — Medium** | Premium polish; notable improvement but event survives without it |

---

### P0 — Critical (ship blockers)

| ID | Area | Problem | Affected File(s) | Complexity | Rollback |
|----|------|---------|-----------------|------------|---------|
| X-01 | Immersion | Admin gear `⚙` visible to all visitors on display wall | `DisplayPage.tsx:64` | Trivial | 1-line revert |
| X-02 | Crowd UX | New signature toast is 15px, bottom-right — invisible from 3m | `DisplayPage.tsx`, `index.css` | Low | CSS-only revert |
| X-03 | Performance | Sky background gradient re-created every frame (18k allocs/min) | `FloatingWall.tsx:136` | Low | Revert cache vars |
| X-04 | Performance | `toDataURL()` called on every `touchmove` pixel — causes input lag on tablets | `SignatureCanvas.tsx:87` | Low | Revert rAF wrapper |
| X-05 | Crowd UX | New card appears at random screen position — crowd can't find their name | `animation.ts:createItem` | Medium | Revert field additions |
| X-06 | Performance | O(n²) separation at 300+ cards will cause visible frame drops | `animation.ts:109` | Medium | Frequency throttle |

---

### P1 — High (strong participation/engagement impact)

| ID | Area | Improvement | Affected File(s) | Complexity | Rollback |
|----|------|------------|-----------------|------------|---------|
| Y-01 | Tamil UX | All input labels English-only; tablet visitors are Tamil-first | `NameInput.tsx` | Trivial | Text revert |
| Y-02 | Tablet UX | Name input requires a tap to focus — extra friction at kiosk | `NameInput.tsx` | Trivial | Remove `autoFocus` |
| Y-03 | Tablet UX | Signature canvas looks mandatory (dashed border, no label) | `SignatureCanvas.tsx` | Low | CSS + label revert |
| Y-04 | Ceremony | Success state is a 14px green text box — no "look at the screen" moment | `InputPage.tsx`, `index.css` | Low | JSX revert |
| Y-05 | Display | Count number jumps instantly — missed animation opportunity | `DisplayPage.tsx` | Low | Remove hook |
| Y-06 | Display | Card boundary pad = 70px — 14% of screen real estate wasted | `animation.ts:87` | Trivial | Revert constant |
| Y-07 | Display | Oldest cards fade to 30% opacity — early participants feel erased | `animation.ts:97` | Trivial | Revert lerp min |
| Y-08 | Reliability | Server restart loses all in-memory signatures | `storage.py`, `main.py` | Medium | Feature flag env var |
| Y-09 | Reliability | Auto-restart watchdog missing from `start_server.bat` | `start_server.bat` | Low | Revert bat file |
| Y-10 | Reliability | Wake Lock not set on tablets — screens sleep mid-event | `InputPage.tsx` | Low | Remove useEffect |

---

### P2 — Medium (premium polish)

| ID | Area | Improvement | Complexity | Rollback |
|----|------|------------|------------|---------|
| Z-01 | Animation | Spring/elastic entry easing (overshoot and settle) | Low | Swap easing fn |
| Z-02 | Animation | Entry shockwave ring expanding from card origin | Medium | Remove shockwave array |
| Z-03 | Crowd | QR code on display wall pointing to tablet URL | Low | Remove component |
| Z-04 | Ceremony | Participant number badge after submission (#247) | Medium | Backend + frontend |
| Z-05 | Ceremony | Card palette color shown on tablet after success | Low | Remove hint |
| Z-06 | Crowd | Milestone celebrations at 100/200/300/500 signatures | Medium | Remove milestone logic |
| Z-07 | Animation | Ambient sparkle particles from floating cards | Medium | Remove sparkle array |
| Z-08 | Display | Depth-stratified motion speed (parallax illusion) | Low | Revert speed factor |
| Z-09 | Display | Name ticker marquee at bottom of wall | Medium | Remove ticker |
| Z-10 | Reliability | WebSocket connection indicator (green/red dot) on display | Low | Remove indicator |

---

### Animation philosophy

**Before:** Cards appear anywhere, drift randomly, older cards fade toward invisible. Passive, static.

**After:** Every new card enters from a **fixed, predictable zone** (bottom-center) so the crowd knows where to look. Cards drift with **depth-stratified speed** (small = slower = feels further away). The wall **breathes** — no frame is identical to the previous. Older participants remain **legible** (opacity min 0.55 vs previous 0.30).

Core motion rules:
1. Entry: fixed zone → target position, spring easing, 0.7s
2. Float: sine-wave drift + slow velocity + bounce walls at 24px (not 70px)
3. Depth: `depthFactor = 0.4 + scale * 0.45` applied to velocity
4. Glow: 5s decay (not 3s) — new entries stay highlighted longer

---

### Tablet experience philosophy

**Goal:** Zero hesitation between arriving at the tablet and seeing your name on screen.

Rules:
1. Name field is **auto-focused** — no first tap required
2. Signature is **visibly optional** — "விருப்பம் / Optional" label + skip affordance
3. Submit button is **tall** (≥56px touch target)
4. Success state **fills the card** and tells you exactly what to do: "Look at the display wall!"
5. Error messages are in **Tamil first**, English second
6. Wake Lock prevents screen sleep on idle tablets

---

### Display wall philosophy

**Goal:** The wall must feel **cinematic and alive**, not like a browser tab.

Rules:
1. No technical scaffolding visible (no admin gear, no IP text)
2. New signature toast is **unmissable from the back of the crowd** (top-center, 22px+, 5s)
3. Counter animates when it increments — even +1 should feel like a milestone
4. Every card uses the **full screen** — boundary pad reduced from 70px to 24px
5. The background is **never static** — sky gradient cached but space hue rotates, stars twinkle

---

### Event-day reliability priorities

In order of risk:
1. Server auto-restart watchdog in `start_server.bat`
2. SQLite persistence so restart doesn't lose data
3. WebSocket status indicator visible to operator
4. Offline submit queue on tablets (localStorage retry)
5. Wake Lock on all tablet pages

---

## Part 5 — Implementation Roadmap

> Execution order: safest + highest ROI first. Each group is independently shippable.

---

### Group 1 — Critical fixes (do these first, zero architectural risk)

| Order | Change | Files | Why first |
|-------|--------|-------|-----------|
| 1 | Hide admin gear behind `?admin` URL param | `DisplayPage.tsx` | 1-line fix, breaks immersion today |
| 2 | Tamil labels + autoFocus on name input | `NameInput.tsx` | Zero risk, immediate participation lift |
| 3 | Signature optional badge + label | `SignatureCanvas.tsx` | Removes #1 tablet hesitation point |
| 4 | Debounce `toDataURL` to rAF | `SignatureCanvas.tsx` | Fixes input lag, zero visual change |
| 5 | Sky gradient cache (module-level) | `FloatingWall.tsx` | 18k → 1 gradient alloc/min, zero visual change |

---

### Group 2 — UX upgrades (high crowd impact, low risk)

| Order | Change | Files | Impact |
|-------|--------|-------|--------|
| 6 | Large success overlay with name + "look at screen" | `InputPage.tsx`, `index.css` | Ceremony moment — highest participation retention |
| 7 | Animated rolling counter on display | `DisplayPage.tsx` | Every new signature feels like an event |
| 8 | Toast → top-center, 22px font, 5s duration | `DisplayPage.tsx`, `index.css` | Visible from back of crowd |
| 9 | Wake Lock on tablet input page | `InputPage.tsx` | Prevents mid-event screen sleep |

---

### Group 3 — Animation upgrades (medium risk, verify visually)

| Order | Change | Files | Impact |
|-------|--------|-------|--------|
| 10 | Fixed entry zone (bottom-center → float target) | `animation.ts`, `FloatingWall.tsx` | Crowd knows where to look for new entries |
| 11 | Reduce boundary pad 70px → 24px | `animation.ts` | Full screen utilization |
| 12 | Opacity min 0.30 → 0.55, scale min 0.60 → 0.75 | `animation.ts` | Early participants remain legible |
| 13 | Depth-stratified motion speed | `animation.ts` | Parallax depth, no perf cost |
| 14 | Entry shockwave ring | `canvas.ts`, `FloatingWall.tsx` | Visceral "arrival" feel |

---

### Group 4 — Performance optimizations (do before Group 3 if card count > 200)

| Order | Change | Files | Impact |
|-------|--------|-------|--------|
| 15 | O(n²) → spatial grid separation | `animation.ts` | Prevents frame drops at 200+ cards |
| 16 | Skip off-screen card draw | `FloatingWall.tsx` | Free perf at boundary zones |
| 17 | Separation frequency throttle (every-2nd frame at 150+ items) | `animation.ts` | Halves collision cost during peak |

---

### Group 5 — Reliability hardening (do day before event)

| Order | Change | Files | Impact |
|-------|--------|-------|--------|
| 18 | Auto-restart watchdog in `start_server.bat` | `start_server.bat` | No operator intervention on crash |
| 19 | SQLite persistence layer | `storage.py`, `main.py` | Restart-safe signature storage |
| 20 | WebSocket status dot on display | `DisplayPage.tsx`, `index.css` | Operator sees health at a glance |
| 21 | Offline submit queue (localStorage retry) | `InputPage.tsx` | Brief WiFi blip loses nothing |

---

### Group 6 — Premium enhancements (if time allows)

| Order | Change | Files | Impact |
|-------|--------|-------|--------|
| 22 | QR code on display wall | `DisplayPage.tsx` | Doubles participation surface area |
| 23 | Participant number badge | `InputPage.tsx`, `backend/main.py` | Collector's identity moment |
| 24 | Milestone celebrations | `DisplayPage.tsx`, `animation.ts` | Crowd events at 100/200/500 |
| 25 | Ambient sparkle system | `canvas.ts` | Wall always looks alive |
| 26 | Name ticker marquee | `DisplayPage.tsx`, `index.css` | Guaranteed name visibility |

---

### What NOT to implement before event day

- Do not switch to PixiJS/WebGL — the canvas renderer is stable and correct
- Do not add any npm packages (except `qrcode.react` for QR, which is zero-dep)
- Do not restructure the WebSocket protocol
- Do not change the FastAPI backend routing
- Do not add React Router or additional routing libraries
