from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Enum as SAEnum
from app.database import Base
import enum


class UserRole(str, enum.Enum):
    FARMER = "FARMER"
    ADMIN = "ADMIN"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(SAEnum(UserRole), default=UserRole.FARMER, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
