import hashlib
from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.traceability_event import TraceabilityEvent
from app.models.batch import Batch


def compute_hash(
    event_id: int,
    batch_id: int,
    stage: str,
    actor_id: int,
    timestamp: datetime,
    event_data: Optional[str],
    previous_hash: str,
) -> str:
    """Compute SHA-256 hash for a traceability event.

    current_hash = SHA256(
        event_id + batch_id + stage + actor_id + timestamp + event_data + previous_hash
    )
    """
    raw = (
        str(event_id)
        + str(batch_id)
        + stage
        + str(actor_id)
        + str(timestamp.timestamp())
        + (event_data or "")
        + previous_hash
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


async def create_genesis_event(
    db: AsyncSession,
    batch_id: int,
    actor_id: int,
    event_data: Optional[str] = None,
) -> TraceabilityEvent:
    """Create the first traceability event (GENESIS) for a batch."""
    previous_hash = "GENESIS"
    stage = "GENESIS"
    now = datetime.utcnow()

    event = TraceabilityEvent(
        batch_id=batch_id,
        stage=stage,
        actor_id=actor_id,
        event_data=event_data,
        timestamp=now,
        previous_hash=previous_hash,
        current_hash="",  # placeholder
    )
    db.add(event)
    await db.flush()

    # Now compute the actual hash
    event.current_hash = compute_hash(
        event_id=event.id,
        batch_id=batch_id,
        stage=stage,
        actor_id=actor_id,
        timestamp=now,
        event_data=event_data,
        previous_hash=previous_hash,
    )
    await db.flush()
    return event


async def create_event(
    db: AsyncSession,
    batch_id: int,
    stage: str,
    actor_id: int,
    event_data: Optional[str] = None,
) -> TraceabilityEvent:
    """Create a new traceability event, chaining to the previous event."""
    # Get the latest event for this batch
    result = await db.execute(
        select(TraceabilityEvent)
        .where(TraceabilityEvent.batch_id == batch_id)
        .order_by(TraceabilityEvent.id.desc())
        .limit(1)
    )
    prev_event = result.scalar_one_or_none()

    previous_hash = prev_event.current_hash if prev_event else "GENESIS"
    now = datetime.utcnow()

    event = TraceabilityEvent(
        batch_id=batch_id,
        stage=stage,
        actor_id=actor_id,
        event_data=event_data,
        timestamp=now,
        previous_hash=previous_hash,
        current_hash="",  # placeholder
    )
    db.add(event)
    await db.flush()

    event.current_hash = compute_hash(
        event_id=event.id,
        batch_id=batch_id,
        stage=stage,
        actor_id=actor_id,
        timestamp=now,
        event_data=event_data,
        previous_hash=previous_hash,
    )
    await db.flush()
    return event


async def verify_chain(db: AsyncSession, batch_id: int) -> bool:
    """Verify the integrity of the hash chain for a given batch."""
    result = await db.execute(
        select(TraceabilityEvent)
        .where(TraceabilityEvent.batch_id == batch_id)
        .order_by(TraceabilityEvent.id.asc())
    )
    events = result.scalars().all()

    if not events:
        return False

    previous_hash = "GENESIS"
    for event in events:
        # Verify the stored previous_hash matches expected
        if event.previous_hash != previous_hash:
            return False

        # Recompute hash and compare
        expected = compute_hash(
            event_id=event.id,
            batch_id=event.batch_id,
            stage=event.stage,
            actor_id=event.actor_id,
            timestamp=event.timestamp,
            event_data=event.event_data,
            previous_hash=event.previous_hash,
        )
        if event.current_hash != expected:
            return False

        previous_hash = event.current_hash

    return True