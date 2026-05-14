"""
Meta WhatsApp Cloud API integration.
"""

import httpx

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


async def send_whatsapp_message(
    to: str,
    text: str,
    phone_number_id: str,
    access_token: str = None,
) -> dict:
    """
    Send a text message via WhatsApp Cloud API.
    
    Args:
        to: Recipient phone number (with country code)
        text: Message text
        phone_number_id: WhatsApp Business phone number ID
        access_token: Meta API token (defaults to settings)
        
    Returns:
        API response from Meta
        
    Raises:
        httpx.HTTPError: If API call fails
    """
    token = access_token or settings.whatsapp_access_token
    
    if not token:
        raise ValueError("WhatsApp access token not configured")
    
    url = f"{settings.whatsapp_api_base_url}/{phone_number_id}/messages"
    
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "text",
        "text": {"body": text},
    }
    
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
        logger.debug(
            "WhatsApp message sent",
            to=to,
            message_id=data.get("messages", [{}])[0].get("id"),
        )
        return data


async def mark_message_as_read(
    message_id: str,
    phone_number_id: str,
    access_token: str = None,
) -> dict:
    """
    Mark an incoming message as read.
    
    Args:
        message_id: WhatsApp message ID
        phone_number_id: WhatsApp Business phone number ID
        access_token: Meta API token
    """
    token = access_token or settings.whatsapp_access_token
    
    url = f"{settings.whatsapp_api_base_url}/{phone_number_id}/messages"
    
    payload = {
        "messaging_product": "whatsapp",
        "status": "read",
        "message_id": message_id,
    }
    
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
        return response.json()
