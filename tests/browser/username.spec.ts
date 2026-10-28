import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

const save = (page: import('@playwright/test').Page) => page.evaluate(() => JSON.parse(localStorage.getItem('pista84')!));

test('first launch demands a valid name and keeps the same GUID after a rename', async ({ page }) => {
  await page.goto('/');
  const modal = page.locator('#modal');
  await expect(modal).toBeVisible();
  await expect(page.locator('#closeModal')).toBeHidden();

  await page.keyboard.press('Escape');
  await expect(modal).toBeVisible();

  await page.locator('#usernameInput').fill('ab');
  await page.locator('#usernameForm button[type=submit]').click();
  await expect(page.locator('#usernameRules')).toHaveClass(/invalid/);
  await expect(modal).toBeVisible();

  await page.locator('#usernameInput').fill('Igor_84');
  await page.locator('#usernameForm button[type=submit]').click();
  await expect(modal).toBeHidden();
  const first = await save(page);
  expect(first.username).toBe('Igor_84');
  expect(first.playerId).toMatch(/^[0-9a-f-]{36}$/);

  await page.reload();
  await expect(modal).toBeHidden();

  await page.locator('#settingsNav').click();
  await page.locator('#username').click();
  await expect(page.locator('#closeModal')).toBeVisible();
  await page.locator('#usernameInput').fill('NewName');
  await page.locator('#usernameForm button[type=submit]').click();
  const renamed = await save(page);
  expect(renamed.username).toBe('NewName');
  expect(renamed.playerId).toBe(first.playerId);
});
