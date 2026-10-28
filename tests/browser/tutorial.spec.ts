import { expect, test } from '@playwright/test';

const save = (page: import('@playwright/test').Page) => page.evaluate(() => JSON.parse(localStorage.getItem('pista84')!));

test.describe('first play', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('a brand-new player gets the five-step tutorial once, right after choosing a name', async ({ page }) => {
    await page.goto('/');
    await page.locator('#usernameInput').fill('Newbie_1');
    await page.locator('#usernameForm button[type=submit]').click();

    const count = page.locator('.tutorial-count');
    await expect(count).toContainText('1');
    for (let step = 2; step <= 5; step += 1) {
      await page.locator('#tutNext').click();
      await expect(count).toContainText(String(step));
    }
    await page.locator('#tutBack').click();
    await expect(count).toContainText('4');
    await page.locator('#tutNext').click();
    await expect(page.locator('#tutSkip')).toHaveCount(0);
    await page.locator('#tutNext').click();
    await expect(page.locator('#modal')).toBeHidden();
    expect((await save(page)).tutorialDone).toBe(true);

    await page.reload();
    await expect(page.locator('#modal')).toBeHidden();
  });
});

test.describe('tutorial', () => {

  test('not moving in the first five seconds shows the tutorial and then restarts the race', async ({ page }) => {
    await page.goto('/');
    await page.locator('#start').click();
    await expect(page.locator('body')).toHaveAttribute('data-view', 'race');

    await expect(page.locator('#tutNext')).toBeVisible({ timeout: 9000 });
    await expect(page.locator('#modalBody .warning')).toBeVisible();
    await expect(page.locator('body')).toHaveAttribute('data-view', 'menu');

    await page.locator('#tutSkip').click();
    await expect(page.locator('#modal')).toBeHidden();
    await expect(page.locator('body')).toHaveAttribute('data-view', 'race');
  });

  test('driving in the first seconds does not interrupt the player', async ({ page }) => {
    await page.goto('/');
    await page.locator('#start').click();
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(6500);
    await page.keyboard.up('ArrowUp');
    await expect(page.locator('#modal')).toBeHidden();
  });

  test('the tutorial can be reopened from the settings', async ({ page }) => {
    await page.goto('/');
    await page.locator('#settingsNav').click();
    await page.locator('#tutorial').click();
    await expect(page.locator('.tutorial-count')).toBeVisible();
  });
});

test.describe('units', () => {
  test('kilometres are the default and miles can be chosen in the settings', async ({ page }) => {
    await page.addInitScript(() => {
      if (!localStorage.getItem('pista84.seeded')) {
        localStorage.setItem('pista84.seeded', '1');
        localStorage.setItem(
          'pista84',
          JSON.stringify({ username: 'Tester', playerId: '6f1c2a3e-9b4d-4e5f-8a7b-0c1d2e3f4a5b', best: 5000, bestScore: 10, tutorialDone: true, lang: 'en' }),
        );
      }
    });
    await page.goto('/');
    await expect(page.locator('#best')).toHaveText('5.00 km');

    await page.locator('#settingsNav').click();
    await expect(page.locator('#units')).toContainText('km');
    await page.locator('#units').click();
    await expect(page.locator('#units')).toContainText('mi');
    expect((await save(page)).units).toBe('mi');
    await page.locator('#closeModal').click();
    await expect(page.locator('#best')).toHaveText('3.11 mi');

    // The HUD speed follows the unit, and the choice survives a reload.
    await page.locator('#start').click();
    await expect(page.locator('#speed em')).toHaveText('mph');
    await page.reload();
    await expect(page.locator('#best')).toHaveText('3.11 mi');
  });
});

test('the Next button stays in the same place on every step', async ({ page }) => {
  await page.goto('/');
  await page.locator('#settingsNav').click();
  await page.locator('#tutorial').click();
  const first = await page.locator('#tutNext').boundingBox();
  await page.locator('#tutNext').click();
  const second = await page.locator('#tutNext').boundingBox();
  expect(second!.x).toBeCloseTo(first!.x, 0);
  expect(second!.width).toBeCloseTo(first!.width, 0);
});
