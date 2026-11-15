import {test, expect} from '@playwright/test';

for (const viewport of [{width: 390, height: 844}, {width: 844, height: 390}, {width: 320, height: 568}, {width: 568, height: 320}]) {
  test(`pairing heading, QR and actions remain composed at ${viewport.width}x${viewport.height}`, async ({page}, testInfo) => {
    await page.setViewportSize(viewport); await page.goto('/');
    await page.locator('#remoteNav').click();
    await expect(page.locator('#remoteLink img')).toBeVisible();
    const bounds = await page.evaluate(() => {
      const box = (selector: string) => {
        const element = document.querySelector(selector); if (!element) throw new Error('Missing surface');
        const r = element.getBoundingClientRect(); return {left: r.left, top: r.top, right: r.right, bottom: r.bottom};
      };
      const dialog = document.querySelector('#modal'); if (!dialog) throw new Error('No dialog');
      return {close: box('#closeModal'), heading: box('.remote-heading'), qr: box('#remoteLink img'),
        actions: box('.remote-actions'), label: box('.remote-heading .label'), scroll: dialog.scrollHeight - dialog.clientHeight};
    });
    expect(bounds.heading.top).toBeGreaterThan(bounds.close.bottom + 2);
    expect(bounds.label.left).toBeGreaterThanOrEqual(0); expect(bounds.label.right).toBeLessThanOrEqual(viewport.width);
    if (viewport.width > viewport.height) {
      expect(bounds.qr.right + 10).toBeLessThan(bounds.heading.left);
      expect(bounds.actions.bottom - bounds.heading.top).toBeLessThan(viewport.height - 60);
      expect(bounds.scroll).toBeLessThanOrEqual(1);
    }
    await expect(page.locator('#pairAgain')).toBeInViewport({ratio: 1});
    // Pairing credentials stay out of committed visual evidence.
    await page.screenshot({path: testInfo.outputPath(`pairing-${viewport.width}.png`), mask: [page.locator('#remoteLink')]});
    await page.locator('#closeModal').click(); await expect(page.locator('#modal')).toBeHidden();
  });
}

test('portrait menu fits visual-viewport height and camera/home safe areas', async ({page}, testInfo) => {
  await page.setViewportSize({width: 390, height: 844}); await page.goto('/');
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--app-height', '750px');
    document.documentElement.style.setProperty('--safe-top', '47px');
    document.documentElement.style.setProperty('--safe-bottom', '34px');
  });
  const positions = await page.locator('#menu').evaluate(menu => {
    const car = menu.querySelector('.selected-car')?.getBoundingClientRect();
    const footer = menu.querySelector('.menu-bottom')?.getBoundingClientRect();
    return {scroll: menu.scrollHeight - menu.clientHeight, carBottom: car?.bottom ?? Infinity, footerBottom: footer?.bottom ?? Infinity};
  });
  expect(positions.scroll).toBeLessThanOrEqual(1);
  expect(positions.carBottom).toBeLessThan(716); expect(positions.footerBottom).toBeLessThanOrEqual(716);
  await page.screenshot({path: testInfo.outputPath('menu-visual-viewport.png')});
});
