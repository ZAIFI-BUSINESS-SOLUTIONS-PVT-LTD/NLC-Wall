import json
from fastapi import WebSocket
from typing import List
import asyncio


class ConnectionManager:
    def __init__(self) -> None:
        self._active: List[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._active.append(ws)

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            if ws in self._active:
                self._active.remove(ws)

    async def broadcast(self, message: dict) -> None:
        payload = json.dumps(message, ensure_ascii=False)
        dead: List[WebSocket] = []
        async with self._lock:
            targets = list(self._active)
        for ws in targets:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.disconnect(ws)

    async def send_to(self, ws: WebSocket, message: dict) -> None:
        payload = json.dumps(message, ensure_ascii=False)
        try:
            await ws.send_text(payload)
        except Exception:
            await self.disconnect(ws)


manager = ConnectionManager()
