import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.api.v1.shops import router as shops_router
from app.api.v1.jobs import router as jobs_router, JOBS_DB
from app.services.websocket_hub import ws_hub
from app.services.cleanup_service import cleanup_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Launch 2-hour TTL cleanup task
    await cleanup_service.start(JOBS_DB)
    print(f"🚀 {settings.PROJECT_NAME} initialized successfully on version {settings.VERSION}")
    if settings.SUPABASE_URL:
        print(f"📦 Supabase Storage & DB enabled at {settings.SUPABASE_URL}")
    else:
        print("💾 Running with in-memory & local disk ephemeral staging.")
    yield
    # Shutdown: Stop cleanup task
    await cleanup_service.stop()
    print(f"🛑 {settings.PROJECT_NAME} gracefully shutting down.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Privacy-First Ephemeral Print Management Cloud Backend API",
    lifespan=lifespan
)

# CORS Middleware (supports dynamic Vercel deployments and localhost)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount REST API Routers
app.include_router(shops_router, prefix=settings.API_V1_PREFIX)
app.include_router(jobs_router, prefix=settings.API_V1_PREFIX)


# Real-time WebSocket Endpoint for Counter Operator Desktops
@app.websocket("/ws/queue/{shop_id}")
async def websocket_queue_endpoint(websocket: WebSocket, shop_id: str):
    await ws_hub.connect(shop_id, websocket)
    try:
        await websocket.send_json({
            "event": "CONNECTED",
            "data": {"shop_id": shop_id, "status": "active"}
        })
        while True:
            msg = await websocket.receive_text()
            if msg == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        await ws_hub.disconnect(shop_id, websocket)
    except Exception:
        await ws_hub.disconnect(shop_id, websocket)


@app.get("/")
async def root():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "supabase_configured": bool(settings.SUPABASE_URL),
        "docs_url": "/docs"
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "active_jobs_count": len(JOBS_DB),
        "supabase_connected": bool(settings.SUPABASE_URL)
    }
