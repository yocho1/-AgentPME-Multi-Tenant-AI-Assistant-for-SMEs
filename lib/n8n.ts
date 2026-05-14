/**
 * n8n webhook caller — fires when the AI detects a hot lead.
 *
 * Payload sent to n8n:
 *   - conversationId, tenantId, channel
 *   - userMessage, aiResponse
 *   - detectedIntent ("pricing", "booking", "purchase", "custom")
 *   - timestamp, customerPhone (if WhatsApp)
 *
 * n8n workflow example:
 *   1. Webhook node (receives this payload)
 *   2. Airtable / Google Sheets → append row
 *   3. Email (SendGrid / Gmail) → notify business owner
 *   4. Slack / Discord → post to sales channel
 */

interface HotLeadPayload {
  event: "hot_lead_detected";
  conversationId: string;
  tenantId: string;
  tenantSlug?: string;
  channel: "widget" | "whatsapp";
  userMessage: string;
  aiResponse: string;
  detectedIntent:
    | "pricing_inquiry"
    | "booking_request"
    | "purchase_intent"
    | "demo_request"
    | "contact_request"
    | "custom";
  confidence: "high" | "medium" | "low";
  customerPhone?: string;
  timestamp: string;
}

/**
 * Lightweight heuristic to detect purchase/lead intent from user messages.
 * Supports Arabic, French, and English keywords.
 */
export function detectHotLeadIntent(text: string): {
  isHotLead: boolean;
  intent: HotLeadPayload["detectedIntent"];
  confidence: HotLeadPayload["confidence"];
} {
  const lower = text.toLowerCase();

  // Pricing / Devis / Tarif
  const pricingPatterns =
    /\b(prix|tarif|devis|combien|coût|cout|budget|pricing|price|cost|how much|quote)\b/i;
  if (pricingPatterns.test(lower)) {
    return { isHotLead: true, intent: "pricing_inquiry", confidence: "high" };
  }

  // Booking / Rendez-vous / RDV
  const bookingPatterns =
    /\b(rdv|rendez-vous|rendezvous|réserver|réserver|réserver|réserver|book|booking|appointment|schedule|disponible|available|calendrier)\b/i;
  if (bookingPatterns.test(lower)) {
    return { isHotLead: true, intent: "booking_request", confidence: "high" };
  }

  // Purchase / Commande / Achat
  const purchasePatterns =
    /\b(commander|commande|acheter|achat|panier|paiement|payer|buy|purchase|order|checkout|cart|pay)\b/i;
  if (purchasePatterns.test(lower)) {
    return { isHotLead: true, intent: "purchase_intent", confidence: "high" };
  }

  // Demo / Essai / Trial
  const demoPatterns =
    /\b(démo|demo|essai|tester|essayer|trial|try|see|voir)\b/i;
  if (demoPatterns.test(lower)) {
    return { isHotLead: true, intent: "demo_request", confidence: "medium" };
  }

  // Contact / Parler / Appeler
  const contactPatterns =
    /\b(contact|parler|appeler|téléphone|email|mail|call|speak|talk|reach|human|agent)\b/i;
  if (contactPatterns.test(lower)) {
    return { isHotLead: true, intent: "contact_request", confidence: "medium" };
  }

  // Arabic keywords (Darija + MSA)
  const arabicHotWords =
    /\b(بغيت|بغا|شحال|ثمن|سوم|سعر|حجز|موعد|اشترا|شرا|دفع|طلب|اتصل|هاتف|واتساب|بريد|email|phone|whatsapp)\b/;
  if (arabicHotWords.test(text)) {
    return { isHotLead: true, intent: "custom", confidence: "medium" };
  }

  return { isHotLead: false, intent: "custom", confidence: "low" };
}

/**
 * Fire the n8n webhook asynchronously.
 * Never blocks the AI response — we fire-and-forget.
 */
export async function triggerN8nWebhook(payload: HotLeadPayload): Promise<void> {
  const webhookUrl =
    process.env.N8N_WEBHOOK_URL ||
    process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log("[n8n] No webhook URL configured — skipping hot-lead automation");
    return;
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "AgentPME/1.0",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error(
        `[n8n] Webhook returned ${res.status}:`,
        await res.text().catch(() => "")
      );
    } else {
      console.log(`[n8n] Hot-lead webhook fired → ${webhookUrl} (${payload.detectedIntent})`);
    }
  } catch (err) {
    console.error("[n8n] Webhook call failed:", err);
  }
}
