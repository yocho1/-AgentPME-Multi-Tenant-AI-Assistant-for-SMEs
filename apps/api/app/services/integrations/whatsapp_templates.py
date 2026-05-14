"""
WhatsApp message templates for business-initiated conversations.

Templates must be pre-approved by Meta before use.
Common use cases: welcome messages, order confirmations, appointment reminders.
"""

from typing import Dict, List, Optional

import httpx

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class WhatsAppTemplate:
    """WhatsApp message template."""
    
    WELCOME = "welcome_message"
    ORDER_CONFIRMATION = "order_confirmation"
    APPOINTMENT_REMINDER = "appointment_reminder"
    SUPPORT_CLOSED = "support_closed"
    HUMAN_HANDOFF = "human_handoff"


async def send_template_message(
    to: str,
    template_name: str,
    language_code: str = "en",
    components: Optional[List[dict]] = None,
    phone_number_id: str = None,
    access_token: str = None,
) -> dict:
    """
    Send a WhatsApp message template.
    
    Templates must be pre-approved by Meta. Use for business-initiated
    conversations (outside the 24-hour window).
    
    Args:
        to: Recipient phone number
        template_name: Name of the approved template
        language_code: Language code (en, fr, ar)
        components: Template variables/components
        phone_number_id: WhatsApp Business phone number ID
        access_token: Meta API token
        
    Returns:
        API response
    """
    token = access_token or settings.whatsapp_access_token
    phone_id = phone_number_id or settings.whatsapp_phone_number_id
    
    if not token or not phone_id:
        raise ValueError("WhatsApp credentials not configured")
    
    url = f"{settings.whatsapp_api_base_url}/{phone_id}/messages"
    
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": language_code},
        },
    }
    
    if components:
        payload["template"]["components"] = components
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            url,
            json=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )
        response.raise_for_status()
        
        data = response.json()
        logger.info(
            "Template message sent",
            to=to,
            template=template_name,
            message_id=data.get("messages", [{}])[0].get("id"),
        )
        return data


async def send_welcome_message(
    to: str,
    business_name: str,
    phone_number_id: str = None,
) -> dict:
    """
    Send a welcome message to new WhatsApp contacts.
    
    Args:
        to: Recipient phone number
        business_name: Name of the business
        phone_number_id: WhatsApp phone number ID
    """
    # Simple text message (within 24h window)
    from app.services.integrations.whatsapp import send_whatsapp_message
    
    welcome_text = (
        f"Hello! Welcome to {business_name}. 👋\n\n"
        f"I'm your AI assistant. I can help you with:\n"
        f"• Product information\n"
        f"• Pricing inquiries\n"
        f"• Booking appointments\n"
        f"• General questions\n\n"
        f"How can I assist you today?"
    )
    
    return await send_whatsapp_message(
        to=to,
        text=welcome_text,
        phone_number_id=phone_number_id,
    )


async def send_human_handoff_message(
    to: str,
    phone_number_id: str = None,
) -> dict:
    """
    Notify user that conversation is being escalated to human agent.
    
    Args:
        to: Recipient phone number
        phone_number_id: WhatsApp phone number ID
    """
    from app.services.integrations.whatsapp import send_whatsapp_message
    
    handoff_text = (
        "I've escalated your conversation to a human agent. 👨‍💼\n\n"
        "They will review our conversation and get back to you shortly. "
        "Thank you for your patience!"
    )
    
    return await send_whatsapp_message(
        to=to,
        text=handoff_text,
        phone_number_id=phone_number_id,
    )


async def send_business_hours_message(
    to: str,
    hours: str,
    phone_number_id: str = None,
) -> dict:
    """
    Send business hours information.
    
    Args:
        to: Recipient phone number
        hours: Business hours text (e.g., "Monday-Friday 9AM-6PM")
        phone_number_id: WhatsApp phone number ID
    """
    from app.services.integrations.whatsapp import send_whatsapp_message
    
    hours_text = (
        f"Our business hours are:\n📅 {hours}\n\n"
        f"Feel free to reach out during these times, or leave a message "
        f"and we'll respond as soon as possible!"
    )
    
    return await send_whatsapp_message(
        to=to,
        text=hours_text,
        phone_number_id=phone_number_id,
    )


async def get_templates(
    phone_number_id: str = None,
    access_token: str = None,
) -> List[dict]:
    """
    Get list of approved message templates from Meta.
    
    Args:
        phone_number_id: WhatsApp Business phone number ID
        access_token: Meta API token
        
    Returns:
        List of template objects
    """
    token = access_token or settings.whatsapp_access_token
    phone_id = phone_number_id or settings.whatsapp_phone_number_id
    
    if not token or not phone_id:
        raise ValueError("WhatsApp credentials not configured")
    
    # Note: This uses the Business Management API, not the Cloud API
    url = f"https://graph.facebook.com/v18.0/{phone_id}/message_templates"
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            url,
            headers={"Authorization": f"Bearer {token}"},
            params={"limit": 100},
        )
        response.raise_for_status()
        
        data = response.json()
        return data.get("data", [])
