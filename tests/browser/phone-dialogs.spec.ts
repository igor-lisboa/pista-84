import { loadHarness } from './support/harness.ts';
import { expect, test, type Page } from '@playwright/test';

// iPhone SE (2nd/3rd generation) is the smallest reference screen: 375 x 667 portrait, 667 x 375 landscape.
const SAVE = { tutorialDone: true, username: 'Tester', owned: ['fusca'], selected: 'fusca' };

async function openFreshPlayer(page: Page): Promise<void> {
  await page.addInitScript((save) => {
    if (!localStorage.getItem('pista84')) localStorage.setItem('pista84', JSON.stringify(save));
  }, SAVE);
  await page.goto('/');
  await expect(page.locator('#menu')).toBeVisible();
}

test.describe('iPhone SE portrait', () => {
  test.use({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });

  test('dialogs fill the whole phone screen and the page cannot be pinch zoomed', async ({ page }) => {
    await openFreshPlayer(page);
    await page.locator('#settingsNav').click();
    const box = await page.locator('#modal').boundingBox();
    expect(box?.x).toBeCloseTo(0, 0);
    expect(box?.y).toBeCloseTo(0, 0);
    expect(box?.width).toBeCloseTo(375, 0);
    expect(box?.height).toBeCloseTo(667, 0);
    await page.locator('#closeModal').click();

    const viewport = await page.locator('meta[name=viewport]').getAttribute('content');
    expect(viewport).toContain('user-scalable=no');
    expect(viewport).toContain('maximum-scale=1');
  });

  test('text outside form fields cannot be selected by a double tap', async ({ page }) => {
    await openFreshPlayer(page);
    const selectable = await page.evaluate(() => getComputedStyle(document.body).userSelect);
    expect(selectable).toBe('none');
    await page.locator('#coinsNav').click();
    await expect(page.locator('#modalBody')).toBeVisible();
    await page.locator('#closeModal').click();
  });
});

test.describe('iPhone SE landscape', () => {
  test.use({ viewport: { width: 667, height: 375 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });

  // The settings dialog is long: it scrolls inside the dialog here, so only the compact dialogs must fit.
  for (const [name, open] of [
    ['shop', '#coinsNav'],
  ] as const) {
    test(`the ${name} dialog fits the short landscape screen without scrolling`, async ({ page }) => {
      await openFreshPlayer(page);
      await page.locator(open).click();
      const fits = await page.locator('#modal').evaluate((dialog) => dialog.scrollHeight <= dialog.clientHeight + 1);
      expect(fits).toBe(true);
    });
  }
});

for (const [width, height] of [[375, 667], [667, 375], [320, 568], [568, 320], [768, 1024], [1024, 768], [900, 1440], [1440, 900]]) {
  test(`results and dialog headers fit ${width}x${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({width: width!, height: height!});
    await openFreshPlayer(page);
    for (const nav of ['#settingsNav', '#aboutNav']) {
      await page.locator(nav).click();
      expect(await page.locator('#modal').evaluate(el => el.scrollTop)).toBe(0);
      await expect(page.locator('#modalBody h1')).toBeInViewport();
      expect(await page.locator('#modal').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      // Reopening another dialog must reset a previously scrolled modal.
      await page.locator('#modal').evaluate(el => { el.scrollTop = el.scrollHeight; });
      await page.locator('#closeModal').click();
    }
    await loadHarness(page);
    for (const reason of ['traffic', 'fuel'] as const) {
      await page.evaluate(reason => {
        const {Race, defaultSave, showGameOver} = window.Pista;
        const race = new Race();
        race.crashSpeed = 390;
        race.finish(reason);
        document.body.dataset.view = 'overlay';
        document.getElementById('overlay')!.hidden = false;
        showGameOver(race, defaultSave(), {restart() {}, secondChance() {}, toMenu() {}, enter() {}});
      }, reason);
      for (const id of ['restart', 'continue', 'enter', 'toMenu']) await expect(page.locator(`#${id}`)).toBeInViewport();
      expect(await page.locator('#overlay').evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
      expect(await page.locator('#overlay').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    }
    if (width === 667 || width === 375) await page.screenshot({path: testInfo.outputPath(`result-${width}x${height}.png`)});
  });
}

for (const safe of [
  {width: 430, height: 932, top: 59, right: 0, bottom: 34, left: 0},
  {width: 932, height: 430, top: 0, right: 59, bottom: 21, left: 59},
]) {
  test(`camera cutout and rounded-corner safe rectangle at ${safe.width}x${safe.height}`, async ({page}) => {
    await page.setViewportSize({width: safe.width, height: safe.height});
    await openFreshPlayer(page);
    await page.evaluate(({top, right, bottom, left}) => {
      const root = document.documentElement.style;
      root.setProperty('--safe-top', `${top}px`);
      root.setProperty('--safe-right', `${right}px`);
      root.setProperty('--safe-bottom', `${bottom}px`);
      root.setProperty('--safe-left', `${left}px`);
    }, safe);
    const menuTop = await page.locator('.menu-top').boundingBox();
    expect(menuTop!.x).toBeGreaterThanOrEqual(safe.left);
    expect(menuTop!.y).toBeGreaterThanOrEqual(safe.top);
    expect(menuTop!.x + menuTop!.width).toBeLessThanOrEqual(safe.width - safe.right + 1);
    await page.locator('#settingsNav').click();
    const dialog = await page.locator('#modal').boundingBox();
    expect(dialog!.x).toBeGreaterThanOrEqual(safe.left);
    expect(dialog!.y).toBeGreaterThanOrEqual(safe.top);
    expect(dialog!.x + dialog!.width).toBeLessThanOrEqual(safe.width - safe.right + 1);
    expect(dialog!.y + dialog!.height).toBeLessThanOrEqual(safe.height - safe.bottom + 1);
    await page.locator('#closeModal').click();
    await loadHarness(page);
    await page.evaluate(() => {
      const raceUi = document.getElementById('raceUI')!;
      raceUi.hidden = false;
      const {Race, defaultSave, showGameOver} = window.Pista;
      const race = new Race(); race.finish('traffic');
      const overlay = document.getElementById('overlay')!; overlay.hidden = false;
      showGameOver(race, defaultSave(), {restart() {}, secondChance() {}, toMenu() {}, enter() {}});
    });
    const hud = await page.locator('.hud').boundingBox();
    expect(hud!.x).toBeGreaterThanOrEqual(safe.left);
    expect(hud!.y).toBeGreaterThanOrEqual(safe.top);
    expect(hud!.x + hud!.width).toBeLessThanOrEqual(safe.width - safe.right + 1);
    const result = await page.locator('.result-card').boundingBox();
    const safeHeight = safe.height - safe.top - safe.bottom;
    expect(result!.y).toBeGreaterThanOrEqual(safe.top);
    expect(result!.y + result!.height).toBeLessThanOrEqual(safe.height - safe.bottom + 1);
    if (safe.height > safe.width) {
      const resultCenter = result!.y + result!.height / 2;
      expect(Math.abs(resultCenter - (safe.top + safeHeight / 2))).toBeLessThan(2);
    }
  });
}

for (const viewport of [{width: 375, height: 667}, {width: 667, height: 375}]) {
  test(`all locales keep result actions visible at ${viewport.width}x${viewport.height}`, async ({page}) => {
    await page.setViewportSize(viewport);
    await openFreshPlayer(page);
    await loadHarness(page);
    const measurements = await page.evaluate(() => {
      const {LANGS, setLang, Race, defaultSave, showGameOver} = window.Pista;
      return Object.keys(LANGS).map(lang => {
        setLang(lang as keyof typeof LANGS);
        const race = new Race();
        race.finish('traffic');
        race.score = 10000000;
        race.distance = 10000000;
        race.coins = 400000;
        document.body.dataset.view = 'overlay';
        const overlay = document.getElementById('overlay')!;
        overlay.hidden = false;
        showGameOver(race, defaultSave(), {restart() {}, secondChance() {}, toMenu() {}, enter() {}});
        const buttons = ['restart', 'continue', 'enter', 'toMenu'].map(id => {
          const el = document.getElementById(id)!;
          const box = el.getBoundingClientRect();
          return {id, fits: box.top >= 0 && box.bottom <= innerHeight && box.left >= 0 && box.right <= innerWidth};
        });
        return {lang, buttons, fits: overlay.scrollHeight <= overlay.clientHeight + 1 && overlay.scrollWidth <= overlay.clientWidth + 1};
      });
    });
    for (const measurement of measurements) {
      expect(measurement.fits, measurement.lang).toBe(true);
      for (const button of measurement.buttons) expect(button.fits, `${measurement.lang}:${button.id}`).toBe(true);
    }
  });
}
