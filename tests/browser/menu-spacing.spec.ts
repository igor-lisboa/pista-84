import {expect, test} from '@playwright/test';

for (const [width, height] of [[320, 568], [375, 667], [390, 844], [568, 320], [667, 375], [844, 390], [768, 1024], [1024, 768], [1440, 900]]) {
  test(`menu composition and navigation at ${width}x${height}`, async ({page}, testInfo) => {
    await page.setViewportSize({width: width!, height: height!});
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const layout = await page.locator('#menu').evaluate(menu => {
      const box = (selector: string) => {
        const rect = menu.querySelector(selector)!.getBoundingClientRect();
        return {left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, center: rect.left + rect.width / 2};
      };
      return {title: box('.title-block'), actions: box('.menu-actions'), car: box('.selected-car'),
        top: box('.menu-top'), bottom: box('.menu-bottom'), overflow: menu.scrollWidth > menu.clientWidth};
    });
    expect(layout.overflow).toBe(false);
    expect(layout.actions.top - layout.top.bottom).toBeGreaterThanOrEqual(10);
    expect(layout.bottom.top - layout.actions.bottom).toBeGreaterThanOrEqual(10);
    if (width! < height!) {
      expect(Math.abs(layout.actions.center - width! / 2)).toBeLessThan(1);
      expect(Math.abs(layout.title.center - width! / 2)).toBeLessThan(1);
      expect(Math.abs(layout.car.center - width! / 2)).toBeLessThan(1);
      expect(layout.actions.top - layout.title.bottom).toBeGreaterThanOrEqual(16);
    } else {
      expect(layout.actions.left - layout.title.right).toBeGreaterThanOrEqual(24);
    }
    for (const id of ['start', 'garageNav', 'coinsNav', 'leaderboardNav', 'remoteNav', 'settingsNav', 'aboutNav', 'garageOpen', 'best', 'wallet']) {
      await expect(page.locator(`#${id}`)).toBeInViewport({ratio: 1});
    }
    await page.screenshot({path: testInfo.outputPath(`menu-${width}x${height}.png`)});
    await page.locator('#garageNav').click();
    await expect(page.locator('.car-card')).toHaveCount(22);
    await page.locator('#closeModal').click();
    if (width! < height!) {
      await page.locator('#coinsNav').click();
      const content = await page.locator('#modalBody').boundingBox();
      expect(Math.abs(content!.y + content!.height / 2 - height! / 2)).toBeLessThan(32);
      await page.locator('#closeModal').click();
    }
    await page.locator('#start').click();
    await expect(page.locator('#menu')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(page.locator('#resume')).toBeVisible();
    await page.locator('#toMenu').click();
    await expect(page.locator('#menu')).toBeVisible();
  });
}
