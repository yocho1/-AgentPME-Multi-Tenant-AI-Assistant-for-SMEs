"""
Security utilities: JWT validation, API key authentication, multi-tenant auth.
"""

from datetime import datetime, timezone
from functools import wraps
from typing import Optional

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import APIKeyHeader, HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from pydantic import BaseModel

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# Security schemes
api_key_header = APIKeyHeader(name=settings.api_key_header, auto_error=False)
bearer_scheme = HTTPBearer(auto_error=False)


class JWTPayload(BaseModel):
    """Validated JWT payload from Supabase."""
    sub: str  # User ID
    email: Optional[str] = None
    role: Optional[str] = "authenticated"
    tenant_id: Optional[str] = None  # Custom claim for multi-tenancy
    exp: Optional[datetime] = None
    iat: Optional[datetime] = None


class AuthenticatedUser(BaseModel):
    """Authenticated user with tenant context."""
    id: str
    email: Optional[str] = None
    tenant_id: Optional[str] = None
    role: str = "authenticated"
    is_service: bool = False  # True if service-to-service call


async def validate_jwt_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)
) -> JWTPayload:
    """
    Validate a Supabase JWT token.
    
    Args:
        credentials: Bearer token from Authorization header
        
    Returns:
        Validated JWTPayload
        
    Raises:
        HTTPException: If token is invalid or expired
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    
    try:
        # Decode and validate JWT
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        
        # Extract custom tenant claim if present
        tenant_id = payload.get("app_metadata", {}).get("tenant_id")
        
        return JWTPayload(
            sub=payload["sub"],
            email=payload.get("email"),
            role=payload.get("role", "authenticated"),
            tenant_id=tenant_id,
            exp=datetime.fromtimestamp(payload["exp"], tz=timezone.utc) if "exp" in payload else None,
            iat=datetime.fromtimestamp(payload["iat"], tz=timezone.utc) if "iat" in payload else None,
        )
        
    except JWTError as e:
        logger.warning("JWT validation failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def validate_api_key(
    api_key: Optional[str] = Security(api_key_header)
) -> bool:
    """
    Validate service-to-service API key.
    
    Used for internal communication between Next.js and FastAPI.
    
    Args:
        api_key: API key from X-API-Key header
        
    Returns:
        True if valid
        
    Raises:
        HTTPException: If API key is invalid
    """
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API key",
        )
    
    # In production, compare against a secure key store
    # For now, compare against environment variable
    if api_key != settings.nextjs_api_key:
        logger.warning("Invalid API key attempt")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API key",
        )
    
    return True


async def get_current_user(
    jwt_payload: JWTPayload = Depends(validate_jwt_token)
) -> AuthenticatedUser:
    """
    Get the current authenticated user from JWT.
    
    Args:
        jwt_payload: Validated JWT payload
        
    Returns:
        AuthenticatedUser with tenant context
    """
    return AuthenticatedUser(
        id=jwt_payload.sub,
        email=jwt_payload.email,
        tenant_id=jwt_payload.tenant_id,
        role=jwt_payload.role or "authenticated",
        is_service=False,
    )


async def get_service_or_user(
    api_key_valid: bool = Depends(validate_api_key),
    jwt_payload: Optional[JWTPayload] = Depends(validate_jwt_token)
) -> AuthenticatedUser:
    """
    Allow either service-to-service (API key) or user (JWT) authentication.
    
    Priority:
    1. If API key is valid → service account
    2. If JWT is valid → authenticated user
    3. Otherwise → 401 Unauthorized
    """
    if api_key_valid:
        return AuthenticatedUser(
            id="service",
            email="service@internal",
            role="service",
            is_service=True,
        )
    
    if jwt_payload:
        return await get_current_user(jwt_payload)
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required",
    )


async def require_tenant(
    user: AuthenticatedUser = Depends(get_current_user)
) -> str:
    """
    Require the user to have a tenant association.
    
    Args:
        user: Authenticated user
        
    Returns:
        Tenant ID
        
    Raises:
        HTTPException: If user has no tenant
    """
    if not user.tenant_id and not user.is_service:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User not associated with any tenant",
        )
    
    # Service accounts can specify tenant in request body
    return user.tenant_id or ""


def require_role(required_role: str):
    """
    Decorator to require a specific role.
    
    Usage:
        @app.get("/admin-only")
        async def admin_endpoint(user: AuthenticatedUser = Depends(require_role("admin"))):
            return {"message": "Admin access granted"}
    """
    async def role_checker(user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
        if user.role != required_role and user.role != "service":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Required role: {required_role}",
            )
        return user
    return role_checker


# Common security dependencies for routes
CurrentUser = Depends(get_current_user)
ServiceOrUser = Depends(get_service_or_user)
RequireTenant = Depends(require_tenant)
