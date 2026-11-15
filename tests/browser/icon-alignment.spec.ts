import {expect, test, type Page} from '@playwright/test';

async function centeredIcons(page: Page, selector: string): Promise<void> {
  const offsets = await page.locator(selector).evaluateAll(elements => elements.filter(el => el.getClientRects().length).map(el => {
    const svg = el.querySelector('svg'); if (!svg) throw new Error('Missing icon');
    const box = el.getBoundingClientRect(), art = svg.getBoundingClientRect();
    return {x: Math.abs(box.x + box.width / 2 - art.x - art.width / 2), y: Math.abs(box.y + box.height / 2 - art.y - art.height / 2)};
  }));
  expect(offsets.length).toBeGreaterThan(0);
  for (const offset of offsets) { expect(offset.x).toBeLessThanOrEqual(1); expect(offset.y).toBeLessThanOrEqual(1); }
}

async function closeCorner(page: Page, rtl = false): Promise<void> {
  const bounds = await page.locator('#modal').boundingBox(), close = await page.locator('#closeModal').boundingBox();
  if (!bounds || !close) throw new Error('Missing open dialog');
  const center = close.x + close.width / 2, middle = bounds.x + bounds.width / 2;
  if (rtl) expect(center).toBeLessThan(middle);
  else expect(center).toBeGreaterThan(middle);
  expect(close.y).toBeGreaterThanOrEqual(bounds.y - 1);
  expect(close.y + close.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1);
}

for (const viewport of [{width: 1440, height: 900}, {width: 800, height: 450}, {width: 375, height: 667}]) {
  test(`menu, settings, dialog and HUD icons center at ${viewport.width}x${viewport.height}`, async ({page}, testInfo) => {
    await page.setViewportSize(viewport); await page.goto('/');
    await centeredIcons(page, '.menu-tools .icon-button, .menu-actions [data-icon]');
    const menuOffsets = await page.locator('.menu-actions button').evaluateAll(buttons => buttons.map(button => {
      const icon = button.querySelector('[data-icon]'); if (!icon) throw new Error('Missing action icon');
      const a = button.getBoundingClientRect(), b = icon.getBoundingClientRect();
      return Math.abs(a.y + a.height / 2 - b.y - b.height / 2);
    }));
    for (const offset of menuOffsets) expect(offset).toBeLessThanOrEqual(1);
    await page.screenshot({path: testInfo.outputPath(`menu-icons-${viewport.width}.png`)});
    await page.locator('#settingsNav').click();
    await centeredIcons(page, '#closeModal, .row-icon');
    await closeCorner(page);
    await page.screenshot({path: testInfo.outputPath(`settings-icons-${viewport.width}.png`)});
    await page.locator('[data-lang="ur"]').click();
    await centeredIcons(page, '#closeModal'); await closeCorner(page, true);
    await page.screenshot({path: testInfo.outputPath(`settings-rtl-icons-${viewport.width}.png`)});
    await page.locator('[data-lang="pt-BR"]').click(); await closeCorner(page);
    await page.locator('#closeModal').click();
    await page.locator('#aboutNav').click(); await centeredIcons(page, '#closeModal'); await closeCorner(page);
    await page.locator('#closeModal').click();
    await page.locator('#start').click(); await centeredIcons(page, '#pause');
    await page.locator('#pause').click(); await expect(page.locator('#resume svg')).toBeVisible();
  });
}
