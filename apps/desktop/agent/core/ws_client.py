import asyncio
import json
import threading
import websockets
from agent.core.config import agent_settings
from agent.core.api_client import api_client


class DesktopWebSocketClient:
    def __init__(self, on_event_callback=None):
        self.on_event = on_event_callback
        self.is_running = False
        self._thread = None

    def start(self):
        self.is_running = True
        self._thread = threading.Thread(target=lambda: asyncio.run(self._listen()), daemon=True)
        self._thread.start()

    def stop(self):
        self.is_running = False
        if self._thread:
            self._thread.join(timeout=2)

    async def _listen(self):
        url = f"{agent_settings.CLOUD_WS_URL}/{agent_settings.SHOP_ID}"
        if url.startswith("ws://localhost:"):
            url = url.replace("ws://localhost:", "ws://127.0.0.1:", 1)
        elif url.startswith("wss://localhost:"):
            url = url.replace("wss://localhost:", "wss://127.0.0.1:", 1)
        while self.is_running:
            try:
                # Reconcile on reconnect, including token refresh after session expiry.
                await asyncio.to_thread(api_client.fetch_shop_queue)
                async with websockets.connect(url, open_timeout=10) as ws:
                    await ws.send(json.dumps({"token": api_client.token}))
                    while self.is_running:
                        try:
                            message = await asyncio.wait_for(ws.recv(), timeout=5)
                            payload = json.loads(message)
                            if self.on_event:
                                self.on_event(payload.get("event"), payload.get("data", {}))
                        except asyncio.TimeoutError:
                            # Periodic snapshot catches missed or cross-worker events.
                            if self.on_event:
                                self.on_event("RECONCILE", {})
                            await ws.send("ping")
            except Exception:
                await asyncio.sleep(3)
