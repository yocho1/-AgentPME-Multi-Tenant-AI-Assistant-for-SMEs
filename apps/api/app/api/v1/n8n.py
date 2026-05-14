"""
n8n automation webhook endpoints.

These endpoints:
- Trigger n8n workflows when hot leads are detected
- Can be called manually for testing
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import AsyncClient

from app.core.config import settings
from app.core.logging import get_logger
from app.models.webhook import N8NResponse, N8NWebhookPayload
from app.services.db import get_service_client
from app.services.integrations.n8n import trigger_n8n_webhook

logger = get_logger(__name__)
router = APIRouter()


@router.post("/trigger", response_model=N8NResponse)
async def trigger_n8n(
    payload: N8NWebhookPayload,
    client: AsyncClient = Depends(get_service_client),
) -> N8NResponse:
    """
    Manually trigger an n8n webhook (for testing).
    
    Args:
        payload: Hot lead data to send to n8n
        client: Supabase service client (not used directly)
        
    Returns:
        Success/failure status
    """
    if not settings.n8n_enabled or not settings.n8n_webhook_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="n8n automation is not configured",
        )
    
    try:
        await trigger_n8n_webhook(payload)
        return N8NResponse(success=True, message="Webhook triggered successfully")
    except Exception as e:
        logger.error("n8n trigger failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to trigger webhook: {str(e)}",
        )


@router.get("/config")
async def get_n8n_config() -> dict:
    """
    Get current n8n configuration (safe - no secrets).
    
    Returns:
        Configuration status
    """
    return {
        "enabled": settings.n8n_enabled,
        "webhook_url_configured": bool(settings.n8n_webhook_url),
        "timeout_seconds": settings.n8n_timeout_seconds,
    }
