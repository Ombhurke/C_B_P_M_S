import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import db
from app.core.auth import password_hash, resolve_session, require_shop
from app.core.seed import DEMO_SHOPS
from app.api.v1.shops import router as shops_router
from app.api.v1.jobs import router as jobs_router
from app.api.v1.checkout import router as checkout_router
from app.api.v1.auth import router as auth_router
from app.api.v1.release import router as release_router
from app.api.v1.customer import router as customer_router
from app.api.v1.uploads import router as uploads_router
from app.services.websocket_hub import ws_hub
from app.services.cleanup_service import cleanup_service
from app.services.storage_service import storage_service
from app.services.payments import get_provider


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.validate_runtime()
    if settings.PAYMENT_PROVIDER != "disabled":
        get_provider()  # Never silently fall back to simulated payments.
    if settings.SEED_DEMO_SHOPS and settings.ENVIRONMENT != "test":
        raise RuntimeError("Demo shop seeding is restricted to automated tests")
    db.initialize()
    try:
        storage_service.initialize()
        with db.transaction() as records:
            if settings.SEED_DEMO_SHOPS:
                for key, shop in DEMO_SHOPS.items():
                    if not records.get("shops", key):
                        records.put("shops", key, shop)
            username = settings.BOOTSTRAP_ADMIN_USERNAME
            if username and not records.get("users", username):
                if len(settings.BOOTSTRAP_ADMIN_PASSWORD) < 12:
                    raise RuntimeError("Bootstrap password must have at least 12 characters")
                if not records.get("shops", settings.BOOTSTRAP_SHOP_ID):
                    raise RuntimeError("Bootstrap shop does not exist")
                records.put("users", username, {"username": username, "role": "admin", "active": True,
                    "shop_id": settings.BOOTSTRAP_SHOP_ID,
                    "password_hash": password_hash(settings.BOOTSTRAP_ADMIN_PASSWORD)})
        await cleanup_service.start()
        yield
    finally:
        await cleanup_service.stop()
        db.close()


app = FastAPI(title=settings.PROJECT_NAME, version=settings.VERSION, lifespan=lifespan,
              docs_url="/docs" if settings.ENABLE_API_DOCS else None,
              redoc_url=None, openapi_url="/openapi.json" if settings.ENABLE_API_DOCS else None)
app.add_middleware(CORSMiddleware, allow_origins=settings.CORS_ORIGINS,
                   allow_origin_regex=settings.CORS_ORIGIN_REGEX, allow_credentials=False,
                   allow_methods=["GET", "POST", "PATCH", "DELETE"],
                   allow_headers=["Authorization", "Content-Type", "X-Checkout-Token", "X-Guest-Session"])
for router in (auth_router, shops_router, jobs_router, checkout_router, release_router, customer_router, uploads_router):
    app.include_router(router, prefix=settings.API_V1_PREFIX)


@app.middleware("http")
async def private_responses(request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.websocket("/ws/queue/{shop_id}")
async def websocket_queue_endpoint(websocket: WebSocket, shop_id: str):
    # Authenticate in the first frame, keeping bearer tokens out of URLs and logs.
    origin = websocket.headers.get("origin")
    if origin and origin not in settings.CORS_ORIGINS:
        await websocket.close(code=1008)
        return
    await websocket.accept()
    try:
        message = await asyncio.wait_for(websocket.receive_json(), timeout=5)
        if not isinstance(message, dict) or not isinstance(message.get("token"), str):
            raise HTTPException(401, "Invalid authentication frame")
        token = message.get("token", "")
        user = resolve_session(token)
        require_shop(user, shop_id)
        await ws_hub.connect(shop_id, websocket, accepted=True, token=token)
        await websocket.send_json({"event": "CONNECTED", "data": {"shop_id": shop_id}})
        while True:
            try:
                msg = await asyncio.wait_for(websocket.receive_text(), timeout=20)
            except asyncio.TimeoutError:
                msg = "ping"
            require_shop(resolve_session(token), shop_id)
            if msg == "ping":
                await websocket.send_json({"event": "PONG", "data": {}})
    except (HTTPException, ValueError, asyncio.TimeoutError):
        await websocket.close(code=1008)
    except WebSocketDisconnect:
        pass
    finally:
        await ws_hub.disconnect(shop_id, websocket)


@app.get("/")
def root():
    return {"status": "online", "service": settings.PROJECT_NAME, "version": settings.VERSION,
            "payment_provider": settings.PAYMENT_PROVIDER}


@app.get("/health")
def health():
    with db.transaction() as records:
        records.list("shops")
    return {"status": "healthy"}
