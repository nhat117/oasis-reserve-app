# Chatwoot + Oasis Reserve — Setup Guide

Connect Chatwoot as a **backend channel connector** to enable AI-powered auto-replies across all messaging channels (website widget, Facebook, Instagram, WhatsApp, Telegram, email, etc.).

**Important:** Chatwoot runs in the background only — your staff manage all conversations from the **Oasis Reserve Inbox** tab in the admin dashboard. Staff never need to open Chatwoot's dashboard.

### Architecture

```
Customer (FB / IG / WhatsApp / Web / Email / Telegram)
    |
    v
Chatwoot (backend connector — receives messages from all channels)
    |
    v
Webhook → Supabase Edge Function → stores in your DB
    |
    v
Oasis Reserve Inbox (your frontend — staff sees & replies here)
    |
    v
Reply → chatwoot-send-message → Chatwoot → back to customer's channel
```

---

## Prerequisites

- A running Chatwoot instance (self-hosted or cloud)
- Your Oasis Reserve admin dashboard accessible
- An OpenAI API key (or compatible provider)

---

## Step 1: Configure AI Settings in Oasis Reserve

Go to **Admin Dashboard > Settings > AI & Knowledge Base** and fill in:

| Field | Value |
|---|---|
| **Global AI** | Toggle ON |
| **API Base URL** | `https://api.openai.com/v1` (or your provider) |
| **API Key** | Your OpenAI key (`sk-...`) |
| **Model** | `gpt-4o-mini` (recommended) |
| **Embedding Model** | `text-embedding-3-small` |
| **Chatwoot URL** | `https://your-chatwoot-instance.com` |
| **Chatwoot API Token** | Your Chatwoot user access token |
| **Chatwoot Account ID** | Your Chatwoot account ID (usually `1`) |

Click **Save Settings**. This creates the `ai_config` row that links your Chatwoot account to your tenant.

---

## Step 2: Add Webhook in Chatwoot

1. In Chatwoot, go to **Settings > Integrations > Webhooks > Configure**
2. Click **"Add new webhook"**
3. Enter this URL:

```
https://afibwdjbpnuxwpshsdyg.supabase.co/functions/v1/chatwoot-webhook
```

4. Subscribe to these events:
   - **`message_created`** — required, triggers AI responses
   - **`conversation_status_changed`** — syncs resolved/pending status to Oasis Reserve
   - **`conversation_created`** — optional, for logging

5. Click **Create**
6. Chatwoot will show you a **webhook secret** — copy and save it (needed for Step 3)

---

## Step 3: Set Webhook Secret (Production Security)

Store the Chatwoot webhook secret as a Supabase secret for signature verification:

```bash
npx supabase secrets set CHATWOOT_WEBHOOK_SECRET="your-secret-from-step-2"
```

This allows the edge function to verify that incoming webhooks are genuinely from Chatwoot and haven't been tampered with.

---

## Step 4: Connect Chatwoot Inboxes (Channels)

In Chatwoot, connect the messaging channels you want AI to respond on. All channels flow through the same webhook — the AI handles them all automatically.

| Channel | Chatwoot Setup Path |
|---|---|
| **Website widget** | Settings > Inboxes > Add Inbox > Website |
| **Facebook Messenger** | Settings > Inboxes > Add Inbox > Facebook |
| **Instagram DM** | Settings > Inboxes > Add Inbox > Instagram |
| **WhatsApp** | Settings > Inboxes > Add Inbox > WhatsApp (via 360dialog/Twilio) |
| **Email** | Settings > Inboxes > Add Inbox > Email |
| **Telegram** | Settings > Inboxes > Add Inbox > Telegram |
| **Line** | Settings > Inboxes > Add Inbox > Line |
| **API (TikTok, custom)** | Settings > Inboxes > Add Inbox > API Channel |

---

## How It Works

```
Customer sends message (any channel)
    |
    v
Chatwoot receives it
    |
    v
Chatwoot fires webhook --> POST to Supabase edge function
    |
    v
chatwoot-webhook edge function:
  1. Resolves tenant via chatwoot_account_id in ai_config
  2. Creates or updates conversation in your DB
  3. Stores the message in chat_messages table
  4. Detects platform (instagram / facebook / web / tiktok / api)
  5. Triggers ai-chat-respond if AI is enabled
    |
    v
ai-chat-respond edge function:
  1. Loads your services, staff schedules, holidays from DB (live data)
  2. Searches knowledge base via RAG (embeddings)
  3. Sends full context to LLM (OpenAI or compatible)
  4. LLM can use tools:
     - get_services: list services + prices
     - get_therapists: list staff + working hours
     - check_availability: find open slots for a date
     - create_booking: book an appointment
     - transfer_to_human: hand off to staff
  5. Sends AI reply back through chatwoot-send-message
    |
    v
Customer receives AI reply in their original channel
```

### What the AI Knows Automatically

The AI loads **real-time data** from your database before every response:

- **Services** — names, prices, durations
- **Staff / therapists** — names, working days, start/end hours, breaks
- **Shop holidays** — closed dates, early close hours
- **Therapist unavailability** — per-date blocks
- **Existing bookings** — to check conflicts and slot availability
- **Shop name** — from your tenant record
- **Knowledge base** — any articles you add (FAQs, policies, location, parking, etc.)

> **Tip:** Add your store address, parking info, cancellation policy, and other FAQs to the Knowledge Base (Settings > AI & Knowledge Base) so the AI can answer those questions too.

---

## Step 5: Configure Auto-Handoff

The AI automatically transfers conversations to human staff when:

- The customer explicitly asks for a human
- The AI fails to resolve the issue after 2 attempts
- The customer seems frustrated or upset
- The AI detects it's going in circles (repeating answers)
- The request is outside AI capabilities (complaints, refunds, complex changes)

### Handoff Notifications

In AI Settings, configure how you get notified:

| Setting | Description |
|---|---|
| **Notification Email** | Receives an email alert when handoff occurs |
| **SMS Alert (Twilio)** | Toggle ON to get SMS notifications |

When a handoff happens:
1. The conversation's `ai_enabled` flag is set to `false` in Oasis Reserve
2. The conversation is **reopened and unassigned in Chatwoot** via the Assignments API (`POST /api/v1/accounts/{id}/conversations/{id}/assignments`) — it appears in the "Unassigned" queue for human agents to pick up
3. Staff gets notified via email (Resend) and/or SMS (Twilio)
4. The conversation appears in the Oasis Reserve Inbox as "needs attention"
5. Staff can reply from either Chatwoot or Oasis Reserve — the response goes back to the customer on their original channel

---

## Step 6: Using the Inbox (Your Frontend)

All conversation management happens in **Admin Dashboard > Inbox**. Staff never need to open Chatwoot.

### Inbox Features

| Feature | Description |
|---|---|
| **Conversation list** | All conversations from all channels, sorted by latest message |
| **Real-time updates** | New messages appear instantly (Supabase Realtime) |
| **Reply composer** | Type and send replies — they go back to the customer's original channel |
| **Platform filter** | Filter by channel: web, Facebook, Instagram, WhatsApp, etc. |
| **Status filter** | Filter by open, resolved, pending |
| **Search** | Search conversations by customer name or message content |
| **AI toggle** | Enable/disable AI per conversation |
| **Staff assignment** | Assign conversations to specific team members |
| **Human takeover** | When AI hands off, staff sees the conversation with full history |
| **Unread badges** | Unread count shown per conversation |

### Staff Reply Flow

1. Staff opens Inbox, selects a conversation
2. Types a reply in the composer and sends
3. Message is saved to your database
4. Message is sent to the customer via Chatwoot API → back to their original channel (FB, IG, etc.)
5. AI is automatically paused for that conversation (human takeover)

---

## Step 7: Test It

1. Open your Chatwoot website widget (or send a message from any connected channel)
2. Send: **"What services do you offer?"**
3. The AI should auto-reply with your services list and prices
4. Check the **Inbox tab** in your Admin Dashboard — the conversation should appear
5. Try: **"I'd like to book a haircut for tomorrow at 2pm"**
6. The AI will check availability and walk through the booking process

---

## Troubleshooting

| Problem | Fix |
|---|---|
| No messages appearing in Inbox | Check webhook URL is correct. Check Supabase function logs: `npx supabase functions logs chatwoot-webhook` |
| AI not replying | Ensure AI is enabled in settings + API key is valid. Test connection with the "Test Connection" button. |
| "Tenant not found" error in logs | Your `chatwoot_account_id` in AI settings must match the Account ID shown in Chatwoot |
| CORS errors | Run `npx supabase secrets set ALLOWED_ORIGINS="https://your-domain.com,http://localhost:8081"` |
| Messages appear but no AI response | Check if conversation's `ai_enabled` is `false` (a handoff may have occurred). Reopen the conversation to re-enable AI. |
| AI replies are wrong/empty | Check knowledge base articles. Ensure services and therapists are configured in your admin. |
| Webhook not firing | In Chatwoot, check Settings > Integrations > Webhooks — verify the URL and subscribed events |

---

## Architecture Reference

### Edge Functions

| Function | Purpose | JWT Required |
|---|---|---|
| `chatwoot-webhook` | Receives Chatwoot webhooks, stores messages, triggers AI | No (uses HMAC) |
| `ai-chat-respond` | Generates AI responses with tools (booking, availability) | Yes |
| `chatwoot-send-message` | Sends replies back to Chatwoot | Yes |
| `notify-handoff` | Sends email/SMS notifications + Chatwoot unassignment on handoff | No |

### Chatwoot API Endpoints Used

| Action | Method | Endpoint |
|---|---|---|
| Send AI reply | POST | `/api/v1/accounts/{id}/conversations/{id}/messages` |
| Assign/unassign on handoff | POST | `/api/v1/accounts/{id}/conversations/{id}/assignments` |
| Reopen on handoff | POST | `/api/v1/accounts/{id}/conversations/{id}/toggle_status` |

All requests use the `api_access_token` header for authentication. See [Chatwoot API docs](https://developers.chatwoot.com/api-reference).

### Database Tables

| Table | Purpose |
|---|---|
| `ai_config` | AI settings per tenant (API keys, Chatwoot config, model settings) |
| `conversations` | Normalized conversations from all channels |
| `chat_messages` | Individual messages within conversations |
| `knowledge_base` | Custom articles for RAG search |
| `knowledge_base_embeddings` | Vector embeddings for semantic search |
| `handoff_events` | Logs of AI-to-human transfers |

---

## Security Notes

- API keys are stored encrypted in `ai_config` (field: `api_key_encrypted`)
- Chatwoot webhook secret should be set via `npx supabase secrets set CHATWOOT_WEBHOOK_SECRET="..."`
- All database queries are scoped to `tenant_id` for multi-tenant isolation
- AI messages pass through prompt injection detection and PII extraction prevention
- Rate limiting: 10 AI messages per minute per conversation (database-backed, survives cold starts)
