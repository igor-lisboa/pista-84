import { expect, test, type Page } from '@playwright/test';
import { hudSpeed } from './support/harness.ts';

async function blurFocusedControl(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
}

/** Emulate the browser visibility event without replacing application services. */
async function hideDocument(page: Page): Promise<void> {
  await page.evaluate(() => {
    const original = Object.getOwnPropertyDescriptor(document, 'hidden');
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    try {
      document.dispatchEvent(new Event('visibilitychange'));
    } finally {
      if (original) Object.defineProperty(document, 'hidden', original);
      else Reflect.deleteProperty(document, 'hidden');
    }
  });
}

async function startWithHeldThrottle(page: Page): Promise<void> {
  await page.goto('/');
  await page.locator('#start').click();
  await blurFocusedControl(page);
  await page.keyboard.down('ArrowUp');
  await expect.poll(() => hudSpeed(page)).toBeGreaterThan(12);
}

async function expectPausedWithClearedThrottle(page: Page): Promise<void> {
  await expect(page.locator('#resume')).toBeVisible();
  const distance = await page.locator('#distance').innerText();
  await page.waitForTimeout(150);
  expect(await page.locator('#distance').innerText()).toBe(distance);
  await blurFocusedControl(page);
  await page.keyboard.press('Enter');
  await expect(page.locator('#overlay')).toBeHidden();
  // ArrowUp remains physically held: only clearing the game's input can make it coast to rest.
  await expect.poll(() => hudSpeed(page)).toBe(0);
  await page.keyboard.up('ArrowUp');
}

test.describe('desktop lifecycle', () => {
  test.use({ viewport: { width: 1280, height: 720 }, hasTouch: false, isMobile: false });

  test('Enter starts and resumes while an open modal owns keyboard shortcuts', async ({ page }) => {
    await page.goto('/');
    await page.locator('#settingsNav').click();
    await blurFocusedControl(page);
    await page.keyboard.press('Enter');
    await expect(page.locator('#modal')).toBeVisible();
    await expect(page.locator('#menu')).toBeVisible();
    await expect(page.locator('#raceUI')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(page.locator('#modal')).toBeHidden();

    await blurFocusedControl(page);
    await page.keyboard.press('Enter');
    await expect(page.locator('#menu')).toBeHidden();
    await expect(page.locator('#raceUI')).toBeVisible();
    await page.keyboard.press('p');
    await expect(page.locator('#resume')).toBeVisible();
    await blurFocusedControl(page);
    await page.keyboard.press('Enter');
    await expect(page.locator('#overlay')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(page.locator('#resume')).toBeVisible();
  });

  test('desktop blur pauses the race and releases held throttle', async ({ page }) => {
    await startWithHeldThrottle(page);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expectPausedWithClearedThrottle(page);
  });

  test('a hidden document pauses the race and releases held throttle', async ({ page }) => {
    await startWithHeldThrottle(page);
    await hideDocument(page);
    await expectPausedWithClearedThrottle(page);
  });
});

test.describe('touch lifecycle', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('touch browser-chrome blur keeps racing; hiding the document pauses and clears input', async ({ page }) => {
    await startWithHeldThrottle(page);
    const before = await hudSpeed(page);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(page.locator('#overlay')).toBeHidden();
    await expect.poll(() => hudSpeed(page)).toBeGreaterThan(before + 2);
    await hideDocument(page);
    await expectPausedWithClearedThrottle(page);
  });
});
