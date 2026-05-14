/**
 * DEPRECATED: n8n integration moved to FastAPI backend.
 * Hot-lead detection and webhook firing are now handled server-side.
 *
 * The FastAPI backend handles:
 * - Intent detection (pricing, booking, purchase, etc.)
 * - n8n webhook triggering
 * - Multilingual keyword matching (AR/FR/EN)
 *
 * @deprecated This logic is now in apps/api/app/services/integrations/n8n.py
 */

console.warn("[DEPRECATED] lib/n8n.ts is deprecated. n8n integration moved to FastAPI.");

export function detectHotLeadIntent(_text: string): {
  isHotLead: boolean;
  intent: string;
  confidence: string;
} {
  throw new Error("detectHotLeadIntent moved to FastAPI backend");
}

export async function triggerN8nWebhook(_payload: unknown): Promise<void> {
  throw new Error("triggerN8nWebhook moved to FastAPI backend");
}
