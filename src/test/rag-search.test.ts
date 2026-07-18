import { describe, it, expect } from 'vitest';

/**
 * Tests for RAG (Retrieval-Augmented Generation) logic:
 * - Text chunking
 * - System prompt building
 * - Knowledge base search result formatting
 */

// ─── Text chunking (mirrors ai-embed-text logic) ────────────────────

function chunkText(text: string, maxTokens: number, overlapTokens: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const wordsPerChunk = Math.floor(maxTokens * 0.75);
  const overlapWords = Math.floor(overlapTokens * 0.75);

  if (words.length <= wordsPerChunk) {
    return [text.trim()];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + wordsPerChunk, words.length);
    chunks.push(words.slice(start, end).join(' '));
    start = end - overlapWords;
    if (start >= words.length - overlapWords) break;
  }

  if (start < words.length && start > 0) {
    const tail = words.slice(start).join(' ');
    if (tail !== chunks[chunks.length - 1]) {
      chunks.push(tail);
    }
  }

  return chunks;
}

// ─── System prompt builder ──────────────────────────────────────────

interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
}

interface WeeklyHour {
  day_of_week: number;
  is_working: boolean;
  start_minute: number;
  end_minute: number;
}

interface Therapist {
  id: string;
  name: string;
  therapist_weekly_hours: WeeklyHour[];
}

function formatMinutesHHMM(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

function describeWeeklyHours(therapist: Therapist): string {
  const dayNames = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const working = therapist.therapist_weekly_hours.filter((r) => r.is_working);
  if (working.length === 0) return 'no working days set';
  return working
    .sort((a, b) => a.day_of_week - b.day_of_week)
    .map((r) => `${dayNames[r.day_of_week]} ${formatMinutesHHMM(r.start_minute)}-${formatMinutesHHMM(r.end_minute)}`)
    .join(', ');
}

function buildSystemPrompt(
  shopName: string,
  services: Service[],
  therapists: Therapist[],
  ragContext: string,
  customOverride: string | null,
): string {
  const servicesList = services
    .map((s) => `- ${s.name}: $${s.price} (${s.duration_minutes} min) [id: ${s.id}]`)
    .join('\n');

  const therapistsList = therapists
    .map((t) => `- ${t.name} (${describeWeeklyHours(t)}) [id: ${t.id}]`)
    .join('\n');

  const base = customOverride || `You are ${shopName}'s friendly AI booking assistant.`;

  return `${base}\n\nAVAILABLE SERVICES:\n${servicesList || 'No services configured yet.'}\n\nAVAILABLE THERAPISTS/STAFF:\n${therapistsList || 'No therapists configured yet.'}\n\n${ragContext ? `ADDITIONAL BUSINESS INFO:\n${ragContext}\n` : ''}`;
}

// ─── RAG result formatting ──────────────────────────────────────────

function formatRAGResults(results: Array<{ title: string; chunk_text: string; similarity: number }>): string {
  return results
    .map((r) => `[${r.title}]: ${r.chunk_text}`)
    .join('\n\n');
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('RAG: Text Chunking', () => {
  it('returns single chunk for short text', () => {
    const text = 'We are open Monday to Saturday from 9am to 6pm.';
    const chunks = chunkText(text, 500, 50);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(text);
  });

  it('splits long text into multiple chunks', () => {
    const words = Array.from({ length: 1000 }, (_, i) => `word${i}`);
    const text = words.join(' ');
    const chunks = chunkText(text, 500, 50);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('chunks have overlap', () => {
    const words = Array.from({ length: 1000 }, (_, i) => `word${i}`);
    const text = words.join(' ');
    const chunks = chunkText(text, 100, 20);

    // Check that adjacent chunks share some words
    if (chunks.length >= 2) {
      const chunk1Words = chunks[0].split(' ');
      const chunk2Words = chunks[1].split(' ');
      const lastWordsOfChunk1 = chunk1Words.slice(-10);
      const firstWordsOfChunk2 = chunk2Words.slice(0, 20);

      const overlap = lastWordsOfChunk1.filter((w) => firstWordsOfChunk2.includes(w));
      expect(overlap.length).toBeGreaterThan(0);
    }
  });

  it('handles empty text', () => {
    const chunks = chunkText('', 500, 50);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe('');
  });

  it('handles text with multiple whitespace', () => {
    const text = 'word1   word2\n\nword3\tword4';
    const chunks = chunkText(text, 500, 50);
    expect(chunks).toHaveLength(1);
    // Short text returns as-is (single chunk = original trimmed)
    expect(chunks[0]).toBe(text);
  });
});

describe('RAG: System Prompt Building', () => {
  const services: Service[] = [
    { id: 's1', name: 'Gel Manicure', price: 55, duration_minutes: 60 },
    { id: 's2', name: 'Pedicure', price: 45, duration_minutes: 45 },
  ];

  const therapists: Therapist[] = [
    {
      id: 't1', name: 'Lisa',
      therapist_weekly_hours: [1, 2, 3, 4, 5].map((day) => ({ day_of_week: day, is_working: true, start_minute: 540, end_minute: 1020 })),
    },
  ];

  it('includes shop name in default prompt', () => {
    const prompt = buildSystemPrompt('Oasis Nails', services, therapists, '', null);
    expect(prompt).toContain("Oasis Nails's friendly AI booking assistant");
  });

  it('lists services with prices and durations', () => {
    const prompt = buildSystemPrompt('Salon', services, therapists, '', null);
    expect(prompt).toContain('Gel Manicure: $55 (60 min)');
    expect(prompt).toContain('Pedicure: $45 (45 min)');
  });

  it('includes service IDs for tool calls', () => {
    const prompt = buildSystemPrompt('Salon', services, therapists, '', null);
    expect(prompt).toContain('[id: s1]');
    expect(prompt).toContain('[id: s2]');
  });

  it('lists therapists with schedule', () => {
    const prompt = buildSystemPrompt('Salon', services, therapists, '', null);
    expect(prompt).toContain('Lisa (Mon 09:00-17:00, Tue 09:00-17:00, Wed 09:00-17:00, Thu 09:00-17:00, Fri 09:00-17:00)');
  });

  it('includes RAG context when available', () => {
    const ragContext = '[Opening Hours]: We are open Monday to Saturday 9am-6pm.';
    const prompt = buildSystemPrompt('Salon', services, therapists, ragContext, null);
    expect(prompt).toContain('ADDITIONAL BUSINESS INFO');
    expect(prompt).toContain('We are open Monday to Saturday');
  });

  it('omits RAG section when empty', () => {
    const prompt = buildSystemPrompt('Salon', services, therapists, '', null);
    expect(prompt).not.toContain('ADDITIONAL BUSINESS INFO');
  });

  it('uses custom override when provided', () => {
    const custom = 'You are a luxury spa concierge named Aria.';
    const prompt = buildSystemPrompt('Salon', services, therapists, '', custom);
    expect(prompt).toContain('luxury spa concierge named Aria');
    expect(prompt).not.toContain("Salon's friendly");
  });

  it('handles empty services and therapists', () => {
    const prompt = buildSystemPrompt('Salon', [], [], '', null);
    expect(prompt).toContain('No services configured yet.');
    expect(prompt).toContain('No therapists configured yet.');
  });
});

describe('RAG: Result Formatting', () => {
  it('formats multiple results', () => {
    const results = [
      { title: 'Opening Hours', chunk_text: 'Mon-Sat 9am-6pm', similarity: 0.92 },
      { title: 'Parking', chunk_text: 'Free parking behind the building', similarity: 0.85 },
    ];
    const formatted = formatRAGResults(results);
    expect(formatted).toContain('[Opening Hours]: Mon-Sat 9am-6pm');
    expect(formatted).toContain('[Parking]: Free parking behind the building');
  });

  it('handles empty results', () => {
    expect(formatRAGResults([])).toBe('');
  });
});
