import uuid
import time
import base64
from pathlib import Path

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
    if body.theme not in ("sky", "space"):
        raise HTTPException(status_code=400, detail="Invalid theme. Use 'sky' or 'space'.")
    _display_theme = body.theme
    await manager.broadcast({"event": "display_theme", "theme": _display_theme})
    return JSONResponse({"theme": _display_theme})


@app.post("/admin/save-images")
async def admin_save_images() -> JSONResponse:
    export_dir = Path(__file__).parent.parent / "exports"
    export_dir.mkdir(exist_ok=True)
    saved = 0
    for sig in storage.get_all():
        if sig.signature:
            try:
                _, b64_data = sig.signature.split(",", 1)
                img_bytes = base64.b64decode(b64_data)
                safe_name = "".join(
                    c if c.isalnum() or c in (" ", "-", "_") else "_"
                    for c in sig.name
                )[:30].strip()
                filename = f"{sig.timestamp}_{safe_name or 'sig'}.png"
                (export_dir / filename).write_bytes(img_bytes)
                saved += 1
            except Exception:
                pass
    return JSONResponse({"saved": saved, "dir": str(export_dir)})


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


# Serve built frontend — must come last so API routes take priority
_static_dir = Path(__file__).parent.parent / "frontend" / "dist"
if _static_dir.exists():
    _assets_dir = _static_dir / "assets"
    if _assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(_assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str) -> FileResponse:
        candidate = _static_dir / full_path
        if candidate.is_file():
            return FileResponse(str(candidate))
        return FileResponse(str(_static_dir / "index.html"))
