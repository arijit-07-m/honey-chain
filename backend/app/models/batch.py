from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from app.database import Base


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_code = Column(String(50), unique=True, nullable=False, index=True)
    hive_id = Column(Integer, ForeignKey("hives.id"), nullable=False)
    farmer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    honey_type = Column(String(255), nullable=True)
    quantity = Column(Float, nullable=False)
    harvest_date = Column(DateTime, nullable=False)
    status = Column(String(50), default="HARVEST", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
