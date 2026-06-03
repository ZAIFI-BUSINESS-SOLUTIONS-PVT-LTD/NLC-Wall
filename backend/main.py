import uuid
import time
import logging
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("signwall.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger(__name__)

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

import storage
import moderation
from models import SubmitRequest, Signature, SubmitResponse, HealthResponse, ThemeBody
from websocket import manager

app = FastAPI(title="Live Sign Wall")

_display_theme: str = "sky"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/submit", response_model=SubmitResponse)
async def submit(request: Request, body: SubmitRequest) -> SubmitResponse:
    client_ip = request.client.host if request.client else "unknown"

    if not moderation.check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Too many submissions. Try again in a minute.")

    if moderation.check_profanity(body.name):
        raise HTTPException(status_code=400, detail="Name contains prohibited content.")

    if moderation.check_duplicate(body.name):
        raise HTTPException(status_code=409, detail="This name was submitted recently. Please wait.")

    sig = Signature(
        id=str(uuid.uuid4()),
        name=body.name,
        signature=body.signature,
        timestamp=int(time.time() * 1000),
    )
    storage.add(sig)

    await manager.broadcast({
        "event": "new_signature",
        "data": sig.model_dump(),
    })

    return SubmitResponse(id=sig.id, timestamp=sig.timestamp)


@app.get("/signatures")
async def get_signatures() -> list:
    return [s.model_dump() for s in storage.get_all()]


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok", count=storage.count())


@app.delete("/admin/signatures")
async def admin_clear() -> JSONResponse:
    storage.clear()
    await manager.broadcast({"event": "clear"})
    return JSONResponse({"status": "cleared"})


@app.get("/admin/display-theme")
async def get_display_theme() -> JSONResponse:
    return JSONResponse({"theme": _display_theme})


@app.post("/admin/display-theme")
async def set_display_theme(body: ThemeBody) -> JSONResponse:
    global _display_theme
    VALID_THEMES = {"sky", "space", "aurora", "ocean", "neon", "forest", "sunset"}
    if body.theme not in VALID_THEMES:
        raise HTTPException(status_code=400, detail=f"Invalid theme. Use one of: {', '.join(sorted(VALID_THEMES))}")
    _display_theme = body.theme
    await manager.broadcast({"event": "display_theme", "theme": _display_theme})
    return JSONResponse({"theme": _display_theme})


@app.post("/admin/save-images")
async def admin_save_images() -> JSONResponse:
    """Re-saves any in-memory signatures not yet on disk (e.g. after a restart)."""
    saved = 0
    for sig in storage.get_all():
        if sig.signature:
            import datetime as _dt
            dt = _dt.datetime.fromtimestamp(sig.timestamp / 1000)
            date_str = dt.strftime("%Y-%m-%d")
            day_dir = storage.SIGNATURES_DIR / date_str
            filename = f"{sig.timestamp}_{sig.id[:8]}.png"
            if not (day_dir / filename).exists():
                storage._save_to_disk(sig)
                saved += 1

    # Build a summary of what's on disk
    folders: dict = {}
    if storage.SIGNATURES_DIR.exists():
        for day_dir in sorted(storage.SIGNATURES_DIR.iterdir()):
            if day_dir.is_dir():
                folders[day_dir.name] = len(list(day_dir.glob("*.png")))

    return JSONResponse({
        "newly_saved": saved,
        "signatures_dir": str(storage.SIGNATURES_DIR),
        "folders": folders,
    })


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    await manager.connect(ws)
    await manager.send_to(ws, {
        "event": "init",
        "data": [s.model_dump() for s in storage.get_all()],
    })
    await manager.send_to(ws, {"event": "display_theme", "theme": _display_theme})
    try:
        while True:
            await ws.receive_text()  # keep alive; clients don't send data
    except WebSocketDisconnect:
        await manager.disconnect(ws)


# Serve built frontend.
# Starlette 1.x changed route priority for {path:path} and "/" mounts.
# Use fully-explicit routes so API routes defined above always win.
_static_dir = Path(__file__).parent.parent / "frontend" / "dist"
if _static_dir.exists():
    _assets_dir = _static_dir / "assets"
    if _assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(_assets_dir)), name="assets")

    _idx = str(_static_dir / "index.html")

    @app.get("/", include_in_schema=False)
    async def _root() -> FileResponse:
        return FileResponse(_idx)

    @app.get("/display", include_in_schema=False)
    async def _display_page() -> FileResponse:
        return FileResponse(_idx)

    @app.get("/admin", include_in_schema=False)
    async def _admin_page() -> FileResponse:
        return FileResponse(_idx)

    # Serve every non-HTML file sitting in dist root (images, favicon, etc.)
    for _sf in _static_dir.iterdir():
        if _sf.is_file() and _sf.suffix != ".html":
            _sfp = str(_sf)
            app.add_api_route(
                f"/{_sf.name}",
                (lambda p: lambda: FileResponse(p))(_sfp),
                methods=["GET"],
                include_in_schema=False,
            )
