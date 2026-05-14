export type Tenant = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  widget_enabled: boolean;
  widget_greeting: string | null;
  widget_position: "bottom-right" | "bottom-left";
  created_at: string;
  updated_at: string;
  subscription_status: "active" | "trialing" | "past_due" | "canceled";
  subscription_expires_at: string | null;
};

export type Profile = {
  id: string;
  tenant_id: string | null;
  role: "owner" | "admin" | "agent" | "viewer";
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Document = {
  id: string;
  tenant_id: string;
  title: string;
  content: string;
  source: string | null;
  status: "active" | "archived";
  chunk_count: number;
  created_at: string;
  updated_at: string;
};

export type Chunk = {
  id: string;
  tenant_id: string;
  document_id: string;
  content: string;
  embedding: string | null; // vector serialized as string
  chunk_index: number;
  created_at: string;
};

export type Conversation = {
  id: string;
  tenant_id: string;
  external_id: string | null;
  channel: "widget" | "whatsapp";
  status: "open" | "closed" | "escalated";
  user_name: string | null;
  user_email: string | null;
  user_phone: string | null;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type TenantWithProfile = Tenant & {
  profiles: Profile[];
};

// Supabase-generated-style Database types.
// Replace with `npx supabase gen types typescript ...` once connected.
export type Database = {
  public: {
    Tables: {
      tenants: {
        Row: Tenant;
        Insert: Omit<Tenant, "id" | "created_at" | "updated_at"> & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<Tenant>;
        Relationships: never[];
      };
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at" | "updated_at"> & { created_at?: string; updated_at?: string };
        Update: Partial<Profile>;
        Relationships: never[];
      };
      documents: {
        Row: Document;
        Insert: Omit<Document, "id" | "created_at" | "updated_at" | "chunk_count"> & { id?: string; created_at?: string; updated_at?: string; chunk_count?: number };
        Update: Partial<Document>;
        Relationships: never[];
      };
      chunks: {
        Row: Chunk;
        Insert: Omit<Chunk, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Chunk>;
        Relationships: never[];
      };
      conversations: {
        Row: Conversation;
        Insert: Omit<Conversation, "id" | "created_at" | "updated_at"> & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<Conversation>;
        Relationships: never[];
      };
      messages: {
        Row: Message;
        Insert: Omit<Message, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Message>;
        Relationships: never[];
      };
    };
    Views: Record<string, never>;
    Functions: {
      match_chunks: {
        Args: {
          query_embedding: string;
          match_tenant_id: string;
          match_count?: number;
        };
        Returns: Array<{
          id: string;
          document_id: string;
          content: string;
          chunk_index: number;
          similarity: number;
        }>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
