/**
 * Sinch Conversation API webhook fixtures for testing.
 * Based on the MESSAGE_INBOUND callback format.
 */

export const messageInboundInstagram = {
  app_id: '01EB37HMH1M6SV18ASNS3G135H',
  accepted_time: '2026-04-04T12:06:13.806686Z',
  event_time: '2026-04-04T12:06:13.254Z',
  project_id: 'c36f3d3d-1513-4edd-ae42-11995557ff61',
  message: {
    id: '01EKJ0WGFM7TR314K4D9Y31J5S',
    direction: 'TO_APP',
    contact_message: {
      text_message: {
        text: 'Hi, I want to book a massage for this Saturday',
      },
    },
    channel_identity: {
      channel: 'INSTAGRAM',
      identity: 'jane_doe_ig',
      app_id: '01EB37HMH1M6SV18ASNS3G135H',
    },
    conversation_id: 'conv_001',
    contact_id: 'contact_001',
    metadata: '',
    accept_time: '2026-04-04T12:06:13.794339Z',
  },
};

export const messageInboundMessenger = {
  app_id: '01EB37HMH1M6SV18ASNS3G135H',
  accepted_time: '2026-04-04T12:10:00.530Z',
  event_time: '2026-04-04T12:10:03.624Z',
  project_id: 'c36f3d3d-1513-4edd-ae42-11995557ff61',
  message: {
    id: '01EKJ13DYJX54C0N062N0Q1J9F',
    direction: 'TO_APP',
    contact_message: {
      text_message: {
        text: 'What services do you offer?',
      },
    },
    channel_identity: {
      channel: 'MESSENGER',
      identity: '534183549153491',
      app_id: '01EB37HMH1M6SV18ASNS3G135H',
    },
    conversation_id: 'conv_002',
    contact_id: 'contact_002',
    metadata: '',
    accept_time: '2026-04-04T12:10:00.494Z',
  },
};

export const messageInboundWhatsApp = {
  app_id: '01EB37HMH1M6SV18ASNS3G135H',
  accepted_time: '2026-04-04T13:00:00.000Z',
  event_time: '2026-04-04T13:00:00.000Z',
  project_id: 'c36f3d3d-1513-4edd-ae42-11995557ff61',
  message: {
    id: '01EKJ2ABC1234567890',
    direction: 'TO_APP',
    contact_message: {
      text_message: {
        text: 'I need an appointment this Saturday please',
      },
    },
    channel_identity: {
      channel: 'WHATSAPP',
      identity: '+61400111222',
      app_id: '01EB37HMH1M6SV18ASNS3G135H',
    },
    conversation_id: 'conv_003',
    contact_id: 'contact_003',
    metadata: '',
    accept_time: '2026-04-04T13:00:00.000Z',
  },
};

export const messageInboundSMS = {
  app_id: '01EB37HMH1M6SV18ASNS3G135H',
  accepted_time: '2026-04-04T14:00:00.000Z',
  event_time: '2026-04-04T14:00:00.000Z',
  project_id: 'c36f3d3d-1513-4edd-ae42-11995557ff61',
  message: {
    id: '01EKJ3XYZ9876543210',
    direction: 'TO_APP',
    contact_message: {
      text_message: {
        text: 'Cancel my booking tomorrow',
      },
    },
    channel_identity: {
      channel: 'SMS',
      identity: '+61400333444',
      app_id: '01EB37HMH1M6SV18ASNS3G135H',
    },
    conversation_id: 'conv_004',
    contact_id: 'contact_004',
    metadata: '',
    accept_time: '2026-04-04T14:00:00.000Z',
  },
};

export const messageInboundViber = {
  app_id: '01EB37HMH1M6SV18ASNS3G135H',
  accepted_time: '2026-04-04T15:00:00.000Z',
  event_time: '2026-04-04T15:00:00.000Z',
  project_id: 'c36f3d3d-1513-4edd-ae42-11995557ff61',
  message: {
    id: '01EKJ4VIBER123456',
    direction: 'TO_APP',
    contact_message: {
      text_message: {
        text: 'Do you have availability on Monday?',
      },
    },
    channel_identity: {
      channel: 'VIBERBM',
      identity: 'viber_user_001',
      app_id: '01EB37HMH1M6SV18ASNS3G135H',
    },
    conversation_id: 'conv_005',
    contact_id: 'contact_005',
    metadata: '',
    accept_time: '2026-04-04T15:00:00.000Z',
  },
};

export const messageInboundMediaOnly = {
  app_id: '01EB37HMH1M6SV18ASNS3G135H',
  accepted_time: '2026-04-04T16:00:00.000Z',
  event_time: '2026-04-04T16:00:00.000Z',
  project_id: 'c36f3d3d-1513-4edd-ae42-11995557ff61',
  message: {
    id: '01EKJ5MEDIA123456',
    direction: 'TO_APP',
    contact_message: {
      media_message: {
        url: 'https://example.com/photo.jpg',
      },
    },
    channel_identity: {
      channel: 'MESSENGER',
      identity: '534183549153491',
      app_id: '01EB37HMH1M6SV18ASNS3G135H',
    },
    conversation_id: 'conv_006',
    contact_id: 'contact_006',
    metadata: '',
    accept_time: '2026-04-04T16:00:00.000Z',
  },
};

export const deliveryReceipt = {
  app_id: '01EB37HMH1M6SV18ASNS3G135H',
  accepted_time: '2026-04-04T12:10:00.530Z',
  event_time: '2026-04-04T12:10:03.624Z',
  project_id: 'c36f3d3d-1513-4edd-ae42-11995557ff61',
  message_delivery_report: {
    message_id: '01EKJ13DYJX54C0N062N0Q1J9F',
    conversation_id: 'conv_002',
    status: 'DELIVERED',
    channel_identity: {
      channel: 'MESSENGER',
      identity: '534183549153491',
      app_id: '01EB37HMH1M6SV18ASNS3G135H',
    },
    contact_id: 'contact_002',
    metadata: '',
  },
};
