import json
import asyncio
from typing import Dict, List, Set
from fastapi import WebSocket


class WebSocketHub:
    """Manages real-time WebSocket subscriptions per shop."""
    def __init__(self):
        # shop_id -> Set of active WebSockets
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, shop_id: str, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            if shop_id not in self.active_connections:
                self.active_connections[shop_id] = set()
            self.active_connections[shop_id].add(websocket)

    async def disconnect(self, shop_id: str, websocket: WebSocket):
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
                await ws.send_text(payload)
            except Exception:
                dead_connections.append(ws)

        if dead_connections:
            async with self._lock:
                for ws in dead_connections:
                    if shop_id in self.active_connections:
                        self.active_connections[shop_id].discard(ws)


ws_hub = WebSocketHub()
