from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.database import get_db
from app.models.hive import Hive, HiveStatus
from app.models.sensor_reading import SensorReading
from app.models.alert import Alert
from app.schemas.schemas import HiveResponse, HiveDetailResponse, SensorReadingResponse, SensorReadingCreate
from app.services.auth import get_current_user
from app.models.user import User
from app.ai.detector import detector

router = APIRouter(prefix="/api/hives", tags=["Hives"])


@router.get("", response_model=list[HiveResponse])
async def list_hives(
    farmer_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all hives, optionally filtered by farmer."""
    query = select(Hive)
    if farmer_id:
        query = query.where(Hive.farmer_id == farmer_id)
    elif current_user.role.value == "FARMER":
        query = query.where(Hive.farmer_id == current_user.id)

    result = await db.execute(query.order_by(Hive.hive_code))
    return result.scalars().all()


@router.get("/{hive_id}", response_model=HiveDetailResponse)
async def get_hive(
    hive_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get hive details with latest telemetry."""
    result = await db.execute(select(Hive).where(Hive.id == hive_id))
    hive = result.scalar_one_or_none()
    if not hive:
        raise HTTPException(status_code=404, detail="Hive not found")

    # Get latest sensor reading (ordered by auto-increment ID to always get latest inserted)
    result = await db.execute(
        select(SensorReading)
        .where(SensorReading.hive_id == hive_id)
        .order_by(desc(SensorReading.id))
        .limit(1)
    )
    latest = result.scalar_one_or_none()

    # Get latest alert
    result = await db.execute(
        select(Alert)
        .where(Alert.hive_id == hive_id, Alert.resolved == False)
        .order_by(desc(Alert.created_at))
        .limit(1)
    )
    alert = result.scalar_one_or_none()

    return HiveDetailResponse(
        id=hive.id,
        hive_code=hive.hive_code,
        cluster_id=hive.cluster_id,
        farmer_id=hive.farmer_id,
        status=hive.status.value if hasattr(hive.status, 'value') else hive.status,
        created_at=hive.created_at,
        latest_temperature=latest.temperature if latest else None,
        latest_humidity=latest.humidity if latest else None,
        latest_weight=latest.weight if latest else None,
        latest_sound_level=latest.sound_level if latest else None,
        anomaly_status=("ANOMALY" if alert else "NORMAL"),
        last_updated=latest.timestamp if latest else None,
    )


@router.get("/{hive_id}/telemetry", response_model=list[SensorReadingResponse])
async def get_hive_telemetry(
    hive_id: int,
    limit: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get sensor reading history for a hive."""
    result = await db.execute(
        select(SensorReading)
        .where(SensorReading.hive_id == hive_id)
        .order_by(desc(SensorReading.timestamp))
        .limit(limit)
    )
    readings = result.scalars().all()
    return list(reversed(readings))


@router.post("/{hive_id}/telemetry", response_model=SensorReadingResponse)
async def inject_telemetry(
    hive_id: int,
    reading: SensorReadingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Directly inject a sensor reading (bypasses MQTT). Useful for demo/testing."""
    result = await db.execute(select(Hive).where(Hive.id == hive_id))
    hive = result.scalar_one_or_none()
    if not hive:
        raise HTTPException(status_code=404, detail="Hive not found")

    timestamp = reading.timestamp or datetime.utcnow()

    # Run anomaly detection
    anomaly_status = "NORMAL"
    anomaly_score = 0.0
    if reading.temperature is not None and reading.humidity is not None and reading.weight is not None and reading.sound_level is not None:
        try:
            anomaly_status, anomaly_score = detector.predict(
                temperature=float(reading.temperature),
                humidity=float(reading.humidity),
                weight=float(reading.weight),
                sound_level=float(reading.sound_level),
            )
        except Exception:
            pass

    is_anomaly = anomaly_status == "ANOMALY"

    sensor = SensorReading(
        hive_id=hive.id,
        temperature=reading.temperature,
        humidity=reading.humidity,
        weight=reading.weight,
        sound_level=reading.sound_level,
        timestamp=timestamp,
        anomaly=is_anomaly,
        anomaly_score=anomaly_score,
    )
    db.add(sensor)

    # Update hive status
    hive.status = HiveStatus.ATTENTION if is_anomaly else HiveStatus.HEALTHY

    # Create alert if anomaly detected
    if is_anomaly:
        result = await db.execute(
            select(Alert).where(Alert.hive_id == hive.id, Alert.resolved == False)
        )
        existing = result.scalar_one_or_none()
        if not existing:
            from app.ai.detector import detector as det
            explanation = det.generate_explanation(
                temperature=float(reading.temperature),
                humidity=float(reading.humidity),
                weight=float(reading.weight),
                sound_level=float(reading.sound_level),
            )
            alert = Alert(hive_id=hive.id, type="ANOMALY", message=explanation, severity="WARNING")
            db.add(alert)

    await db.flush()
    return SensorReadingResponse(
        id=sensor.id, hive_id=sensor.hive_id,
        temperature=sensor.temperature, humidity=sensor.humidity,
        weight=sensor.weight, sound_level=sensor.sound_level,
        timestamp=sensor.timestamp, anomaly=sensor.anomaly,
        anomaly_score=sensor.anomaly_score,
    )