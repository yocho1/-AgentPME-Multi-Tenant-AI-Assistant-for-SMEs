"""
Text chunking and PDF extraction utilities.

Replicates the logic from lib/chunking.ts (Next.js version) in Python.
Uses tiktoken for accurate OpenAI token counting.
"""

import re
from typing import List

import fitz  # PyMuPDF
import tiktoken

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# Tokenizer for text-embedding-3-small (uses cl100k_base)
TOKENIZER = tiktoken.get_encoding("cl100k_base")


def count_tokens(text: str) -> int:
    """Count tokens in text using tiktoken."""
    return len(TOKENIZER.encode(text))


def chunk_text(
    text: str,
    chunk_size: int = None,
    chunk_overlap: int = None,
) -> List[str]:
    """
    Split text into overlapping chunks by token count.
    
    This mirrors the TypeScript implementation in lib/chunking.ts.
    
    Args:
        text: Source text to chunk
        chunk_size: Target tokens per chunk (default: settings.CHUNK_SIZE = 1000)
        chunk_overlap: Overlap between chunks (default: settings.CHUNK_OVERLAP = 200)
        
    Returns:
        List of text chunks
    """
    chunk_size = chunk_size or settings.chunk_size
    chunk_overlap = chunk_overlap or settings.chunk_overlap
    
    if not text.strip():
        return []
    
    # Encode text to tokens
    tokens = TOKENIZER.encode(text)
    
    chunks = []
    start = 0
    
    while start < len(tokens):
        # Take chunk_size tokens
        end = min(start + chunk_size, len(tokens))
        chunk_tokens = tokens[start:end]
        
        # Decode back to text
        chunk_text = TOKENIZER.decode(chunk_tokens)
        chunks.append(chunk_text)
        
        # Move forward by (chunk_size - overlap)
        start += chunk_size - chunk_overlap
        
        # Avoid infinite loop on small texts
        if start >= len(tokens) and len(chunk_tokens) < chunk_size:
            break
    
    logger.info(
        "Text chunked",
        total_tokens=len(tokens),
        chunk_count=len(chunks),
        chunk_size=chunk_size,
        overlap=chunk_overlap,
    )
    
    return chunks


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """
    Extract text from PDF using PyMuPDF (fitz).
    
    Args:
        pdf_bytes: Raw PDF file bytes
        
    Returns:
        Extracted text
        
    Raises:
        ValueError: If PDF is corrupted or empty
    """
    text_parts = []
    
    try:
        # Open PDF from memory
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text()
            
            # Clean up whitespace
            text = re.sub(r'\s+', ' ', text).strip()
            
            if text:
                text_parts.append(text)
        
        doc.close()
        
    except Exception as e:
        logger.error("PDF extraction failed", error=str(e))
        raise ValueError(f"Failed to extract PDF text: {e}")
    
    full_text = "\n\n".join(text_parts)
    
    logger.info(
        "PDF extracted",
        pages=len(text_parts),
        chars=len(full_text),
        tokens=count_tokens(full_text),
    )
    
    return full_text


def extract_text_from_file(content: bytes, content_type: str) -> str:
    """
    Extract text from various file types.
    
    Args:
        content: Raw file bytes
        content_type: MIME type
        
    Returns:
        Extracted text
    """
    if content_type == "application/pdf":
        return extract_text_from_pdf(content)
    
    elif content_type in ["text/plain", "text/markdown", "text/html"]:
        # Decode text files
        try:
            return content.decode("utf-8")
        except UnicodeDecodeError:
            # Try with different encoding
            return content.decode("latin-1")
    
    else:
        raise ValueError(f"Unsupported content type: {content_type}")


def create_chunks_with_metadata(
    text: str,
    document_id: str,
    chunk_size: int = None,
    chunk_overlap: int = None,
) -> List[dict]:
    """
    Create chunks with metadata ready for embedding.
    
    Args:
        text: Source text
        document_id: Parent document ID
        chunk_size: Target tokens per chunk
        chunk_overlap: Overlap between chunks
        
    Returns:
        List of chunk dicts with content, chunk_index, token_count
    """
    chunks = chunk_text(text, chunk_size, chunk_overlap)
    
    return [
        {
            "content": chunk,
            "chunk_index": i,
            "token_count": count_tokens(chunk),
            "document_id": document_id,
        }
        for i, chunk in enumerate(chunks)
    ]
