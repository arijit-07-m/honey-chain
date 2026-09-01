from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.database import get_db
from app.models.cluster import Cluster
from app.models.hive import Hive
from app.models.batch import Batch
from app.models.alert import Alert
from app.models.user import User, UserRole
from app.schemas.schemas import AdminDashboardResponse, ClusterStatsResponse, AlertResponse
from app.services.auth import get_current_user, require_role

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.get("/dashboard", response_model=AdminDashboardResponse)
async def admin_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """Get admin dashboard statistics."""
    # Total clusters
    result = await db.execute(select(func.count(Cluster.id)))
    total_clusters = result.scalar() or 0

    # Total beekeepers (farmers)
    result = await db.execute(
        select(func.count(User.id)).where(User.role == UserRole.FARMER)
    )
    total_beekeepers = result.scalar() or 0

    # Active hives
    result = await db.execute(select(func.count(Hive.id)))
    active_hives = result.scalar() or 0

    # Total honey produced
    result = await db.execute(select(func.coalesce(func.sum(Batch.quantity), 0)))
    honey_produced = float(result.scalar() or 0)

    # Recent alerts
    result = await db.execute(
        select(Alert).order_by(desc(Alert.created_at)).limit(10)
    )
    alerts = result.scalars().all()

    return AdminDashboardResponse(
        total_clusters=total_clusters,
        total_beekeepers=total_beekeepers,
        active_hives=active_hives,
        honey_produced_kg=round(honey_produced, 1),
        recent_alerts=[
            AlertResponse(
                id=a.id,
                hive_id=a.hive_id,
                type=a.type,
                message=a.message,
                severity=a.severity,
                created_at=a.created_at,
                resolved=a.resolved,
            )
            for a in alerts
        ],
    )


@router.get("/clusters", response_model=list[ClusterStatsResponse])
async def admin_clusters(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """Get cluster-level statistics."""
    result = await db.execute(select(Cluster))
    clusters = result.scalars().all()

    stats = []
    for cluster in clusters:
        # Hive count
        result = await db.execute(
            select(func.count(Hive.id)).where(Hive.cluster_id == cluster.id)
        )
        hive_count = result.scalar() or 0

        # Beekeeper count (farmers with hives in this cluster)
        result = await db.execute(
            select(func.count(func.distinct(Hive.farmer_id)))
            .where(Hive.cluster_id == cluster.id)
        )
        beekeeper_count = result.scalar() or 0

        # Honey produced from hives in this cluster
        result = await db.execute(
            select(func.coalesce(func.sum(Batch.quantity), 0))
            .join(Hive, Batch.hive_id == Hive.id)
            .where(Hive.cluster_id == cluster.id)
        )
        honey_produced = float(result.scalar() or 0)

        stats.append(ClusterStatsResponse(
            id=cluster.id,
            name=cluster.name,
            location=cluster.location,
            hive_count=hive_count,
            beekeeper_count=beekeeper_count,
            honey_produced_kg=round(honey_produced, 1),
        ))

    return stats


@router.get("/batches", response_model=list)
async def admin_batches(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """Get all batches with audit info for admin."""
    result = await db.execute(
        select(Batch).order_by(desc(Batch.created_at)).limit(50)
    )
    batches = result.scalars().all()

    batch_list = []
    for batch in batches:
        # Get latest traceability event hash
        from app.models.traceability_event import TraceabilityEvent
        result = await db.execute(
            select(TraceabilityEvent)
            .where(TraceabilityEvent.batch_id == batch.id)
            .order_by(desc(TraceabilityEvent.id))
            .limit(1)
        )
        last_event = result.scalar_one_or_none()

        batch_list.append({
            "id": batch.id,
            "batch_code": batch.batch_code,
            "honey_type": batch.honey_type,
            "quantity": batch.quantity,
            "status": batch.status,
            "created_at": batch.created_at.isoformat(),
            "last_hash": last_event.current_hash[:16] + "..." if last_event else "N/A",
        })

    return batch_list