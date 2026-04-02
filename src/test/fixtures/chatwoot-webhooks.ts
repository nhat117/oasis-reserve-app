/**
 * Test fixtures for Chatwoot webhook payloads
 */

export const messageCreatedIncoming = {
  event: "message_created",
  message_type: "incoming",
  id: 12345,
  content: "Hi, I want to book a massage for tomorrow",
  content_type: "text",
  account: { id: 1 },
  conversation: {
    id: 100,
    channel: "Instagram",
  },
  sender: {
    id: 200,
    name: "Jane Doe",
    email: "jane@example.com",
    phone_number: "+61400000000",
    thumbnail: "https://example.com/avatar.jpg",
  },
  attachments: [],
};

export const messageCreatedOutgoing = {
  event: "message_created",
  message_type: "outgoing",
  id: 12346,
  content: "Hello! We'd love to help you book.",
  content_type: "text",
  account: { id: 1 },
  conversation: { id: 100, channel: "Instagram" },
  sender: { id: 1, name: "AI Assistant", type: "agent" },
};

export const conversationStatusChanged = {
  event: "conversation_status_changed",
  id: 100,
  status: "resolved",
  account: { id: 1 },
};

export const messageCreatedFacebook = {
  event: "message_created",
  message_type: "incoming",
  id: 12347,
  content: "What services do you offer?",
  content_type: "text",
  account: { id: 1 },
  conversation: {
    id: 101,
    channel: "Facebook",
  },
  sender: {
    id: 201,
    name: "John Smith",
    email: null,
    phone_number: null,
    identifier: "fb_12345",
  },
};

export const messageCreatedTikTok = {
  event: "message_created",
  message_type: "incoming",
  id: 12348,
  content: "How much for a gel manicure?",
  content_type: "text",
  account: { id: 1 },
  conversation: {
    id: 102,
    channel: "Api", // TikTok via API channel
  },
  sender: {
    id: 202,
    name: "TikTokUser123",
  },
};
