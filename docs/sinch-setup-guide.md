# Sinch Conversation API Setup Guide

This guide explains how to connect Oasis Reserve to Sinch Conversation API for omnichannel messaging (Messenger, WhatsApp, SMS, Viber, RCS, Instagram, Telegram).

## Prerequisites

- A Sinch account at [dashboard.sinch.com](https://dashboard.sinch.com)
- A Sinch Conversation API app (created in the dashboard)
- At least one messaging channel configured (e.g., Facebook Messenger, WhatsApp)

## 1. Get Your Sinch Credentials

1. Log in to [Sinch Dashboard](https://dashboard.sinch.com)
2. Go to **Settings > Access Keys** and note your:
   - **Project ID**
   - **Client ID**
   - **Client Secret**
3. Go to **Conversation API > Apps** and note your:
   - **App ID**
4. Note which **region** your app was created in: `us`, `eu`, or `br`

## 2. Configure Channels in Sinch

In the Sinch Dashboard under your Conversation API app, configure the channels you want:

| Channel | Setup |
|---------|-------|
| **Facebook Messenger** | Link your Facebook Page |
| **Instagram** | Link your Instagram Business account |
| **WhatsApp** | Configure WhatsApp Business sender |
| **SMS** | Configure SMS number/sender |
| **Viber** | Set up Viber Business account |
| **RCS** | Configure RCS agent |
| **Telegram** | Link your Telegram bot |

## 3. Set Up the Webhook

In your Sinch Conversation API app settings, create a webhook:

- **Target URL**: `https://<your-supabase-project>.supabase.co/functions/v1/sinch-webhook`
- **Triggers**: Select at minimum:
  - `MESSAGE_INBOUND` (incoming customer messages)
  - `MESSAGE_DELIVERY` (delivery receipts, optional)
- **Secret**: (Optional) Set an HMAC secret for webhook signature verification

## 4. Configure in Oasis Reserve

1. Open your Oasis Reserve dashboard
2. Go to **Settings > AI Settings**
3. Under **Sinch Connection**, enter:
   - **Project ID**: Your Sinch project ID
   - **App ID**: Your Conversation API app ID
   - **Client ID**: Your OAuth client ID
   - **Client Secret**: Your OAuth client secret
   - **Region**: Select us/eu/br matching your Sinch app
4. Click **Save Settings**

## 5. Test the Integration

1. Send a message to one of your configured channels (e.g., message your Facebook Page)
2. The message should appear in the **Inbox** tab of Oasis Reserve
3. If AI is enabled, the AI assistant will automatically respond
4. Staff can reply manually from the Inbox, which sends the reply back through Sinch

## Architecture

```
Customer (Messenger/WhatsApp/SMS/etc.)
    |
    v
Sinch Conversation API
    |
    v (MESSAGE_INBOUND webhook)
sinch-webhook (Edge Function)
    |
    +--> conversations table (upsert)
    +--> chat_messages table (insert)
    +--> ai-chat-respond (if AI enabled)
            |
            +--> LLM (OpenAI-compatible)
            +--> sinch-send-message --> Sinch API --> Customer
```

## Supported Message Types

| Type | Inbound | Outbound |
|------|---------|----------|
| Text | Yes | Yes |
| Media (image/video/audio) | Stored as metadata | Not yet |
| Location | Stored as metadata | Not yet |
| Cards/Carousels | Stored as metadata | Not yet |

## Troubleshooting

- **Messages not arriving**: Check that the webhook URL is correct and the edge function is deployed
- **Tenant not found**: Ensure the Sinch App ID in your settings matches the one sending webhooks
- **Auth errors on send**: Verify your Client ID and Client Secret are correct for the region
- **Messages not sending**: Check the Sinch Dashboard for delivery reports and error details

## API Reference

- [Sinch Conversation API docs](https://developers.sinch.com/docs/conversation/)
- [Send a message](https://developers.sinch.com/docs/conversation/api-reference/conversation/messages/messages_sendmessage/)
- [Webhook events](https://developers.sinch.com/docs/conversation/callbacks/)
