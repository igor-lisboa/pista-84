import { expect, test } from '@playwright/test';

test('with tilt on, a portrait screen asks for landscape and pauses the race until it is turned', async ({ page }) => {
  // No orientation lock here (like iOS): the software fallback must cover it.
  await page.addInitScript(() => {
    Object.defineProperty(screen, 'orientation', { value: undefined, configurable: true });
    // Desktop Chromium has no motion sensor API; a phone does.
    const sensor = ((window as unknown as Record<string, unknown>).DeviceOrientationEvent ??= class {}) as Record<string, unknown>;
    sensor.requestPermission = async () => 'granted';
  });
  await page.setViewportSize({ width: 780, height: 390 });
  await page.goto('/');
  await page.locator('#settingsNav').click();
  await page.locator('#tilt').click();
  await expect(page.locator('body')).toHaveAttribute('data-tilt', 'on');
  await page.locator('#closeModal').click();
  await expect(page.locator('#rotateHint')).toBeHidden();

  await page.locator('#start').click();
  await expect(page.locator('body')).toHaveAttribute('data-view', 'race');

  // The phone drops to portrait mid-race: hint appears and the race pauses.
  await page.setViewportSize({ width: 390, height: 780 });
  await expect(page.locator('#rotateHint')).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-view', 'overlay');

  await page.setViewportSize({ width: 780, height: 390 });
  await expect(page.locator('#rotateHint')).toBeHidden();

  // Escape hatch: back to on-screen buttons straight from the portrait hint.
  await page.setViewportSize({ width: 390, height: 780 });
  await expect(page.locator('#rotateHint')).toBeVisible();
  await page.locator('#rotateOff').click();
  await expect(page.locator('#rotateHint')).toBeHidden();
  await expect(page.locator('body')).toHaveAttribute('data-tilt', 'off');
});
