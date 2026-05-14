"""
LangGraph agent orchestration for RAG pipeline.

Implements a state machine:
    START → retrieve → generate → n8n → END

Mirrors the Next.js implementation in lib/agent.ts.
"""

from typing import Annotated, Any, Dict, List, Optional, TypedDict
from uuid import UUID

from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from supabase import AsyncClient

from app.core.config import settings
from app.core.logging import get_logger
from app.models.webhook import N8NWebhookPayload
from app.services.ai.embeddings import embed_query
from app.services.ai.llm import (
    create_system_prompt,
    detect_language,
    generate_chat_response,
)
from app.services.db.queries import DocumentQueries, TenantQueries
from app.services.integrations.n8n import (
    detect_hot_lead_intent,
    trigger_n8n_webhook,
)

logger = get_logger(__name__)


class AgentState(TypedDict):
    """State schema for the LangGraph agent."""
    messages: Annotated[List[Dict[str, str]], add_messages]
    context: str
    tenant_id: str
    conversation_id: Optional[str]
    channel: Optional[str]
    customer_phone: Optional[str]
    tenant_slug: Optional[str]
    n8n_enabled: Optional[bool]
    n8n_webhook_url: Optional[str]
    intent_detected: Optional[str]


async def retrieve_node(state: AgentState, client: AsyncClient) -> Dict[str, Any]:
    """
    Retrieve relevant chunks from knowledge base.
    
    Args:
        state: Current agent state
        client: Supabase client
        
    Returns:
        Updated state with retrieved context
    """
    # Get last user message
    user_messages = [m for m in state["messages"] if m.get("role") == "user"]
    if not user_messages:
        return {"context": "No relevant documents found."}
    
    last_message = user_messages[-1]["content"]
    
    # Generate embedding for query
    try:
        query_embedding = await embed_query(last_message)
    except Exception as e:
        logger.error("Failed to generate query embedding", error=str(e))
        return {"context": "No relevant documents found."}
    
    # Search similar chunks
    tenant_id = UUID(state["tenant_id"])
    chunks = await DocumentQueries.search_similar_chunks(
        client,
        tenant_id,
        query_embedding,
        match_threshold=settings.vector_match_threshold,
        match_count=settings.vector_match_count,
    )
    
    if not chunks:
        return {"context": "No relevant documents found."}
    
    # Format context
    context_parts = []
    for i, chunk in enumerate(chunks, 1):
        context_parts.append(f"[{i}] {chunk.content}")
    
    context_text = "\n\n---\n\n".join(context_parts)
    
    logger.info(
        "Retrieved chunks",
        tenant_id=str(tenant_id),
        chunk_count=len(chunks),
    )
    
    return {"context": context_text}


async def generate_node(state: AgentState) -> Dict[str, Any]:
    """
    Generate AI response using OpenRouter LLM.
    
    Args:
        state: Current agent state with context
        
    Returns:
        Updated state with AI response
    """
    # Detect language from last user message
    user_messages = [m for m in state["messages"] if m.get("role") == "user"]
    lang = "en"
    if user_messages:
        lang = detect_language(user_messages[-1]["content"])
    
    # Create system prompt with context
    system_prompt = create_system_prompt(
        context=state.get("context", "No relevant documents found."),
        language=lang,
    )
    
    # Build messages for LLM
    llm_messages = [
        {"role": "system", "content": system_prompt},
        *state["messages"],
    ]
    
    # Generate response via OpenRouter
    try:
        response = await generate_chat_response(
            messages=llm_messages,
            temperature=settings.openrouter_temperature or 0.3,
            max_tokens=1024,
        )
    except Exception as e:
        logger.error("LLM generation failed", error=str(e))
        response = "I'm sorry, I'm having trouble right now. Please try again later."
    
    logger.info(
        "Generated response",
        tenant_id=state["tenant_id"],
        language=lang,
        response_length=len(response),
    )
    
    return {
        "messages": [{"role": "assistant", "content": response}],
    }


async def n8n_node(state: AgentState) -> Dict[str, Any]:
    """
    Detect hot leads and trigger n8n webhook.
    
    Fire-and-forget: never blocks the response.
    
    Args:
        state: Current agent state
        
    Returns:
        State with intent detected
    """
    # Skip if n8n not enabled
    if not state.get("n8n_enabled"):
        return {}
    
    # Get last user message and AI response
    user_messages = [m for m in state["messages"] if m.get("role") == "user"]
    ai_messages = [m for m in state["messages"] if m.get("role") == "assistant"]
    
    if not user_messages:
        return {}
    
    user_text = user_messages[-1]["content"]
    ai_text = ai_messages[-1]["content"] if ai_messages else ""
    
    # Detect intent
    is_hot_lead, intent, confidence = detect_hot_lead_intent(user_text)
    
    if is_hot_lead:
        # Build payload
        payload = N8NWebhookPayload(
            conversation_id=UUID(state.get("conversation_id") or "00000000-0000-0000-0000-000000000000"),
            tenant_id=UUID(state["tenant_id"]),
            tenant_slug=state.get("tenant_slug"),
            channel=state.get("channel") or "widget",
            user_message=user_text,
            ai_response=ai_text,
            detected_intent=intent,
            confidence=confidence,
            customer_phone=state.get("customer_phone"),
        )
        
        # Fire webhook (async, non-blocking)
        webhook_url = state.get("n8n_webhook_url") or settings.n8n_webhook_url
        if webhook_url:
            # Fire-and-forget
            import asyncio
            asyncio.create_task(
                trigger_n8n_webhook_with_error_handling(payload, webhook_url)
            )
        
        logger.info(
            "Hot lead detected, n8n webhook fired",
            intent=intent,
            confidence=confidence,
            tenant_id=state["tenant_id"],
        )
        
        return {"intent_detected": intent}
    
    return {}


async def trigger_n8n_webhook_with_error_handling(
    payload: N8NWebhookPayload,
    webhook_url: str,
) -> None:
    """Wrapper to handle errors without affecting main flow."""
    try:
        await trigger_n8n_webhook(payload, webhook_url)
    except Exception as e:
        logger.error("n8n webhook failed (non-blocking)", error=str(e))


# Build the LangGraph
workflow = StateGraph(AgentState)

# Add nodes
workflow.add_node("retrieve", retrieve_node)
workflow.add_node("generate", generate_node)
workflow.add_node("n8n", n8n_node)

# Add edges (linear flow: retrieve → generate → n8n → END)
workflow.set_entry_point("retrieve")
workflow.add_edge("retrieve", "generate")
workflow.add_edge("generate", "n8n")
workflow.add_edge("n8n", END)

# Compile
agent_graph = workflow.compile()


async def run_agent(
    client: AsyncClient,
    tenant_id: str,
    messages: List[Dict[str, str]],
    conversation_id: str = None,
    channel: str = "widget",
    customer_phone: str = None,
    tenant_slug: str = None,
    n8n_enabled: bool = False,
    n8n_webhook_url: str = None,
) -> Dict[str, Any]:
    """
    Run the full LangGraph agent pipeline.
    
    This is the main entry point for agent execution.
    
    Args:
        client: Supabase service client
        tenant_id: Tenant ID
        messages: Chat history (list of {role, content})
        conversation_id: Optional conversation ID
        channel: 'widget' or 'whatsapp'
        customer_phone: Phone for WhatsApp
        tenant_slug: Tenant slug for n8n
        n8n_enabled: Whether to trigger n8n
        n8n_webhook_url: Custom n8n URL
        
    Returns:
        Dict with 'reply', 'intent_detected', 'conversation_id'
    """
    # Get tenant n8n config if not provided
    if n8n_enabled is None:
        try:
            n8n_config = await TenantQueries.get_n8n_config(client, UUID(tenant_id))
            n8n_enabled = n8n_config.get("n8n_enabled", False)
            n8n_webhook_url = n8n_webhook_url or n8n_config.get("n8n_webhook_url")
            tenant_slug = tenant_slug or n8n_config.get("slug")
        except Exception:
            n8n_enabled = False
    
    # Initial state
    initial_state = {
        "messages": messages,
        "context": "",
        "tenant_id": tenant_id,
        "conversation_id": conversation_id,
        "channel": channel,
        "customer_phone": customer_phone,
        "tenant_slug": tenant_slug,
        "n8n_enabled": n8n_enabled,
        "n8n_webhook_url": n8n_webhook_url,
        "intent_detected": None,
    }
    
    # Run graph
    try:
        # Note: retrieve_node needs client, so we pass it through
        # LangGraph doesn't easily support passing extra args to nodes
        # Workaround: retrieve_node uses a closure or we modify the state
        
        # For now, we'll handle retrieve separately before the graph
        context_result = await retrieve_node(initial_state, client)
        initial_state["context"] = context_result.get("context", "")
        
        # Now run generate and n8n
        generate_result = await generate_node(initial_state)
        initial_state["messages"].extend(generate_result.get("messages", []))
        
        n8n_result = await n8n_node(initial_state)
        intent_detected = n8n_result.get("intent_detected")
        
        # Get final response
        assistant_messages = [m for m in initial_state["messages"] if m.get("role") == "assistant"]
        reply = assistant_messages[-1]["content"] if assistant_messages else ""
        
        return {
            "reply": reply,
            "intent_detected": intent_detected,
            "conversation_id": conversation_id,
        }
        
    except Exception as e:
        logger.exception("Agent execution failed", error=str(e))
        return {
            "reply": "I'm sorry, I'm having trouble right now. A human agent will assist you shortly.",
            "intent_detected": None,
            "conversation_id": conversation_id,
        }
