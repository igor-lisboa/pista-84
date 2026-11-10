import { expect, test } from '@playwright/test';
import { accountBackend } from './support/account-backend.ts';

test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block' });

const save = (page: import('@playwright/test').Page) => page.evaluate(() => JSON.parse(localStorage.getItem('pista84')!));

test('first launch demands a valid name and password, creates the account and keeps the same GUID across reloads', async ({ page, context }) => {
  await accountBackend(context);
  await page.goto('/');
  const modal = page.locator('#modal');
  await expect(modal).toBeVisible();
  await expect(page.locator('#closeModal')).toBeHidden();

  await page.keyboard.press('Escape');
  await expect(modal).toBeVisible();

  await page.locator('#usernameInput').fill('ab');
  await page.locator('#usernamePassword').fill('abcde');
  await page.locator('#usernameForm button[type=submit]').click();
  await expect(page.locator('#usernameStatus')).not.toBeEmpty();
  await expect(page.locator('#usernameInput')).toHaveAttribute('aria-invalid', 'true');
  await expect(modal).toBeVisible();

  await page.locator('#usernameInput').fill('igor_84');
  await page.locator('#usernamePassword').fill('abcd');
  await page.locator('#usernameForm button[type=submit]').click();
  await expect(page.locator('#usernameStatus')).not.toBeEmpty();
  await expect(page.locator('#usernamePassword')).toHaveValue('');
  await expect(modal).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('pista84.account'))).toBeNull();

  await page.locator('#usernamePassword').fill('abcde');
  await page.locator('#usernameForm button[type=submit]').click();
  // A brand-new player gets the tutorial next; skipping it closes the dialog.
  await expect(page.locator('#tutNext')).toBeVisible();
  await page.locator('#tutSkip').click();
  await expect(modal).toBeHidden();
  const first = await save(page);
  expect(first.username).toBe('igor_84');
  expect(first.playerId).toMatch(/^[0-9a-f-]{36}$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pista84.account')!))).toMatchObject({ id: first.playerId, username: 'igor_84' });

  await page.reload();
  await expect(modal).toBeHidden();
  expect((await save(page)).playerId).toBe(first.playerId);
});

test('first launch can continue offline when the account service is unreachable, without uploading', async ({ page }) => {
  const uploads: string[] = [];
  await page.route('**/api/**', (route) => {
    const request = route.request();
    if (request.method() !== 'GET') uploads.push(request.url());
    return route.abort();
  });
  await page.goto('/');
  await expect(page.locator('#usernameOffline')).toBeHidden();

  await page.locator('#usernameInput').fill('offline_1');
  await page.locator('#usernamePassword').fill('abcde');
  await page.locator('#usernameForm button[type=submit]').click();
  await expect(page.locator('#usernameStatus')).not.toBeEmpty();
  await expect(page.locator('#usernameOffline')).toBeVisible();

  await page.locator('#usernameOffline').click();
  await expect(page.locator('#tutNext')).toBeVisible();
  await page.locator('#tutSkip').click();
  await expect(page.locator('#modal')).toBeHidden();
  expect((await save(page)).username).toBe('offline_1');
  expect(await page.evaluate(() => localStorage.getItem('pista84.account'))).toBeNull();
  // Only the failed sign-up attempt itself may have been sent: no score or progress upload.
  expect(uploads.filter((url) => !url.endsWith('/api/auth'))).toEqual([]);
});

test('a wrong password does not offer the offline way in', async ({ page, context }) => {
  await accountBackend(context);
  await page.goto('/');
  await page.locator('#usernameInput').fill('Someone');
  await page.locator('#usernamePassword').fill('abcde');
  await page.locator('#usernameForm button[type=submit]').click();
  await expect(page.locator('#tutNext')).toBeVisible();
  await page.locator('#tutSkip').click();
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('#usernameTab-login').click();
  await page.locator('#usernameInput').fill('Someone');
  await page.locator('#usernamePassword').fill('wrong-pass');
  await page.locator('#usernameForm button[type=submit]').click();
  await expect(page.locator('#usernameStatus')).not.toBeEmpty();
  await expect(page.locator('#usernameOffline')).toBeHidden();
});

test('first launch explains that a username is already taken and lets the player pick another', async ({ page, context }) => {
  const store = await accountBackend(context);
  await store.accounts.create({ id: crypto.randomUUID(), username: 'Driver', usernameKey: 'driver', passwordHash: 'unused', createdAt: Date.now() });
  await page.goto('/');
  await page.locator('#usernameInput').fill('DRIVER');
  await page.locator('#usernamePassword').fill('abcde');
  await page.locator('#usernameForm button[type=submit]').click();
  await expect(page.locator('#usernameStatus')).toContainText('Escolha outro nome');
  await expect(page.locator('#usernameInput')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#usernameInput')).toBeFocused();
  // The form is usable again right away, with the normal label back on the button.
  await expect(page.locator('#usernameForm button[type=submit]')).toBeEnabled();
  await expect(page.locator('#usernameForm button[type=submit]')).toHaveText('Criar conta');
  await page.locator('#usernameInput').fill('FreshDriver');
  await expect(page.locator('#usernameStatus')).toBeEmpty();
  await page.locator('#usernamePassword').fill('abcde');
  await page.locator('#usernameForm button[type=submit]').click();
  await expect(page.locator('#tutNext')).toBeVisible();
});
