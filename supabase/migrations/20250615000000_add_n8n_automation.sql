-- ============================================================
-- Sprint 6: n8n Automation Webhook
-- Adds per-tenant n8n webhook configuration for hot-lead detection.
-- ============================================================

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS n8n_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS n8n_webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS n8n_trigger_pricing BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS n8n_trigger_booking BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS n8n_trigger_purchase BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS n8n_trigger_demo BOOLEAN DEFAULT true;

-- Add conversation_id to messages for easier n8n payload correlation
-- (already exists, but ensure it's indexed)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
