import { expect, test, type Page } from '@playwright/test';
import { hudSpeed } from './support/harness.ts';

test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block' });

const save = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('pista84')!));

test('a new device plays offline as a guest: no sign-up, the tutorial follows, the shop and ranking show guest notices', async ({ page, context }) => {
  await page.goto('/');
  const modal = page.locator('#modal');
  await expect(modal).toBeVisible();
  await expect(page.locator('#closeModal')).toBeVisible();

  await page.locator('#usernameGuest').click();
  await expect(page.locator('.tutorial-count')).toContainText('1');
  for (let step = 2; step <= 5; step += 1) await page.locator('#tutNext').click();
  await page.locator('#tutNext').click();
  await expect(modal).toBeHidden();
  const guest = await save(page);
  expect(guest.tutorialDone).toBe(true);
  expect(guest.username).toBeNull();

  await context.setOffline(true);
  await page.locator('#start').click();
  await expect(page.locator('#raceUI')).toBeVisible();
  await page.keyboard.down('ArrowUp');
  await expect.poll(() => hudSpeed(page), { timeout: 15000 }).toBeGreaterThan(20);
  await page.keyboard.up('ArrowUp');
  await page.keyboard.press('p');
  await expect(page.locator('#resume')).toBeVisible();

  await page.locator('#toMenu').click();
  await expect(page.locator('#menu')).toBeVisible({ timeout: 10000 });

  await page.locator('#coinsNav').click();
  await expect(page.locator('#modalBody .warning')).toBeVisible();
  await expect(page.locator('#modalBody .coin-pack')).toHaveCount(0);
  await page.locator('#closeModal').click();

  await page.locator('#leaderboardNav').click();
  await expect(page.locator('#modalBody .warning')).toBeVisible();
  await page.locator('#closeModal').click();
  await context.setOffline(false);
});

test('the first run after the tutorial uses the Veloce GT once; after its crash the player’s own car is used again', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('pista84')) {
      localStorage.setItem('pista84', JSON.stringify({ tutorialDone: true, owned: ['fusca'], selected: 'fusca', demoUsed: false }));
    }
  });
  await page.goto('/');
  await page.locator('#start').click();
  await expect(page.getByText(/Corrida demo|Demo run/)).toBeVisible();
  await page.keyboard.down('ArrowUp');
  await page.keyboard.down('ArrowRight');
  await expect(page.locator('#overlay h2')).toHaveText('VOCÊ BATEU!', { timeout: 20000 });
  // A guest sees the enter option on the result screen.
  await expect(page.locator('#enter')).toBeVisible();
  await page.keyboard.up('ArrowRight');
  await page.keyboard.up('ArrowUp');
  expect((await save(page)).demoUsed).toBe(true);
  expect((await save(page)).selected).toBe('fusca');

  await page.locator('#restart').click();
  await expect(page.locator('#raceUI')).toBeVisible();
  await expect(page.getByText(/Corrida demo|Demo run/)).toHaveCount(0);
});
