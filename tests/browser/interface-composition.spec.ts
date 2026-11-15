import {expect, test} from '@playwright/test';

for (const viewport of [{width: 390, height: 844}, {width: 844, height: 390}]) {
  test(`account fields and primary action stay together at ${viewport.width}x${viewport.height}`, async ({page}, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.locator('#settingsNav').click();
    await page.locator('#account').click();
    await expect(page.locator('#accountForm .submit')).toBeInViewport();
    await expect(page.locator('#accountUsername')).toBeInViewport();
    await expect(page.locator('#accountPassword')).toBeInViewport();
    const box = await page.locator('#accountForm').boundingBox();
    expect(box!.width).toBeLessThanOrEqual(620);
    const username = await page.locator('#accountUsername').boundingBox();
    const password = await page.locator('#accountPassword').boundingBox();
    if (viewport.width > viewport.height) expect(username!.y).toBeCloseTo(password!.y, 0);
    await page.screenshot({path: testInfo.outputPath(`account-${viewport.width}x${viewport.height}.png`)});
    await page.locator('#closeModal').click();
    await page.locator('#garageNav').click();
    const grid = await page.locator('.garage-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(grid).toBe(viewport.width > viewport.height ? 2 : 1);
    await page.screenshot({path: testInfo.outputPath(`garage-${viewport.width}x${viewport.height}.png`)});
  });
}

test('short landscape pairing keeps QR code and reconnect action visible together', async ({page}) => {
  await page.setViewportSize({width: 844, height: 390});
  await page.goto('/');
  await page.locator('#remoteNav').click();
  await expect(page.locator('#remoteLink img')).toBeVisible();
  await expect(page.locator('#remoteLink img')).toBeInViewport();
  await expect(page.locator('#pairAgain')).toBeInViewport();
  await expect(page.locator('#remoteLink a')).toBeInViewport();
  await page.locator('#closeModal').click();
  await expect(page.locator('#start')).toBeVisible();
});
