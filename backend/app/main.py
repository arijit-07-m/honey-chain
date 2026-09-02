import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import settings, get_cors_origins
from app.database import init_db, engine
from app.api.auth import router as auth_router
from app.api.hives import router as hives_router
from app.api.batches import router as batches_router
from app.api.alerts import router as alerts_router
from app.api.admin import router as admin_router
from app.mqtt.handler import MQTTHandler
from app.mqtt.service import on_mqtt_message
from app.database import AsyncSessionLocal
from app.services.seed import seed_database

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

mqtt_handler: MQTTHandler | None = None
keep_alive_task = None


async def keep_alive():
    """Ping the database every 5 minutes to prevent Render spindown."""
    while True:
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            logger.debug("Keep-alive ping successful")
        except Exception as e:
            logger.warning(f"Keep-alive ping failed: {e}")
        await asyncio.sleep(300)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global keep_alive_task
    logger.info("Starting Honey Chain backend...")
    await init_db()
    logger.info("Database initialized")

    async with AsyncSessionLocal() as session:
        await seed_database(session)
        await session.commit()

    keep_alive_task = asyncio.create_task(keep_alive())
    logger.info("Keep-alive task started")

    global mqtt_handler
    if settings.MQTT_ENABLED:
        try:
            mqtt_handler = MQTTHandler(on_message_callback=on_mqtt_message)
            mqtt_handler.start()
            logger.info("MQTT handler started")
        except Exception as e:
            logger.warning(f"MQTT failed to start: {e}")
    else:
        logger.info("MQTT disabled")

    yield

    if keep_alive_task:
        keep_alive_task.cancel()
    if mqtt_handler:
        mqtt_handler.stop()
    logger.info("Shutdown complete")


app = FastAPI(
    title="Honey Chain API",
    description="Blockchain-based honey traceability and smart beekeeping API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(hives_router)
app.include_router(batches_router)
app.include_router(alerts_router)
app.include_router(admin_router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "Honey Chain API"}
