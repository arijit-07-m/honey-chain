from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum as SAEnum
from app.database import Base
import enum


class HiveStatus(str, enum.Enum):
    HEALTHY = "HEALTHY"
    ATTENTION = "ATTENTION"
    CRITICAL = "CRITICAL"


class Hive(Base):
    __tablename__ = "hives"

    id = Column(Integer, primary_key=True, index=True)
    hive_code = Column(String(50), unique=True, nullable=False, index=True)
    cluster_id = Column(Integer, ForeignKey("clusters.id"), nullable=True)
    farmer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(SAEnum(HiveStatus), default=HiveStatus.HEALTHY, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
