"""
Conversation management endpoints.

Handles:
- List conversations for tenant
- Get conversation details
- Update conversation status (open → escalated → closed)
- Assign conversation to agent
- Send manual messages
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from supabase import AsyncClient

from app.core.logging import get_logger
from app.models.chat import ChatMessage, ConversationSummary, MessageRole
from app.services.db import ConversationQueries, get_service_client
from app.services.integrations.whatsapp import send_whatsapp_message
from app.services.integrations.whatsapp_templates import send_human_handoff_message

logger = get_logger(__name__)
router = APIRouter()


class UpdateStatusRequest(BaseModel):
    """Request to update conversation status."""
    status: str  # open, escalated, closed
    assigned_to: Optional[str] = None
    notes: Optional[str] = None


class SendMessageRequest(BaseModel):
    """Request to send a manual message."""
    message: str
    phone_number_id: Optional[str] = None


@router.get("/", response_model=List[ConversationSummary])
async def list_conversations(
    tenant_id: UUID,
    status: Optional[str] = None,
    channel: Optional[str] = None,
    client: AsyncClient = Depends(get_service_client),
) -> List[ConversationSummary]:
    """
    List conversations for a tenant.
    
    Args:
        tenant_id: Tenant ID
        status: Filter by status (open, escalated, closed)
        channel: Filter by channel (widget, whatsapp)
        client: Supabase client
        
    Returns:
        List of conversation summaries
    """
    query = client.table("conversations").select(
        "*, messages(count)"
    ).eq("tenant_id", str(tenant_id))
    
    if status:
        query = query.eq("status", status)
    if channel:
        query = query.eq("channel", channel)
    
    result = await query.order("updated_at", desc=True).execute()
    
    conversations = []
    for conv in result.data or []:
        # Get last message preview
        last_msg_result = await client.table("messages").select(
            "content"
        ).eq("conversation_id", conv["id"]).order(
            "created_at", desc=True
        ).limit(1).execute()
        
        last_message = last_msg_result.data[0] if last_msg_result.data else None
        
        conversations.append(ConversationSummary(
            id=UUID(conv["id"]),
            tenant_id=UUID(conv["tenant_id"]),
            channel=conv["channel"],
            status=conv["status"],
            user_phone=conv.get("user_phone"),
            created_at=conv["created_at"],
            updated_at=conv["updated_at"],
            message_count=conv.get("messages", [{}])[0].get("count", 0),
            last_message_preview=last_message["content"][:100] if last_message else None,
        ))
    
    return conversations


@router.get("/{conversation_id}")
async def get_conversation(
    conversation_id: UUID,
    client: AsyncClient = Depends(get_service_client),
) -> dict:
    """
    Get conversation details with all messages.
    
    Args:
        conversation_id: Conversation ID
        client: Supabase client
        
    Returns:
        Conversation with messages
    """
    # Get conversation
    conv_result = await client.table("conversations").select(
        "*"
    ).eq("id", str(conversation_id)).single().execute()
    
    if not conv_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )
    
    conv = conv_result.data
    
    # Get messages
    messages = await ConversationQueries.get_messages(client, conversation_id)
    
    return {
        "id": conv["id"],
        "tenant_id": conv["tenant_id"],
        "channel": conv["channel"],
        "status": conv["status"],
        "user_phone": conv.get("user_phone"),
        "assigned_to": conv.get("assigned_to"),
        "created_at": conv["created_at"],
        "updated_at": conv["updated_at"],
        "messages": [
            {
                "role": msg.role.value,
                "content": msg.content,
                "timestamp": msg.timestamp,
            }
            for msg in messages
        ],
    }


@router.patch("/{conversation_id}/status")
async def update_conversation_status(
    conversation_id: UUID,
    request: UpdateStatusRequest,
    client: AsyncClient = Depends(get_service_client),
) -> dict:
    """
    Update conversation status (open → escalated → closed).
    
    When escalating:
    - Updates status to 'escalated'
    - Stops AI auto-responses
    - Optionally notifies customer via WhatsApp
    
    Args:
        conversation_id: Conversation ID
        request: Status update request
        client: Supabase client
        
    Returns:
        Updated conversation
    """
    # Validate status
    if request.status not in ["open", "escalated", "closed"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be: open, escalated, or closed",
        )
    
    # Get conversation
    conv_result = await client.table("conversations").select(
        "*, tenants(whatsapp_phone_id)"
    ).eq("id", str(conversation_id)).single().execute()
    
    if not conv_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )
    
    conv = conv_result.data
    
    # Update status
    update_data = {"status": request.status}
    if request.assigned_to:
        update_data["assigned_to"] = request.assigned_to
    
    await client.table("conversations").update(update_data).eq(
        "id", str(conversation_id)
    ).execute()
    
    # If escalating and WhatsApp, notify customer
    if request.status == "escalated" and conv["channel"] == "whatsapp" and conv.get("user_phone"):
        try:
            phone_number_id = conv["tenants"]["whatsapp_phone_id"]
            await send_human_handoff_message(
                to=conv["user_phone"],
                phone_number_id=phone_number_id,
            )
        except Exception as e:
            logger.warning("Failed to send handoff notification", error=str(e))
    
    logger.info(
        "Conversation status updated",
        conversation_id=str(conversation_id),
        status=request.status,
        assigned_to=request.assigned_to,
    )
    
    return {
        "id": str(conversation_id),
        "status": request.status,
        "assigned_to": request.assigned_to,
        "message": f"Conversation {request.status}",
    }


@router.post("/{conversation_id}/message")
async def send_manual_message(
    conversation_id: UUID,
    request: SendMessageRequest,
    client: AsyncClient = Depends(get_service_client),
) -> dict:
    """
    Send a manual message from human agent.
    
    Args:
        conversation_id: Conversation ID
        request: Message to send
        client: Supabase client
        
    Returns:
        Sent message details
    """
    # Get conversation
    conv_result = await client.table("conversations").select(
        "*, tenants(whatsapp_phone_id)"
    ).eq("id", str(conversation_id)).single().execute()
    
    if not conv_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )
    
    conv = conv_result.data
    
    # Store message
    await ConversationQueries.add_message(
        client,
        conversation_id,
        MessageRole.ASSISTANT,
        request.message,
    )
    
    # If WhatsApp, send message
    if conv["channel"] == "whatsapp" and conv.get("user_phone"):
        try:
            phone_number_id = request.phone_number_id or conv["tenants"]["whatsapp_phone_id"]
            
            if phone_number_id:
                await send_whatsapp_message(
                    to=conv["user_phone"],
                    text=request.message,
                    phone_number_id=phone_number_id,
                )
        except Exception as e:
            logger.error("Failed to send WhatsApp message", error=str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to send WhatsApp message: {e}",
            )
    
    logger.info(
        "Manual message sent",
        conversation_id=str(conversation_id),
        channel=conv["channel"],
    )
    
    return {
        "sent": True,
        "conversation_id": str(conversation_id),
        "channel": conv["channel"],
    }


@router.post("/{conversation_id}/close")
async def close_conversation(
    conversation_id: UUID,
    client: AsyncClient = Depends(get_service_client),
) -> dict:
    """
    Close a conversation (convenience endpoint).
    
    Args:
        conversation_id: Conversation ID
        client: Supabase client
        
    Returns:
        Closed conversation
    """
    return await update_conversation_status(
        conversation_id,
        UpdateStatusRequest(status="closed"),
        client,
    )


@router.post("/{conversation_id}/escalate")
async def escalate_conversation(
    conversation_id: UUID,
    assigned_to: Optional[str] = None,
    client: AsyncClient = Depends(get_service_client),
) -> dict:
    """
    Escalate conversation to human agent (convenience endpoint).
    
    Args:
        conversation_id: Conversation ID
        assigned_to: Agent ID to assign
        client: Supabase client
        
    Returns:
        Escalated conversation
    """
    return await update_conversation_status(
        conversation_id,
        UpdateStatusRequest(status="escalated", assigned_to=assigned_to),
        client,
    )
