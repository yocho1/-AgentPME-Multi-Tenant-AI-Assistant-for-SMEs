"""
Document processing API endpoints.

Handles:
- PDF upload and text extraction (PyMuPDF)
- Text chunking with tiktoken
- OpenAI embeddings via OpenRouter
- pgvector storage
"""

from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from supabase import AsyncClient

from app.core.config import settings
from app.core.logging import get_logger
from app.models.document import DocumentResponse
from app.services.db import get_service_client
from app.services.document_service import DocumentService

logger = get_logger(__name__)
router = APIRouter()


@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    tenant_id: UUID,
    file: UploadFile = File(...),
    client: AsyncClient = Depends(get_service_client),
) -> DocumentResponse:
    """
    Upload a document, extract text, chunk, embed via OpenRouter, and store.
    
    Full pipeline:
    1. Validate file (PDF, TXT, MD, HTML only)
    2. Extract text (PyMuPDF for PDF)
    3. Chunk text (tiktoken, 1000 tokens, 200 overlap)
    4. Generate embeddings (OpenRouter → OpenAI text-embedding-3-small)
    5. Store in Supabase (document + chunks with embeddings)
    
    Args:
        tenant_id: Tenant ID for document ownership
        file: Uploaded file (max 10MB)
        client: Supabase service client
        
    Returns:
        Document with chunk count and details
        
    Raises:
        HTTPException: If file invalid or processing fails
    """
    try:
        result = await DocumentService.process_upload(client, tenant_id, file)
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.exception("Document upload failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process document",
        )


@router.get("/{document_id}")
async def get_document(
    document_id: UUID,
    client: AsyncClient = Depends(get_service_client),
) -> dict:
    """Get document by ID (placeholder)."""
    # TODO: Feature 3
    return {"id": str(document_id), "status": "placeholder"}


@router.delete("/{document_id}")
async def delete_document(
    document_id: UUID,
    client: AsyncClient = Depends(get_service_client),
) -> dict:
    """Delete document and its chunks (placeholder)."""
    # TODO: Feature 3
    return {"deleted": str(document_id)}
