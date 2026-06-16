# Testing — Live Sign Wall

Runnable automated test suites for the NLC Neyveli Book Fair Live Sign Wall.

| Suite | Tool | Location | Tests |
|-------|------|----------|------:|
| Backend | pytest | `backend/tests/` | 172 |
| Frontend | Vitest + React Testing Library | `frontend/src/__tests__/` | 65 |
| **Total** | | | **237** |

All tests run fully offline and create **no** real data — the backend redirects its
database, signature folder and log to a throwaway temp directory, and the frontend
mocks all network/canvas/WebSocket access. Your real `signwall.db` and `signatures/`
folder are never touched.

---

## Backend (FastAPI / pytest)

### Install

```bash
cd backend
pip install -r requirements.txt -r requirements-dev.txt
```

### Run

```bash
cd backend
pytest                 # all tests
pytest -v              # verbose, per-test names
pytest tests/test_api_submit.py        # one file
pytest -k "rate_limit or duplicate"    # by keyword
```

### What's covered

| File | Area under test |
|------|-----------------|
| `test_models.py` | Pydantic validation — name trim/length (≤60), signature size (≤200 KB), pledge duration clamping (5–600 s) and 4000-char text truncation, chief-guest `retention_mode` enum. |
| `test_moderation.py` | Per-IP rate limit (15/min rolling window), profanity blocklist (case-insensitive, substring), 8-second duplicate-name guard. Uses a fake clock to test window expiry without sleeping. |
| `test_storage.py` | In-memory store, 500-item FIFO cap with oldest-eviction, DB keeps all rows beyond the cap, audience vs chief-guest counting, the three clear variants, and automatic PNG-to-disk persistence (including graceful handling of a malformed image). |
| `test_database.py` | SQLite layer — idempotent schema init + `is_chief_guest` migration, config key/value store, signature CRUD, `INSERT OR REPLACE` semantics, chronological load order, metadata listing (no base64, `has_sig` flag), pagination, selective clears. |
| `test_api_submit.py` | `POST /submit` happy path + disk write, validation 422s, profanity 400, duplicate 409, rate-limit 429; `GET /signatures`. |
| `test_api_health.py` | `GET /health` total / audience / chief-guest split. |
| `test_api_admin_config.py` | Display theme get/set + invalid-theme 400 + all 7 themes; pledge config persistence + clamping; chief-guest config + invalid-mode 422; DB persistence of both configs. |
| `test_api_admin_db.py` | Clear-audience / clear-chief-guest endpoints; paginated DB listing; name edit (+422/404); chief-guest toggle (+404); delete (+404); per-signature image download (PNG bytes, 404 when absent, 500 when undecodable); save-images-to-disk. |
| `test_websocket.py` | `/ws` handshake (init → display_theme → pledge_config → cg_config), and every broadcast: new/remove/update signature, clear, clear_chief_guests, theme & config pushes, and fan-out to multiple clients. |
| `test_integration.py` | Multi-step operator flows (audience + chief-guest lifecycle, edit-then-download, duplicate-window recovery, config survival), and crash recovery: the in-memory store is rebuilt from SQLite on restart, respecting the 500 cap. |

### How isolation works

`tests/conftest.py` redirects `paths.DB_PATH`, `paths.SIGNATURES_DIR` and
`paths.LOG_PATH` to a temp directory **before** importing `database`, `storage` or
`main` (those modules bind the paths at import time). An autouse fixture then resets
the in-memory store, moderation counters, config table and server-side config globals
between every test. The `client` fixture is a Starlette `TestClient` (used as a context
manager so WebSocket tests share its event loop).

---

## Frontend (React / Vitest)

### Install

```bash
cd frontend
npm install            # picks up the new devDependencies
```

### Run

```bash
cd frontend
npm test               # vitest run (one-shot, CI-friendly)
npm run test:watch     # watch mode
npx vitest run src/__tests__/animation.test.ts   # one file
```

### What's covered

| File | Area under test |
|------|-----------------|
| `animation.test.ts` | The canvas physics in `utils/animation.ts` — deterministic palette hashing, spawn margins, entry state, glow on the newest card only, depth recession (front-10 stay opaque), wall containment/clamping, ±60° rotation clamp, overlap separation, ageing. |
| `themes.test.ts` | All 7 display themes in `utils/themes.ts` — config shape, valid entry animations, 8-colour palettes, and exact particle counts per theme. |
| `useWebSocket.test.ts` | The reconnecting WS hook — correct `/ws` URL, JSON frame parsing, malformed-frame tolerance, reconnect after close, no reconnect after unmount, close-on-error. Uses a mock `WebSocket` + fake timers. |
| `NameInput.test.tsx` | Label/placeholder, controlled value, `onChange`, 60-char cap, disabled state. |
| `SignatureCanvas.test.tsx` | Renders label + canvas, hides Undo/Clear until drawn, emits `null` export on reset-token change. |
| `InputPage.test.tsx` | Header render, submit disabled until a name is typed, success ceremony overlay, server-error surfacing, server-side-style name trimming in the POST body. |
| `DisplayPage.test.tsx` | HUD render, chief-guest banner appear/disappear, Tamil-first pledge panel, and the WebSocket event reducer (init / new_signature / clear_chief_guests). FloatingWall + MascotCorner are mocked out. |
| `AdminPage.test.tsx` | Header + live stats from `/health`, empty DB state, posting a display theme, clearing the audience wall (with confirm), and all 7 theme buttons. Uses a URL-routed `fetch` mock. |

### Test infrastructure

`vitest.config.ts` runs jsdom with globals enabled. `src/test/setup.ts` adds
jest-dom matchers, a permissive 2-D canvas stub (jsdom has none), a
`requestAnimationFrame` polyfill, and a `matchMedia` stub. Test files live in
`src/__tests__/` and are **excluded from the production build** via `tsconfig.json`,
so `npm run build` is unaffected.

---

## Notes

- Pre-existing (not test-related): `npm run build` currently reports
  `MascotCorner.tsx(67): 'controls' is declared but its value is never read`
  because `noUnusedLocals` is on. That is in application source, not the tests —
  worth a one-line cleanup, but out of scope for this suite.
- The backend emits one harmless deprecation warning from Starlette's `TestClient`.
