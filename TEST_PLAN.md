# AgentPME — Complete User Flow Test Plan

## Overview

This document defines the end-to-end test scenarios for AgentPME. Test the full user journey from signup to production, across all channels (web widget, WhatsApp), in multiple languages.

**Inspired by:** Ekipia.ai (5 AI employees managed via WhatsApp — 299 DH/mo)

---

## 1. Auth & Onboarding Flow

### 1.1 Signup

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Go to `/register` | Registration form displayed |
| 2 | Fill email, password, full name | Input accepted |
| 3 | Click "Create Account" | Account created, redirected to `/dashboard` |
| 4 | Check Supabase `profiles` table | New profile with `tenant_id` and `role = 'owner'` |
| 5 | Check Supabase `tenants` table | New tenant with slug auto-generated |

### 1.2 Login

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Go to `/login` | Login form displayed |
| 2 | Enter valid credentials | Logged in, redirected to `/dashboard` |
| 3 | Enter invalid password | Error message: "Invalid login credentials" |
| 4 | Click "Sign out" from sidebar | Session cleared, redirected to `/login` |

### 1.3 First-Time Dashboard

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Log in for first time | Sidebar shows: Dashboard, Conversations, Knowledge, Analytics, Billing, Team, Settings |
| 2 | Click "Dashboard" | Stats cards visible (conversations, messages) |
| 3 | Verify tenant slug | URL should show tenant-specific data |

---

## 2. Knowledge Base (Sprint 2)

### 2.1 Document Upload

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Go to `/dashboard/knowledge` | Knowledge base page loaded |
| 2 | Click "Upload Document" | File picker opens |
| 3 | Select a `.txt` file with business info | File uploaded, success message |
| 4 | Check Supabase `documents` table | Document inserted with `tenant_id` |
| 5 | Check Supabase `chunks` table | Multiple chunks created with embeddings |
| 6 | Verify chunk count | Content split into ~1000 char chunks with 200 overlap |

**Sample document content to upload:**
```
SHOPUSIA LTD - Return Policy

Our return policy allows customers to return items within 30 days of purchase. 
Items must be unused and in original packaging. Refunds are processed within 
5-7 business days to the original payment method. Sale items are final and 
cannot be returned. For defective products, we offer free returns and exchanges 
within 90 days. Contact our support team at support@shopusia.com for help.

Business Hours: Monday-Friday 9AM-6PM, Saturday 10AM-4PM.
Location: 123 Business Ave, Casablanca, Morocco.
Phone: +212 5XX-XXXXXX
```

### 2.2 Document List

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | After upload | Document appears in list with title |
| 2 | Refresh page | Document still visible (persisted) |

---

## 3. Web Widget (Sprint 3)

### 3.1 Widget Configuration

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Go to `/dashboard/settings` | Settings form loaded |
| 2 | Change "Widget Greeting" to "Welcome to SHOPUSIA!" | Input accepted |
| 3 | Toggle "Widget Enabled" | Toggle switches on/off |
| 4 | Change "Widget Position" to "bottom-left" | Dropdown updated |
| 5 | Click "Save Changes" | Success toast, settings persisted |

### 3.2 Embed Script

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Go to `/dashboard/settings` | Settings page |
| 2 | Find "Widget Script" section | Script code block visible |
| 3 | Copy the script | Clipboard contains embed code |
| 4 | Create a test HTML file, paste script | Widget loads in bottom-right (or configured position) |

**Test HTML file:**
```html
<!DOCTYPE html>
<html>
<head><title>Widget Test</title></head>
<body>
  <h1>Test Page</h1>
  <p>Widget should appear below...</p>
  <!-- PASTE EMBED SCRIPT HERE -->
</body>
</html>
```

### 3.3 Widget Chat Flow

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open widget on test page | Chat bubble visible |
| 2 | Click chat bubble | Chat widget opens with greeting |
| 3 | Type: "Hello" | Message sent, AI replies |
| 4 | Type: "What is your return policy?" | AI answers with KB content (30 days, original packaging, etc.) |
| 5 | Check Dashboard → Conversations | New conversation appears with "widget" channel |
| 6 | Check conversation status | Status = "open" |

---

## 4. WhatsApp Integration (Sprint 4)

### 4.1 Prerequisites
- Meta Developer account configured
- WhatsApp Business API test number active
- ngrok running (`ngrok http 3000`)
- Webhook verified in Meta dashboard
- Tenant linked: `UPDATE tenants SET whatsapp_phone_id = '...' WHERE slug = '...'`

### 4.2 WhatsApp Message Flow

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Send WhatsApp message to test number | Message delivered |
| 2 | Check terminal logs | `[whatsapp] running agent for tenant: ...` |
| 3 | Receive AI reply on WhatsApp | Reply contains KB-based answer |
| 4 | Check Dashboard → Conversations | New conversation with green WhatsApp icon |
| 5 | Click conversation | Full message history visible |

---

## 5. Conversation Management (Sprint 4)

### 5.1 Conversation List

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Go to `/dashboard/conversations` | List of all conversations |
| 2 | Verify channel icons | Widget = blue icon, WhatsApp = green phone icon |
| 3 | Check status badges | Open = blue, Escalated = orange, Closed = green |
| 4 | Verify counts | "X open, Y escalated, Z closed" matches list |

### 5.2 Escalate Flow

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open a widget conversation | Detail panel shows messages |
| 2 | Click "Escalate" button | Status changes to "Escalated", orange badge |
| 3 | Send another message from widget | AI does NOT auto-respond |
| 4 | Dashboard shows "Escalated" | Human agent can take over |

### 5.3 Close Flow

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open an escalated conversation | Detail panel visible |
| 2 | Click "Close" button | Status changes to "Closed", green badge |
| 3 | Verify in list | Conversation shows green "Closed" badge |

### 5.4 Live Polling

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Keep conversations page open | Auto-refreshes every 5 seconds |
| 2 | Send new message from widget | Appears in list without manual refresh |

---

## 6. Analytics Dashboard (Sprint 5)

### 6.1 KPI Cards

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Go to `/dashboard/analytics` | Analytics page loaded |
| 2 | Verify KPI cards | Total, Open, Closed, Escalated counts match actual data |
| 3 | Verify channel breakdown | Widget vs WhatsApp counts correct |
| 4 | Verify messages sent | Total message count accurate |

### 6.2 Recent Activity

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Check "Recent Activity" | Shows last 7 days of conversations |
| 2 | Verify dates | Dates formatted correctly (locale-aware) |

### 6.3 Top Queries

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Check "Recent Customer Queries" | Shows last 30 days of user messages |
| 2 | Verify channel labels | Shows "WhatsApp" or "Widget" per query |

---

## 7. Multi-Language Testing (Sprint 5)

### 7.1 Language Detection Test Cases

| # | Language | Input Message | Expected AI Response Language |
|---|----------|---------------|--------------------------------|
| 1 | **Arabic (MSA)** | `مرحبا، ما هي سياسة الإرجاع؟` | Arabic (`مرحباً! يمكنك إرجاع المنتجات خلال 30 يوماً...`) |
| 2 | **Arabic (Darija)** | `سلام، كيفاش نرجع produit?` | Arabic/Darija mixed |
| 3 | **French** | `Bonjour, quelle est votre politique de retour?` | French (`Bonjour ! Notre politique de retour vous permet...`) |
| 4 | **French (casual)** | `Salut, je veux savoir les délais de livraison` | French |
| 5 | **English** | `Hello, what is your return policy?` | English (`Hello! Our return policy allows...`) |
| 6 | **English (US)** | `Hey, how do returns work?` | English |
| 7 | **French + KB** | `Quels sont vos horaires d'ouverture?` | French with KB content (Monday-Friday 9AM-6PM...) |
| 8 | **Arabic + KB** | `ما هي ساعات العمل؟` | Arabic with KB content |

### 7.2 Mixed Conversation Flow

**Test scenario:** User switches languages mid-conversation

| Step | User Message | Expected AI Language |
|------|-------------|---------------------|
| 1 | `Hello, what are your hours?` | English |
| 2 | `Merci, et la politique de retour?` | French |
| 3 | `شكراً، كم سعر المنتج؟` | Arabic |

---

## 8. Stripe Billing (Sprint 5)

### 8.1 Billing Page

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Go to `/dashboard/billing` | 3 pricing cards displayed |
| 2 | Verify plan details | Starter $29, Pro $79, Enterprise $199 |
| 3 | Verify feature lists | Each plan shows correct features |
| 4 | Current plan shows "Free Trial" (or active plan) | Accurate status |

### 8.2 Subscribe Flow

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click "Subscribe" on Starter | Redirects to Stripe Checkout |
| 2 | Fill test card: `4242 4242 4242 4242` | Card accepted |
| 3 | Fill expiry: `12/30`, CVC: `123` | Form valid |
| 4 | Click "Subscribe" | Payment processed, redirect to `/dashboard/settings?success=true` |
| 5 | Go to `/dashboard/billing` | Shows "Current Plan: Starter" |
| 6 | Check Supabase `tenants` | `subscription_status = 'active'`, `subscription_tier = 'starter'` |
| 7 | Check Stripe Dashboard | Customer created, subscription active |

### 8.3 Webhook Verification

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Check terminal logs | `[stripe webhook] subscription activated for tenant: ...` |
| 2 | Cancel subscription in Stripe | `[stripe webhook] subscription canceled...` logged |

---

## 9. End-to-End Full Flow Test

### Scenario: New Business Onboarding

| Step | Action | Channel | Expected Result |
|------|--------|---------|----------------|
| 1 | Register new account | Web | Account created, tenant provisioned |
| 2 | Upload KB document | Dashboard | Document chunked and embedded |
| 3 | Configure widget greeting | Dashboard | "Welcome to SHOPUSIA!" saved |
| 4 | Embed widget on test site | Test HTML | Widget loads, chat functional |
| 5 | Customer chats via widget | Widget | AI answers based on KB |
| 6 | Customer asks in French | Widget | AI responds in French |
| 7 | Customer escalates | Dashboard | Agent clicks "Escalate", status = escalated |
| 8 | Customer sends WhatsApp | WhatsApp | New conversation, AI auto-replies |
| 9 | Customer asks in Arabic | WhatsApp | AI responds in Arabic |
| 10 | Agent reviews analytics | Dashboard | KPIs reflect all conversations |
| 11 | Business subscribes to Pro | Billing | Stripe checkout → active subscription |
| 12 | Verify subscription limits | All channels | Pro tier features unlocked |

---

## 10. Edge Cases & Error Handling

### 10.1 Auth Errors

| Scenario | Expected Behavior |
|----------|-------------------|
| Unauthenticated API call | Returns 401 "Unauthorized" |
| User with no tenant | Returns 403 "No tenant" |
| Invalid plan tier in checkout | Returns 400 "Invalid plan" |

### 10.2 WhatsApp Errors

| Scenario | Expected Behavior |
|----------|-------------------|
| No tenant linked to `whatsapp_phone_id` | Log: `[whatsapp] No tenant for phone_number_id` |
| Missing `WHATSAPP_ACCESS_TOKEN` | Error at runtime |
| Webhook verification fails | Returns 403 "Forbidden" |

### 10.3 AI Errors

| Scenario | Expected Behavior |
|----------|-------------------|
| No matching chunks in KB | AI says "I don't know, let me escalate you" |
| OpenRouter API down | Fallback message: "Sorry, I'm having trouble..." |
| Invalid API key | 401 error logged, graceful fallback |

### 10.4 Billing Errors

| Scenario | Expected Behavior |
|----------|-------------------|
| Missing `NEXT_PUBLIC_APP_URL` | Falls back to `http://localhost:3000` |
| Stripe webhook signature invalid | Returns 400 "Invalid signature" |
| Payment fails | Webhook sets `subscription_status = 'past_due'` |

---

## 11. Performance & Load Testing

| Test | Metric | Expected |
|------|--------|----------|
| Page load time (Dashboard) | < 2s |
| Widget chat response | < 3s |
| WhatsApp webhook response | < 2s |
| Analytics API response | < 1s |
| Document upload + chunking | < 5s per 10KB file |
| Conversations list (100 items) | < 1s |

---

## 12. Regression Checklist

Before each deploy, verify:

- [ ] Auth: signup, login, logout all work
- [ ] KB: upload document, chunks created, embeddings generated
- [ ] Widget: embed script loads, chat works, AI uses KB
- [ ] WhatsApp: webhook verified, messages received, replies sent
- [ ] Conversations: list, detail, escalate, close all functional
- [ ] Analytics: KPIs accurate, recent activity shows data
- [ ] Multi-language: Arabic, French, English all detected and responded
- [ ] Billing: checkout flow, webhook sync, subscription status update
- [ ] TypeScript: `npx tsc --noEmit` passes
- [ ] No `.env.local` secrets in repo

---

## Test Data

### Sample Documents for KB

**doc1.txt — Return Policy:**
```
SHOPUSIA LTD - Return Policy
Our return policy allows customers to return items within 30 days of purchase. 
Items must be unused and in original packaging. Refunds are processed within 
5-7 business days to the original payment method. Sale items are final and 
cannot be returned. For defective products, we offer free returns and exchanges 
within 90 days. Contact: support@shopusia.com
```

**doc2.txt — Shipping Info (French):**
```
Livraison - SHOPUSIA
Nous livrons partout au Maroc. Délai: 2-3 jours à Casablanca/Rabat, 
3-5 jours pour le reste du pays. Livraison gratuite à partir de 500 DH.
Paiement: carte bancaire, paiement à la livraison (Cash on Delivery).
```

**doc3.txt — Business Hours (Arabic):**
```
ساعات العمل - شوبوزيا
نفتح من الاثنين إلى الجمعة من الساعة 9 صباحاً حتى 6 مساءً.
يوم السبت من 10 صباحاً حتى 4 مساءً.
يوم الأحد مغلق.
العنوان: 123 شارع الأعمال، الدار البيضاء، المغرب.
```

---

## Appendix: Competitor Analysis (Ekipia.ai)

**Ekipia.ai** offers 5 AI "employees" managed via WhatsApp for 299 DH/mo:
- Salma (manager/scheduler)
- Rachid (sales/CRM)
- Yasmine (social media)
- Omar (ads/media buyer)
- Karim (copywriter)

**AgentPME differentiation:**
- Multi-channel (widget + WhatsApp) vs Ekipia's WhatsApp-only
- SaaS billing with 3 tiers vs Ekipia's flat pricing
- Multi-language auto-detection vs Ekipia's manual language selection
- Knowledge base with RAG vs Ekipia's pre-trained personas
- Open-source/customizable vs Ekipia's black-box approach

---

*Document version: 1.0*
*Last updated: 2026-05-14*
