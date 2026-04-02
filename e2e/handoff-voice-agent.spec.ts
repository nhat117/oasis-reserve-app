import { test, expect } from '@playwright/test';

/**
 * E2E tests for Handoff Notifications and Voice Agent settings.
 *
 * These tests require admin authentication. They follow the same pattern
 * as inbox.spec.ts — they verify UI structure loads correctly behind
 * the admin login gate.
 *
 * To run with auth: set ADMIN_EMAIL and ADMIN_PASSWORD env vars,
 * or run against a Supabase instance with seeded test credentials.
 */

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

async function loginIfNeeded(page: import('@playwright/test').Page) {
  await page.goto('/admin');
  await page.waitForLoadState('networkidle');

  // If we see the login form, try to authenticate
  const loginForm = page.locator('text=Admin Login');
  if (await loginForm.isVisible({ timeout: 3000 }).catch(() => false)) {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      return false; // No credentials — skip test
    }
    await page.locator('input[type="email"], input:near(:text("Email"))').first().fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
    await page.locator('button:has-text("Sign In")').click();
    await page.waitForLoadState('networkidle');
    // Wait for dashboard to load
    await page.waitForSelector('button:has-text("Settings"), button:has-text("Cài đặt")', { timeout: 10000 }).catch(() => null);

    // Dismiss onboarding modal if present
    const skipBtn = page.locator('button:has-text("Skip")');
    if (await skipBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await skipBtn.click({ force: true });
      await page.waitForTimeout(1000);
    }
    // Double-check modal is gone
    const modal = page.locator('text=Welcome to Admin Dashboard!');
    if (await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
      await page.locator('button:has-text("Skip")').click({ force: true }).catch(() => null);
      await page.waitForTimeout(1000);
    }
  }
  return true;
}

async function navigateToAISettings(page: import('@playwright/test').Page): Promise<boolean> {
  const loggedIn = await loginIfNeeded(page);
  if (!loggedIn) return false;

  // Ensure onboarding modal is dismissed before navigating
  const onboardingModal = page.locator('text=Welcome to Admin Dashboard!');
  if (await onboardingModal.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.locator('button:has-text("Skip")').click({ force: true }).catch(() => null);
    await page.waitForTimeout(1000);
  }

  const settingsNav = page.locator('button:has-text("Settings"), button:has-text("Cài đặt")');
  if (await settingsNav.first().isVisible({ timeout: 5000 }).catch(() => false)) {
    await settingsNav.first().click();
    const aiSettings = page.locator('text=AI & Knowledge Base');
    if (await aiSettings.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await aiSettings.first().click();
      const dialog = page.locator('[role="dialog"]');
      await dialog.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null);
      return dialog.isVisible();
    }
  }
  return false;
}

test.describe('Handoff Notification Settings', () => {
  test('admin login page loads correctly', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Should see either login form or admin dashboard
    const loginVisible = await page.locator('text=Admin Login').isVisible().catch(() => false);
    const dashboardVisible = await page.locator('button:has-text("Settings")').isVisible().catch(() => false);
    expect(loginVisible || dashboardVisible).toBe(true);
  });

  test('login page has email and password fields', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    const loginForm = page.locator('text=Admin Login');
    if (await loginForm.isVisible({ timeout: 3000 }).catch(() => false)) {
      const emailInput = page.locator('input[type="email"], input:near(:text("Email"))').first();
      const passwordInput = page.locator('input[type="password"]').first();
      const signInBtn = page.locator('button:has-text("Sign In")');

      await expect(emailInput).toBeVisible();
      await expect(passwordInput).toBeVisible();
      await expect(signInBtn).toBeVisible();
    }
  });

  test('AI settings dialog shows handoff and voice sections when authenticated', async ({ page }) => {
    const opened = await navigateToAISettings(page);
    if (!opened) {
      test.skip(true, 'Requires admin credentials (set ADMIN_EMAIL/ADMIN_PASSWORD)');
      return;
    }

    const dialog = page.locator('[role="dialog"]');

    // Wait for settings to finish loading
    const loading = dialog.locator('text=Loading AI settings');
    const loadingGone = await loading.waitFor({ state: 'hidden', timeout: 10000 }).then(() => true).catch(() => false);
    if (!loadingGone) {
      test.skip(true, 'AI settings did not load (Supabase may be unavailable)');
      return;
    }

    // Handoff Notifications section
    await expect(dialog.locator('text=Handoff Notifications')).toBeVisible();

    // Email input
    await expect(dialog.locator('input[type="email"][placeholder*="manager"]')).toBeVisible();

    // SMS toggle
    await expect(dialog.locator('text=SMS alert via Twilio')).toBeVisible();

    // Voice Agent section
    await expect(dialog.locator('text=Voice Agent').first()).toBeVisible();

    // Enable Voice toggle
    await expect(dialog.locator('text=Enable Voice')).toBeVisible();
  });

  test('notification email can be entered', async ({ page }) => {
    const opened = await navigateToAISettings(page);
    if (!opened) {
      test.skip(true, 'Requires admin credentials');
      return;
    }

    const dialog = page.locator('[role="dialog"]');
    const emailInput = dialog.locator('input[type="email"][placeholder*="manager"]');
    await emailInput.fill('test-manager@oasis.com');
    await expect(emailInput).toHaveValue('test-manager@oasis.com');
  });

  test('enabling voice reveals ElevenLabs fields', async ({ page }) => {
    const opened = await navigateToAISettings(page);
    if (!opened) {
      test.skip(true, 'Requires admin credentials');
      return;
    }

    const dialog = page.locator('[role="dialog"]');

    // Click Enable Voice toggle
    const toggleArea = dialog.locator('text=Enable Voice').locator('..');
    const toggle = toggleArea.locator('button[role="switch"]');
    if (await toggle.count() > 0) {
      await toggle.click();

      // ElevenLabs API key input should appear
      const apiKeyInput = dialog.locator('input[placeholder*="xi-"]');
      await expect(apiKeyInput).toBeVisible({ timeout: 3000 });

      // Voice select with Sarah
      const voiceSelect = dialog.locator('select').filter({ hasText: 'Sarah' });
      if (await voiceSelect.count() > 0) {
        const options = voiceSelect.locator('option');
        expect(await options.count()).toBeGreaterThanOrEqual(5);
      }

      // Greeting textarea
      const greetingArea = dialog.locator('textarea[placeholder*="Hello"]');
      await expect(greetingArea).toBeVisible();
    }
  });

  test('Save Settings button is present', async ({ page }) => {
    const opened = await navigateToAISettings(page);
    if (!opened) {
      test.skip(true, 'Requires admin credentials');
      return;
    }

    const dialog = page.locator('[role="dialog"]');

    // Wait for settings to finish loading (may fail in preview without Supabase)
    const loading = dialog.locator('text=Loading AI settings');
    const loadingGone = await loading.waitFor({ state: 'hidden', timeout: 10000 }).then(() => true).catch(() => false);
    if (!loadingGone) {
      test.skip(true, 'AI settings did not load (Supabase may be unavailable)');
      return;
    }

    const saveBtn = dialog.locator('button:has-text("Save Settings")');
    await expect(saveBtn).toBeVisible({ timeout: 5000 });
    await expect(saveBtn).toBeEnabled();
  });
});

test.describe('Voice Agent Settings - No Auth Required', () => {
  test('admin page is accessible', async ({ page }) => {
    const response = await page.goto('/admin');
    expect(response?.status()).toBeLessThan(500);
  });

  test('page does not have console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('supabase')) {
        errors.push(msg.text());
      }
    });

    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Filter out expected Supabase/network errors in preview mode
    const realErrors = errors.filter(
      (e) => !e.includes('auth') && !e.includes('401') && !e.includes('PGRST')
        && !e.includes('404') && !e.includes('406') && !e.includes('Failed to load resource'),
    );
    expect(realErrors).toHaveLength(0);
  });
});
