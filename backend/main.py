import uuid
import time
import base64
import json
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
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

import storage
import database
import moderation
from models import (
    SubmitRequest, Signature, SubmitResponse, HealthResponse,
    ThemeBody, UpdateNameBody, PledgeBody, ChiefGuestConfigBody, ChiefGuestMarkBody,
)
from websocket import manager

app = FastAPI(title="Live Sign Wall")

_display_theme: str = "sky"
_pledge_text: str = ""
_cg_config: dict = {"enabled": False, "retention_mode": "forever", "retention_until": None}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _load_server_config() -> None:
    global _pledge_text, _cg_config
    pledge = database.db_config_get("pledge_text")
    if pledge is not None:
        _pledge_text = pledge
    cg = database.db_config_get("cg_config")
    if cg:
        try:
            _cg_config = json.loads(cg)
        except Exception:
            pass


_load_server_config()


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
    total = storage.count()
    aud = storage.count_audience()
    return HealthResponse(status="ok", count=total, audience_count=aud, cg_count=total - aud)


@app.delete("/admin/signatures")
async def admin_clear() -> JSONResponse:
    """Clears audience (non-chief-guest) signatures only."""
    storage.clear_audience()
    await manager.broadcast({"event": "clear"})
    return JSONResponse({"status": "cleared"})


@app.delete("/admin/chief-guest-signatures")
async def admin_clear_cg() -> JSONResponse:
    """Clears chief-guest signatures only."""
    storage.clear_chief_guests()
    await manager.broadcast({"event": "clear_chief_guests"})
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


@app.get("/admin/pledge")
async def get_pledge() -> JSONResponse:
    return JSONResponse({"text": _pledge_text})


@app.post("/admin/pledge")
async def set_pledge(body: PledgeBody) -> JSONResponse:
    global _pledge_text
    _pledge_text = body.text
    database.db_config_set("pledge_text", _pledge_text)
    await manager.broadcast({"event": "pledge_update", "text": _pledge_text})
    return JSONResponse({"text": _pledge_text})


@app.get("/admin/chief-guest-config")
async def get_cg_config() -> JSONResponse:
    return JSONResponse(_cg_config)


@app.post("/admin/chief-guest-config")
async def set_cg_config(body: ChiefGuestConfigBody) -> JSONResponse:
    global _cg_config
    _cg_config = {
        "enabled": body.enabled,
        "retention_mode": body.retention_mode,
        "retention_until": body.retention_until,
    }
    database.db_config_set("cg_config", json.dumps(_cg_config))
    await manager.broadcast({"event": "cg_config", "config": _cg_config})
    return JSONResponse(_cg_config)


@app.get("/admin/db/signatures")
async def admin_db_list(skip: int = 0, limit: int = 50) -> JSONResponse:
    items = database.db_get_all_meta(skip=skip, limit=limit)
    total = database.db_count()
    return JSONResponse({"total": total, "items": items})


@app.put("/admin/db/signatures/{sig_id}")
async def admin_db_update(sig_id: str, body: UpdateNameBody) -> JSONResponse:
    updated = storage.update_name(sig_id, body.name)
    if not updated:
        raise HTTPException(status_code=404, detail="Signature not found")
    return JSONResponse({"status": "updated"})


@app.put("/admin/db/signatures/{sig_id}/chief-guest")
async def admin_db_set_cg(sig_id: str, body: ChiefGuestMarkBody) -> JSONResponse:
    updated = storage.set_chief_guest(sig_id, body.is_chief_guest)
    if not updated:
        raise HTTPException(status_code=404, detail="Signature not found")
    sig = database.db_get_by_id(sig_id)
    if sig:
        await manager.broadcast({"event": "update_signature", "data": sig.model_dump()})
    return JSONResponse({"status": "updated"})


@app.delete("/admin/db/signatures/{sig_id}")
async def admin_db_delete(sig_id: str) -> JSONResponse:
    removed = storage.remove(sig_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Signature not found")
    await manager.broadcast({"event": "remove_signature", "id": sig_id})
    return JSONResponse({"status": "deleted"})


@app.get("/admin/db/signatures/{sig_id}/image")
async def admin_db_image(sig_id: str) -> Response:
    sig = database.db_get_by_id(sig_id)
    if not sig or not sig.signature:
        raise HTTPException(status_code=404, detail="Signature image not found")
    try:
        _header, b64_data = sig.signature.split(",", 1)
        img_bytes = base64.b64decode(b64_data)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to decode signature image")
    safe_name = "".join(c if c.isalnum() or c in "-_ " else "_" for c in sig.name)
    return Response(
        content=img_bytes,
        media_type="image/png",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}_{sig_id[:8]}.png"'},
    )


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
    await manager.send_to(ws, {"event": "pledge_update", "text": _pledge_text})
    await manager.send_to(ws, {"event": "cg_config", "config": _cg_config})
    try:
        while True:
            await ws.receive_text()  # keep alive; clients don't send data
    except WebSocketDisconnect:
        await manager.disconnect(ws)


# Serve built frontend.
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

    for _sf in _static_dir.iterdir():
        if _sf.is_file() and _sf.suffix != ".html":
            _sfp = str(_sf)
            app.add_api_route(
                f"/{_sf.name}",
                (lambda p: lambda: FileResponse(p))(_sfp),
                methods=["GET"],
                include_in_schema=False,
            )
