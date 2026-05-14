"""
Health check endpoints for monitoring and load balancers.
"""

from fastapi import APIRouter, Depends, status
from supabase import AsyncClient

from app.core.config import settings
from app.core.logging import get_logger
from app.services.db import get_service_client

logger = get_logger(__name__)
router = APIRouter()


@router.get("/", status_code=status.HTTP_200_OK)
async def health_check() -> dict:
    """
    Basic health check.
    
    Returns:
        Status and version information.
    """
    return {
        "status": "healthy",
        "version": "1.0.0",
        "environment": settings.app_env,
    }


@router.get("/ready", status_code=status.HTTP_200_OK)
async def readiness_check(
    client: AsyncClient = Depends(get_service_client)
) -> dict:
    """
    Readiness probe - checks if all dependencies are available.
    
    Checks:
    - Database connectivity (Supabase)
    
    Returns:
        Detailed status of all services.
    """
    services = {
        "api": "up",
        "supabase": "unknown",
    }
    
    # Check Supabase connection
    try:
        # Simple query to verify connection
        result = await client.table("tenants").select("count", count="exact").limit(0).execute()
        services["supabase"] = "up"
    except Exception as e:
        logger.error("Supabase health check failed", error=str(e))
        services["supabase"] = "down"
        services["error"] = str(e)
    
    all_healthy = all(s == "up" for s in services.values() if s != "unknown")
    
    return {
        "status": "ready" if all_healthy else "not_ready",
        "services": services,
    }


@router.get("/live", status_code=status.HTTP_200_OK)
async def liveness_check() -> dict:
    """
    Liveness probe - lightweight check that the process is running.
    
    Kubernetes uses this to restart the pod if it's stuck.
    """
    return {
        "status": "alive",
        "timestamp": "",  # Will be added
    }
