"""
OpenRouter embeddings service.

Uses OpenRouter to generate embeddings via OpenAI's text-embedding-3-small.
This mirrors the Next.js implementation that uses OpenRouter for both
LLM and embeddings with a single API key.
"""

from typing import List, Optional

import httpx

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# OpenRouter API configuration
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_EMBEDDING_MODEL = "openai/text-embedding-3-small"
EMBEDDING_DIMENSIONS = 1536


async def generate_embeddings(
    texts: List[str],
    model: str = None,
    api_key: str = None,
) -> List[List[float]]:
    """
    Generate embeddings for multiple texts using OpenRouter.
    
    This calls OpenRouter's embeddings endpoint, which proxies to OpenAI.
    
    Args:
        texts: List of texts to embed (max 100 per batch)
        model: Embedding model (default: openai/text-embedding-3-small)
        api_key: OpenRouter API key (default: from settings)
        
    Returns:
        List of embedding vectors (each 1536 dimensions for text-embedding-3-small)
        
    Raises:
        httpx.HTTPError: If API call fails
        ValueError: If texts list is empty or too large
    """
    if not texts:
        raise ValueError("texts cannot be empty")
    
    if len(texts) > 100:
        raise ValueError("Maximum 100 texts per batch")
    
    model = model or settings.openai_embedding_model or DEFAULT_EMBEDDING_MODEL
    api_key = api_key or settings.openrouter_api_key
    
    if not api_key:
        raise ValueError("OpenRouter API key not configured")
    
    url = f"{OPENROUTER_BASE_URL}/embeddings"
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": settings.nextjs_api_url or "http://localhost:3000",
        "X-Title": "AgentPME-FastAPI",
    }
    
    payload = {
        "model": model,
        "input": texts,
    }
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        
        data = response.json()
        
        # Extract embeddings from response
        # OpenAI format: {"data": [{"embedding": [...], "index": 0, "object": "embedding"}, ...]}
        embeddings = []
        for item in data["data"]:
            embeddings.append(item["embedding"])
        
        logger.info(
            "Embeddings generated",
            count=len(embeddings),
            model=model,
            dimensions=len(embeddings[0]) if embeddings else 0,
            total_tokens=data.get("usage", {}).get("total_tokens", 0),
        )
        
        return embeddings


async def embed_query(
    text: str,
    model: str = None,
    api_key: str = None,
) -> List[float]:
    """
    Generate embedding for a single query text.
    
    Convenience wrapper around generate_embeddings for single queries.
    
    Args:
        text: Query text to embed
        model: Embedding model
        api_key: OpenRouter API key
        
    Returns:
        Embedding vector (1536 dimensions)
    """
    embeddings = await generate_embeddings([text], model, api_key)
    return embeddings[0]


async def embed_chunks(
    chunks: List[dict],
    model: str = None,
    api_key: str = None,
) -> List[dict]:
    """
    Generate embeddings for a list of chunk dicts.
    
    Adds embedding vector to each chunk dict in place.
    
    Args:
        chunks: List of chunk dicts with 'content' key
        model: Embedding model
        api_key: OpenRouter API key
        
    Returns:
        Chunks with 'embedding' key added
    """
    if not chunks:
        return chunks
    
    # Extract texts
    texts = [chunk["content"] for chunk in chunks]
    
    # Generate embeddings in batches (max 100)
    batch_size = 100
    all_embeddings = []
    
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        embeddings = await generate_embeddings(batch, model, api_key)
        all_embeddings.extend(embeddings)
    
    # Add embeddings to chunks
    for chunk, embedding in zip(chunks, all_embeddings):
        chunk["embedding"] = embedding
    
    return chunks
