"""
FastAPI dependencies for routes.

Provides dependency injection for:
- Database clients (service role or user-authenticated)
- Current user extraction from JWT
- Tenant validation
"""

from typing import AsyncGenerator, Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.logging import get_logger
from app.core.security import get_current_user, get_service_or_user
from app.models.chat import AuthenticatedUser
from app.services.db import get_service_client, get_user_client
from app.services.db.supabase import service_client_context, user_client_context

logger = get_logger(__name__)
security_scheme = HTTPBearer(auto_error=False)


async def get_db_client(
    user: AuthenticatedUser = Depends(get_service_or_user)
) -> AsyncGenerator:
    """
    Get appropriate database client based on authentication type.
    
    - Service calls (API key): Service client (bypasses RLS)
    - User calls (JWT): Service client for internal processing
    
    Yields:
        Supabase AsyncClient
    """
    async with service_client_context() as client:
        yield client


async def get_tenant_id(
    user: AuthenticatedUser = Depends(get_current_user),
    request: Request = None
) -> str:
    """
    Extract tenant ID from authenticated user or request body.
    
    Priority:
    1. User's tenant_id from JWT
    2. tenant_id from request body (for widget/anonymous users)
    
    Raises:
        HTTPException: If no tenant ID available
    """
    # First check user's JWT claim
    if user.tenant_id:
        return user.tenant_id
    
    # For service accounts, check request body
    if user.is_service and request:
        try:
            body = await request.json()
            tenant_id = body.get("tenant_id")
            if tenant_id:
                return str(tenant_id)
        except Exception:
            pass
    
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Tenant ID required. User not associated with any tenant.",
    )


async def optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme)
) -> Optional[AuthenticatedUser]:
    """
    Optionally get current user (for endpoints that allow anonymous access).
    
    Returns:
        AuthenticatedUser if valid JWT, None otherwise
    """
    if not credentials:
        return None
    
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None


class CommonDependencies:
    """
    Common dependencies bundle for API routes.
    
    Usage:
        @router.post("/chat")
        async def chat(
            deps: CommonDependencies = Depends()
        ):
            tenant_id = deps.tenant_id
            db = deps.db
    """
    
    def __init__(
        self,
        db=Depends(get_db_client),
        tenant_id: str = Depends(get_tenant_id),
        user: AuthenticatedUser = Depends(get_current_user),
    ):
        self.db = db
        self.tenant_id = tenant_id
        self.user = user
