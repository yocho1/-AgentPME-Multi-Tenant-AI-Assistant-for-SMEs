"""
Pydantic models for webhook integrations.
"""

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class WhatsAppMessageType(str, Enum):
    """WhatsApp message types."""
    TEXT = "text"
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"
    DOCUMENT = "document"
    LOCATION = "location"


class WhatsAppWebhookEntry(BaseModel):
    """Single entry in WhatsApp webhook payload."""
    id: str = Field(..., description="Webhook entry ID")
    changes: list[dict] = Field(..., description="List of changes")


class WhatsAppWebhook(BaseModel):
    """Meta WhatsApp webhook payload."""
    object: str = Field(default="whatsapp_business_account")
    entry: list[WhatsAppWebhookEntry]


class WhatsAppTextMessage(BaseModel):
    """Text message content."""
    body: str


class WhatsAppMessage(BaseModel):
    """Individual WhatsApp message from webhook."""
    from_: str = Field(..., alias="from", description="Sender's phone number")
    id: str = Field(..., description="Message ID")
    timestamp: str = Field(..., description="Unix timestamp")
    text: Optional[WhatsAppTextMessage] = None
    type: WhatsAppMessageType

    class Config:
        populate_by_name = True


class WhatsAppValue(BaseModel):
    """Value object containing messages."""
    messaging_product: str = "whatsapp"
    metadata: dict
    contacts: Optional[list] = None
    messages: Optional[list[WhatsAppMessage]] = None


class N8NWebhookPayload(BaseModel):
    """
    Payload sent to n8n when hot lead is detected.
    
    n8n workflow receives this and can:
    - Add to Airtable/Google Sheets
    - Send email to sales team
    - Post to Slack/Discord
    - Trigger CRM automation
    """
    event: str = Field(default="hot_lead_detected")
    conversation_id: UUID
    tenant_id: UUID
    tenant_slug: Optional[str] = None
    channel: str = Field(..., pattern="^(widget|whatsapp)$")
    user_message: str = Field(..., max_length=4000)
    ai_response: str = Field(..., max_length=10000)
    detected_intent: str = Field(
        ...,
        pattern="^(pricing_inquiry|booking_request|purchase_intent|demo_request|contact_request|custom)$"
    )
    confidence: str = Field(..., pattern="^(high|medium|low)$")
    customer_phone: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class N8NResponse(BaseModel):
    """Response from n8n webhook."""
    success: bool
    workflow_id: Optional[str] = None
    execution_id: Optional[str] = None
    message: Optional[str] = None
