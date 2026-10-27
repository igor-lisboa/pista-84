import { expect, test } from '@playwright/test';
import { loadHarness } from './support/harness.ts';

test('all game-over reasons explain the actual score-to-coins payout, including rounding', async ({ page }) => {
  await page.goto('/');
  await loadHarness(page);
  for (const reason of ['fuel', 'traffic', 'wall'] as const) {
    for (const score of [24.9, 25, 79.9]) {
      await page.evaluate(({ reason, score }) => {
        const { Race, POINTS_PER_COIN, showGameOver, defaultSave } = window.Pista;
        const race = new Race();
        race.finish(reason);
        race.score = score;
        race.coins = Math.floor(score / POINTS_PER_COIN);
        document.getElementById('overlay')!.hidden = false;
        showGameOver(race, defaultSave(), { restart() {}, secondChance() {}, toMenu() {} });
      }, { reason, score });
      await expect(page.locator('.result-conversion strong')).toHaveText(`${Math.floor(score)} pts = ${Math.floor(score / 25)} moedas`);
      await expect(page.locator('.result-conversion small')).toContainText('25 pts = 1 moeda');
      await expect(page.locator('.result-conversion small')).toContainText('moedas inteiras');
      await expect(page.locator('#continue')).toBeDisabled();
      await expect(page.locator('#continue')).toContainText('1.000');
    }
  }
});

test('the main menu opens coin packs and clearly marks real-money purchases unavailable', async ({ page }) => {
  await page.goto('/');
  const before = await page.locator('#wallet').textContent();
  await page.locator('#coinsNav').click();
  await expect(page.locator('.coin-pack')).toHaveCount(3);
  await expect(page.locator('.shop-status')).toContainText('Compras indisponíveis');
  for (const button of await page.locator('.coin-pack button').all()) await expect(button).toBeDisabled();
  await expect(page.locator('.coin-pack span').first()).toContainText('9,90');
  await page.locator('#closeModal').click();
  await expect(page.locator('#wallet')).toHaveText(before!);
});

test('the end-of-game conversion and menu remain reachable on a short landscape phone', async ({ page }) => {
  await page.setViewportSize({ width: 568, height: 320 });
  await page.goto('/');
  await loadHarness(page);
  await page.evaluate(() => {
    const { Race, showGameOver, defaultSave } = window.Pista;
    const race = new Race();
    race.finish('wall');
    race.score = 1250;
    race.coins = 50;
    document.getElementById('overlay')!.hidden = false;
    showGameOver(race, defaultSave(), { restart() {}, secondChance() {}, toMenu() {} });
  });
  await expect(page.locator('.result-conversion')).toBeVisible();
  await page.locator('#toMenu').scrollIntoViewIfNeeded();
  await expect(page.locator('#toMenu')).toBeInViewport();
  await page.locator('#overlay h2').scrollIntoViewIfNeeded();
  await expect(page.locator('#overlay h2')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(568);
});
