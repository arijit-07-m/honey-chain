from datetime import datetime
from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, Boolean
from app.database import Base


class SensorReading(Base):
    __tablename__ = "sensor_readings"

    id = Column(Integer, primary_key=True, index=True)
    hive_id = Column(Integer, ForeignKey("hives.id"), nullable=False, index=True)
    temperature = Column(Float, nullable=True)
    humidity = Column(Float, nullable=True)
    weight = Column(Float, nullable=True)
    sound_level = Column(Float, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    anomaly = Column(Boolean, default=False)
    anomaly_score = Column(Float, nullable=True)
