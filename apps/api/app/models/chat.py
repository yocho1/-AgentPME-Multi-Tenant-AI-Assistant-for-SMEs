"""
Pydantic models for chat endpoints.
"""

from datetime import datetime
from enum import Enum
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class MessageRole(str, Enum):
    """Message roles in a conversation."""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ChatMessage(BaseModel):
    """Single chat message."""
    role: MessageRole = Field(..., description="Who sent the message")
    content: str = Field(..., min_length=1, max_length=10000, description="Message content")
    timestamp: Optional[datetime] = Field(default=None, description="When message was sent")


class ChatRequest(BaseModel):
    """Request body for chat endpoint."""
    message: str = Field(
        ...,
        min_length=1,
        max_length=4000,
        description="User's message to the AI",
        examples=["What is your return policy?"]
    )
    conversation_id: Optional[UUID] = Field(
        default=None,
        description="Existing conversation ID, or null to create new"
    )
    tenant_id: Optional[UUID] = Field(
        default=None,
        description="Tenant ID (required for widget/anonymous users)"
    )
    channel: Literal["widget", "whatsapp"] = Field(
        default="widget",
        description="Communication channel"
    )
    stream: bool = Field(
        default=False,
        description="If true, stream response via SSE"
    )


class ChatResponse(BaseModel):
    """Response from chat endpoint."""
    reply: str = Field(..., description="AI's response")
    conversation_id: UUID = Field(..., description="Conversation ID")
    intent_detected: Optional[str] = Field(
        default=None,
        description="Detected intent (pricing, booking, etc.)"
    )
    sources: Optional[List[str]] = Field(
        default=None,
        description="Source documents/chunks used for RAG"
    )
    model_used: str = Field(default="claude-3-5-sonnet", description="AI model used")


class ConversationSummary(BaseModel):
    """Summary of a conversation for listing."""
    id: UUID
    tenant_id: UUID
    channel: Literal["widget", "whatsapp"]
    status: Literal["open", "escalated", "closed"]
    user_phone: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    message_count: int = 0
    last_message_preview: Optional[str] = None


class ConversationDetail(BaseModel):
    """Full conversation with messages."""
    id: UUID
    tenant_id: UUID
    channel: Literal["widget", "whatsapp"]
    status: Literal["open", "escalated", "closed"]
    user_phone: Optional[str] = None
    assigned_to: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    messages: List[ChatMessage] = []
