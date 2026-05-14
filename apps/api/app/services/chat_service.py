"""
Chat service orchestrating the full conversation flow.

Handles:
- Conversation get/create
- Message history
- Agent execution
- Message storage
- Response streaming
"""

from typing import AsyncGenerator, List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from supabase import AsyncClient

from app.core.logging import get_logger
from app.models.chat import ChatMessage, ChatRequest, ChatResponse, MessageRole
from app.services.ai.agent import run_agent
from app.services.ai.llm import generate_chat_stream
from app.services.db.queries import ConversationQueries
from app.services.db import TenantQueries

logger = get_logger(__name__)


class ChatService:
    """Service for handling chat conversations."""
    
    @staticmethod
    async def process_message(
        client: AsyncClient,
        request: ChatRequest,
    ) -> ChatResponse:
        """
        Process a chat message and return AI response.
        
        Full flow:
        1. Get/create conversation
        2. Fetch message history
        3. Add user message to DB
        4. Run agent (RAG + LLM + n8n)
        5. Store AI response
        6. Return response
        
        Args:
            client: Supabase service client
            request: Chat request with message
            
        Returns:
            Chat response with AI reply
        """
        tenant_id = request.tenant_id
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="tenant_id is required",
            )
        
        # Get or create conversation
        if request.channel == "whatsapp":
            # WhatsApp conversations identified by phone
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Use WhatsApp webhook for WhatsApp messages",
            )
        
        conversation_id = await ConversationQueries.get_or_create_widget_conversation(
            client, tenant_id, request.conversation_id
        )
        
        # Fetch history
        history = await ConversationQueries.get_messages(client, conversation_id)
        
        # Convert to dict format for agent
        messages = [
            {"role": msg.role.value, "content": msg.content}
            for msg in history
        ]
        messages.append({"role": "user", "content": request.message})
        
        # Store user message
        await ConversationQueries.add_message(
            client, conversation_id, MessageRole.USER, request.message
        )
        
        # Get tenant config for n8n
        tenant_config = await TenantQueries.get_n8n_config(client, tenant_id)
        
        # Run agent
        result = await run_agent(
            client=client,
            tenant_id=str(tenant_id),
            messages=messages,
            conversation_id=str(conversation_id),
            channel=request.channel,
            tenant_slug=tenant_config.get("slug"),
            n8n_enabled=tenant_config.get("n8n_enabled", False),
            n8n_webhook_url=tenant_config.get("n8n_webhook_url"),
        )
        
        # Store AI response
        await ConversationQueries.add_message(
            client, conversation_id, MessageRole.ASSISTANT, result["reply"]
        )
        
        logger.info(
            "Chat processed",
            tenant_id=str(tenant_id),
            conversation_id=str(conversation_id),
            intent=result.get("intent_detected"),
        )
        
        return ChatResponse(
            reply=result["reply"],
            conversation_id=conversation_id,
            intent_detected=result.get("intent_detected"),
            sources=None,  # Could extract from context
            model_used="openrouter/gpt-3.5-turbo",
        )
    
    @staticmethod
    async def process_message_stream(
        client: AsyncClient,
        request: ChatRequest,
    ) -> AsyncGenerator[str, None]:
        """
        Process a chat message and stream AI response via SSE.
        
        Args:
            client: Supabase service client
            request: Chat request
            
        Yields:
            SSE event strings
        """
        tenant_id = request.tenant_id
        conversation_id = await ConversationQueries.get_or_create_widget_conversation(
            client, tenant_id, request.conversation_id
        )
        
        # Fetch history and add user message
        history = await ConversationQueries.get_messages(client, conversation_id)
        messages = [
            {"role": msg.role.value, "content": msg.content}
            for msg in history
        ]
        messages.append({"role": "user", "content": request.message})
        
        # Store user message
        await ConversationQueries.add_message(
            client, conversation_id, MessageRole.USER, request.message
        )
        
        # Get context from RAG (simplified - just yield)
        yield 'data: {"type": "start", "conversation_id": "' + str(conversation_id) + '"}\n\n'
        
        # Stream LLM response
        # TODO: Full RAG context injection for streaming
        # For now, stream directly
        full_response = ""
        try:
            async for chunk in generate_chat_stream(messages):
                full_response += chunk
                # Escape special chars for JSON
                import json
                data = json.dumps({"type": "chunk", "content": chunk})
                yield f'data: {data}\n\n'
        except Exception as e:
            logger.error("Streaming failed", error=str(e))
            yield 'data: {"type": "error", "message": "Streaming failed"}\n\n'
        
        # Store full response
        await ConversationQueries.add_message(
            client, conversation_id, MessageRole.ASSISTANT, full_response
        )
        
        yield 'data: {"type": "end"}\n\n'
