import { expect, test } from '@playwright/test';

const NEW_LANGUAGES = {
  es: 'JUGAR', hi: 'खेलें', 'zh-CN': '开始游戏', id: 'MAIN',
  ur: 'کھیلیں', bn: 'খেলুন', ru: 'ИГРАТЬ', am: 'ይጫወቱ',
};

test('all new language flags select translated text and persist the choice', async ({ page }) => {
  await page.goto('/');
  await page.locator('#settingsNav').click();
  await expect(page.locator('.flag')).toHaveCount(15);
  // Spanish explicitly uses the red/yellow/red flag of Spain.
  await expect(page.locator('[data-lang="es"] svg rect[fill="#aa151b"]')).toHaveCount(1);
  await expect(page.locator('[data-lang="es"] svg rect[fill="#f1bf00"]')).toHaveCount(1);
  for (const [lang, play] of Object.entries(NEW_LANGUAGES)) {
    await page.locator(`[data-lang="${lang}"]`).click();
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page.locator('html')).toHaveAttribute('dir', lang === 'ur' ? 'rtl' : 'ltr');
    await expect(page.locator(`[data-lang="${lang}"]`)).toHaveAttribute('aria-checked', 'true');
    await page.locator('#closeModal').click();
    await expect(page.locator('#start span')).toHaveText(play);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('#settingsNav').click();
  }
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'am');
  await expect(page.locator('#start span')).toHaveText(NEW_LANGUAGES.am);
});

test('Urdu browser detection preserves physical steering and pedal positions on a phone', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ur-PK', hasTouch: true, isMobile: true });
  try {
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ur');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('#start span')).toHaveText(NEW_LANGUAGES.ur);
    await page.locator('#start').tap();
    const positions = await page.evaluate(() => {
      const left = (name: string) => document.querySelector(`[data-control="${name}"]`)!.getBoundingClientRect().left;
      return { left: left('left'), right: left('right'), brake: left('brake'), accelerate: left('accelerate') };
    });
    expect(positions.left).toBeLessThan(positions.right);
    expect(positions.right).toBeLessThan(positions.brake);
    expect(positions.brake).toBeLessThan(positions.accelerate);
    await page.locator('#pause').tap();
    const popup = await page.locator('.overlay-card').boundingBox();
    expect(Math.abs(popup!.x + popup!.width / 2 - 195)).toBeLessThan(1);
    await page.locator('#pauseSettings').tap();
    await page.locator('[data-lang="es"]').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  } finally {
    await context.close();
  }
});
