from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings


class Base(DeclarativeBase):
    \"\"\"Base class for all SQLAlchemy ORM models.\"\"\"


engine = create_async_engine(settings.DATABASE_URL, echo=False, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    \"\"\"FastAPI dependency that provides an async database session.\"\"\"
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db():
    \"\"\"Create all tables. For a prototype we use metadata.create_all;
    production deployments can migrate to Alembic migrations.\"\"\"
    from app import models  # noqa: F401  (register models with Base.metadata)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
