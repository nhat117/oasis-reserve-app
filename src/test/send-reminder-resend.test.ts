import { describe, it, expect } from 'vitest';

/**
 * Integration test: sends a booking reminder email via the Resend edge function.
 *
 * PREREQUISITE: 'resend_api_key' must be set in app_settings table.
 *
 * Run:  npx vitest run src/test/send-reminder-resend.test.ts
 */

const SUPABASE_URL = 'https://afibwdjbpnuxwpshsdyg.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmaWJ3ZGpicG51eHdwc2hzZHlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2Mzg5MTYsImV4cCI6MjA5MDIxNDkxNn0.JnFhpHBIqL-dM2jasy82p3HMw5_29gK2FJlZTphkZqQ';

describe('Send reminder via Resend', () => {
  it(
    'sends a booking reminder email to nhat117@gmail.com',
    async () => {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #8B5CF6;">🌿 Appointment Reminder</h2>
          <p>Hi <strong>Nhat</strong>,</p>
          <p>This is a friendly reminder about your upcoming appointment:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Service</td><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Relaxation Massage 60min</strong></td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Therapist</td><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Alice</strong></td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Date</td><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>31/03/2026</strong></td></tr>
            <tr><td style="padding: 8px; color: #666;">Time</td><td style="padding: 8px;"><strong>14:00</strong></td></tr>
          </table>
          <p style="color: #666; font-size: 14px;">We look forward to seeing you! 💆‍♂️</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #999; font-size: 12px;">This is a test reminder from Oasis Reserve.</p>
        </div>
      `;

      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/send-email-resend`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            to: 'nhat117@gmail.com',
            subject: '🌿 Appointment Reminder – Relaxation Massage 31/03/2026 at 14:00',
            html,
          }),
        },
      );

      const data = await res.json();
      console.log('Response status:', res.status);
      console.log('Response body:', JSON.stringify(data, null, 2));

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.id).toBeTruthy();
      console.log('✅ Email sent via Resend! ID:', data.id);
    },
    30_000,
  );
});
