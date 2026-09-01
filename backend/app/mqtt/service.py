import json
import logging
from datetime import datetime
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.hive import Hive
from app.models.sensor_reading import SensorReading
from app.models.alert import Alert
from app.ai.detector import detector

logger = logging.getLogger(__name__)


async def on_mqtt_message(payload: dict):
    """Callback invoked when a telemetry message arrives via MQTT."""
    hive_code = payload.get("hive_code")
    if not hive_code:
        logger.warning("MQTT message missing hive_code")
        return

    async with AsyncSessionLocal() as db:
        # Find the hive by code
        result = await db.execute(select(Hive).where(Hive.hive_code == hive_code))
        hive = result.scalar_one_or_none()
        if not hive:
            logger.warning(f"Hive {hive_code} not found in database, skipping")
            return

        # Parse readings
        temperature = payload.get("temperature")
        humidity = payload.get("humidity")
        weight = payload.get("weight")
        sound_level = payload.get("sound_level")
        timestamp_str = payload.get("timestamp")

        try:
            timestamp = datetime.fromisoformat(timestamp_str) if timestamp_str else datetime.utcnow()
        except (ValueError, TypeError):
            timestamp = datetime.utcnow()

        # Run anomaly detection
        anomaly_status = "NORMAL"
        anomaly_score = 0.0
        if temperature is not None and humidity is not None and weight is not None and sound_level is not None:
            try:
                anomaly_status, anomaly_score = detector.predict(
                    temperature=float(temperature),
                    humidity=float(humidity),
                    weight=float(weight),
                    sound_level=float(sound_level),
                )
            except Exception as e:
                logger.error(f"Anomaly detection error: {e}")

        is_anomaly = anomaly_status == "ANOMALY"

        # Create sensor reading
        reading = SensorReading(
            hive_id=hive.id,
            temperature=temperature,
            humidity=humidity,
            weight=weight,
            sound_level=sound_level,
            timestamp=timestamp,
            anomaly=is_anomaly,
            anomaly_score=anomaly_score,
        )
        db.add(reading)

        # Update hive status
        if is_anomaly:
            from app.models.hive import HiveStatus
            hive.status = HiveStatus.ATTENTION
        else:
            from app.models.hive import HiveStatus
            hive.status = HiveStatus.HEALTHY

        # Create alert if anomaly detected and no active alert exists
        if is_anomaly:
            result = await db.execute(
                select(Alert).where(
                    Alert.hive_id == hive.id,
                    Alert.resolved == False,
                )
            )
            existing = result.scalar_one_or_none()
            if not existing:
                explanation = detector.generate_explanation(
                    temperature=float(temperature),
                    humidity=float(humidity),
                    weight=float(weight),
                    sound_level=float(sound_level),
                )
                alert = Alert(
                    hive_id=hive.id,
                    type="ANOMALY",
                    message=explanation,
                    severity="WARNING",
                )
                db.add(alert)

        await db.commit()
        logger.info(f"Sensor reading recorded for hive {hive_code} (anomaly={is_anomaly})")