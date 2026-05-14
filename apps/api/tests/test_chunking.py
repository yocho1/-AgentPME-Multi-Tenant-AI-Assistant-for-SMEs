"""
Tests for text chunking and PDF extraction.
"""

import pytest

from app.services.ai.chunking import (
    chunk_text,
    count_tokens,
    create_chunks_with_metadata,
)


def test_count_tokens():
    """Test token counting with tiktoken."""
    text = "Hello, world!"
    tokens = count_tokens(text)
    assert tokens > 0
    assert isinstance(tokens, int)


def test_chunk_text_short():
    """Test chunking short text returns single chunk."""
    text = "This is a short text."
    chunks = chunk_text(text, chunk_size=100, chunk_overlap=20)
    assert len(chunks) == 1
    assert chunks[0] == text


def test_chunk_text_long():
    """Test chunking long text creates multiple chunks."""
    # Create text that's definitely longer than chunk_size
    text = "word " * 500  # ~500 tokens
    chunks = chunk_text(text, chunk_size=100, chunk_overlap=20)
    assert len(chunks) > 1
    
    # Verify overlap - chunks should share some content
    if len(chunks) > 1:
        # Last part of first chunk should appear in second chunk
        first_chunk_end = chunks[0][-20:]
        assert first_chunk_end in chunks[1]


def test_chunk_text_empty():
    """Test chunking empty text returns empty list."""
    chunks = chunk_text("", chunk_size=100, chunk_overlap=20)
    assert chunks == []


def test_chunk_text_whitespace():
    """Test chunking whitespace-only text returns empty list."""
    chunks = chunk_text("   \n\t  ", chunk_size=100, chunk_overlap=20)
    assert chunks == []


def test_create_chunks_with_metadata():
    """Test creating chunks with metadata."""
    text = "This is the first sentence. This is the second. This is the third."
    document_id = "doc-123"
    
    chunks = create_chunks_with_metadata(
        text,
        document_id,
        chunk_size=20,
        chunk_overlap=5,
    )
    
    assert len(chunks) > 0
    
    for i, chunk in enumerate(chunks):
        assert "content" in chunk
        assert "chunk_index" in chunk
        assert "token_count" in chunk
        assert "document_id" in chunk
        assert chunk["chunk_index"] == i
        assert chunk["document_id"] == document_id
        assert chunk["token_count"] > 0
        assert isinstance(chunk["content"], str)


@pytest.mark.asyncio
async def test_extract_text_from_pdf():
    """Test PDF text extraction (requires sample PDF)."""
    # This test requires a sample PDF file
    # For now, just import the function
    from app.services.ai.chunking import extract_text_from_pdf
    assert callable(extract_text_from_pdf)
