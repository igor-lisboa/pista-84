import {expect, test} from '@playwright/test';
import {loadHarness} from './support/harness.ts';

for (const [width, height] of [[320, 568], [568, 320], [375, 667], [667, 375], [768, 1024], [1024, 768], [900, 1440], [1440, 900]] as const) {
  test(`demo transition and actions fit all locales at ${width}x${height}`, async ({page}, testInfo) => {
    await page.setViewportSize({width, height});
    await page.goto('/');
    await loadHarness(page);
    const reports = await page.evaluate(() => {
      const {LANGS, setLang, Race, defaultSave, showGameOver} = window.Pista;
      return Object.keys(LANGS).map(lang => {
        setLang(lang as keyof typeof LANGS);
        const race = new Race();
        race.finish('traffic');
        race.crashSpeed = 300;
        const overlay = document.getElementById('overlay');
        if (!overlay) throw new Error('Missing overlay');
        overlay.hidden = false;
        document.body.dataset.view = 'overlay';
        showGameOver(race, defaultSave(), {restart() {}, toMenu() {}, secondChance() {}, enter() {}}, 'Fusca 76');
        const ids = ['demoTransition', 'restart', 'continue', 'enter', 'toMenu'];
        const elements = ids.map(id => {
          const element = document.getElementById(id);
          if (!element) throw new Error(`Missing ${id}`);
          const rect = element.getBoundingClientRect();
          return {id, fits: rect.top >= 0 && rect.bottom <= innerHeight && rect.left >= 0 && rect.right <= innerWidth};
        });
        return {lang, elements, text: document.getElementById('demoTransition')?.textContent,
          fits: overlay.scrollHeight <= overlay.clientHeight + 1 && overlay.scrollWidth <= overlay.clientWidth + 1};
      });
    });
    for (const report of reports) {
      expect(report.text, report.lang).toContain('Fusca 76');
      expect(report.text, report.lang).not.toContain('{car}');
      expect(report.fits, report.lang).toBe(true);
      for (const element of report.elements) expect(element.fits, `${report.lang}:${element.id}`).toBe(true);
    }
    await page.screenshot({path: testInfo.outputPath(`demo-transition-${width}x${height}.png`)});
  });
}

test('transition names the saved next vehicle and disappears from later results', async ({page}) => {
  await page.goto('/');
  await loadHarness(page);
  await page.evaluate(() => {
    const {Race, defaultSave, showGameOver} = window.Pista;
    const race = new Race(); race.finish('fuel');
    const overlay = document.getElementById('overlay'); if (!overlay) throw new Error('Missing overlay');
    overlay.hidden = false;
    showGameOver(race, defaultSave(), {restart() {}, toMenu() {}, secondChance() {}}, 'Biz 125');
  });
  await expect(page.locator('#demoTransition')).toContainText('Biz 125');
  await page.evaluate(() => {
    const {Race, defaultSave, showGameOver} = window.Pista;
    const race = new Race(); race.finish('fuel');
    showGameOver(race, defaultSave(), {restart() {}, toMenu() {}, secondChance() {}});
  });
  await expect(page.locator('#demoTransition')).toHaveCount(0);
});
