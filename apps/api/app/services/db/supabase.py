"""
Supabase client factory with support for both:
1. Service role client (bypasses RLS - for webhooks/internal operations)
2. User-authenticated client (respects RLS - for user requests)
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

from supabase import AsyncClient, create_client

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# Cache for service client (reusable across requests)
_service_client: Optional[AsyncClient] = None


async def get_service_client() -> AsyncClient:
    """
    Get or create the Supabase service role client.
    
    The service role has elevated permissions and bypasses RLS policies.
    Use ONLY for:
    - WhatsApp webhooks (no user context)
    - Background jobs
    - Internal operations
    
    Returns:
        AsyncClient with service role
    """
    global _service_client
    
    if _service_client is None:
        logger.debug("Creating Supabase service client")
        _service_client = await create_client(
            settings.supabase_url,
            settings.supabase_service_key,
        )
    
    return _service_client


async def get_user_client(jwt_token: str) -> AsyncClient:
    """
    Create a Supabase client authenticated as a specific user.
    
    This client respects Row Level Security (RLS) policies,
    ensuring users can only access their own tenant's data.
    
    Args:
        jwt_token: Supabase JWT token from the authenticated user
        
    Returns:
        AsyncClient authenticated as the user
    """
    logger.debug("Creating user-authenticated Supabase client")
    
    client = await create_client(
        settings.supabase_url,
        settings.supabase_key,  # anon key for client-side
    )
    
    # Set the user's JWT token for RLS
    client.auth.set_session(jwt_token, refresh_token="")
    
    return client


@asynccontextmanager
async def service_client_context() -> AsyncGenerator[AsyncClient, None]:
    """
    Context manager for service client operations.
    
    Usage:
        async with service_client_context() as client:
            result = await client.table("tenants").select("*").execute()
    """
    client = await get_service_client()
    try:
        yield client
    except Exception as e:
        logger.error("Service client operation failed", error=str(e))
        raise


@asynccontextmanager
async def user_client_context(
    jwt_token: str
) -> AsyncGenerator[AsyncClient, None]:
    """
    Context manager for user-authenticated client operations.
    
    Usage:
        async with user_client_context(jwt_token) as client:
            result = await client.table("conversations").select("*").execute()
    """
    client = await get_user_client(jwt_token)
    try:
        yield client
    except Exception as e:
        logger.error("User client operation failed", error=str(e))
        raise


async def close_service_client() -> None:
    """Close the cached service client (useful for testing/cleanup)."""
    global _service_client
    if _service_client:
        await _service_client.auth.sign_out()
        _service_client = None
        logger.debug("Service client closed")
