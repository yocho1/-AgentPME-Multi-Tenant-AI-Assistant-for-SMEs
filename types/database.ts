export type Tenant = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
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

export type TenantWithProfile = Tenant & {
  profiles: Profile[];
};

// Stub database types until Supabase CLI generates the full schema.
// Replace this with `npx supabase gen types typescript ...` once your project is connected.
export type Database = {
  public: {
    Tables: {
      tenants: {
        Row: Tenant;
        Insert: Omit<Tenant, "id" | "created_at" | "updated_at"> & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<Tenant>;
      };
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at" | "updated_at"> & { created_at?: string; updated_at?: string };
        Update: Partial<Profile>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
