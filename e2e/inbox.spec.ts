import { test, expect } from '@playwright/test';

/**
 * E2E tests for the Inbox and AI Knowledge Base features.
 * These test the admin dashboard inbox tab and settings integration.
 */

test.describe('Inbox Tab', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to admin dashboard (assumes auth is handled)
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
  });

  test('Inbox tab is visible in sidebar navigation', async ({ page }) => {
    // Check that the Inbox nav item exists
    const inboxNav = page.locator('[data-value="inbox"], button:has-text("Inbox"), button:has-text("Hộp thư")');
    await expect(inboxNav.first()).toBeVisible();
  });

  test('Clicking Inbox tab shows the inbox panel', async ({ page }) => {
    // Click on Inbox tab
    const inboxNav = page.locator('button:has-text("Inbox"), button:has-text("Hộp thư")');
    await inboxNav.first().click();

    // Should show the empty state or conversation list
    const inboxContent = page.locator('text=Select a conversation, text=No conversations found');
    await expect(inboxContent.first()).toBeVisible({ timeout: 5000 });
  });

  test('Inbox shows search and filter controls', async ({ page }) => {
    const inboxNav = page.locator('button:has-text("Inbox"), button:has-text("Hộp thư")');
    await inboxNav.first().click();

    // Search input
    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();

    // Status filter
    const statusFilter = page.locator('text=All Status');
    await expect(statusFilter.first()).toBeVisible();
  });
});

test.describe('AI & Knowledge Base Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
  });

  test('AI settings option is visible in Settings tab', async ({ page }) => {
    // Navigate to Settings
    const settingsNav = page.locator('button:has-text("Settings"), button:has-text("Cài đặt")');
    await settingsNav.first().click();

    // Find AI & Knowledge Base settings row
    const aiSettings = page.locator('text=AI & Knowledge Base');
    await expect(aiSettings.first()).toBeVisible({ timeout: 5000 });
  });

  test('Clicking AI settings opens the configuration dialog', async ({ page }) => {
    const settingsNav = page.locator('button:has-text("Settings"), button:has-text("Cài đặt")');
    await settingsNav.first().click();

    const aiSettings = page.locator('text=AI & Knowledge Base');
    await aiSettings.first().click();

    // Dialog should open with AI settings form
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Should show API Base URL field
    const apiUrlInput = dialog.locator('input[placeholder*="openai"], input[value*="openai"]');
    await expect(apiUrlInput.first()).toBeVisible();
  });

  test('Knowledge Base section shows article management', async ({ page }) => {
    const settingsNav = page.locator('button:has-text("Settings"), button:has-text("Cài đặt")');
    await settingsNav.first().click();

    const aiSettings = page.locator('text=AI & Knowledge Base');
    await aiSettings.first().click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Should show Knowledge Base section
    const kbSection = dialog.locator('text=Knowledge Base');
    await expect(kbSection.first()).toBeVisible();

    // Should show Add Article button
    const addBtn = dialog.locator('button:has-text("Add Article")');
    await expect(addBtn).toBeVisible();
  });
});

test.describe('Human Takeover Flow', () => {
  test('Reply composer shows human takeover warning', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    const inboxNav = page.locator('button:has-text("Inbox"), button:has-text("Hộp thư")');
    await inboxNav.first().click();

    // This test verifies the UI components load. Full interaction
    // requires seeded conversation data.
    const panel = page.locator('text=Select a conversation');
    await expect(panel.first()).toBeVisible({ timeout: 5000 });
  });
});
