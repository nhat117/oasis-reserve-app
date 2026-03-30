import { describe, it, expect } from 'vitest';

/**
 * Integration test: sends a real booking-reminder email via the
 * send-transactional-email Supabase Edge Function.
 *
 * Run with:  npx vitest run src/test/send-reminder-email.test.ts
 */

const SUPABASE_URL = 'https://afibwdjbpnuxwpshsdyg.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmaWJ3ZGpicG51eHdwc2hzZHlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2Mzg5MTYsImV4cCI6MjA5MDIxNDkxNn0.JnFhpHBIqL-dM2jasy82p3HMw5_29gK2FJlZTphkZqQ';

describe('Send booking-reminder email (integration)', () => {
  it(
    'sends a reminder email to nhat117@gmail.com',
    async () => {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/send-transactional-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            templateName: 'booking-reminder',
            recipientEmail: 'nhat117@gmail.com',
            templateData: {
              customerName: 'Nhat (Test)',
              serviceName: 'Relaxation Massage 60min',
              therapistName: 'Alice',
              bookingDate: '31/03/2026',
              startTime: '14:00',
            },
          }),
        },
      );

      const data = await res.json();
      console.log('Response status:', res.status);
      console.log('Response body:', JSON.stringify(data, null, 2));

      // The function should either queue the email or suppress it
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
    },
    30_000, // 30s timeout for network call
  );
});
