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
    Receive incoming WhatsApp messages from Meta and process with AI.
    
    Full implementation:
    1. Parse incoming message
    2. Find tenant by phone_number_id
    3. Get/create conversation
    4. Store user message
    5. Run RAG + LLM via LangGraph agent
    6. Store AI response
    7. Send reply back to WhatsApp
    8. Trigger n8n if hot lead detected
    
    Args:
        webhook: Parsed webhook payload from Meta
        client: Supabase service client
        
    Returns:
        Processing status
    """
    from uuid import UUID
    from app.models.chat import MessageRole
    from app.services.ai.agent import run_agent
    from app.services.db import TenantQueries
    
    processed_count = 0
    
    for entry in webhook.entry:
        for change in entry.changes:
            value = change.get("value", {})
            messages = value.get("messages", [])
            statuses = value.get("statuses", [])  # Message status updates
            phone_number_id = value.get("metadata", {}).get("phone_number_id")
            
            # Process message statuses (delivered, read, failed)
            for status_update in statuses:
                await _process_message_status(client, status_update)
            
            # Process incoming messages
            for msg in messages:
                if msg.get("type") != "text":
                    continue
                
                msg_id = msg.get("id")
                from_phone = msg.get("from")
                text = msg.get("text", {}).get("body", "")
                timestamp = msg.get("timestamp")
                
                if not text or not from_phone:
                    continue
                
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
                
                tenant_id = UUID(tenant["id"])
                tenant_slug = tenant.get("slug")
                
                # Get or create conversation
                conversation_id, conv_status = await ConversationQueries.get_or_create_whatsapp_conversation(
                    client, tenant_id, from_phone
                )
                
                # Skip if escalated (human agent handling)
                if conv_status == "escalated":
                    logger.info(
                        "Skipping auto-reply for escalated conversation",
                        conversation_id=str(conversation_id),
                    )
                    continue
                
                # Store user message
                await ConversationQueries.add_message(
                    client, conversation_id, MessageRole.USER, text
                )
                
                # Fetch conversation history for context
                history = await ConversationQueries.get_messages(client, conversation_id)
                chat_messages = [
                    {"role": msg.role.value, "content": msg.content}
                    for msg in history
                ]
                
                # Get tenant n8n config
                n8n_config = await TenantQueries.get_n8n_config(client, tenant_id)
                
                # Run AI agent
                try:
                    result = await run_agent(
                        client=client,
                        tenant_id=str(tenant_id),
                        messages=chat_messages,
                        conversation_id=str(conversation_id),
                        channel="whatsapp",
                        customer_phone=from_phone,
                        tenant_slug=tenant_slug,
                        n8n_enabled=n8n_config.get("n8n_enabled", False),
                        n8n_webhook_url=n8n_config.get("n8n_webhook_url"),
                    )
                    
                    reply = result["reply"]
                    intent_detected = result.get("intent_detected")
                    
                    # Store AI response
                    await ConversationQueries.add_message(
                        client, conversation_id, MessageRole.ASSISTANT, reply
                    )
                    
                    # Mark message as read
                    try:
                        from app.services.integrations.whatsapp import mark_message_as_read
                        await mark_message_as_read(msg_id, phone_number_id)
                    except Exception as e:
                        logger.debug("Failed to mark message as read", error=str(e))
                    
                    # Send reply back to WhatsApp
                    try:
                        await send_whatsapp_message(
                            to=from_phone,
                            text=reply[:4096],  # WhatsApp message limit
                            phone_number_id=phone_number_id,
                        )
                        
                        logger.info(
                            "WhatsApp message processed and replied",
                            tenant_id=str(tenant_id),
                            conversation_id=str(conversation_id),
                            phone=from_phone,
                            intent=intent_detected,
                            reply_length=len(reply),
                        )
                        
                        processed_count += 1
                        
                    except Exception as e:
                        logger.error(
                            "Failed to send WhatsApp reply",
                            error=str(e),
                            phone=from_phone,
                        )
                
                except Exception as e:
                    logger.exception(
                        "Agent failed for WhatsApp message",
                        error=str(e),
                        tenant_id=str(tenant_id),
                    )
                    
                    # Send error message to user
                    try:
                        await send_whatsapp_message(
                            to=from_phone,
                            text="Sorry, I'm having trouble right now. A human agent will assist you shortly.",
                            phone_number_id=phone_number_id,
                        )
                    except Exception:
                        pass
    
    return {
        "status": "processed",
        "messages_processed": processed_count,
    }


async def _process_message_status(client: AsyncClient, status_update: dict) -> None:
    """
    Process WhatsApp message status updates (sent, delivered, read, failed).
    
    Args:
        client: Supabase client
        status_update: Status update from Meta webhook
    """
    status = status_update.get("status")
    message_id = status_update.get("id")
    timestamp = status_update.get("timestamp")
    
    if not message_id or not status:
        return
    
    # Log status updates (could store in DB for analytics)
    logger.debug(
        "WhatsApp message status update",
        message_id=message_id,
        status=status,
        timestamp=timestamp,
    )
