import { expect, test } from '@playwright/test';
import { hudSpeed } from './support/harness.ts';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('phone layout: tap starts a race, controls are reachable and nothing scrolls', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => Object.defineProperty(screen, 'orientation', { value: undefined, configurable: true }));
  await page.goto('/');
  await page.locator('#start').tap();
  await expect(page.locator('#menu')).toBeHidden();
  await expect(page.locator('#raceUI')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth)).toBe(true);

  for (const name of ['left', 'right', 'brake', 'accelerate']) {
    const button = page.locator(`[data-control="${name}"]`);
    await expect(button).toBeVisible();
    const reachable = await button.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const topmost = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return rect.top >= 0 && rect.bottom <= (window.visualViewport?.height ?? innerHeight) && element.contains(topmost);
    });
    expect(reachable, name).toBe(true);
  }

  await page.locator('[data-control="accelerate"]').dispatchEvent('pointerdown', { pointerId: 1 });
  await page.locator('[data-control="right"]').dispatchEvent('pointerdown', { pointerId: 2 });
  await page.waitForTimeout(600);
  expect(await hudSpeed(page)).toBeGreaterThan(15);
  await page.locator('[data-control="accelerate"]').dispatchEvent('pointerup', { pointerId: 1 });
  await page.locator('[data-control="right"]').dispatchEvent('pointerup', { pointerId: 2 });
  await page.locator('#pause').tap();
  await expect(page.locator('#resume')).toBeVisible();
  await page.locator('#toMenu').tap();
  await expect(page.locator('#menu')).toBeVisible();
  expect(errors).toEqual([]);
});

test('pedals sit bottom-right, arrows bottom-left, and the HUD stays out of both corners', async ({ page }) => {
  await page.goto('/');
  await page.locator('#start').tap();
  const boxes = await page.evaluate(() => {
    const box = (selector: string) => {
      const rect = document.querySelector(selector)!.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    };
    return { accelerate: box('[data-control="accelerate"]'), left: box('[data-control="left"]'), speed: box('.hud-speed'), fuel: box('.fuel'), width: innerWidth, height: innerHeight };
  });
  expect(boxes.accelerate.right).toBeGreaterThan(boxes.width * 0.7);
  expect(boxes.left.left).toBeLessThan(boxes.width * 0.3);
  expect(boxes.speed.bottom).toBeLessThan(boxes.height * 0.3);
  expect(boxes.fuel.bottom).toBeLessThan(boxes.height * 0.3);
});

test('landscape phone keeps the pedals inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/');
  await page.locator('#start').tap();
  await expect(page.locator('#raceUI')).toBeVisible();
  const size = await page.locator('#game').evaluate((canvas: HTMLCanvasElement) => ({
    ratio: canvas.width / canvas.height,
    ratioCss: canvas.clientWidth / canvas.clientHeight,
  }));
  expect(Math.abs(size.ratio - size.ratioCss)).toBeLessThan(0.02);
  await expect(page.locator('[data-control="accelerate"]')).toBeVisible();
});
