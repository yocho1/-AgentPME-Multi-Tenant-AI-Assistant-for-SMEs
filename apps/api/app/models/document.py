"""
Pydantic models for document processing endpoints.
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class DocumentUpload(BaseModel):
    """Document upload request metadata."""
    filename: str = Field(..., description="Original filename")
    content_type: str = Field(default="text/plain", description="MIME type")
    tenant_id: UUID = Field(..., description="Tenant ID for document ownership")


class Chunk(BaseModel):
    """Text chunk with embedding."""
    id: Optional[UUID] = None
    document_id: UUID
    content: str = Field(..., description="Chunk text content")
    embedding: Optional[List[float]] = None  # Not returned to client
    chunk_index: int
    token_count: Optional[int] = None
    created_at: Optional[datetime] = None


class DocumentResponse(BaseModel):
    """Document with its chunks."""
    id: UUID
    tenant_id: UUID
    filename: str
    content_type: str
    file_size: int
    chunk_count: int
    chunks: Optional[List[Chunk]] = None
    created_at: datetime


class DocumentSummary(BaseModel):
    """Document without chunks (for listing)."""
    id: UUID
    tenant_id: UUID
    filename: str
    content_type: str
    file_size: int
    chunk_count: int
    created_at: datetime


class ChunkSearchResult(BaseModel):
    """Result from semantic search over chunks."""
    chunk_id: UUID
    document_id: UUID
    content: str
    similarity: float = Field(..., ge=0, le=1, description="Similarity score (0-1)")
    chunk_index: int


class EmbeddingRequest(BaseModel):
    """Request to generate embeddings."""
    texts: List[str] = Field(..., min_length=1, max_length=100, description="Texts to embed")
    model: str = Field(default="text-embedding-3-small", description="Embedding model")


class EmbeddingResponse(BaseModel):
    """Embeddings response."""
    embeddings: List[List[float]]
    model: str
    dimensions: int
    token_count: int
