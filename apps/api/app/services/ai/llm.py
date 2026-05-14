"""
OpenRouter LLM service for chat completions.

Uses OpenRouter API (compatible with OpenAI SDK format) to generate
responses from various models (GPT-3.5, GPT-4, Claude, etc.).

Mirrors the Next.js implementation in lib/agent.ts.
"""

from typing import AsyncGenerator, List, Optional, Dict, Any

import httpx

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# OpenRouter API configuration
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_MODEL = "openai/gpt-3.5-turbo"  # Same as Next.js default


async def generate_chat_response(
    messages: List[Dict[str, str]],
    model: str = None,
    temperature: float = 0.3,
    max_tokens: int = 1024,
    api_key: str = None,
) -> str:
    """
    Generate a chat response using OpenRouter.
    
    Args:
        messages: List of message dicts with 'role' and 'content'
                 Roles: 'system', 'user', 'assistant'
        model: Model identifier (default: openai/gpt-3.5-turbo)
               Options: openai/gpt-3.5-turbo, openai/gpt-4, anthropic/claude-3.5-sonnet, etc.
        temperature: Sampling temperature (0-1, default: 0.3)
        max_tokens: Max tokens to generate (default: 1024)
        api_key: OpenRouter API key (default: from settings)
        
    Returns:
        Generated response text
        
    Raises:
        httpx.HTTPError: If API call fails
        ValueError: If messages invalid
    """
    if not messages:
        raise ValueError("messages cannot be empty")
    
    model = model or settings.openrouter_model or DEFAULT_MODEL
    api_key = api_key or settings.openrouter_api_key
    
    if not api_key:
        raise ValueError("OpenRouter API key not configured")
    
    url = f"{OPENROUTER_BASE_URL}/chat/completions"
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": settings.nextjs_api_url or "http://localhost:3000",
        "X-Title": "AgentPME-FastAPI",
    }
    
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        
        data = response.json()
        
        # Extract response text
        choices = data.get("choices", [])
        if not choices:
            raise ValueError("No response choices from LLM")
        
        message = choices[0].get("message", {})
        content = message.get("content", "")
        
        logger.info(
            "LLM response generated",
            model=model,
            tokens_used=data.get("usage", {}).get("total_tokens", 0),
            response_length=len(content),
        )
        
        return content


async def generate_chat_stream(
    messages: List[Dict[str, str]],
    model: str = None,
    temperature: float = 0.3,
    max_tokens: int = 1024,
    api_key: str = None,
) -> AsyncGenerator[str, None]:
    """
    Generate a streaming chat response using OpenRouter (SSE).
    
    Yields partial response chunks as they arrive.
    
    Args:
        messages: List of message dicts
        model: Model identifier
        temperature: Sampling temperature
        max_tokens: Max tokens
        api_key: OpenRouter API key
        
    Yields:
        Chunks of the response text
    """
    if not messages:
        raise ValueError("messages cannot be empty")
    
    model = model or settings.openrouter_model or DEFAULT_MODEL
    api_key = api_key or settings.openrouter_api_key
    
    if not api_key:
        raise ValueError("OpenRouter API key not configured")
    
    url = f"{OPENROUTER_BASE_URL}/chat/completions"
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": settings.nextjs_api_url or "http://localhost:3000",
        "X-Title": "AgentPME-FastAPI",
        "Accept": "text/event-stream",
    }
    
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": True,  # Enable streaming
    }
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        async with client.stream(
            "POST",
            url,
            headers=headers,
            json=payload,
        ) as response:
            response.raise_for_status()
            
            # Parse SSE stream
            async for line in response.aiter_lines():
                line = line.strip()
                
                if not line or line == "data: [DONE]":
                    continue
                
                if line.startswith("data: "):
                    data = line[6:]  # Remove "data: " prefix
                    
                    # Parse JSON
                    try:
                        import json
                        chunk_data = json.loads(data)
                        
                        # Extract content delta
                        choices = chunk_data.get("choices", [])
                        if choices:
                            delta = choices[0].get("delta", {})
                            content = delta.get("content", "")
                            
                            if content:
                                yield content
                    except json.JSONDecodeError:
                        # Skip malformed JSON
                        continue


def create_system_prompt(
    context: str,
    language: str = "en",
    escalate_offered: bool = True,
) -> str:
    """
    Create system prompt for the AI assistant.
    
    Mirrors the system prompt from lib/agent.ts.
    
    Args:
        context: Retrieved context from knowledge base
        language: Response language (en, fr, ar)
        escalate_offered: Whether to offer human escalation
        
    Returns:
        Formatted system prompt
    """
    base_prompt = """You are AgentPME, a helpful AI assistant for a small business.

Answer the customer's question based ONLY on the provided context below.
If the context doesn't contain the answer, say you don't know and offer to escalate to a human.
Be concise, friendly, and professional."""
    
    # Language instruction
    lang_instruction = {
        "en": "Respond in English only.",
        "fr": "Répondez en français uniquement.",
        "ar": "يجيب باللغة العربية فقط.",
    }.get(language, "Respond in English only.")
    
    prompt = f"""{base_prompt}

{lang_instruction}

Context:
{context}
"""
    
    return prompt


def detect_language(text: str) -> str:
    """
    Detect language from text (lightweight heuristic).
    
    Mirrors lib/agent.ts detectLanguage().
    
    Args:
        text: Input text
        
    Returns:
        Language code: 'en', 'fr', or 'ar'
    """
    # Arabic Unicode range
    if any('\u0600' <= c <= '\u06FF' for c in text):
        return "ar"
    
    # French indicators
    french_words = [
        "bonjour", "salut", "merci", "bon", "comment", "quel", "où", "quand",
        "pourquoi", "combien", "je", "tu", "il", "elle", "nous", "vous",
        "ils", "elles", "être", "avoir", "faire", "aller", "voir", "savoir",
        "pouvoir", "vouloir", "venir", "prendre", "trouver", "donner",
    ]
    text_lower = text.lower()
    if any(word in text_lower for word in french_words):
        return "fr"
    
    return "en"
