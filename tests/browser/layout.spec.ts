import { expect, test } from '@playwright/test';
import { loadHarness } from './support/harness.ts';

const VIEWPORTS = [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1280, height: 720 }];

test('HUD frames stay fixed as score, distance, speed and fuel digits change', async ({ page }) => {
  await page.goto('/');
  await loadHarness(page);
  await page.locator('#start').click();
  await page.evaluate(() => document.fonts.ready);
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    const frames = await page.evaluate(() => {
      const hud = new window.Pista.Hud();
      const race = new window.Pista.Race();
      race.start();
      return [0, 99, 9999, 9999999].map((n, i) => {
        race.score = n;
        race.distance = n;
        race.speed = i * 100;
        race.fuel = i ? 9 : 100;
        hud.update(race, 0, 1000 + i * 1000);
        return ['.hud-speed', '.hud-trip', '.fuel', '#pause'].map((selector) => {
          const r = document.querySelector(selector)!.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        });
      });
    });
    for (const frame of frames) expect(frame).toEqual(frames[0]);
    if (!(viewport.width > viewport.height && viewport.height <= 570)) {
      const trip = frames[0]![1]!;
      expect(Math.abs(trip.x + trip.width / 2 - viewport.width / 2)).toBeLessThan(1);
    }
    for (const box of frames[0]!) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    }
  }
});

test('phone popups are centred and garage buttons and paint choices align', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  for (const viewport of VIEWPORTS.slice(0, 3)) {
    await page.setViewportSize(viewport);
    await page.locator('#start').click();
    await page.locator('#pause').click();
    const card = await page.locator('.overlay-card').boundingBox();
    expect(Math.abs(card!.x + card!.width / 2 - viewport.width / 2)).toBeLessThan(1);
    expect(card!.x).toBeGreaterThanOrEqual(0);
    if (card!.height < viewport.height - 40) {
      expect(Math.abs(card!.y + card!.height / 2 - viewport.height / 2)).toBeLessThan(1);
    }
    await page.locator('#toMenu').click();
    await page.locator('#garageNav').click();
    const layout = await page.locator('#modal').evaluate((dialog) => {
      const rect = dialog.getBoundingClientRect();
      const rows = new Map<number, number[]>();
      for (const card of dialog.querySelectorAll('.car-card')) {
        const y = Math.round(card.getBoundingClientRect().top);
        const tops = rows.get(y) ?? [];
        tops.push(card.querySelector('button')!.getBoundingClientRect().top);
        rows.set(y, tops);
      }
      return { centre: rect.x + rect.width / 2, overflow: dialog.scrollWidth - dialog.clientWidth, rows: [...rows.values()], paints: [...dialog.querySelectorAll('.paint-option')].map((p) => p.getBoundingClientRect().width) };
    });
    expect(Math.abs(layout.centre - viewport.width / 2)).toBeLessThan(1);
    expect(layout.overflow).toBeLessThanOrEqual(1);
    for (const row of layout.rows) expect(Math.max(...row) - Math.min(...row)).toBeLessThanOrEqual(1);
    expect(Math.max(...layout.paints) - Math.min(...layout.paints)).toBeLessThanOrEqual(1);
    await expect(page.locator('.paint-option')).toHaveCount(17);
    await page.locator('#closeModal').click();
  }
});
