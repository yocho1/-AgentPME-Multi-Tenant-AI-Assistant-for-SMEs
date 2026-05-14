"""
n8n webhook integration for hot-lead automation.
"""

import asyncio
from typing import Optional, Tuple

import httpx

from app.core.config import settings
from app.core.logging import get_logger
from app.models.webhook import N8NWebhookPayload

logger = get_logger(__name__)


class HotLeadIntent:
    """Hot lead intent types."""
    PRICING = "pricing_inquiry"
    BOOKING = "booking_request"
    PURCHASE = "purchase_intent"
    DEMO = "demo_request"
    CONTACT = "contact_request"
    CUSTOM = "custom"


def detect_hot_lead_intent(text: str) -> Tuple[bool, str, str]:
    """
    Detect if user message indicates purchase/lead intent.
    
    Supports English, French, and Arabic (Darija/MSA).
    
    Args:
        text: User message text
        
    Returns:
        Tuple of (is_hot_lead, intent_type, confidence)
    """
    lower = text.lower()
    
    # Pricing / Devis / Tarif
    pricing = [
        "prix", "tarif", "devis", "combien", "coût", "cout", "budget",
        "pricing", "price", "cost", "how much", "quote", "costs",
        "شحال", "ثمن", "سعر", "تمن", "بشحال"
    ]
    if any(word in lower for word in pricing):
        return True, HotLeadIntent.PRICING, "high"
    
    # Booking / Rendez-vous / RDV
    booking = [
        "rdv", "rendez-vous", "rendezvous", "réserver", "réserver",
        "book", "booking", "appointment", "schedule", "disponible",
        "available", "calendrier", "date", "حجز", "موعد", "rendez"
    ]
    if any(word in lower for word in booking):
        return True, HotLeadIntent.BOOKING, "high"
    
    # Purchase / Commande / Achat
    purchase = [
        "commander", "commande", "acheter", "achat", "panier",
        "paiement", "payer", "buy", "purchase", "order", "checkout",
        "cart", "pay", "shop", "شراء", "اشتري", "شرا", "نشتري"
    ]
    if any(word in lower for word in purchase):
        return True, HotLeadIntent.PURCHASE, "high"
    
    # Demo / Essai / Trial
    demo = [
        "démo", "demo", "essai", "tester", "essayer", "trial", "try",
        "see", "voir", "démonstration", "تجربة", "تست", "démo"
    ]
    if any(word in lower for word in demo):
        return True, HotLeadIntent.DEMO, "medium"
    
    # Contact / Parler / Appeler
    contact = [
        "contact", "parler", "appeler", "téléphone", "email", "mail",
        "call", "speak", "talk", "reach", "human", "agent",
        "اتصل", "هاتف", "واتساب", "email", "تواصل"
    ]
    if any(word in lower for word in contact):
        return True, HotLeadIntent.CONTACT, "medium"
    
    return False, HotLeadIntent.CUSTOM, "low"


async def trigger_n8n_webhook(
    payload: N8NWebhookPayload,
    webhook_url: Optional[str] = None
) -> None:
    """
    Fire n8n webhook asynchronously (fire-and-forget).
    
    Never blocks the main flow - errors are logged but don't affect
    the AI response to the user.
    
    Args:
        payload: Hot lead data
        webhook_url: Optional override URL (else uses settings)
    """
    url = webhook_url or settings.n8n_webhook_url
    
    if not url:
        logger.debug("n8n webhook URL not configured, skipping")
        return
    
    try:
        async with httpx.AsyncClient(timeout=settings.n8n_timeout_seconds) as client:
            response = await client.post(
                url,
                json=payload.model_dump(mode="json"),
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "AgentPME-FastAPI/1.0",
                },
            )
            
            if response.status_code >= 400:
                logger.warning(
                    "n8n webhook returned error",
                    status_code=response.status_code,
                    response=response.text[:200],
                )
            else:
                logger.info(
                    "n8n webhook triggered successfully",
                    intent=payload.detected_intent,
                    tenant_slug=payload.tenant_slug,
                )
                
    except asyncio.TimeoutError:
        logger.warning("n8n webhook timed out (fire-and-forget)")
    except Exception as e:
        logger.error("n8n webhook failed", error=str(e))
        # Don't raise - this is fire-and-forget
