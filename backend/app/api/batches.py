from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from app.database import get_db
from app.models.batch import Batch
from app.models.hive import Hive
from app.models.traceability_event import TraceabilityEvent
from app.models.user import User
from app.schemas.schemas import (
    HarvestCreate,
    BatchResponse,
    BatchDetailResponse,
    TraceabilityEventResponse,
    EventCreate,
    VerifyResponse,
)
from app.services.auth import get_current_user
from app.blockchain.service import create_genesis_event, create_event, verify_chain
import qrcode
from io import BytesIO
import base64
import os

router = APIRouter(prefix="/api/batches", tags=["Batches"])

# In-memory sequential counter for batch codes.
# Initialized from the DB at startup via init_batch_counter() so it never
# collides with seeded or previously-created batches after a Render restart.
_batch_counter = 0


async def init_batch_counter(db: AsyncSession):
    """Set _batch_counter to the highest existing batch number in the DB.

    Called once at startup (after seeding) so that new harvest batches
    always receive a code higher than any already in the database.
    Without this, after a Render restart the counter resets to 0 and
    tries to re-create HC-2026-00001 → unique-key violation → 500 error.
    """
    global _batch_counter
    result = await db.execute(select(func.count(Batch.id)))
    count = result.scalar() or 0
    # Extract the highest numeric suffix from existing batch codes.
    result2 = await db.execute(select(Batch.batch_code))
    codes = [row[0] for row in result2.all()]
    max_num = 0
    for code in codes:
        try:
            # Batch codes are HC-YYYY-NNNNN; grab the last segment.
            num = int(code.split("-")[-1])
            if num > max_num:
                max_num = num
        except (ValueError, IndexError):
            pass
    _batch_counter = max_num
    import logging
    logging.getLogger(__name__).info(
        f"Batch counter initialized to {_batch_counter} (based on {count} existing batches)"
    )


def _generate_batch_code() -> str:
    global _batch_counter
    _batch_counter += 1
    year = datetime.utcnow().year
    return f"HC-{year}-{_batch_counter:05d}"


def _generate_qr(batch_code: str) -> str:
    frontend_url = os.getenv("NEXT_PUBLIC_APP_URL", "http://localhost:3000")
    qr_data = f"{frontend_url}/verify/{batch_code}"
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(qr_data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    qr_dir = "qr_codes"
    os.makedirs(qr_dir, exist_ok=True)
    qr_path = os.path.join(qr_dir, f"{batch_code}.png")
    img.save(qr_path)
    buf = BytesIO()
    img.save(buf, format="PNG")
    img_base64 = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/png;base64,{img_base64}"


@router.get("", response_model=list[BatchResponse])
async def list_batches(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all batches (for farmer: own batches; for admin: all)."""
    query = select(Batch)
    if current_user.role.value == "FARMER":
        query = query.where(Batch.farmer_id == current_user.id)
    result = await db.execute(query.order_by(desc(Batch.created_at)))
    return result.scalars().all()


@router.get("/{batch_id}", response_model=BatchDetailResponse)
async def get_batch(
    batch_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get batch details with full traceability timeline."""
    result = await db.execute(select(Batch).where(Batch.id == batch_id))
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    result = await db.execute(
        select(TraceabilityEvent)
        .where(TraceabilityEvent.batch_id == batch_id)
        .order_by(TraceabilityEvent.id.asc())
    )
    events = result.scalars().all()
    return BatchDetailResponse(
        id=batch.id, batch_code=batch.batch_code,
        hive_id=batch.hive_id, farmer_id=batch.farmer_id,
        honey_type=batch.honey_type, quantity=batch.quantity,
        harvest_date=batch.harvest_date, status=batch.status,
        created_at=batch.created_at,
        events=[TraceabilityEventResponse(
            id=e.id, batch_id=e.batch_id, stage=e.stage,
            actor_id=e.actor_id, event_data=e.event_data,
            timestamp=e.timestamp, previous_hash=e.previous_hash,
            current_hash=e.current_hash,
        ) for e in events],
    )


@router.post("/harvest", response_model=BatchResponse)
async def create_harvest(
    harvest: HarvestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new harvest batch with hash-chain event."""
    try:
        result = await db.execute(select(Hive).where(Hive.id == harvest.hive_id))
        hive = result.scalar_one_or_none()
        if not hive:
            raise HTTPException(status_code=404, detail="Hive not found")

        # 1. Strip timezone for PostgreSQL asyncpg TIMESTAMP WITHOUT TIME ZONE compatibility
        harvest_date = harvest.harvest_date
        if harvest_date is not None and harvest_date.tzinfo is not None:
            harvest_date = harvest_date.replace(tzinfo=None)
        elif harvest_date is None:
            harvest_date = datetime.utcnow()

        # 2. Determine next batch code directly from the DB to guarantee zero collision
        year = datetime.utcnow().year
        prefix = f"HC-{year}-"
        result_codes = await db.execute(select(Batch.batch_code))
        existing_codes = [row[0] for row in result_codes.all()]
        max_num = 0
        for c in existing_codes:
            if c and c.startswith(prefix):
                try:
                    num = int(c.split("-")[-1])
                    if num > max_num:
                        max_num = num
                except (ValueError, IndexError):
                    pass
        batch_code = f"HC-{year}-{(max_num + 1):05d}"

        batch = Batch(
            batch_code=batch_code,
            hive_id=harvest.hive_id,
            farmer_id=current_user.id,
            honey_type=harvest.honey_type,
            quantity=harvest.quantity,
            harvest_date=harvest_date,
            status="HARVEST",
        )
        db.add(batch)
        await db.flush()  # get batch.id assigned by the DB

        # 3. Build event description
        event_data = f"Harvested {harvest.quantity}kg of {harvest.honey_type}"
        if harvest.notes:
            event_data += f" | Notes: {harvest.notes}"
        if harvest.location:
            event_data += f" | Location: {harvest.location}"

        # 4. Record GENESIS block first, then HARVEST block
        await create_genesis_event(
            db=db,
            batch_id=batch.id,
            actor_id=current_user.id,
            event_data=f"Batch digital identity initialized for {batch.batch_code}",
        )
        await create_event(
            db=db,
            batch_id=batch.id,
            stage="HARVEST",
            actor_id=current_user.id,
            event_data=event_data,
        )

        # 5. Pre-generate QR code PNG on disk (safe fail)
        try:
            _generate_qr(batch_code)
        except Exception as qr_err:
            import logging
            logging.getLogger(__name__).warning(f"QR disk write failed (non-fatal): {qr_err}")

        return BatchResponse(
            id=batch.id,
            batch_code=batch.batch_code,
            hive_id=batch.hive_id,
            farmer_id=batch.farmer_id,
            honey_type=batch.honey_type,
            quantity=batch.quantity,
            harvest_date=batch.harvest_date,
            status=batch.status,
            created_at=batch.created_at,
        )
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        import logging
        logging.getLogger(__name__).error(f"create_harvest error: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Harvest creation failed: {str(e)}")


@router.post("/{batch_id}/events", response_model=TraceabilityEventResponse)
async def add_event(
    batch_id: int,
    event: EventCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a new traceability event to a batch."""
    result = await db.execute(select(Batch).where(Batch.id == batch_id))
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    batch.status = event.stage
    chain_event = await create_event(
        db=db, batch_id=batch.id, stage=event.stage,
        actor_id=current_user.id, event_data=event.event_data,
    )
    return TraceabilityEventResponse(
        id=chain_event.id, batch_id=chain_event.batch_id,
        stage=chain_event.stage, actor_id=chain_event.actor_id,
        event_data=chain_event.event_data, timestamp=chain_event.timestamp,
        previous_hash=chain_event.previous_hash, current_hash=chain_event.current_hash,
    )


@router.get("/{batch_id}/timeline", response_model=list[TraceabilityEventResponse])
async def get_timeline(batch_id: int, db: AsyncSession = Depends(get_db)):
    """Get the complete traceability timeline for a batch."""
    result = await db.execute(
        select(TraceabilityEvent)
        .where(TraceabilityEvent.batch_id == batch_id)
        .order_by(TraceabilityEvent.id.asc())
    )
    events = result.scalars().all()
    return [TraceabilityEventResponse(
        id=e.id, batch_id=e.batch_id, stage=e.stage,
        actor_id=e.actor_id, event_data=e.event_data,
        timestamp=e.timestamp, previous_hash=e.previous_hash,
        current_hash=e.current_hash,
    ) for e in events]


@router.get("/{batch_id}/verify", response_model=VerifyResponse)
async def verify_batch_chain(batch_id: int, db: AsyncSession = Depends(get_db)):
    """Verify the hash-chain integrity of a batch."""
    result = await db.execute(select(Batch).where(Batch.id == batch_id))
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    valid = await verify_chain(db, batch_id)
    return VerifyResponse(
        valid=valid,
        batch_id=batch.batch_code,
        message="Chain integrity verified" if valid else "Chain integrity compromised",
    )


@router.get("/{batch_id}/qr")
async def get_batch_qr(batch_id: int, db: AsyncSession = Depends(get_db)):
    """Get the QR code for a batch as base64."""
    result = await db.execute(select(Batch).where(Batch.id == batch_id))
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    qr_path = os.path.join("qr_codes", f"{batch.batch_code}.png")
    if os.path.exists(qr_path):
        with open(qr_path, "rb") as f:
            img_data = base64.b64encode(f.read()).decode()
        return {"qr_code": f"data:image/png;base64,{img_data}", "batch_code": batch.batch_code}
    img = _generate_qr(batch.batch_code)
    return {"qr_code": img, "batch_code": batch.batch_code}


@router.get("/verify/consumer/{batch_code}", response_model=dict)
async def consumer_verify_batch(batch_code: str, db: AsyncSession = Depends(get_db)):
    """Public endpoint for consumers to verify a batch by its batch code."""
    result = await db.execute(select(Batch).where(Batch.batch_code == batch_code))
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    result = await db.execute(select(Hive).where(Hive.id == batch.hive_id))
    hive = result.scalar_one_or_none()
    result = await db.execute(
        select(TraceabilityEvent)
        .where(TraceabilityEvent.batch_id == batch.id)
        .order_by(TraceabilityEvent.id.asc())
    )
    events = result.scalars().all()
    chain_valid = await verify_chain(db, batch.id)
    return {
        "valid": chain_valid,
        "batch_code": batch.batch_code,
        "honey_type": batch.honey_type,
        "quantity": batch.quantity,
        "harvest_date": batch.harvest_date.isoformat(),
        "hive_code": hive.hive_code if hive else None,
        "status": batch.status,
        "timeline": [{
            "stage": e.stage,
            "timestamp": e.timestamp.isoformat(),
            "hash": e.current_hash[:12] + "...",
            "event_data": e.event_data,
        } for e in events],
    }