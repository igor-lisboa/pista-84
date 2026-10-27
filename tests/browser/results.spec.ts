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
      await expect(page.locator('.result-conversion strong')).toHaveText(`${Math.floor(score)} pts → ${Math.floor(score / 25)} moedas`);
      await expect(page.locator('.result-conversion small')).toContainText('25 pts = 1 moeda');
      await expect(page.locator('.result-conversion small')).toContainText('moedas inteiras');
    }
  }
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
