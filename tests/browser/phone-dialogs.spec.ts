import { expect, test, type Page } from '@playwright/test';

// iPhone SE (2nd/3rd generation) is the smallest reference screen: 375 x 667 portrait, 667 x 375 landscape.
const SAVE = { tutorialDone: true, username: 'Tester', owned: ['fusca'], selected: 'fusca' };

async function openFreshPlayer(page: Page): Promise<void> {
  await page.addInitScript((save) => {
    if (!localStorage.getItem('pista84')) localStorage.setItem('pista84', JSON.stringify(save));
  }, SAVE);
  await page.goto('/');
  await expect(page.locator('#menu')).toBeVisible();
}

test.describe('iPhone SE portrait', () => {
  test.use({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });

  test('dialogs fill the whole phone screen and the page cannot be pinch zoomed', async ({ page }) => {
    await openFreshPlayer(page);
    await page.locator('#settingsNav').click();
    const box = await page.locator('#modal').boundingBox();
    expect(box?.x).toBeCloseTo(0, 0);
    expect(box?.y).toBeCloseTo(0, 0);
    expect(box?.width).toBeCloseTo(375, 0);
    expect(box?.height).toBeCloseTo(667, 0);
    await page.locator('#closeModal').click();

    const viewport = await page.locator('meta[name=viewport]').getAttribute('content');
    expect(viewport).toContain('user-scalable=no');
    expect(viewport).toContain('maximum-scale=1');
  });

  test('text outside form fields cannot be selected by a double tap', async ({ page }) => {
    await openFreshPlayer(page);
    const selectable = await page.evaluate(() => getComputedStyle(document.body).userSelect);
    expect(selectable).toBe('none');
    await page.locator('#coinsNav').click();
    await expect(page.locator('#modalBody')).toBeVisible();
    await page.locator('#closeModal').click();
  });
});

test.describe('iPhone SE landscape', () => {
  test.use({ viewport: { width: 667, height: 375 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });

  // The settings dialog is long: it scrolls inside the dialog here, so only the compact dialogs must fit.
  for (const [name, open] of [
    ['shop', '#coinsNav'],
  ] as const) {
    test(`the ${name} dialog fits the short landscape screen without scrolling`, async ({ page }) => {
      await openFreshPlayer(page);
      await page.locator(open).click();
      const fits = await page.locator('#modal').evaluate((dialog) => dialog.scrollHeight <= dialog.clientHeight + 1);
      expect(fits).toBe(true);
    });
  }
});
