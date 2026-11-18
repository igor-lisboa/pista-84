import {expect, test} from '@playwright/test';

test.use({storageState: {cookies: [], origins: []}, serviceWorkers: 'block'});
test.describe.configure({mode: 'parallel'});

for (const close of ['button', 'close', 'escape']) {
  test(`${close} continues to the unseen tutorial without consuming the demo`, async ({page}) => {
    await page.goto('/');
    await expect(page.locator('#introCar')).toContainText('Fusca 76');
    await expect(page.locator('#usernameForm')).toHaveCount(0);
    if (close === 'escape') await page.keyboard.press('Escape');
    else await page.locator(close === 'button' ? '#introContinue' : '#closeModal').click();
    await expect(page.locator('.tutorial-count')).toContainText('1');
    await page.locator('#tutSkip').click();
    await expect(page.locator('#modal')).toBeHidden();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pista84')!))).toMatchObject({
      tutorialDone: true, demoUsed: false, selected: 'fusca', owned: ['fusca'],
    });
  });
}

test('completed tutorial is not repeated and completed demo suppresses the welcome', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('pista84', JSON.stringify({
    tutorialDone: true, demoUsed: location.search !== '?pending', selected: 'brasilia', owned: ['fusca', 'brasilia'],
  })));
  await page.goto('/?pending');
  await expect(page.locator('#introCar')).toContainText('Brasília');
  await page.locator('#introContinue').click();
  await expect(page.locator('#modal')).toBeHidden();
  await expect(page.locator('#tutNext')).toHaveCount(0);
  await page.goto('/');
  await expect(page.locator('#modal')).toBeHidden();
  await expect(page.locator('#introContinue')).toHaveCount(0);
});

for (const [width, height] of [[320, 568], [568, 320], [375, 667], [667, 375], [768, 1024], [1024, 768], [900, 1440], [1440, 900]] as const) {
  test(`welcome is readable and its action reachable in all locales at ${width}x${height}`, async ({page}, testInfo) => {
    test.setTimeout(120000);
    await page.setViewportSize({width, height});
    await page.addInitScript(() => localStorage.setItem('pista84', JSON.stringify({
      lang: new URLSearchParams(location.search).get('lang'), tutorialDone: false, demoUsed: false,
    })));
    for (const lang of ['pt-BR', 'en', 'pt-PT', 'fr', 'it', 'ja', 'de', 'es', 'hi', 'zh-CN', 'id', 'ur', 'bn', 'ru', 'am']) {
      await page.goto(`/?lang=${lang}`);
      await expect(page.locator('#introCar')).toContainText('Fusca 76');
      await expect(page.locator('html')).toHaveAttribute('dir', lang === 'ur' ? 'rtl' : 'ltr');
      expect(await page.locator('#modal').evaluate(element => ({
        top: element.scrollTop, fits: element.scrollWidth <= element.clientWidth + 1,
      })), lang).toEqual({top: 0, fits: true});
      await page.screenshot({path: testInfo.outputPath(`welcome-${lang}-${width}x${height}.png`)});
      await page.locator('#introContinue').click();
      await expect(page.locator('.tutorial-count')).toBeVisible();
    }
  });
}

test('welcome respects simulated modern-phone safe insets in both orientations', async ({page}, testInfo) => {
  for (const [width, height] of [[393, 852], [852, 393]] as const) {
    await page.setViewportSize({width, height});
    await page.goto('/');
    await page.addStyleTag({content: ':root{--safe-top:24px;--safe-right:28px;--safe-bottom:21px;--safe-left:32px}'});
    await expect(page.locator('#introCar')).toBeVisible();
    await page.locator('#introContinue').scrollIntoViewIfNeeded();
    const rect = await page.locator('#introContinue').boundingBox();
    if (!rect) throw new Error('Missing continue action');
    expect(rect.x).toBeGreaterThanOrEqual(32);
    expect(rect.y + rect.height).toBeLessThanOrEqual(height - 21);
    expect(rect.x + rect.width).toBeLessThanOrEqual(width - 28);
    await page.screenshot({path: testInfo.outputPath(`welcome-safe-${width}x${height}.png`)});
  }
});
