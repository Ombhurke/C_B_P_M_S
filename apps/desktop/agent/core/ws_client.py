import json
import asyncio
import threading
from typing import Callable, Optional
import websockets
from agent.core.config import agent_settings


class DesktopWebSocketClient:
    """Listens for real-time print queue updates pushed from cloud API."""
    def __init__(self, on_event_callback: Optional[Callable[[str, dict], None]] = None):
        self.on_event = on_event_callback
        self.is_running = False
        self._thread: Optional[threading.Thread] = None

    def start(self):
        self.is_running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()

    def stop(self):
        self.is_running = False

    def _run_loop(self):
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(self._listen())

    async def _listen(self):
        ws_url = f"{agent_settings.CLOUD_WS_URL}/{agent_settings.SHOP_ID}"
        while self.is_running:
            try:
                async with websockets.connect(ws_url) as ws:
                    print(f"[AgentWS] Connected to live queue stream: {ws_url}")
                    while self.is_running:
                        msg = await ws.recv()
                        payload = json.loads(msg)
                        event = payload.get("event")
                        data = payload.get("data", {})
                        if self.on_event:
                            self.on_event(event, data)
            except Exception as e:
                # Retry backoff
                await asyncio.sleep(3)
