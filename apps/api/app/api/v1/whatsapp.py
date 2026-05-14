"""
WhatsApp webhook endpoints for Meta Cloud API.

Handles:
- Webhook verification (challenge-response)
- Incoming message processing
- AI response generation
- Message sending back to WhatsApp
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from supabase import AsyncClient

from app.core.config import settings
from app.core.logging import get_logger
from app.models.webhook import WhatsAppWebhook
from app.services.db import (
    ConversationQueries,
    TenantQueries,
    get_service_client,
)
from app.services.integrations.whatsapp import send_whatsapp_message

logger = get_logger(__name__)
router = APIRouter()


@router.get("/webhook")
async def verify_webhook(
    request: Request,
) -> str:
    """
    Verify webhook with Meta's challenge-response.
    
    Meta sends:
    - hub.mode=subscribe
    - hub.verify_token=<token>
    - hub.challenge=<random>
    
    We must return hub.challenge if verify_token matches.
    """
    params = dict(request.query_params)
    
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")
    
    logger.debug(
        "WhatsApp webhook verification",
        mode=mode,
        token=token,
        challenge=challenge,
    )
    
    if mode == "subscribe" and token == settings.whatsapp_verify_token:
        logger.info("WhatsApp webhook verified successfully")
        return challenge
    
    logger.warning("WhatsApp webhook verification failed")
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Verification failed",
    )


@router.post("/webhook")
async def receive_webhook(
    webhook: WhatsAppWebhook,
    client: AsyncClient = Depends(get_service_client),
) -> dict:
    """
    Receive incoming WhatsApp messages from Meta.
    
    Placeholder implementation.
    Full implementation in Feature 5: WhatsApp Integration.
    
    Args:
        webhook: Parsed webhook payload from Meta
        client: Supabase service client
        
    Returns:
        Processing status
    """
    for entry in webhook.entry:
        for change in entry.changes:
            value = change.get("value", {})
            messages = value.get("messages", [])
            phone_number_id = value.get("metadata", {}).get("phone_number_id")
            
            for msg in messages:
                if msg.get("type") != "text":
                    continue
                
                from_phone = msg.get("from")
                text = msg.get("text", {}).get("body", "")
                
                # Find tenant by phone_number_id
                tenant = await TenantQueries.get_by_whatsapp_phone_id(
                    client, phone_number_id
                )
                
                if not tenant:
                    logger.warning(
                        "No tenant for phone_number_id",
                        phone_number_id=phone_number_id,
                    )
                    continue
                
                tenant_id = tenant["id"]
                
                # Get or create conversation
                conversation_id, conv_status = await ConversationQueries.get_or_create_whatsapp_conversation(
                    client, tenant_id, from_phone
                )
                
                # Skip if escalated
                if conv_status == "escalated":
                    continue
                
                # TODO: Feature 5 - Full implementation:
                # 1. Store user message
                # 2. Fetch conversation history
                # 3. Run LangGraph agent with Claude
                # 4. Store and send AI response
                
                logger.info(
                    "WhatsApp message received (placeholder)",
                    tenant_id=str(tenant_id),
                    phone=from_phone,
                    text_preview=text[:50],
                )
                
                # Placeholder: Send echo response
                if phone_number_id:
                    await send_whatsapp_message(
                        to=from_phone,
                        text=f"Received: {text[:100]} (Full AI coming in Feature 5)",
                        phone_number_id=phone_number_id,
                    )
    
    return {"status": "processed"}
