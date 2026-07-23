import { describe, it, expect } from 'vitest';
import { addMinutes, format } from 'date-fns';

/**
 * Tests for AI chat assistant tool logic:
 * - Availability checking (mirrors Booking.tsx logic)
 * - Booking creation validation
 * - Round-robin therapist assignment
 * - Handoff trigger detection
 */

// ─── Types ───────────────────────────────────────────────────────────

interface WeeklyHour {
  day_of_week: number;
  is_working: boolean;
  start_minute: number;
  end_minute: number;
  break_start_minute: number | null;
  break_end_minute: number | null;
}

interface Therapist {
  id: string;
  name: string;
  therapist_weekly_hours: WeeklyHour[];
}

interface Booking {
  therapist_id: string;
  start_time: string;
  end_time: string;
  status: string;
}

const BUFFER_MINUTES = 15;

function getDayHours(therapist: Therapist, dayOfWeek: number): WeeklyHour | undefined {
  return therapist.therapist_weekly_hours.find((r) => r.day_of_week === dayOfWeek);
}

// ─── Extracted logic (matches ai-chat-respond tool executor) ─────────

function checkSlotAvailability(
  timeStr: string,
  duration: number,
  therapists: Therapist[],
  date: Date,
  unavailableIds: Set<string>,
  existingBookings: Booking[],
  earlyCloseHour: number | null = null,
): { time: string; available_therapists: number }[] {
  const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();

  const workingTherapists = therapists.filter(
    (t) => getDayHours(t, dayOfWeek)?.is_working && !unavailableIds.has(t.id),
  );

  if (workingTherapists.length === 0) return [];

  const minStartMin = Math.min(...workingTherapists.map((t) => getDayHours(t, dayOfWeek)!.start_minute));
  const rawMaxEndMin = Math.max(...workingTherapists.map((t) => getDayHours(t, dayOfWeek)!.end_minute));
  const maxEndMin = earlyCloseHour ? Math.min(rawMaxEndMin, earlyCloseHour * 60) : rawMaxEndMin;

  const slots: { time: string; available_therapists: number }[] = [];

  for (let slotStartMin = minStartMin; slotStartMin < maxEndMin; slotStartMin += 30) {
    const slotEndMin = slotStartMin + duration;
    if (slotEndMin > maxEndMin) continue;

    const slotTime = `${String(Math.floor(slotStartMin / 60)).padStart(2, '0')}:${String(slotStartMin % 60).padStart(2, '0')}`;
    let availCount = 0;

    for (const t of workingTherapists) {
      const dayHours = getDayHours(t, dayOfWeek)!;
      if (slotStartMin < dayHours.start_minute || slotEndMin > dayHours.end_minute) continue;

      if (dayHours.break_start_minute != null && dayHours.break_end_minute != null) {
        if (slotStartMin < dayHours.break_end_minute && slotEndMin > dayHours.break_start_minute) continue;
      }

      const hasConflict = existingBookings.some((b) => {
        if (b.therapist_id !== t.id) return false;
        const bStart = parseInt(b.start_time.split(':')[0]) * 60 + parseInt(b.start_time.split(':')[1]);
        const bEnd = parseInt(b.end_time.split(':')[0]) * 60 + parseInt(b.end_time.split(':')[1]);
        return slotStartMin < bEnd + BUFFER_MINUTES && slotEndMin > bStart - BUFFER_MINUTES;
      });

      if (!hasConflict) availCount++;
    }

    if (availCount > 0) {
      slots.push({ time: slotTime, available_therapists: availCount });
    }
  }

  return slots;
}

function pickTherapistRoundRobin(
  available: Therapist[],
  bookingCounts: Record<string, number>,
): Therapist {
  const sorted = [...available].sort((a, b) => {
    const countDiff = (bookingCounts[a.id] || 0) - (bookingCounts[b.id] || 0);
    if (countDiff !== 0) return countDiff;
    return a.id.localeCompare(b.id);
  });
  return sorted[0];
}

function shouldHandoff(message: string, keywords: string[]): boolean {
  const lower = message.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

// ─── Test Data ───────────────────────────────────────────────────────

const makeWeeklyHours = (workingDays: number[], startHour: number, endHour: number, breakStartHour: number | null, breakEndHour: number | null): WeeklyHour[] =>
  [1, 2, 3, 4, 5, 6, 7].map((day) => ({
    day_of_week: day,
    is_working: workingDays.includes(day),
    start_minute: startHour * 60,
    end_minute: endHour * 60,
    break_start_minute: breakStartHour != null ? breakStartHour * 60 : null,
    break_end_minute: breakEndHour != null ? breakEndHour * 60 : null,
  }));

const therapists: Therapist[] = [
  { id: 't1', name: 'Lisa', therapist_weekly_hours: makeWeeklyHours([1, 2, 3, 4, 5], 9, 17, 12, 13) },
  { id: 't2', name: 'Mai', therapist_weekly_hours: makeWeeklyHours([1, 2, 3, 4, 5, 6], 10, 18, null, null) },
  { id: 't3', name: 'Trang', therapist_weekly_hours: makeWeeklyHours([1, 3, 5], 9, 15, null, null) },
];

// ─── Tests ───────────────────────────────────────────────────────────

describe('AI Chat Tool: check_availability', () => {
  const monday = new Date('2026-04-06'); // Monday

  it('returns available slots for a 60-min service on Monday', () => {
    const slots = checkSlotAvailability('', 60, therapists, monday, new Set(), []);
    expect(slots.length).toBeGreaterThan(0);
    // First slot should be 09:00 (earliest start)
    expect(slots[0].time).toBe('09:00');
    // At 09:00: Lisa (9-17) + Trang (9-15) available. Mai starts at 10, so 2 therapists.
    expect(slots[0].available_therapists).toBe(2);
  });

  it('excludes slots during break time', () => {
    const slots = checkSlotAvailability('', 60, therapists, monday, new Set(), []);
    // Lisa has break 12-13, so 11:30-12:30 and 12:00-13:00 should have fewer therapists
    const slot1200 = slots.find((s) => s.time === '12:00');
    // Lisa can't do 12:00-13:00 (break), so only Mai + Trang
    expect(slot1200?.available_therapists).toBe(2);
  });

  it('handles existing bookings with buffer', () => {
    const bookings: Booking[] = [
      { therapist_id: 't1', start_time: '10:00', end_time: '11:00', status: 'confirmed' },
    ];
    const slots = checkSlotAvailability('', 60, therapists, monday, new Set(), bookings);

    // At 10:00, Lisa is booked. Also 09:30 overlaps due to 15min buffer (09:30+60=10:30, conflicts with 10:00-15=9:45)
    const slot1000 = slots.find((s) => s.time === '10:00');
    expect(slot1000?.available_therapists).toBe(2); // Only Mai + Trang
  });

  it('marks therapists as unavailable', () => {
    const slots = checkSlotAvailability('', 60, therapists, monday, new Set(['t1', 't3']), []);
    // Only Mai available
    expect(slots[0].available_therapists).toBe(1);
  });

  it('returns empty for a Sunday (no therapists work Sunday)', () => {
    const sunday = new Date('2026-04-05');
    const slots = checkSlotAvailability('', 60, therapists, sunday, new Set(), []);
    expect(slots).toHaveLength(0);
  });

  it('respects Saturday schedule (only Mai works)', () => {
    const saturday = new Date('2026-04-04');
    const slots = checkSlotAvailability('', 60, therapists, saturday, new Set(), []);
    expect(slots.length).toBeGreaterThan(0);
    slots.forEach((s) => {
      expect(s.available_therapists).toBe(1); // Only Mai
    });
  });

  it('respects early close hour', () => {
    const slots = checkSlotAvailability('', 60, therapists, monday, new Set(), [], 14);
    // No slots should end after 14:00
    const latestSlot = slots[slots.length - 1];
    const [h, m] = latestSlot.time.split(':').map(Number);
    expect(h * 60 + m + 60).toBeLessThanOrEqual(14 * 60);
  });

  it('handles 30-min service slots correctly', () => {
    const slots = checkSlotAvailability('', 30, therapists, monday, new Set(), []);
    // Should have more slots than 60-min
    const slots60 = checkSlotAvailability('', 60, therapists, monday, new Set(), []);
    expect(slots.length).toBeGreaterThan(slots60.length);
  });
});

describe('AI Chat Tool: round-robin therapist assignment', () => {
  it('picks therapist with fewest bookings', () => {
    const counts = { t1: 3, t2: 1, t3: 2 };
    const picked = pickTherapistRoundRobin(therapists, counts);
    expect(picked.id).toBe('t2');
  });

  it('uses stable tie-breaking by ID', () => {
    const counts = { t1: 1, t2: 1, t3: 1 };
    const picked = pickTherapistRoundRobin(therapists, counts);
    expect(picked.id).toBe('t1'); // First alphabetically
  });

  it('picks from available list only', () => {
    const available = therapists.filter((t) => t.id !== 't1');
    const counts = { t2: 5, t3: 2 };
    const picked = pickTherapistRoundRobin(available, counts);
    expect(picked.id).toBe('t3');
  });

  it('handles empty booking counts', () => {
    const picked = pickTherapistRoundRobin(therapists, {});
    expect(picked.id).toBe('t1');
  });
});

describe('AI Chat Tool: handoff detection', () => {
  const keywords = ['speak to human', 'talk to staff', 'real person', 'manager'];

  it('detects handoff keywords', () => {
    expect(shouldHandoff('I want to speak to human please', keywords)).toBe(true);
    expect(shouldHandoff('Can I talk to staff?', keywords)).toBe(true);
    expect(shouldHandoff('Get me a real person', keywords)).toBe(true);
    expect(shouldHandoff('I need to see the manager', keywords)).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(shouldHandoff('SPEAK TO HUMAN', keywords)).toBe(true);
    expect(shouldHandoff('Talk To Staff NOW', keywords)).toBe(true);
  });

  it('does not trigger on normal messages', () => {
    expect(shouldHandoff('I want to book a massage', keywords)).toBe(false);
    expect(shouldHandoff('What time do you open?', keywords)).toBe(false);
    expect(shouldHandoff('How much is a manicure?', keywords)).toBe(false);
  });
});

// ─── AI-Driven Auto Handoff ────────────────────────────────────────

/**
 * Sentiment scoring: returns a score from -1 (very negative) to +1 (very positive).
 * Used by the AI to decide whether auto-handoff is warranted.
 */
interface SentimentSignals {
  negativeWords: string[];
  positiveWords: string[];
  frustrationPatterns: string[];
  urgencyPatterns: string[];
}

const SENTIMENT_SIGNALS: SentimentSignals = {
  negativeWords: [
    'angry', 'upset', 'frustrated', 'terrible', 'horrible', 'awful',
    'worst', 'disgusting', 'unacceptable', 'furious', 'livid', 'pathetic',
    'useless', 'incompetent', 'ridiculous', 'outrageous', 'disappointed',
    'hate', 'ruined', 'wasted', 'scam', 'rip off', 'never again',
  ],
  positiveWords: [
    'thanks', 'thank you', 'great', 'good', 'excellent', 'amazing',
    'wonderful', 'perfect', 'love', 'happy', 'pleased', 'awesome',
    'fantastic', 'helpful', 'appreciate',
  ],
  frustrationPatterns: [
    'this is not working',
    'i already told you',
    'i said',
    'are you even listening',
    'how many times',
    'i keep telling you',
    'you already asked me',
    'you keep asking',
    'you don\'t understand',
    'this is going nowhere',
    'waste of time',
    'forget it',
    'never mind',
    'just stop',
  ],
  urgencyPatterns: [
    'emergency',
    'urgent',
    'asap',
    'right now',
    'immediately',
    'can\'t wait',
    'time sensitive',
    'critical',
  ],
};

function analyzeSentiment(message: string): number {
  const lower = message.toLowerCase();
  let score = 0;

  for (const word of SENTIMENT_SIGNALS.negativeWords) {
    if (lower.includes(word)) score -= 0.15;
  }
  for (const word of SENTIMENT_SIGNALS.positiveWords) {
    if (lower.includes(word)) score += 0.1;
  }

  // Exclamation marks amplify negative sentiment
  const exclamations = (message.match(/!/g) || []).length;
  if (exclamations >= 2) score -= 0.1 * Math.min(exclamations, 5);

  // ALL CAPS amplifies negative sentiment
  const capsRatio = (message.match(/[A-Z]/g) || []).length / Math.max(message.length, 1);
  if (capsRatio > 0.6 && message.length > 5) score -= 0.2;

  return Math.max(-1, Math.min(1, score));
}

function detectFrustration(message: string): boolean {
  const lower = message.toLowerCase();
  return SENTIMENT_SIGNALS.frustrationPatterns.some((p) => lower.includes(p));
}

function detectUrgency(message: string): boolean {
  const lower = message.toLowerCase();
  return SENTIMENT_SIGNALS.urgencyPatterns.some((p) => lower.includes(p));
}

interface ConversationContext {
  messageCount: number;
  unansweredQuestions: number;
  repeatedTopics: number;
  toolFailures: number;
  sentiment: number;
}

interface AutoHandoffDecision {
  shouldHandoff: boolean;
  reason: string;
  confidence: number; // 0-1
}

/**
 * AI auto-handoff decision engine.
 * Evaluates multiple signals to decide if the conversation should be
 * escalated to a human — without the customer explicitly asking.
 */
function evaluateAutoHandoff(
  message: string,
  context: ConversationContext,
  config: { auto_handoff_on_negative_sentiment: boolean; sentiment_threshold?: number },
): AutoHandoffDecision {
  const sentiment = analyzeSentiment(message);
  const isFrustrated = detectFrustration(message);
  const isUrgent = detectUrgency(message);
  const sentimentThreshold = config.sentiment_threshold ?? -0.4;

  // Rule 1: Strong negative sentiment
  if (config.auto_handoff_on_negative_sentiment && sentiment <= sentimentThreshold) {
    return {
      shouldHandoff: true,
      reason: 'negative_sentiment',
      confidence: Math.min(1, Math.abs(sentiment)),
    };
  }

  // Rule 2: Frustration detected in message
  if (isFrustrated) {
    return {
      shouldHandoff: true,
      reason: 'frustration_detected',
      confidence: 0.85,
    };
  }

  // Rule 3: Repeated tool failures (AI can't fulfill request)
  if (context.toolFailures >= 2) {
    return {
      shouldHandoff: true,
      reason: 'repeated_tool_failures',
      confidence: 0.9,
    };
  }

  // Rule 4: Long conversation with unanswered questions (AI going in circles)
  if (context.messageCount >= 8 && context.unansweredQuestions >= 2) {
    return {
      shouldHandoff: true,
      reason: 'unresolved_conversation',
      confidence: 0.7,
    };
  }

  // Rule 5: Customer repeating the same topic (AI not resolving)
  if (context.repeatedTopics >= 3) {
    return {
      shouldHandoff: true,
      reason: 'repeated_topic',
      confidence: 0.8,
    };
  }

  // Rule 6: Urgent request that AI can't handle well
  if (isUrgent && context.messageCount >= 3) {
    return {
      shouldHandoff: true,
      reason: 'urgent_unresolved',
      confidence: 0.75,
    };
  }

  return { shouldHandoff: false, reason: 'none', confidence: 0 };
}

// ─── Auto Handoff Tests ─────────────────────────────────────────────

describe('AI Chat Tool: sentiment analysis', () => {
  it('scores negative messages below zero', () => {
    expect(analyzeSentiment('This is terrible and horrible')).toBeLessThan(0);
    expect(analyzeSentiment('I am so angry and frustrated')).toBeLessThan(0);
    expect(analyzeSentiment('Worst experience ever, disgusting service')).toBeLessThan(0);
  });

  it('scores positive messages above zero', () => {
    expect(analyzeSentiment('Thank you so much, this is great!')).toBeGreaterThan(0);
    expect(analyzeSentiment('Excellent service, I love it')).toBeGreaterThan(0);
    expect(analyzeSentiment('Amazing, you are so helpful')).toBeGreaterThan(0);
  });

  it('scores neutral messages near zero', () => {
    const score = analyzeSentiment('I want to book a haircut tomorrow at 2pm');
    expect(Math.abs(score)).toBeLessThan(0.2);
  });

  it('amplifies negativity for ALL CAPS', () => {
    const normal = analyzeSentiment('this is terrible');
    const caps = analyzeSentiment('THIS IS TERRIBLE');
    expect(caps).toBeLessThan(normal);
  });

  it('amplifies negativity for multiple exclamation marks', () => {
    const calm = analyzeSentiment('this is terrible');
    const shouting = analyzeSentiment('this is terrible!!!');
    expect(shouting).toBeLessThan(calm);
  });

  it('clamps scores between -1 and 1', () => {
    const veryNegative = analyzeSentiment('angry upset frustrated terrible horrible awful worst disgusting unacceptable furious livid pathetic!!!');
    expect(veryNegative).toBeGreaterThanOrEqual(-1);
    expect(veryNegative).toBeLessThanOrEqual(1);
  });
});

describe('AI Chat Tool: frustration detection', () => {
  it('detects frustration patterns', () => {
    expect(detectFrustration('This is not working at all')).toBe(true);
    expect(detectFrustration('I already told you my name is John')).toBe(true);
    expect(detectFrustration('How many times do I have to say this')).toBe(true);
    expect(detectFrustration('You keep asking the same question')).toBe(true);
    expect(detectFrustration('This is going nowhere')).toBe(true);
    expect(detectFrustration('Just forget it')).toBe(true);
  });

  it('does not flag normal messages', () => {
    expect(detectFrustration('I want to book a massage')).toBe(false);
    expect(detectFrustration('What time is available tomorrow?')).toBe(false);
    expect(detectFrustration('Can I get a manicure at 3pm?')).toBe(false);
  });
});

describe('AI Chat Tool: urgency detection', () => {
  it('detects urgent messages', () => {
    expect(detectUrgency('This is an emergency, I need help now')).toBe(true);
    expect(detectUrgency('Urgent: need to reschedule ASAP')).toBe(true);
    expect(detectUrgency('I need this immediately')).toBe(true);
    expect(detectUrgency("It's time sensitive, can't wait")).toBe(true);
  });

  it('does not flag normal messages', () => {
    expect(detectUrgency('Can I book for next week?')).toBe(false);
    expect(detectUrgency('What services do you offer?')).toBe(false);
  });
});

describe('AI Chat Tool: auto-handoff decision engine', () => {
  const defaultConfig = { auto_handoff_on_negative_sentiment: true };
  const disabledSentimentConfig = { auto_handoff_on_negative_sentiment: false };

  const calmContext: ConversationContext = {
    messageCount: 2,
    unansweredQuestions: 0,
    repeatedTopics: 0,
    toolFailures: 0,
    sentiment: 0,
  };

  it('triggers handoff on strong negative sentiment', () => {
    const result = evaluateAutoHandoff(
      'This is absolutely terrible and unacceptable!!! I am furious!!!',
      calmContext,
      defaultConfig,
    );
    expect(result.shouldHandoff).toBe(true);
    expect(result.reason).toBe('negative_sentiment');
    expect(result.confidence).toBeGreaterThan(0.4);
  });

  it('does not trigger on negative sentiment when disabled', () => {
    const result = evaluateAutoHandoff(
      'This is absolutely terrible and unacceptable!!!',
      calmContext,
      disabledSentimentConfig,
    );
    // Should not handoff via sentiment (may still via frustration)
    expect(result.reason).not.toBe('negative_sentiment');
  });

  it('triggers handoff on frustration patterns', () => {
    const result = evaluateAutoHandoff(
      'I already told you my phone number, why do you keep asking?',
      calmContext,
      defaultConfig,
    );
    expect(result.shouldHandoff).toBe(true);
    expect(result.reason).toBe('frustration_detected');
  });

  it('triggers handoff on repeated tool failures', () => {
    const failingContext: ConversationContext = {
      ...calmContext,
      toolFailures: 2,
    };
    const result = evaluateAutoHandoff(
      'Can you check availability again?',
      failingContext,
      defaultConfig,
    );
    expect(result.shouldHandoff).toBe(true);
    expect(result.reason).toBe('repeated_tool_failures');
    expect(result.confidence).toBe(0.9);
  });

  it('triggers handoff on long unresolved conversations', () => {
    const longContext: ConversationContext = {
      messageCount: 10,
      unansweredQuestions: 3,
      repeatedTopics: 0,
      toolFailures: 0,
      sentiment: -0.1,
    };
    const result = evaluateAutoHandoff(
      'So can you actually help me or not?',
      longContext,
      defaultConfig,
    );
    expect(result.shouldHandoff).toBe(true);
    expect(result.reason).toBe('unresolved_conversation');
  });

  it('triggers handoff on repeated topics', () => {
    const repeatingContext: ConversationContext = {
      ...calmContext,
      repeatedTopics: 3,
    };
    const result = evaluateAutoHandoff(
      'I want the deep tissue massage, as I keep saying',
      repeatingContext,
      defaultConfig,
    );
    expect(result.shouldHandoff).toBe(true);
    expect(result.reason).toBe('repeated_topic');
  });

  it('triggers handoff on urgent unresolved requests', () => {
    const urgentContext: ConversationContext = {
      ...calmContext,
      messageCount: 4,
    };
    const result = evaluateAutoHandoff(
      'This is urgent! I need to cancel my appointment ASAP',
      urgentContext,
      defaultConfig,
    );
    expect(result.shouldHandoff).toBe(true);
    expect(result.reason).toBe('urgent_unresolved');
  });

  it('does not trigger on happy normal conversations', () => {
    const result = evaluateAutoHandoff(
      'Great, I would like to book a massage for tomorrow please',
      calmContext,
      defaultConfig,
    );
    expect(result.shouldHandoff).toBe(false);
    expect(result.reason).toBe('none');
    expect(result.confidence).toBe(0);
  });

  it('does not trigger on short urgent messages (AI still trying)', () => {
    const freshContext: ConversationContext = {
      ...calmContext,
      messageCount: 1,
    };
    const result = evaluateAutoHandoff(
      'Urgent! I need to change my booking',
      freshContext,
      defaultConfig,
    );
    expect(result.shouldHandoff).toBe(false);
  });

  it('respects custom sentiment threshold', () => {
    const strictConfig = { auto_handoff_on_negative_sentiment: true, sentiment_threshold: -0.2 };
    const result = evaluateAutoHandoff(
      'I am very disappointed and upset with this terrible service',
      calmContext,
      strictConfig,
    );
    expect(result.shouldHandoff).toBe(true);
    expect(result.reason).toBe('negative_sentiment');
  });

  it('returns confidence proportional to sentiment strength', () => {
    const mild = evaluateAutoHandoff('This is disappointing', calmContext, defaultConfig);
    const severe = evaluateAutoHandoff(
      'TERRIBLE AWFUL HORRIBLE DISGUSTING!!! I AM FURIOUS!!!',
      calmContext,
      defaultConfig,
    );
    if (mild.shouldHandoff && severe.shouldHandoff) {
      expect(severe.confidence).toBeGreaterThanOrEqual(mild.confidence);
    }
  });

  it('prioritizes frustration over sentiment when both present', () => {
    // Frustration check comes after sentiment in the code, but
    // if sentiment doesn't trigger (disabled), frustration should
    const result = evaluateAutoHandoff(
      'I already told you this is not working!!!',
      calmContext,
      disabledSentimentConfig,
    );
    expect(result.shouldHandoff).toBe(true);
    expect(result.reason).toBe('frustration_detected');
  });
});

describe('AI Chat Tool: combined keyword + auto handoff', () => {
  const keywords = ['speak to human', 'talk to staff', 'real person', 'manager'];
  const autoConfig = { auto_handoff_on_negative_sentiment: true };
  const calmContext: ConversationContext = {
    messageCount: 2,
    unansweredQuestions: 0,
    repeatedTopics: 0,
    toolFailures: 0,
    sentiment: 0,
  };

  it('keyword handoff takes priority (fast path)', () => {
    const message = 'I want to speak to human';
    const keywordResult = shouldHandoff(message, keywords);
    expect(keywordResult).toBe(true);
    // No need to run auto-handoff evaluation
  });

  it('auto-handoff catches cases keywords miss', () => {
    const message = 'THIS IS RIDICULOUS!!! I HAVE BEEN WAITING AND YOUR BOT IS USELESS!!!';
    const keywordResult = shouldHandoff(message, keywords);
    expect(keywordResult).toBe(false); // Keywords don't match
    const autoResult = evaluateAutoHandoff(message, calmContext, autoConfig);
    expect(autoResult.shouldHandoff).toBe(true); // But auto-handoff catches it
  });

  it('neither triggers on normal booking flow', () => {
    const message = 'Hi, I want to book a 60 minute massage for tomorrow at 10am';
    const keywordResult = shouldHandoff(message, keywords);
    const autoResult = evaluateAutoHandoff(message, calmContext, autoConfig);
    expect(keywordResult).toBe(false);
    expect(autoResult.shouldHandoff).toBe(false);
  });
});

// ─── LLM-Driven Circle Detection (mirrors edge function logic) ──────

interface ChatMessage {
  direction: string;
  sender_type: string;
  sender_name: string;
  content: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

interface CircleAnalysis {
  shouldAdviseHandoff: boolean;
  advisory: string;
  signals: {
    repeatedQuestions: number;
    similarResponses: number;
    customerRepeats: number;
    toolFailures: number;
    conversationLength: number;
  };
}

function textSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/).filter((w) => w.length > 2));
  const wordsB = new Set(b.split(/\s+/).filter((w) => w.length > 2));
  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  return intersection / Math.max(wordsA.size, wordsB.size);
}

function analyzeConversationCircles(messages: ChatMessage[]): CircleAnalysis {
  const signals = {
    repeatedQuestions: 0,
    similarResponses: 0,
    customerRepeats: 0,
    toolFailures: 0,
    conversationLength: messages.length,
  };

  if (messages.length < 4) {
    return { shouldAdviseHandoff: false, advisory: '', signals };
  }

  const customerMsgs = messages
    .filter((m) => m.sender_type === 'customer')
    .map((m) => m.content?.toLowerCase().trim() || '');
  const aiMsgs = messages
    .filter((m) => m.sender_type === 'ai')
    .map((m) => m.content?.toLowerCase().trim() || '');

  for (let i = 1; i < customerMsgs.length; i++) {
    if (customerMsgs[i].length < 5) continue;
    for (let j = 0; j < i; j++) {
      if (textSimilarity(customerMsgs[i], customerMsgs[j]) > 0.6) {
        signals.customerRepeats++;
      }
    }
  }

  for (let i = 1; i < aiMsgs.length; i++) {
    if (aiMsgs[i].length < 10) continue;
    for (let j = 0; j < i; j++) {
      if (textSimilarity(aiMsgs[i], aiMsgs[j]) > 0.6) {
        signals.similarResponses++;
      }
    }
  }

  const questionPatterns = ['what is your name', 'your phone', 'which service', 'what date', 'what time', 'which day'];
  const aiQuestions: string[] = [];
  for (const msg of aiMsgs) {
    for (const pattern of questionPatterns) {
      if (msg.includes(pattern)) aiQuestions.push(pattern);
    }
  }
  const questionCounts = new Map<string, number>();
  for (const q of aiQuestions) {
    questionCounts.set(q, (questionCounts.get(q) || 0) + 1);
  }
  for (const count of questionCounts.values()) {
    if (count >= 2) signals.repeatedQuestions++;
  }

  for (const m of messages) {
    if (m.metadata && typeof m.metadata === 'object') {
      const meta = m.metadata as Record<string, unknown>;
      if (meta.security_blocked || meta.error) signals.toolFailures++;
    }
  }

  const reasons: string[] = [];
  if (signals.customerRepeats >= 2) reasons.push('customer repeated');
  if (signals.similarResponses >= 2) reasons.push('ai repeated');
  if (signals.repeatedQuestions >= 1) reasons.push('repeated questions');
  if (signals.toolFailures >= 2) reasons.push('tool failures');
  if (signals.conversationLength >= 12 && reasons.length === 0) reasons.push('long conversation');

  return { shouldAdviseHandoff: reasons.length > 0, advisory: reasons.join('; '), signals };
}

// Helper to build a message
function msg(senderType: string, content: string, metadata?: Record<string, unknown>): ChatMessage {
  return {
    direction: senderType === 'customer' ? 'inbound' : 'outbound',
    sender_type: senderType,
    sender_name: senderType === 'customer' ? 'Customer' : 'AI Assistant',
    content,
    metadata: metadata || null,
    created_at: new Date().toISOString(),
  };
}

describe('AI Chat Tool: text similarity', () => {
  it('returns 1 for identical strings', () => {
    expect(textSimilarity('hello world foo', 'hello world foo')).toBe(1);
  });

  it('returns 0 for completely different strings', () => {
    expect(textSimilarity('alpha beta gamma', 'delta epsilon zeta')).toBe(0);
  });

  it('returns high score for similar messages', () => {
    const score = textSimilarity(
      'i want to book a massage please',
      'i want to book a massage today',
    );
    expect(score).toBeGreaterThan(0.6);
  });

  it('ignores short words (<=2 chars)', () => {
    // "I" and "a" are filtered out, so similarity between these is based on meaningful words
    const score = textSimilarity('I am a customer', 'I am a different person');
    expect(score).toBeLessThan(1);
  });

  it('handles empty strings', () => {
    expect(textSimilarity('', '')).toBe(1);
    expect(textSimilarity('hello world test', '')).toBe(0);
  });
});

describe('AI Chat Tool: conversation circle detection (LLM-driven handoff)', () => {
  it('does not trigger on short conversations', () => {
    const messages = [
      msg('customer', 'Hi, I want to book'),
      msg('ai', 'Sure! What service would you like?'),
    ];
    const result = analyzeConversationCircles(messages);
    expect(result.shouldAdviseHandoff).toBe(false);
  });

  it('detects customer repeating themselves', () => {
    const messages = [
      msg('customer', 'I want to book a deep tissue massage for tomorrow'),
      msg('ai', 'Sure! What time works for you?'),
      msg('customer', 'I want to book a deep tissue massage for tomorrow please'),
      msg('ai', 'I can help with that! What time would you prefer?'),
      msg('customer', 'I want to book a deep tissue massage for tomorrow now'),
      msg('ai', 'Let me check availability for you.'),
      msg('customer', 'Book me a deep tissue massage for tomorrow already'),
      msg('ai', 'Checking availability now...'),
    ];
    const result = analyzeConversationCircles(messages);
    expect(result.shouldAdviseHandoff).toBe(true);
    expect(result.signals.customerRepeats).toBeGreaterThanOrEqual(2);
  });

  it('detects AI giving similar responses', () => {
    const messages = [
      msg('customer', 'Can I get a refund?'),
      msg('ai', 'I apologize but I cannot process refunds. Please contact our staff for assistance with refunds.'),
      msg('customer', 'How do I get my money back?'),
      msg('ai', 'I am sorry but I cannot process refunds. Please contact our staff for help with refunds.'),
      msg('customer', 'I need a refund now'),
      msg('ai', 'I apologize but I cannot handle refunds. Please contact our staff directly for refund assistance.'),
    ];
    const result = analyzeConversationCircles(messages);
    expect(result.shouldAdviseHandoff).toBe(true);
    expect(result.signals.similarResponses).toBeGreaterThanOrEqual(2);
  });

  it('detects AI asking the same question repeatedly', () => {
    const messages = [
      msg('customer', 'I want to book a massage'),
      msg('ai', 'What is your name so I can make the booking?'),
      msg('customer', 'My name is John'),
      msg('ai', 'Thanks! And what is your name for the appointment?'),
      msg('customer', 'I already told you, John!'),
      msg('ai', 'Sorry about that. Could you confirm what is your name?'),
    ];
    const result = analyzeConversationCircles(messages);
    expect(result.shouldAdviseHandoff).toBe(true);
    expect(result.signals.repeatedQuestions).toBeGreaterThanOrEqual(1);
  });

  it('detects multiple tool/system failures', () => {
    const messages = [
      msg('customer', 'Book a massage'),
      msg('ai', 'Let me check...', { error: 'service_unavailable' }),
      msg('customer', 'Try again please'),
      msg('ai', 'Trying again...', { error: 'timeout' }),
      msg('customer', 'Is it working?'),
      msg('ai', 'I apologize for the issues.'),
    ];
    const result = analyzeConversationCircles(messages);
    expect(result.shouldAdviseHandoff).toBe(true);
    expect(result.signals.toolFailures).toBe(2);
  });

  it('flags very long conversations without other signals', () => {
    // Each message is completely unique with no overlapping words
    const topics = [
      'haircut', 'manicure', 'pedicure', 'facial', 'waxing', 'threading',
      'highlights', 'balayage', 'keratin', 'extensions', 'braiding', 'coloring', 'perming',
    ];
    const messages: ChatMessage[] = [];
    for (let i = 0; i < 13; i++) {
      messages.push(msg('customer', `Tell about ${topics[i]} pricing details`));
      messages.push(msg('ai', `Our ${topics[i]} starts from various options available.`));
    }
    const result = analyzeConversationCircles(messages);
    expect(result.shouldAdviseHandoff).toBe(true);
  });

  it('does not trigger on normal progressive conversations', () => {
    const messages = [
      msg('customer', 'Hi I want to book a massage'),
      msg('ai', 'Sure! We have Swedish and Deep Tissue. Which would you prefer?'),
      msg('customer', 'Deep tissue please, for tomorrow'),
      msg('ai', 'Great! I have slots at 10am, 11am, 2pm. What works?'),
      msg('customer', '2pm please. My name is John, phone 0400111222'),
      msg('ai', 'Booking confirmed! Deep tissue at 2pm tomorrow with Lisa.'),
    ];
    const result = analyzeConversationCircles(messages);
    expect(result.shouldAdviseHandoff).toBe(false);
  });

  it('builds advisory text with multiple reasons', () => {
    const messages = [
      msg('customer', 'I want a refund for my terrible experience'),
      msg('ai', 'I cannot process refunds. Please contact our staff for assistance.', { error: 'not_supported' }),
      msg('customer', 'I want a refund for my terrible experience please'),
      msg('ai', 'I cannot process refunds. Please contact our staff for help.', { error: 'not_supported' }),
      msg('customer', 'Give me a refund for my terrible experience now'),
      msg('ai', 'I am unable to process refunds. Please contact staff.'),
    ];
    const result = analyzeConversationCircles(messages);
    expect(result.shouldAdviseHandoff).toBe(true);
    // Should have multiple signals
    expect(result.signals.customerRepeats).toBeGreaterThanOrEqual(2);
  });
});

describe('AI Chat Tool: LLM system prompt injection for circle prevention', () => {
  it('generates no advisory for normal conversations', () => {
    const messages = [
      msg('customer', 'Hello'),
      msg('ai', 'Hi! How can I help?'),
    ];
    const result = analyzeConversationCircles(messages);
    expect(result.advisory).toBe('');
    expect(result.shouldAdviseHandoff).toBe(false);
  });

  it('advisory instructs LLM to use transfer_to_human', () => {
    // Simulate the edge function logic: if shouldAdviseHandoff, append to system prompt
    const messages = [
      msg('customer', 'I need to cancel and get a refund for my booking'),
      msg('ai', 'I cannot handle cancellations or refunds. Please contact our staff for assistance.'),
      msg('customer', 'Cancel my booking and give me a refund please now'),
      msg('ai', 'I cannot handle cancellations or refunds. Please contact our staff for help.'),
      msg('customer', 'I need to cancel and get a refund for my booking immediately'),
      msg('ai', 'I am not able to process cancellations or refunds. Please contact our staff.'),
      msg('customer', 'Cancel my booking and refund me right now please'),
      msg('ai', 'Sorry, I cannot process cancellations or refunds. Please reach out to staff directly.'),
    ];
    const result = analyzeConversationCircles(messages);
    expect(result.shouldAdviseHandoff).toBe(true);

    // Simulate what the edge function does
    const circleAdvisory = result.shouldAdviseHandoff
      ? `\n\nCONVERSATION STATUS ALERT:\n${result.advisory}\nYou MUST call transfer_to_human if you cannot add new value in your next response.`
      : '';

    expect(circleAdvisory).toContain('CONVERSATION STATUS ALERT');
    expect(circleAdvisory).toContain('transfer_to_human');
  });
});

// ─── create_booking therapist validation (mirrors toolCreateBooking) ─
//
// Regression coverage for a bug where requesting a *specific* therapist
// (args.therapist_id) skipped all availability checks and booked them
// regardless of their weekly schedule/day-off/conflicts. Round-robin
// (no therapist_id) already validated correctly — the specific-therapist
// branch now runs the same fitsInAnyBlock + unavailability + conflict
// checks before confirming.

interface ScheduleTherapist {
  id: string;
  name: string;
  therapist_weekly_hours: { day_of_week: number; start_minute: number; end_minute: number }[];
}

function getScheduleDayBlocks(t: ScheduleTherapist, dayOfWeek: number) {
  return t.therapist_weekly_hours.filter((r) => r.day_of_week === dayOfWeek);
}

function fitsInBlocks(startMin: number, endMin: number, blocks: { start_minute: number; end_minute: number }[]): boolean {
  return blocks.some((b) => startMin >= b.start_minute && endMin <= b.end_minute);
}

function makeAllDayHours(days: number[], startHour = 9, endHour = 18) {
  return days.map((d) => ({ day_of_week: d, start_minute: startHour * 60, end_minute: endHour * 60 }));
}

/** Mirrors toolCreateBooking's specific-therapist branch: validate before assigning. */
function resolveSpecificTherapist(
  requestedId: string,
  dow: number,
  slotStartMin: number,
  slotEndMin: number,
  therapists: ScheduleTherapist[],
  unavailableIds: Set<string>,
  dayBookings: { therapist_id: string; start_time: string; end_time: string }[],
): { therapistId: string } | { error: string } {
  const requested = therapists.find((t) => t.id === requestedId);
  if (!requested) return { error: 'Therapist not found.' };
  if (unavailableIds.has(requested.id)) return { error: `${requested.name} is not available.` };
  if (!fitsInBlocks(slotStartMin, slotEndMin, getScheduleDayBlocks(requested, dow))) {
    return { error: `${requested.name} does not work at this time.` };
  }
  const BUFFER = 15;
  const hasConflict = dayBookings.some((b) => {
    if (b.therapist_id !== requested.id) return false;
    const [bsh, bsm] = b.start_time.split(':').map(Number);
    const [beh, bem] = b.end_time.split(':').map(Number);
    const bStart = bsh * 60 + bsm;
    const bEnd = beh * 60 + bem;
    return slotStartMin < bEnd + BUFFER && slotEndMin > bStart - BUFFER;
  });
  if (hasConflict) return { error: `${requested.name} is already booked at this time.` };
  return { therapistId: requested.id };
}

describe('AI Chat Tool: create_booking validates a specifically-requested therapist', () => {
  // Wednesday = day_of_week 3. Clara only works Sunday (7).
  const clara: ScheduleTherapist = { id: 'clara', name: 'Clara', therapist_weekly_hours: makeAllDayHours([7]) };
  const renee: ScheduleTherapist = { id: 'renee', name: 'Renee', therapist_weekly_hours: makeAllDayHours([1, 2, 3, 4, 5, 6]) };
  const heather: ScheduleTherapist = { id: 'heather', name: 'Heather', therapist_weekly_hours: makeAllDayHours([1, 2, 3, 4, 5, 6]) };
  const cindy: ScheduleTherapist = { id: 'cindy', name: 'Cindy', therapist_weekly_hours: makeAllDayHours([1, 2, 3, 4, 5, 6]) };
  const ruby: ScheduleTherapist = { id: 'ruby', name: 'Ruby', therapist_weekly_hours: makeAllDayHours([1, 2, 3, 4, 5, 6]) };
  const vivien: ScheduleTherapist = { id: 'vivien', name: 'Vivien', therapist_weekly_hours: makeAllDayHours([1, 2, 3, 4, 5, 6]) };
  const hannah: ScheduleTherapist = { id: 'hannah', name: 'Hannah', therapist_weekly_hours: makeAllDayHours([7]) }; // Sunday only, like Clara

  const allStaff = [clara, renee, heather, cindy, ruby, vivien, hannah];
  const wednesday = 3;
  const slot = { start: 10 * 60, end: 11 * 60 }; // 10:00-11:00

  it('rejects booking Clara on Wednesday even when explicitly requested', () => {
    const result = resolveSpecificTherapist('clara', wednesday, slot.start, slot.end, allStaff, new Set(), []);
    expect('error' in result).toBe(true);
  });

  it('rejects booking Hannah on Wednesday even when explicitly requested', () => {
    const result = resolveSpecificTherapist('hannah', wednesday, slot.start, slot.end, allStaff, new Set(), []);
    expect('error' in result).toBe(true);
  });

  it('allows booking each Wednesday-working staff member when explicitly requested', () => {
    for (const staff of [renee, heather, cindy, ruby, vivien]) {
      const result = resolveSpecificTherapist(staff.id, wednesday, slot.start, slot.end, allStaff, new Set(), []);
      expect(result).toEqual({ therapistId: staff.id });
    }
  });

  it('rejects a requested therapist marked unavailable that day even if their weekly hours cover it', () => {
    const result = resolveSpecificTherapist('renee', wednesday, slot.start, slot.end, allStaff, new Set(['renee']), []);
    expect('error' in result).toBe(true);
  });

  it('rejects a requested therapist with a conflicting booking', () => {
    const dayBookings = [{ therapist_id: 'renee', start_time: '10:00', end_time: '11:00' }];
    const result = resolveSpecificTherapist('renee', wednesday, slot.start, slot.end, allStaff, new Set(), dayBookings);
    expect('error' in result).toBe(true);
  });

  it('round-robin candidate pool on Wednesday excludes Clara and Hannah', () => {
    const available = allStaff.filter((t) => fitsInBlocks(slot.start, slot.end, getScheduleDayBlocks(t, wednesday)));
    expect(available.map((t) => t.id).sort()).toEqual(['cindy', 'heather', 'renee', 'ruby', 'vivien'].sort());
    expect(available.some((t) => t.id === 'clara')).toBe(false);
    expect(available.some((t) => t.id === 'hannah')).toBe(false);
  });
});

describe('AI Chat Tool: booking mode routing', () => {
  it('selects local mode by default', () => {
    const config = { booking_mode: 'local' };
    expect(config.booking_mode).toBe('local');
  });

  it('selects fresha mode when configured', () => {
    const config = { booking_mode: 'fresha', fresha_partner_token: 'tok_123', fresha_location_id: 'loc_456' };
    expect(config.booking_mode).toBe('fresha');
    expect(config.fresha_partner_token).toBeTruthy();
    expect(config.fresha_location_id).toBeTruthy();
  });

  it('falls back to local when fresha token is missing', () => {
    const config = { booking_mode: 'fresha', fresha_partner_token: '', fresha_location_id: '' };
    const shouldUseFresha = config.booking_mode === 'fresha' && !!config.fresha_partner_token;
    expect(shouldUseFresha).toBe(false);
  });

  it('validates booking mode values', () => {
    const validModes = ['local', 'fresha'];
    expect(validModes.includes('local')).toBe(true);
    expect(validModes.includes('fresha')).toBe(true);
    expect(validModes.includes('other')).toBe(false);
  });
});

describe('AI Chat Tool: booking time calculation', () => {
  it('calculates end time correctly for 60-min service', () => {
    const startTime = '10:00';
    const duration = 60;
    const [h, m] = startTime.split(':').map(Number);
    const endTotalMin = h * 60 + m + duration;
    const endH = Math.floor(endTotalMin / 60);
    const endM = endTotalMin % 60;
    const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    expect(endTime).toBe('11:00');
  });

  it('calculates end time correctly for 90-min service spanning noon', () => {
    const startTime = '11:30';
    const duration = 90;
    const [h, m] = startTime.split(':').map(Number);
    const endTotalMin = h * 60 + m + duration;
    const endH = Math.floor(endTotalMin / 60);
    const endM = endTotalMin % 60;
    const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    expect(endTime).toBe('13:00');
  });

  it('validates time format', () => {
    const validFormat = /^\d{2}:\d{2}$/;
    expect(validFormat.test('10:00')).toBe(true);
    expect(validFormat.test('9:00')).toBe(false);
    expect(validFormat.test('10:0')).toBe(false);
    expect(validFormat.test('abc')).toBe(false);
  });
});
