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
    resolved: bool = Query(False),
    limit: int = Query(default=20, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List alerts, optionally filtered by hive."""
    query = select(Alert).where(Alert.resolved == resolved)

    if hive_id:
        query = query.where(Alert.hive_id == hive_id)

    # Farmers see only their hive alerts
    if current_user.role == UserRole.FARMER:
        from app.models.hive import Hive
        hives_result = await db.execute(
            select(Hive.id).where(Hive.farmer_id == current_user.id)
        )
        hive_ids = [r[0] for r in hives_result.all()]
        query = query.where(Alert.hive_id.in_(hive_ids))

    result = await db.execute(query.order_by(desc(Alert.created_at)).limit(limit))
    return result.scalars().all()