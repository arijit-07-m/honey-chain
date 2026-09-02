from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.database import get_db
from app.models.alert import Alert
from app.schemas.schemas import AlertResponse
from app.services.auth import get_current_user
from app.models.user import User, UserRole

router = APIRouter(prefix="/api/alerts", tags=["Alerts"])


@router.get("", response_model=list[AlertResponse])
async def list_alerts(
    hive_id: int = Query(None),
    resolved: str = Query("false"),
    limit: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List alerts, optionally filtered by hive. Returns unresolved by default."""
    query = select(Alert)
    
    if resolved == "true":
        query = query.where(Alert.resolved == True)
    elif resolved == "false":
        query = query.where(Alert.resolved == False)

    if hive_id:
        query = query.where(Alert.hive_id == hive_id)

    # Farmers see only their own hive alerts
    if current_user.role == UserRole.FARMER:
        from app.models.hive import Hive
        hives_result = await db.execute(
            select(Hive.id).where(Hive.farmer_id == current_user.id)
        )
        hive_ids = [r[0] for r in hives_result.all()]
        query = query.where(Alert.hive_id.in_(hive_ids))

    result = await db.execute(query.order_by(desc(Alert.created_at)).limit(limit))
    return result.scalars().all()


@router.patch("/{alert_id}/resolve", response_model=AlertResponse)
async def resolve_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark an alert as resolved. Farmers can only resolve alerts on their own hives."""
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    # Farmers can only resolve alerts on hives they own
    if current_user.role == UserRole.FARMER:
        from app.models.hive import Hive
        hive_result = await db.execute(
            select(Hive).where(Hive.id == alert.hive_id, Hive.farmer_id == current_user.id)
        )
        if not hive_result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Not authorized to resolve this alert")

    alert.resolved = True
    await db.commit()
    await db.refresh(alert)
    return alert