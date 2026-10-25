from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings

# NullPool is required for serverless environments (Vercel).
# Each function invocation opens and closes its own connection.
# Connection pooling is handled externally by Supabase Supavisor (port 6543).
engine = create_async_engine(settings.database_url, poolclass=NullPool)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
