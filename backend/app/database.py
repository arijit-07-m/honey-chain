from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings


class Base(DeclarativeBase):
    '''Base class for all SQLAlchemy ORM models.'''


engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    connect_args={} if 'sqlite' in settings.DATABASE_URL else {'ssl': 'require'}
)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    '''FastAPI dependency that provides an async database session.'''
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db():
    '''Create all tables.'''
    from app import models
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
