import {test, expect} from '@playwright/test';
import type {Page} from '@playwright/test';
import {playerApi} from '../../src/server/player-api.ts';
import {syncAccountProgress} from '../../src/server/account-progress.ts';
import {defaultSave} from '../../src/game/save.ts';
import {accountBackend} from './support/account-backend.ts';

test.use({serviceWorkers: 'block'});
const password = 'a unique browser test passphrase';

test('signup and login allow a five-character password and reject four characters', async ({page, context}) => {
  await backend(context);
  await page.goto('/');
  await openAccount(page);
  await page.locator('#accountTab-signup').click();
  await expect(page.locator('#accountRules')).toContainText('5–128');
  await expect(page.locator('#accountPassword')).toHaveAttribute('minlength', '5');
  await page.locator('#accountUsername').fill('driver');
  await page.locator('#accountPassword').fill('abcd');
  await page.locator('#accountForm button[type=submit]').click();
  expect(await page.locator('#accountPassword').evaluate((input: HTMLInputElement) => input.validity.tooShort)).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('pista84.account'))).toBeNull();
  await page.locator('#accountPassword').fill('abcde');
  await page.locator('#accountForm button[type=submit]').click();
  await expect(page.locator('#modal')).toBeHidden();
  await context.clearCookies();
  await openAccount(page);
  await page.locator('#accountPassword').fill('abcde');
  await page.locator('#accountForm button[type=submit]').click();
  await expect(page.locator('#modal')).toBeHidden();
});

test('account forms keep typed credentials when a delayed guest session check finishes', async ({page, context}) => {
  await backend(context);
  let finishCheck!: () => void;
  const check = new Promise<void>(resolve => { finishCheck = resolve; });
  await page.route('**/api/auth', async route => {
    if (route.request().method() === 'GET') await check;
    return route.fallback();
  });
  await page.goto('/');
  await openAccount(page);
  await page.locator('#accountTab-signup').click();
  await page.locator('#accountUsername').fill('driver');
  await page.locator('#accountPassword').fill(password);
  const response = page.waitForResponse(response => response.url().endsWith('/api/auth'));
  finishCheck();
  await response;
  await expect(page.locator('#accountUsername')).toHaveValue('driver');
  await expect(page.locator('#accountPassword')).toHaveValue(password);
  await expect(page.locator('#accountPassword')).toHaveAttribute('autocomplete', 'new-password');
});

test('a fresh device can sign up directly from the guest name screen', async ({page, context}) => {
  await context.clearCookies();
  await context.addInitScript(() => {
    if (localStorage.getItem('fresh-device-fixture')) return;
    localStorage.clear();
    localStorage.setItem('fresh-device-fixture', 'yes');
  });
  await backend(context);
  await page.goto('/');
  await expect(page.locator('#usernameForm')).toBeVisible();
  await expect(page.locator('#closeModal')).toBeVisible();
  await page.locator('#usernameTab-login').click();
  await expect(page.locator('#usernamePassword')).toHaveAttribute('autocomplete', 'current-password');
  await expect(page.locator('#usernameTab-signup')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#usernameTab-signup').click();
  await expect(page.locator('#usernameTab-signup')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#usernamePassword')).toHaveAttribute('autocomplete', 'new-password');
  await page.locator('#usernameInput').fill('driver');
  await page.locator('#usernamePassword').fill(password);
  await page.locator('#usernameForm button[type=submit]').click();
  await expect(page.locator('#tutNext')).toBeVisible();
  await page.locator('#tutSkip').click();
  await expect(page.locator('#modal')).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pista84')!).username)).toBe('driver');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pista84.account')!).username)).toBe('driver');
});

const backend = accountBackend;

async function openAccount(page: Page) {
  await page.locator('#settingsNav').click();
  await page.locator('#account').click();
  await expect(page.locator('#accountForm')).toBeVisible();
}

async function logIn(page: Page, signup = false) {
  if (signup) await page.locator('#accountTab-signup').click();
  await page.locator('#accountUsername').fill('driver');
  await page.locator('#accountPassword').fill(password);
  await page.locator('#accountForm button[type=submit]').click();
  await expect(page.locator('#modal')).toBeHidden();
}

test('signup asks for another pilot username when a normalized name is already registered', async ({page, context}) => {
  const store = await backend(context);
  await store.accounts.create({id: crypto.randomUUID(), username: 'driver', usernameKey: 'driver', passwordHash: 'unused', createdAt: Date.now()});
  await page.goto('/');
  await openAccount(page);
  await page.locator('#accountTab-signup').click();
  await page.locator('#accountUsername').fill('DRIVER');
  await page.locator('#accountPassword').fill(password);
  await page.locator('#accountForm button[type=submit]').click();
  await expect(page.locator('#accountStatus')).toContainText('Escolha outro nome');
  await expect(page.locator('#accountUsername')).toBeFocused();
  await expect(page.locator('#accountUsername')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#accountPassword')).toHaveValue('');
  expect(await page.evaluate(() => localStorage.getItem('pista84.account'))).toBeNull();
  await page.locator('#accountUsername').fill('newdriver');
  await expect(page.locator('#accountStatus')).toBeEmpty();
  await expect(page.locator('#accountUsername')).not.toHaveAttribute('aria-invalid');
  await page.locator('#accountPassword').fill(password);
  await page.locator('#accountForm button[type=submit]').click();
  await expect(page.locator('#modal')).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pista84')!).username)).toBe('newdriver');
});

test('signed-in pilot names match the account on launch and after importing progress', async ({page, context}) => {
  await backend(context);
  await page.goto('/');
  await openAccount(page);
  await logIn(page, true);
  const identity = await page.evaluate(() => JSON.parse(localStorage.getItem('pista84.account')!));
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('pista84')!);
    save.username = 'OldPilot';
    localStorage.setItem('pista84', JSON.stringify(save));
  });
  await page.reload();
  await page.locator('#settingsNav').click();
  await expect(page.locator('#account')).toContainText('driver');
  await page.locator('#account').click();
  await expect(page.locator('#accountName')).toHaveText('driver');
  await expect(page.locator('#usernameInput')).toHaveCount(0);
  await page.locator('#closeModal').click();
  await page.locator('#garageNav').click();
  await page.locator('#importSave').setInputFiles({
    name: 'progress.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({...defaultSave(), username: 'AnotherPilot', coins: 42})),
  });
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('pista84')!)))
    .toMatchObject({playerId: identity.id, username: 'driver', coins: 42});
});

test('signup merges guest progress, persists a session and logout clears this device and another open tab', async ({page, context}) => {
  await backend(context);
  await page.addInitScript(() => {
    if (localStorage.getItem('account-fixture')) return;
    const save = JSON.parse(localStorage.getItem('pista84') ?? '{}');
    localStorage.setItem('pista84', JSON.stringify({...save, coins: 700, bestScore: 900, tutorialDone: true, owned: ['fusca', 'gol']}));
    localStorage.setItem('account-fixture', 'yes');
  });
  await page.goto('/');
  await openAccount(page);
  await logIn(page, true);
  const account = await page.evaluate(() => JSON.parse(localStorage.getItem('pista84.account')!));
  expect(account.username).toBe('driver');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pista84')!))).toMatchObject({playerId: account.id, coins: 700, bestScore: 900, username: 'driver'});
  expect(await page.evaluate(() => document.cookie)).not.toContain('pista84-session');
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(password);
  await page.reload();
  const otherTab = await context.newPage();
  await otherTab.goto('/');
  await page.locator('#settingsNav').click();
  await page.locator('#account').click();
  await expect(page.locator('#accountName')).toHaveText('driver');
  await page.locator('#accountLogout').click();
  // Logout reloads the page: wait for the reloaded first-launch form before reading storage.
  await expect(page.locator('#usernameForm')).toBeVisible();
  await expect(otherTab.locator('#usernameForm')).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('pista84.account'))).toBeNull();
  const fresh = await page.evaluate(() => JSON.parse(localStorage.getItem('pista84')!));
  expect(fresh.playerId).not.toBe(account.id);
  expect(fresh).toMatchObject({coins: 0, best: 0, bestScore: 0, username: null, history: [], owned: ['fusca']});
  expect(await page.evaluate(id => JSON.stringify(localStorage).includes(id), account.id)).toBe(false);
  expect((await context.cookies()).some(cookie => cookie.name.includes('pista84-session'))).toBe(false);
});

test('login restores cloud records and guest unlocks; expired sessions allow reauthentication', async ({page, context}) => {
  const store = await backend(context);
  const signup = await playerApi(new Request('http://127.0.0.1:4173/api/auth', {
    method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({action: 'signup', username: 'driver', password}),
  }), store);
  const {user} = await signup.json();
  await syncAccountProgress(store, user, {...defaultSave(), coins: 1200, bestScore: 5000, owned: ['fusca', 'gol']});
  await page.goto('/');
  await openAccount(page);
  await logIn(page);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pista84')!))).toMatchObject({coins: 1200, bestScore: 5000, playerId: user.id, owned: ['fusca', 'gol']});
  await context.clearCookies();
  await page.locator('#settingsNav').click();
  await page.locator('#account').click();
  await expect(page.locator('#accountUsername')).toHaveValue('driver');
  await expect(page.locator('#accountUsername')).toHaveAttribute('readonly', '');
  await page.locator('#accountPassword').fill(password);
  await page.locator('#accountForm button[type=submit]').click();
  await expect(page.locator('#modal')).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pista84')!).bestScore)).toBe(5000);
});

test('a failed account merge keeps guest data and offers a retry with the established session', async ({page, context}) => {
  await backend(context);
  let available = false;
  await page.route('**/api/account', route => available ? route.fallback() : route.fulfill({status: 503, json: {error: 'Unavailable'}}));
  await page.goto('/');
  await openAccount(page);
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('pista84')!));
  await page.locator('#accountTab-signup').click();
  await page.locator('#accountUsername').fill('driver');
  await page.locator('#accountPassword').fill(password);
  await page.locator('#accountForm button[type=submit]').click();
  await expect(page.locator('#accountStatus')).not.toBeEmpty();
  expect(await page.evaluate(() => localStorage.getItem('pista84.account'))).toBeNull();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pista84')!).playerId)).toBe(before.playerId);
  available = true;
  // The sync button is gone: retrying is simply submitting the form again.
  await page.locator('#accountPassword').fill(password);
  await page.locator('#accountForm button[type=submit]').click();
  await expect(page.locator('#modal')).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pista84')!).username)).toBe('driver');
});

for (const viewport of [{width: 390, height: 844}, {width: 844, height: 390}]) {
  test(`account forms fit a phone at ${viewport.width}x${viewport.height} and guest play remains available`, async ({page}) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await openAccount(page);
    expect(await page.locator('#modal').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await expect(page.locator('#accountUsername')).toHaveAttribute('autocomplete', 'username');
    await expect(page.locator('#accountPassword')).toHaveAttribute('autocomplete', 'current-password');
    await page.locator('#closeModal').click();
    await page.locator('#start').click();
    await expect(page.locator('#raceUI')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('pista84.account'))).toBeNull();
  });
}

test('a signed-in player changes the password from the account screen', async ({page, context}) => {
  await backend(context);
  await page.goto('/');
  await openAccount(page);
  await logIn(page, true);
  await page.locator('#settingsNav').click();
  // Settings only offers the account: starting over as a new player is not a separate action.
  await expect(page.locator('#newPlayer')).toHaveCount(0);
  await page.locator('#account').click();
  await expect(page.locator('#passwordForm')).toBeVisible();

  await page.locator('#currentPassword').fill('not the password');
  await page.locator('#newPassword').fill('a different passphrase');
  await page.locator('#passwordForm button[type=submit]').click();
  await expect(page.locator('#passwordStatus')).toContainText('senha atual');
  await expect(page.locator('#currentPassword')).toBeFocused();

  await page.locator('#currentPassword').fill(password);
  await page.locator('#passwordForm button[type=submit]').click();
  await expect(page.locator('#passwordStatus')).toContainText('Senha alterada');
  await expect(page.locator('#currentPassword')).toHaveValue('');
  await expect(page.locator('#newPassword')).toHaveValue('');
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('a different passphrase');

  // Only the new password works from now on.
  await context.clearCookies();
  await page.reload();
  await page.locator('#settingsNav').click();
  await page.locator('#account').click();
  await page.locator('#accountPassword').fill(password);
  await page.locator('#accountForm button[type=submit]').click();
  await expect(page.locator('#accountStatus')).toContainText('incorretos');
  await page.locator('#accountPassword').fill('a different passphrase');
  await page.locator('#accountForm button[type=submit]').click();
  await expect(page.locator('#modal')).toBeHidden();
});

for (const viewport of [{width: 390, height: 844}, {width: 844, height: 390}]) {
  test(`the close button stays in view while a long dialog scrolls at ${viewport.width}x${viewport.height}`, async ({page}) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.locator('#settingsNav').click();
    const modal = page.locator('#modal');
    const close = page.locator('#closeModal');
    await expect(close).toBeVisible();
    const scrollable = await modal.evaluate(el => el.scrollHeight > el.clientHeight + 40);
    expect(scrollable).toBe(true);
    const gap = async () => (await close.boundingBox())!.y - (await modal.boundingBox())!.y;
    const before = await gap();
    await modal.evaluate(el => el.scrollTo(0, el.scrollHeight));
    expect(await modal.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    await expect(close).toBeInViewport({ratio: 1});
    expect(Math.abs((await gap()) - before)).toBeLessThan(2);
    await close.click();
    await expect(modal).toBeHidden();
  });
}
