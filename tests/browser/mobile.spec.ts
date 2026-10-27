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
    fit: getComputedStyle(canvas).objectFit,
  }));
  expect(size.ratio).toBeCloseTo(4 / 3);
  expect(size.fit).toBe('contain');
  await expect(page.locator('[data-control="accelerate"]')).toBeVisible();
});

test('landscape HUD fits small phones and leaves the driving controls clear', async ({ page }) => {
  await page.goto('/');
  await page.locator('#start').tap();
  for (const viewport of [{ width: 568, height: 320 }, { width: 667, height: 375 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    const boxes = await page.evaluate(() => {
      const rect = (selector: string) => {
        const box = document.querySelector(selector)!.getBoundingClientRect();
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
      };
      return {
        hud: ['.hud-speed', '.hud-trip', '.fuel', '#pause'].map(rect),
        controls: ['.steering', '.pedals'].map(rect),
        width: window.visualViewport!.width,
        height: window.visualViewport!.height,
        scrollWidth: document.documentElement.scrollWidth,
      };
    });
    expect(boxes.scrollWidth).toBe(viewport.width);
    for (const hud of boxes.hud) {
      expect(hud.left).toBeGreaterThanOrEqual(0);
      expect(hud.right).toBeLessThanOrEqual(boxes.width);
      expect(hud.top).toBeGreaterThanOrEqual(0);
      expect(hud.bottom).toBeLessThanOrEqual(boxes.height);
      for (const control of boxes.controls) {
        expect(hud.bottom <= control.top || hud.right <= control.left || hud.left >= control.right).toBe(true);
      }
    }
    expect(boxes.hud[1]!.top).toBeGreaterThanOrEqual(boxes.hud[0]!.bottom);
    expect(boxes.hud[2]!.left).toBeGreaterThan(boxes.width / 2);
  }
});

test('rapid steering taps keep the viewport at its original scale and release the controls', async ({ page }) => {
  await page.goto('/');
  await page.locator('#start').tap();
  const initialScale = await page.evaluate(() => window.visualViewport!.scale);
  for (const name of ['left', 'right']) {
    const button = page.locator(`[data-control="${name}"]`);
    await button.tap();
    await button.tap();
    await expect(button).not.toHaveClass(/pressed/);
  }
  expect(await page.evaluate(() => window.visualViewport!.scale)).toBe(initialScale);
  // Check native gesture defaults too: desktop emulation alone may not perform Safari's zoom.
  const prevented = await page.locator('[data-control="left"]').evaluate((button) => {
    const end = new Event('touchend', { bubbles: true, cancelable: true });
    const doubleClick = new MouseEvent('dblclick', { bubbles: true, cancelable: true });
    button.dispatchEvent(end);
    button.dispatchEvent(doubleClick);
    return { end: end.defaultPrevented, doubleClick: doubleClick.defaultPrevented };
  });
  expect(prevented).toEqual({ end: true, doubleClick: true });
});
