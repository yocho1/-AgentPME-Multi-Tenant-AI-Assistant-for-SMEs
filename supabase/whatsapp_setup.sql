-- Link your tenant to the WhatsApp phone number ID
-- Run this in Supabase SQL Editor

-- Step 1: Add the column if it doesn't exist
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS whatsapp_phone_id TEXT;

-- Step 2: See all your tenants
SELECT id, name, slug, whatsapp_phone_id FROM public.tenants;

-- Update your tenant with the WhatsApp phone number ID
-- Replace 'your-tenant-slug' with your actual slug
UPDATE public.tenants 
SET whatsapp_phone_id = '1110514682144103' 
WHERE slug = 'your-tenant-slug';

-- Verify it worked
SELECT id, name, slug, whatsapp_phone_id FROM public.tenants;
