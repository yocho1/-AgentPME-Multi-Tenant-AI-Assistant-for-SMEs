"""
Database query operations for Supabase.

All queries use the service client (bypasses RLS) for:
- Webhook operations
- Internal AI processing
- Background jobs

User-authenticated queries (respects RLS) should be done via the user client
in API route handlers.
"""

from typing import List, Optional
from uuid import UUID

from supabase import AsyncClient

from app.core.logging import get_logger
from app.models.chat import ChatMessage, ConversationDetail, MessageRole
from app.models.document import ChunkSearchResult

logger = get_logger(__name__)


class TenantQueries:
    """Queries for tenant operations."""
    
    @staticmethod
    async def get_by_id(client: AsyncClient, tenant_id: UUID) -> Optional[dict]:
        """Get tenant by ID."""
        result = await client.table("tenants").select("*").eq("id", str(tenant_id)).single().execute()
        return result.data if result.data else None
    
    @staticmethod
    async def get_by_whatsapp_phone_id(client: AsyncClient, phone_id: str) -> Optional[dict]:
        """Find tenant by WhatsApp phone number ID."""
        result = await client.table("tenants").select("*").eq("whatsapp_phone_id", phone_id).single().execute()
        return result.data if result.data else None
    
    @staticmethod
    async def get_n8n_config(client: AsyncClient, tenant_id: UUID) -> dict:
        """Get n8n automation configuration for tenant."""
        result = await client.table("tenants").select(
            "n8n_enabled, n8n_webhook_url, slug"
        ).eq("id", str(tenant_id)).single().execute()
        return result.data if result.data else {"n8n_enabled": False, "n8n_webhook_url": None}


class ConversationQueries:
    """Queries for conversation operations."""
    
    @staticmethod
    async def get_or_create_widget_conversation(
        client: AsyncClient,
        tenant_id: UUID,
        conversation_id: Optional[UUID] = None
    ) -> UUID:
        """
        Get existing conversation or create new one for widget chat.
        
        Returns:
            Conversation ID
        """
        if conversation_id:
            # Verify conversation exists and belongs to tenant
            result = await client.table("conversations").select("id, status").eq(
                "id", str(conversation_id)
            ).eq("tenant_id", str(tenant_id)).single().execute()
            
            if result.data:
                return conversation_id
        
        # Create new conversation
        new_conv = {
            "tenant_id": str(tenant_id),
            "channel": "widget",
            "status": "open",
        }
        result = await client.table("conversations").insert(new_conv).select("id").single().execute()
        conv_id = result.data["id"]
        logger.debug("Created widget conversation", conversation_id=conv_id, tenant_id=str(tenant_id))
        return UUID(conv_id)
    
    @staticmethod
    async def get_or_create_whatsapp_conversation(
        client: AsyncClient,
        tenant_id: UUID,
        from_phone: str
    ) -> tuple[UUID, str]:
        """
        Get existing open WhatsApp conversation or create new one.
        
        Returns:
            Tuple of (conversation_id, status)
        """
        # Look for existing open conversation with this phone
        result = await client.table("conversations").select("id, status").eq(
            "tenant_id", str(tenant_id)
        ).eq("user_phone", from_phone).eq("channel", "whatsapp").eq(
            "status", "open"
        ).order("created_at", desc=True).limit(1).single().execute()
        
        if result.data:
            return UUID(result.data["id"]), result.data["status"]
        
        # Create new conversation
        new_conv = {
            "tenant_id": str(tenant_id),
            "channel": "whatsapp",
            "status": "open",
            "user_phone": from_phone,
        }
        result = await client.table("conversations").insert(new_conv).select("id").single().execute()
        conv_id = result.data["id"]
        logger.debug(
            "Created WhatsApp conversation",
            conversation_id=conv_id,
            tenant_id=str(tenant_id),
            phone=from_phone
        )
        return UUID(conv_id), "open"
    
    @staticmethod
    async def get_messages(
        client: AsyncClient,
        conversation_id: UUID
    ) -> List[ChatMessage]:
        """Get all messages for a conversation."""
        result = await client.table("messages").select(
            "role, content, created_at"
        ).eq("conversation_id", str(conversation_id)).order(
            "created_at", desc=False
        ).execute()
        
        if not result.data:
            return []
        
        return [
            ChatMessage(
                role=MessageRole(msg["role"]),
                content=msg["content"],
                timestamp=msg["created_at"]
            )
            for msg in result.data
        ]
    
    @staticmethod
    async def add_message(
        client: AsyncClient,
        conversation_id: UUID,
        role: MessageRole,
        content: str
    ) -> None:
        """Add a message to a conversation."""
        await client.table("messages").insert({
            "conversation_id": str(conversation_id),
            "role": role.value,
            "content": content,
        }).execute()
    
    @staticmethod
    async def update_status(
        client: AsyncClient,
        conversation_id: UUID,
        status: str  # open, escalated, closed
    ) -> None:
        """Update conversation status."""
        await client.table("conversations").update({
            "status": status
        }).eq("id", str(conversation_id)).execute()


class DocumentQueries:
    """Queries for document and chunk operations."""
    
    @staticmethod
    async def create_document(
        client: AsyncClient,
        tenant_id: UUID,
        filename: str,
        content_type: str,
        file_size: int
    ) -> UUID:
        """Create document record and return ID."""
        doc = {
            "tenant_id": str(tenant_id),
            "filename": filename,
            "content_type": content_type,
            "file_size": file_size,
        }
        result = await client.table("documents").insert(doc).select("id").single().execute()
        return UUID(result.data["id"])
    
    @staticmethod
    async def create_chunks(
        client: AsyncClient,
        document_id: UUID,
        chunks: List[dict]  # List of {content, embedding, chunk_index}
    ) -> int:
        """
        Create chunks for a document.
        
        Args:
            chunks: List of chunk dicts with content, embedding, chunk_index
            
        Returns:
            Number of chunks created
        """
        chunk_records = [
            {
                "document_id": str(document_id),
                "content": chunk["content"],
                "embedding": chunk["embedding"],
                "chunk_index": chunk["chunk_index"],
            }
            for chunk in chunks
        ]
        
        await client.table("chunks").insert(chunk_records).execute()
        return len(chunk_records)
    
    @staticmethod
    async def search_similar_chunks(
        client: AsyncClient,
        tenant_id: UUID,
        query_embedding: List[float],
        match_threshold: float = 0.8,
        match_count: int = 5
    ) -> List[ChunkSearchResult]:
        """
        Perform semantic search using pgvector similarity.
        
        Calls the match_chunks RPC function in Supabase.
        """
        try:
            result = await client.rpc(
                "match_chunks",
                {
                    "query_embedding": query_embedding,
                    "match_threshold": match_threshold,
                    "match_count": match_count,
                    "p_tenant_id": str(tenant_id),
                }
            ).execute()
            
            if not result.data:
                return []
            
            return [
                ChunkSearchResult(
                    chunk_id=chunk["id"],
                    document_id=chunk["document_id"],
                    content=chunk["content"],
                    similarity=chunk["similarity"],
                    chunk_index=chunk["chunk_index"]
                )
                for chunk in result.data
            ]
        except Exception as e:
            logger.error("Chunk search failed", error=str(e), tenant_id=str(tenant_id))
            return []
    
    @staticmethod
    async def get_document_chunks(
        client: AsyncClient,
        document_id: UUID
    ) -> List[dict]:
        """Get all chunks for a document."""
        result = await client.table("chunks").select(
            "id, content, chunk_index, created_at"
        ).eq("document_id", str(document_id)).order("chunk_index").execute()
        return result.data or []


class ProfileQueries:
    """Queries for user profile operations."""
    
    @staticmethod
    async def get_by_user_id(client: AsyncClient, user_id: UUID) -> Optional[dict]:
        """Get profile by user ID."""
        result = await client.table("profiles").select("*").eq("id", str(user_id)).single().execute()
        return result.data if result.data else None
    
    @staticmethod
    async def get_by_tenant(client: AsyncClient, tenant_id: UUID) -> List[dict]:
        """Get all profiles for a tenant."""
        result = await client.table("profiles").select("*").eq("tenant_id", str(tenant_id)).execute()
        return result.data or []
