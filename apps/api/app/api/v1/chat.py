"""
Chat API endpoint - OpenRouter LLM with streaming via SSE.

This endpoint handles:
1. Widget chat (anonymous users with tenant_id)
2. Authenticated dashboard chat
3. RAG context injection from pgvector
4. LangGraph agent orchestration (OpenRouter GPT-3.5/Claude)
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from supabase import AsyncClient

from app.core.logging import get_logger
from app.models.chat import ChatRequest, ChatResponse
from app.services.chat_service import ChatService
from app.services.db import get_service_client

logger = get_logger(__name__)
router = APIRouter()


@router.post("/", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    client: AsyncClient = Depends(get_service_client),
) -> ChatResponse:
    """
    Process a chat message and return AI response via OpenRouter.
    
    Full pipeline:
    1. Get/create conversation
    2. Fetch message history
    3. RAG: Embed query, search pgvector for similar chunks
    4. Generate context-aware response via OpenRouter (GPT-3.5/Claude)
    5. Detect hot lead intent, trigger n8n if needed
    6. Store response and return
    
    Args:
        request: Chat message with optional conversation_id
        client: Supabase service client
        
    Returns:
        AI response with conversation details and detected intent
    """
    try:
        response = await ChatService.process_message(client, request)
        return response
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Chat processing failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process chat message",
        )


@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    client: AsyncClient = Depends(get_service_client),
) -> StreamingResponse:
    """
    Stream chat response via Server-Sent Events (SSE) using OpenRouter.
    
    Streams partial responses as they're generated.
    
    Returns:
        StreamingResponse with text/event-stream content type
    """
    try:
        return StreamingResponse(
            ChatService.process_message_stream(client, request),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",  # Disable nginx buffering
            },
        )
    except Exception as e:
        logger.exception("Streaming failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Streaming failed",
        )
