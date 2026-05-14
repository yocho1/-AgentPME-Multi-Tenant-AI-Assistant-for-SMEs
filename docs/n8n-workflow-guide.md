# n8n Hot-Lead Automation Guide

## Overview

When a customer shows **purchase intent** (pricing inquiry, booking request, purchase intent, demo request), AgentPME fires a webhook to your **n8n** instance. You can then automate any workflow: add to Airtable, send email, post to Slack, etc.

---

## How It Works

```
Customer asks "How much does the Pro plan cost?"
  → AI answers via widget/WhatsApp
  → n8nNode detects "pricing_inquiry" intent
  → POST to your n8n webhook URL
  → n8n workflow runs (add to CRM, send email, etc.)
```

**Fire-and-forget**: The webhook is sent in the background — it never blocks the AI response.

---

## Supported Intents

| Intent | Trigger Keywords (EN/FR/AR) | Example |
|--------|------------------------------|---------|
| `pricing_inquiry` | prix, tarif, devis, combien, price, cost, how much, شحال, ثمن, سعر | "How much is Pro?" |
| `booking_request` | rdv, réserver, book, appointment, disponible, حجز, موعد | "Can I book a demo?" |
| `purchase_intent` | commander, acheter, buy, purchase, order, panier, شرا, اشتري | "I want to buy the Starter plan" |
| `demo_request` | démo, demo, essai, trial, tester | "Can I try the Pro plan?" |
| `contact_request` | contact, appeler, téléphone, call, speak, human | "I want to talk to a human" |
| `custom` | Arabic hot-words (Darija/MSA) | "بغيت نعرف" |

---

## Configuration

### 1. Dashboard Settings

Go to **Dashboard → Settings → Automations (n8n)**:

- **Enable hot-lead detection** → checkbox
- **n8n Webhook URL** → your n8n webhook endpoint

### 2. Environment Variable (fallback)

If no per-tenant webhook URL is set, the global env var is used:

```bash
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/agentpme-hot-lead
```

---

## n8n Workflow Setup

### Step 1: Create a Webhook node

1. In n8n, create a new workflow
2. Add **Webhook** node as trigger
3. Method: `POST`
4. Path: `agentpme-hot-lead` (or whatever you want)
5. Response mode: `Last Node`

### Step 2: Test the webhook

Trigger the webhook manually from AgentPME:

```bash
curl -X POST https://your-n8n.app/webhook/agentpme-hot-lead \
  -H "Content-Type: application/json" \
  -d '{
    "event": "hot_lead_detected",
    "conversationId": "conv-123",
    "tenantId": "tenant-456",
    "tenantSlug": "ekipia-demo",
    "channel": "widget",
    "userMessage": "How much does the Pro plan cost?",
    "aiResponse": "The Pro plan is 799 DH/month...",
    "detectedIntent": "pricing_inquiry",
    "confidence": "high",
    "customerPhone": "+212600000000",
    "timestamp": "2026-05-14T10:00:00.000Z"
  }'
```

### Step 3: Add actions

#### Example A: Add to Google Sheets / Airtable

```
Webhook → Airtable (Create Record)
  Table: Hot Leads
  Fields:
    - conversationId: {{ $json.conversationId }}
    - tenant: {{ $json.tenantSlug }}
    - intent: {{ $json.detectedIntent }}
    - message: {{ $json.userMessage }}
    - phone: {{ $json.customerPhone }}
    - date: {{ $json.timestamp }}
```

#### Example B: Send Email to Sales Team

```
Webhook → Send Email (Gmail / SendGrid)
  To: sales@yourcompany.com
  Subject: 🔥 Hot Lead — {{ $json.detectedIntent }} from {{ $json.tenantSlug }}
  Body:
    New lead detected on {{ $json.channel }}.

    Intent: {{ $json.detectedIntent }}
    Message: {{ $json.userMessage }}
    Phone: {{ $json.customerPhone }}
    Conversation: {{ $json.conversationId }}
```

#### Example C: Post to Slack

```
Webhook → Slack (Post Message)
  Channel: #sales-leads
  Message:
    🔔 *Hot Lead Detected*
    Tenant: {{ $json.tenantSlug }}
    Intent: {{ $json.detectedIntent }}
    Message: {{ $json.userMessage }}
    Phone: {{ $json.customerPhone }}
```

#### Example D: Full Pipeline (CRM + Email + Slack)

```
Webhook
  → IF (confidence === "high")
    → Airtable (Create Record)
    → Send Email
    → Slack (Post Message)
  → ELSE
    → Airtable (Create Record only)
```

---

## Self-Hosted n8n (for Loi 09-08 compliance)

If you need to keep data in Morocco for compliance with **Loi 09-08** (data protection law):

```bash
# Run n8n on a local server or Moroccan cloud provider
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n
```

Then set the webhook URL to your local/internal domain:
```
N8N_WEBHOOK_URL=http://192.168.1.100:5678/webhook/agentpme-hot-lead
```

---

## Testing

1. Go to **Dashboard → Settings → Automations**
2. Enable hot-lead detection
3. Set webhook URL (you can use https://webhook.site for testing)
4. Go to your widget or WhatsApp
5. Send: "How much does the Pro plan cost?"
6. Check webhook.site — you should see the payload

---

## Payload Schema

```typescript
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
  timestamp: string; // ISO 8601
}
```
