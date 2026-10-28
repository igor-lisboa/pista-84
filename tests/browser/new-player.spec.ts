import { expect, test } from '@playwright/test';

const save = (page: import('@playwright/test').Page) => page.evaluate(() => JSON.parse(localStorage.getItem('pista84')!));

test('a new player starts clean after a confirmation and the old one goes to history', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('pista84.seeded')) {
      localStorage.setItem('pista84.seeded', '1');
      localStorage.setItem(
        'pista84',
        JSON.stringify({ username: 'Tester', playerId: '6f1c2a3e-9b4d-4e5f-8a7b-0c1d2e3f4a5b', coins: 400, bestScore: 777, owned: ['fusca'], lang: 'en' }),
      );
    }
  });
  await page.goto('/');
  const modal = page.locator('#modal');

  // Cancelling changes nothing.
  await page.locator('#newPlayerNav').click();
  await expect(modal).toBeVisible();
  await page.locator('#newPlayerCancel').click();
  await expect(modal).toBeHidden();
  expect((await save(page)).coins).toBe(400);

  // Confirming starts over and demands a new name.
  await page.locator('#newPlayerNav').click();
  await page.locator('#newPlayerConfirm').click();
  await expect(page.locator('#usernameInput')).toBeVisible();
  await expect(page.locator('#closeModal')).toBeHidden();

  const fresh = await save(page);
  expect(fresh.playerId).not.toBe('6f1c2a3e-9b4d-4e5f-8a7b-0c1d2e3f4a5b');
  expect(fresh.coins).toBe(0);
  expect(fresh.username).toBeNull();
  expect(fresh.lang).toBe('en');
  expect(fresh.history).toEqual([expect.objectContaining({ username: 'Tester', bestScore: 777 })]);

  await page.locator('#usernameInput').fill('SecondRun');
  await page.locator('#usernameForm button[type=submit]').click();
  await expect(page.locator('#tutNext')).toBeVisible();
  await page.locator('#tutSkip').click();
  await expect(modal).toBeHidden();
  expect((await save(page)).username).toBe('SecondRun');
});
