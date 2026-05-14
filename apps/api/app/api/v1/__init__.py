"""API version 1 routes."""

from fastapi import APIRouter

from app.api.v1 import chat, conversations, documents, health, n8n, whatsapp

router = APIRouter(prefix="/v1")

# Include all v1 routers
router.include_router(health.router, prefix="/health", tags=["Health"])
router.include_router(chat.router, prefix="/chat", tags=["Chat"])
router.include_router(conversations.router, prefix="/conversations", tags=["Conversations"])
router.include_router(documents.router, prefix="/documents", tags=["Documents"])
router.include_router(whatsapp.router, prefix="/whatsapp", tags=["WhatsApp"])
router.include_router(n8n.router, prefix="/n8n", tags=["n8n Automation"])

__all__ = ["router"]
