import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings, get_cors_origins
from app.database import init_db, engine
from app.api.auth import router as auth_router
from app.api.hives import router as hives_router
from app.api.batches import router as batches_router, init_batch_counter
from app.api.alerts import router as alerts_router
from app.api.admin import router as admin_router
from app.mqtt.handler import MQTTHandler
from app.mqtt.service import on_mqtt_message
from app.database import AsyncSessionLocal
from app.services.seed import seed_database

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

mqtt_handler: MQTTHandler | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Honey Chain backend...")
    await init_db()
    logger.info("Database initialized")

    async with AsyncSessionLocal() as session:
        await seed_database(session)
        await session.commit()
        await init_batch_counter(session)

    global mqtt_handler
    if settings.MQTT_ENABLED:
        try:
            # Pass the main event loop so DB operations run on it
            main_loop = asyncio.get_running_loop()
            mqtt_handler = MQTTHandler(on_message_callback=on_mqtt_message, loop=main_loop)
            mqtt_handler.start()
            logger.info(f"MQTT handler started (broker={settings.MQTT_BROKER_URL}:{settings.MQTT_BROKER_PORT})")
        except Exception as e:
            logger.warning(f"MQTT failed to start: {e}")
    else:
        logger.info("MQTT disabled")

    yield

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
    return {
        "status": "ok",
        "service": "Honey Chain API",
        "cors_origins": get_cors_origins(),
        "mqtt_enabled": settings.MQTT_ENABLED,
        "mqtt_broker": settings.MQTT_BROKER_URL,
    }
