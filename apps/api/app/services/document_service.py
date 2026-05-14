"""
Document processing service.

Orchestrates the full pipeline:
1. File upload validation
2. Text extraction (PDF, text files)
3. Text chunking
4. Embedding generation (via OpenRouter)
5. Database storage (document + chunks)
"""

from typing import List
from uuid import UUID

from fastapi import UploadFile
from supabase import AsyncClient

from app.core.config import settings
from app.core.logging import get_logger
from app.models.document import DocumentResponse
from app.services.ai.chunking import (
    count_tokens,
    create_chunks_with_metadata,
    extract_text_from_file,
)
from app.services.ai.embeddings import embed_chunks
from app.services.db.queries import DocumentQueries

logger = get_logger(__name__)


class DocumentService:
    """Service for document processing pipeline."""
    
    @staticmethod
    async def process_upload(
        client: AsyncClient,
        tenant_id: UUID,
        file: UploadFile,
    ) -> DocumentResponse:
        """
        Process a document upload through the full pipeline.
        
        Args:
            client: Supabase service client
            tenant_id: Tenant ID for ownership
            file: Uploaded file
            
        Returns:
            Document with chunk details
            
        Raises:
            ValueError: If file type unsupported or processing fails
            httpx.HTTPError: If embedding generation fails
        """
        # Validate file
        allowed_types = [
            "application/pdf",
            "text/plain",
            "text/markdown",
            "text/html",
        ]
        
        if file.content_type not in allowed_types:
            raise ValueError(
                f"File type '{file.content_type}' not supported. "
                f"Supported: PDF, TXT, MD, HTML"
            )
        
        # Read file
        content = await file.read()
        file_size = len(content)
        
        if file_size == 0:
            raise ValueError("File is empty")
        
        if file_size > 10 * 1024 * 1024:  # 10MB limit
            raise ValueError("File too large (max 10MB)")
        
        logger.info(
            "Processing document upload",
            tenant_id=str(tenant_id),
            filename=file.filename,
            content_type=file.content_type,
            size=file_size,
        )
        
        # Step 1: Extract text
        try:
            text = extract_text_from_file(content, file.content_type)
        except Exception as e:
            logger.error("Text extraction failed", error=str(e))
            raise ValueError(f"Failed to extract text: {e}")
        
        if not text.strip():
            raise ValueError("No text content found in file")
        
        total_tokens = count_tokens(text)
        logger.info(
            "Text extracted",
            chars=len(text),
            tokens=total_tokens,
        )
        
        # Step 2: Create document record
        document_id = await DocumentQueries.create_document(
            client,
            tenant_id,
            file.filename or "unnamed",
            file.content_type,
            file_size,
        )
        
        logger.info(
            "Document record created",
            document_id=str(document_id),
        )
        
        # Step 3: Chunk text
        chunks = create_chunks_with_metadata(
            text,
            str(document_id),
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
        )
        
        if not chunks:
            raise ValueError("Failed to create chunks from text")
        
        logger.info(
            "Text chunked",
            chunk_count=len(chunks),
        )
        
        # Step 4: Generate embeddings via OpenRouter
        try:
            chunks = await embed_chunks(chunks)
        except Exception as e:
            logger.error("Embedding generation failed", error=str(e))
            # Don't leave orphaned document - could delete here
            raise ValueError(f"Failed to generate embeddings: {e}")
        
        logger.info(
            "Embeddings generated",
            chunk_count=len(chunks),
        )
        
        # Step 5: Store chunks in database
        chunk_count = await DocumentQueries.create_chunks(client, document_id, chunks)
        
        logger.info(
            "Document processing complete",
            document_id=str(document_id),
            chunk_count=chunk_count,
            total_tokens=total_tokens,
        )
        
        return DocumentResponse(
            id=document_id,
            tenant_id=tenant_id,
            filename=file.filename or "unnamed",
            content_type=file.content_type,
            file_size=file_size,
            chunk_count=chunk_count,
        )
    
    @staticmethod
    async def delete_document(
        client: AsyncClient,
        document_id: UUID,
        tenant_id: UUID,
    ) -> bool:
        """
        Delete a document and its chunks.
        
        Args:
            client: Supabase service client
            document_id: Document to delete
            tenant_id: Tenant ID (for verification)
            
        Returns:
            True if deleted
        """
        # Chunks are deleted via CASCADE foreign key
        result = await client.table("documents").delete().eq(
            "id", str(document_id)
        ).eq("tenant_id", str(tenant_id)).execute()
        
        deleted = bool(result.data)
        
        if deleted:
            logger.info(
                "Document deleted",
                document_id=str(document_id),
                tenant_id=str(tenant_id),
            )
        
        return deleted
