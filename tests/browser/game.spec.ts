import { expect, test, type Page } from '@playwright/test';
import { hudSpeed } from './support/harness.ts';

const CAR_COUNT = 22;

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test('menu disappears in race; pause and return to menu keep usable flows', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await expect(page.locator('#menu')).toBeVisible();
  await expect(page.locator('#raceUI')).toBeHidden();
  await page.locator('#start').click();
  await expect(page.locator('#menu')).toBeHidden();
  await expect(page.locator('#raceUI')).toBeVisible();
  await expect(page.locator('#settingsNav')).toBeHidden();

  await page.keyboard.down('ArrowUp');
  await expect.poll(() => hudSpeed(page), { timeout: 15000 }).toBeGreaterThan(20);
  await page.keyboard.up('ArrowUp');

  await page.keyboard.press('p');
  await expect(page.locator('#resume')).toBeVisible();
  const distance = await page.locator('#distance').innerText();
  await page.waitForTimeout(250);
  expect(await page.locator('#distance').innerText()).toBe(distance);

  await page.locator('#resume').click();
  await page.keyboard.down(' ');
  await expect.poll(() => hudSpeed(page)).toBe(0);
  await page.keyboard.up(' ');
  await expect(page.locator('#restart')).toHaveCount(0);

  await page.keyboard.down('ArrowUp');
  await expect.poll(() => hudSpeed(page), { timeout: 15000 }).toBeGreaterThan(25);
  await page.keyboard.up('ArrowUp');
  await page.keyboard.press('p');
  await page.locator('#toMenu').click();
  await expect(page.locator('#menu')).toBeVisible();
  await page.locator('#garageNav').click();
  await expect(page.locator('.car-card')).toHaveCount(CAR_COUNT);
  expect(errors).toEqual([]);
});

test('the barrier ends the race with the crash screen', async ({ page }) => {
  await page.goto('/');
  await page.locator('#start').click();
  await page.keyboard.down('ArrowUp');
  await page.keyboard.down('ArrowRight');
  await expect(page.locator('#overlay h2')).toHaveText('VOCÊ BATEU!', { timeout: 20000 });
  await expect(page.locator('#overlay')).toHaveClass(/crash/);
  await expect(page.locator('#restart')).toBeVisible();
  await page.keyboard.up('ArrowRight');
  await page.keyboard.up('ArrowUp');
});

test('leaving the road drags the speed down to about 40 km/h', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('pista84', JSON.stringify({ username: 'Tester', tutorialDone: true, demoUsed: true, owned: ['fusca', 'gt'], selected: 'gt' }));
    Math.random = () => 0.3;
  });
  await page.goto('/');
  await page.locator('#start').click();
  await page.keyboard.down('ArrowUp');
  await expect.poll(() => hudSpeed(page), { timeout: 30000 }).toBeGreaterThan(110);
  await page.keyboard.down('ArrowRight');
  await expect(page.locator('#cpLabel')).toContainText('FORA DA PISTA', { timeout: 10000 });
  await expect.poll(() => hudSpeed(page), { timeout: 5000 }).toBeLessThan(55);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.up('ArrowUp');
});

test('the language can be switched in the options', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#start span')).toHaveText('JOGAR');
  await page.locator('#settingsNav').click();
  await page.locator('[data-lang="en"]').click();
  await page.locator('#closeModal').click();
  await expect(page.locator('#start span')).toHaveText('PLAY');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.locator('#settingsNav').click();
  await page.locator('[data-lang="ja"]').click();
  await page.locator('#closeModal').click();
  await expect(page.locator('#start span')).toHaveText('プレイ');
});

test('the offline cache serves the app and sound can be switched on', async ({ page, context }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await page.locator('#settingsNav').click();
  await page.locator('#sound').click();
  const hasAudio = await page.evaluate(() => !!(window.AudioContext ?? ('webkitAudioContext' in window ? window.webkitAudioContext : undefined)));
  if (hasAudio) await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', /true|false/);
  else await expect(page.locator('#toast')).toBeVisible();
  await page.locator('#closeModal').click();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.reload();
  expect(await page.evaluate(async () => {
    const image = new Image();
    image.src = '/assets/vehicle-harley-v2.png';
    await image.decode();
    return image.naturalWidth;
  })).toBe(1536);
  await page.locator('#start').click();
  await expect(page.locator('#raceUI')).toBeVisible();
  expect(errors).toEqual([]);
});
