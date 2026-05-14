"""External service integrations."""

from app.services.integrations.n8n import detect_hot_lead_intent, trigger_n8n_webhook
from app.services.integrations.whatsapp import send_whatsapp_message

__all__ = [
    "detect_hot_lead_intent",
    "trigger_n8n_webhook",
    "send_whatsapp_message",
]
