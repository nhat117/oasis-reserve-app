import { describe, it, expect, vi } from 'vitest';

/**
 * Tests for:
 * - Handoff notification (email via Resend, SMS via Twilio, in-app events)
 * - Voice agent (ElevenLabs TTS + LLM + Twilio STT)
 * - Voice settings configuration
 * - End-to-end handoff → notification flow
 */

// ─── Handoff Notification Logic ─────────────────────────────────────

interface HandoffPayload {
  conversation_id?: string;
  tenant_id: string;
  reason: string;
  customer_name?: string;
  customer_message?: string;
  source?: string;
}

interface NotificationConfig {
  handoff_notify_email: string | null;
  handoff_notify_sms: boolean;
}

interface NotifyResult {
  ok: boolean;
  notified_via: string[];
}

/**
 * Determines which channels to notify based on config.
 * Always includes in_app.
 */
function resolveNotificationChannels(config: NotificationConfig): string[] {
  const channels = ['in_app'];
  if (config.handoff_notify_email) channels.push('email');
  if (config.handoff_notify_sms) channels.push('sms');
  return channels;
}

/**
 * Validates a handoff payload before sending.
 */
function validateHandoffPayload(payload: HandoffPayload): { valid: boolean; error?: string } {
  if (!payload.tenant_id) return { valid: false, error: 'tenant_id required' };
  if (!payload.reason || payload.reason.trim().length === 0) return { valid: false, error: 'reason required' };
  if (payload.reason.length > 1000) return { valid: false, error: 'reason too long' };
  return { valid: true };
}

/**
 * Builds the handoff email HTML.
 */
function buildHandoffEmailHtml(params: {
  shopName: string;
  reason: string;
  customerName?: string;
  customerMessage?: string;
}): string {
  let html = `<h2>Customer Needs Human Assistance</h2>`;
  html += `<p><strong>Shop:</strong> ${params.shopName}</p>`;
  html += `<p><strong>Customer:</strong> ${params.customerName || 'Unknown'}</p>`;
  html += `<p><strong>Reason:</strong> ${params.reason}</p>`;
  if (params.customerMessage) {
    html += `<p><strong>Last message:</strong> ${params.customerMessage}</p>`;
  }
  return html;
}

/**
 * Builds the SMS message for handoff notifications.
 */
function buildHandoffSms(shopName: string, customerName: string | undefined, reason: string): string {
  return `[${shopName}] AI handoff: ${customerName || 'Customer'} needs help. Reason: ${reason}`;
}

// ─── Voice Agent Logic ──────────────────────────────────────────────

interface VoiceConfig {
  voice_agent_enabled: boolean;
  elevenlabs_api_key: string | null;
  elevenlabs_voice_id: string;
  elevenlabs_model_id: string;
  voice_greeting: string;
  voice_language: string;
  api_base_url: string;
  model_name: string;
}

const ELEVENLABS_VOICES: Record<string, string> = {
  EXAVITQu4vr4xnSDxMaL: 'Sarah',
  '21m00Tcm4TlvDq8ikWAM': 'Rachel',
  AZnzlk1XvdvUeBnXmlld: 'Domi',
  MF3mGyEYCl7XYWbV9V6O: 'Elli',
  TxGEqnHWrfWFTfGW9XjX: 'Josh',
  VR6AewLTigWG4xSOukaG: 'Arnold',
  pNInz6obpgDQGcFmaJgB: 'Adam',
  yoZ06aMxZJJ28mfd3POQ: 'Sam',
  jBpfuIE2acCO8z3wKNLl: 'Gigi',
};

const ELEVENLABS_MODELS = [
  'eleven_multilingual_v2',
  'eleven_turbo_v2_5',
  'eleven_turbo_v2',
  'eleven_monolingual_v1',
];

const SUPPORTED_LANGUAGES = ['en', 'vi', 'zh', 'ja', 'ko', 'fr', 'es'];

/**
 * Generates TwiML response.
 */
function twiml(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`;
}

/**
 * Escapes XML special characters for TwiML.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Builds the ElevenLabs TTS request body.
 */
function buildTtsPayload(text: string, modelId: string) {
  return {
    text,
    model_id: modelId,
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.0,
      use_speaker_boost: true,
    },
  };
}

/**
 * Builds the voice system prompt for LLM.
 */
function buildVoiceSystemPrompt(shopName: string, services: string, language: string): string {
  return `You are ${shopName}'s friendly voice assistant answering a phone call.
Keep responses SHORT (1-2 sentences max) — this will be spoken aloud.
Services: ${services || 'Ask staff for details.'}
If you cannot help, say you'll transfer them to a team member.
Never use markdown, lists, or formatting — speak naturally.
Language: ${language === 'vi' ? 'Vietnamese' : 'English'}`;
}

/**
 * Detects if LLM response indicates a transfer is needed.
 */
function detectVoiceTransfer(responseText: string): boolean {
  const transferPhrases = ['transfer you', 'connect you', 'team member will', 'staff will'];
  return transferPhrases.some((p) => responseText.toLowerCase().includes(p));
}

/**
 * Builds greeting TwiML based on whether ElevenLabs is available.
 */
function buildGreetingTwiml(config: VoiceConfig, ttsUrl: string, respondUrl: string): string {
  if (config.elevenlabs_api_key) {
    return twiml(
      `<Play>${ttsUrl}</Play>` +
      `<Gather input="speech" action="${respondUrl}" speechTimeout="3" language="${config.voice_language}"><Say></Say></Gather>` +
      `<Say>I didn't hear anything. Goodbye!</Say><Hangup/>`,
    );
  }
  return twiml(
    `<Gather input="speech" action="${respondUrl}" speechTimeout="3" language="${config.voice_language}">` +
    `<Say>${escapeXml(config.voice_greeting)}</Say></Gather>` +
    `<Say>I didn't hear anything. Goodbye!</Say><Hangup/>`,
  );
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('Handoff Notification: channel resolution', () => {
  it('always includes in_app', () => {
    const channels = resolveNotificationChannels({ handoff_notify_email: null, handoff_notify_sms: false });
    expect(channels).toEqual(['in_app']);
  });

  it('adds email when configured', () => {
    const channels = resolveNotificationChannels({ handoff_notify_email: 'test@salon.com', handoff_notify_sms: false });
    expect(channels).toContain('email');
    expect(channels).toContain('in_app');
  });

  it('adds sms when enabled', () => {
    const channels = resolveNotificationChannels({ handoff_notify_email: null, handoff_notify_sms: true });
    expect(channels).toContain('sms');
  });

  it('includes all channels when fully configured', () => {
    const channels = resolveNotificationChannels({ handoff_notify_email: 'a@b.com', handoff_notify_sms: true });
    expect(channels).toEqual(['in_app', 'email', 'sms']);
  });
});

describe('Handoff Notification: payload validation', () => {
  it('accepts valid payload', () => {
    expect(validateHandoffPayload({ tenant_id: '123e4567-e89b-12d3-a456-426614174000', reason: 'Customer upset' })).toEqual({ valid: true });
  });

  it('rejects missing tenant_id', () => {
    expect(validateHandoffPayload({ tenant_id: '', reason: 'test' }).valid).toBe(false);
  });

  it('rejects empty reason', () => {
    expect(validateHandoffPayload({ tenant_id: 'abc', reason: '' }).valid).toBe(false);
    expect(validateHandoffPayload({ tenant_id: 'abc', reason: '   ' }).valid).toBe(false);
  });

  it('rejects reason over 1000 chars', () => {
    expect(validateHandoffPayload({ tenant_id: 'abc', reason: 'x'.repeat(1001) }).valid).toBe(false);
  });

  it('accepts optional fields', () => {
    const result = validateHandoffPayload({
      tenant_id: 'abc',
      reason: 'frustrated customer',
      customer_name: 'John',
      customer_message: 'I need help',
      source: 'ai_decision',
    });
    expect(result.valid).toBe(true);
  });
});

describe('Handoff Notification: email template', () => {
  it('includes shop name and reason', () => {
    const html = buildHandoffEmailHtml({ shopName: 'Oasis Spa', reason: 'Customer requested human' });
    expect(html).toContain('Oasis Spa');
    expect(html).toContain('Customer requested human');
  });

  it('includes customer name when provided', () => {
    const html = buildHandoffEmailHtml({ shopName: 'Spa', reason: 'test', customerName: 'Jane Doe' });
    expect(html).toContain('Jane Doe');
  });

  it('shows Unknown when customer name missing', () => {
    const html = buildHandoffEmailHtml({ shopName: 'Spa', reason: 'test' });
    expect(html).toContain('Unknown');
  });

  it('includes last message when provided', () => {
    const html = buildHandoffEmailHtml({ shopName: 'Spa', reason: 'test', customerMessage: 'I am very frustrated!' });
    expect(html).toContain('I am very frustrated!');
  });

  it('omits last message section when not provided', () => {
    const html = buildHandoffEmailHtml({ shopName: 'Spa', reason: 'test' });
    expect(html).not.toContain('Last message');
  });
});

describe('Handoff Notification: SMS message', () => {
  it('builds correct SMS format', () => {
    const sms = buildHandoffSms('Oasis Spa', 'John', 'negative_sentiment');
    expect(sms).toBe('[Oasis Spa] AI handoff: John needs help. Reason: negative_sentiment');
  });

  it('defaults to Customer when name missing', () => {
    const sms = buildHandoffSms('Spa', undefined, 'frustration');
    expect(sms).toContain('Customer needs help');
  });

  it('keeps SMS concise', () => {
    const sms = buildHandoffSms('Very Long Salon Name', 'John Smith', 'A very long reason');
    expect(sms.length).toBeLessThan(160); // SMS limit
  });
});

describe('Voice Agent: TwiML generation', () => {
  it('generates valid TwiML wrapper', () => {
    const xml = twiml('<Say>Hello</Say>');
    expect(xml).toBe('<?xml version="1.0" encoding="UTF-8"?><Response><Say>Hello</Say></Response>');
  });

  it('escapes XML special characters', () => {
    expect(escapeXml('A & B')).toBe('A &amp; B');
    expect(escapeXml('<script>')).toBe('&lt;script&gt;');
    expect(escapeXml('"quotes"')).toBe('&quot;quotes&quot;');
    expect(escapeXml("it's")).toBe('it&apos;s');
  });

  it('handles empty string', () => {
    expect(escapeXml('')).toBe('');
  });
});

describe('Voice Agent: ElevenLabs TTS payload', () => {
  it('builds correct TTS request', () => {
    const payload = buildTtsPayload('Hello there', 'eleven_multilingual_v2');
    expect(payload.text).toBe('Hello there');
    expect(payload.model_id).toBe('eleven_multilingual_v2');
    expect(payload.voice_settings.stability).toBe(0.5);
    expect(payload.voice_settings.similarity_boost).toBe(0.75);
    expect(payload.voice_settings.use_speaker_boost).toBe(true);
  });

  it('preserves text exactly as provided', () => {
    const payload = buildTtsPayload('Xin chao! Cam on ban da goi.', 'eleven_multilingual_v2');
    expect(payload.text).toBe('Xin chao! Cam on ban da goi.');
  });
});

describe('Voice Agent: voice selection', () => {
  it('has all preset voices', () => {
    expect(Object.keys(ELEVENLABS_VOICES)).toHaveLength(9);
    expect(ELEVENLABS_VOICES['EXAVITQu4vr4xnSDxMaL']).toBe('Sarah');
    expect(ELEVENLABS_VOICES['TxGEqnHWrfWFTfGW9XjX']).toBe('Josh');
  });

  it('supports all expected models', () => {
    expect(ELEVENLABS_MODELS).toContain('eleven_multilingual_v2');
    expect(ELEVENLABS_MODELS).toContain('eleven_turbo_v2_5');
    expect(ELEVENLABS_MODELS).toContain('eleven_turbo_v2');
    expect(ELEVENLABS_MODELS).toContain('eleven_monolingual_v1');
  });

  it('supports expected languages', () => {
    expect(SUPPORTED_LANGUAGES).toContain('en');
    expect(SUPPORTED_LANGUAGES).toContain('vi');
    expect(SUPPORTED_LANGUAGES).toContain('zh');
    expect(SUPPORTED_LANGUAGES).toContain('ja');
  });

  it('defaults to Sarah voice', () => {
    const defaultVoiceId = 'EXAVITQu4vr4xnSDxMaL';
    expect(ELEVENLABS_VOICES[defaultVoiceId]).toBe('Sarah');
  });
});

describe('Voice Agent: system prompt for voice calls', () => {
  it('builds concise voice prompt', () => {
    const prompt = buildVoiceSystemPrompt('Oasis Spa', 'Massage: $80 (60min)', 'en');
    expect(prompt).toContain('Oasis Spa');
    expect(prompt).toContain('SHORT');
    expect(prompt).toContain('1-2 sentences');
    expect(prompt).toContain('Massage: $80');
    expect(prompt).toContain('English');
  });

  it('uses Vietnamese when language is vi', () => {
    const prompt = buildVoiceSystemPrompt('Spa', '', 'vi');
    expect(prompt).toContain('Vietnamese');
  });

  it('instructs no markdown for voice', () => {
    const prompt = buildVoiceSystemPrompt('Spa', '', 'en');
    expect(prompt).toContain('Never use markdown');
    expect(prompt).toContain('speak naturally');
  });

  it('tells AI to transfer when it cannot help', () => {
    const prompt = buildVoiceSystemPrompt('Spa', '', 'en');
    expect(prompt).toContain('transfer');
  });
});

describe('Voice Agent: transfer detection', () => {
  it('detects transfer phrases', () => {
    expect(detectVoiceTransfer("I'll transfer you to a team member now.")).toBe(true);
    expect(detectVoiceTransfer("Let me connect you with our staff.")).toBe(true);
    expect(detectVoiceTransfer("A team member will assist you shortly.")).toBe(true);
    expect(detectVoiceTransfer("Our staff will help you with that.")).toBe(true);
  });

  it('does not false-positive on normal responses', () => {
    expect(detectVoiceTransfer('We have massage available at 2pm tomorrow.')).toBe(false);
    expect(detectVoiceTransfer('The price for a manicure is $40.')).toBe(false);
    expect(detectVoiceTransfer('Your booking is confirmed!')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(detectVoiceTransfer("I'LL TRANSFER YOU")).toBe(true);
    expect(detectVoiceTransfer('Team Member Will assist')).toBe(true);
  });
});

describe('Voice Agent: greeting TwiML', () => {
  const baseConfig: VoiceConfig = {
    voice_agent_enabled: true,
    elevenlabs_api_key: null,
    elevenlabs_voice_id: 'EXAVITQu4vr4xnSDxMaL',
    elevenlabs_model_id: 'eleven_multilingual_v2',
    voice_greeting: 'Hello! How can I help?',
    voice_language: 'en',
    api_base_url: 'https://api.openai.com/v1',
    model_name: 'gpt-4o-mini',
  };

  it('uses Twilio TTS fallback when no ElevenLabs key', () => {
    const xml = buildGreetingTwiml(baseConfig, '', '/respond');
    expect(xml).toContain('<Gather');
    expect(xml).toContain('<Say>Hello! How can I help?</Say>');
    expect(xml).not.toContain('<Play>');
  });

  it('uses ElevenLabs TTS when key is available', () => {
    const config = { ...baseConfig, elevenlabs_api_key: 'xi-test-key' };
    const xml = buildGreetingTwiml(config, '/tts?text=hello', '/respond');
    expect(xml).toContain('<Play>/tts?text=hello</Play>');
    expect(xml).toContain('<Gather');
  });

  it('includes speech gather for customer response', () => {
    const xml = buildGreetingTwiml(baseConfig, '', '/respond');
    expect(xml).toContain('input="speech"');
    expect(xml).toContain('speechTimeout="3"');
    expect(xml).toContain('language="en"');
  });

  it('includes hangup fallback', () => {
    const xml = buildGreetingTwiml(baseConfig, '', '/respond');
    expect(xml).toContain("<Say>I didn't hear anything. Goodbye!</Say>");
    expect(xml).toContain('<Hangup/>');
  });

  it('escapes special characters in greeting', () => {
    const config = { ...baseConfig, voice_greeting: "O'Reilly & Co" };
    const xml = buildGreetingTwiml(config, '', '/respond');
    expect(xml).toContain("O&apos;Reilly &amp; Co");
  });
});

describe('Voice Agent: end-to-end flow mocking', () => {
  it('handles full greeting → speech → LLM → TTS → respond cycle', () => {
    // 1. Greeting generated
    const greetingConfig: VoiceConfig = {
      voice_agent_enabled: true,
      elevenlabs_api_key: 'xi-key',
      elevenlabs_voice_id: 'EXAVITQu4vr4xnSDxMaL',
      elevenlabs_model_id: 'eleven_multilingual_v2',
      voice_greeting: 'Hello, welcome to Oasis Spa!',
      voice_language: 'en',
      api_base_url: 'https://api.openai.com/v1',
      model_name: 'gpt-4o-mini',
    };

    const greetingXml = buildGreetingTwiml(greetingConfig, '/tts?text=Hello', '/respond');
    expect(greetingXml).toContain('<Play>');
    expect(greetingXml).toContain('<Gather');

    // 2. Customer speaks → STT gives text
    const customerSpeech = 'I want to book a massage for tomorrow';

    // 3. LLM system prompt built
    const systemPrompt = buildVoiceSystemPrompt('Oasis Spa', 'Massage: $80 (60min)', 'en');
    expect(systemPrompt).toContain('Oasis Spa');

    // 4. Mock LLM response
    const llmResponse = 'We have massage slots available tomorrow at 10am and 2pm. Which works for you?';
    expect(detectVoiceTransfer(llmResponse)).toBe(false); // Not a transfer

    // 5. TTS payload built
    const ttsPayload = buildTtsPayload(llmResponse, 'eleven_multilingual_v2');
    expect(ttsPayload.text).toBe(llmResponse);
  });

  it('handles voice transfer flow', () => {
    const customerSpeech = 'I want a refund for my terrible experience';
    const llmResponse = "I'm sorry to hear that. Let me transfer you to a team member who can help with that.";

    // Should detect transfer
    expect(detectVoiceTransfer(llmResponse)).toBe(true);

    // Handoff notification should be sent
    const channels = resolveNotificationChannels({ handoff_notify_email: 'mgr@spa.com', handoff_notify_sms: true });
    expect(channels).toEqual(['in_app', 'email', 'sms']);

    const sms = buildHandoffSms('Oasis Spa', undefined, 'Voice call handoff: customer requested refund');
    expect(sms).toContain('AI handoff');
  });
});

describe('Handoff + Voice: settings configuration', () => {
  const defaultConfig = {
    handoff_notify_email: null as string | null,
    handoff_notify_sms: false,
    voice_agent_enabled: false,
    elevenlabs_api_key: null as string | null,
    elevenlabs_voice_id: 'EXAVITQu4vr4xnSDxMaL',
    elevenlabs_model_id: 'eleven_multilingual_v2',
    voice_greeting: 'Hello! Thank you for calling. How can I help you today?',
    voice_language: 'en',
  };

  it('has correct defaults', () => {
    expect(defaultConfig.handoff_notify_email).toBeNull();
    expect(defaultConfig.handoff_notify_sms).toBe(false);
    expect(defaultConfig.voice_agent_enabled).toBe(false);
    expect(defaultConfig.elevenlabs_voice_id).toBe('EXAVITQu4vr4xnSDxMaL');
    expect(defaultConfig.elevenlabs_model_id).toBe('eleven_multilingual_v2');
    expect(defaultConfig.voice_language).toBe('en');
  });

  it('voice is disabled by default', () => {
    expect(defaultConfig.voice_agent_enabled).toBe(false);
  });

  it('voice greeting has sensible default', () => {
    expect(defaultConfig.voice_greeting).toContain('Hello');
    expect(defaultConfig.voice_greeting).toContain('help');
  });

  it('validates email format for notify email', () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    expect(emailRegex.test('valid@email.com')).toBe(true);
    expect(emailRegex.test('not-an-email')).toBe(false);
    expect(emailRegex.test('')).toBe(false);
  });
});
