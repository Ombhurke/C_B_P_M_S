import json
import asyncio
from typing import Dict, List, Set
from fastapi import WebSocket
from app.core.auth import resolve_session, require_shop


class WebSocketHub:
    """Manages real-time WebSocket subscriptions per shop."""
    def __init__(self):
        # shop_id -> Set of active WebSockets
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()
        self.tokens = {}

    async def connect(self, shop_id: str, websocket: WebSocket, accepted=False, token=""):
        if not accepted:
            await websocket.accept()
        self.tokens[websocket] = token
        async with self._lock:
            if shop_id not in self.active_connections:
                self.active_connections[shop_id] = set()
            self.active_connections[shop_id].add(websocket)

    async def disconnect(self, shop_id: str, websocket: WebSocket):
        self.tokens.pop(websocket, None)
        async with self._lock:
            if shop_id in self.active_connections:
                self.active_connections[shop_id].discard(websocket)
                if not self.active_connections[shop_id]:
                    del self.active_connections[shop_id]

    async def broadcast_to_shop(self, shop_id: str, event_type: str, data: dict):
        """Dispatches real-time events to all connected operator desktops."""
        async with self._lock:
            conns = list(self.active_connections.get(shop_id, set()))
            
        if not conns:
            return

        payload = json.dumps({
            "event": event_type,
            "data": data
        })

        dead_connections = []
        for ws in conns:
            try:
                require_shop(resolve_session(self.tokens.get(ws, "")), shop_id)
                await asyncio.wait_for(ws.send_text(payload), timeout=2)
            except Exception:
                dead_connections.append(ws)

        if dead_connections:
            async with self._lock:
                for ws in dead_connections:
                    if shop_id in self.active_connections:
                        self.active_connections[shop_id].discard(ws)
                        self.tokens.pop(ws, None)
                        if not self.active_connections[shop_id]:
                            del self.active_connections[shop_id]


ws_hub = WebSocketHub()
