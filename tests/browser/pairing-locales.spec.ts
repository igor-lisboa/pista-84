import {test, expect} from '@playwright/test';
import {loadHarness} from './support/harness.ts';

for (const viewport of [{width: 320, height: 568}, {width: 568, height: 320}, {width: 390, height: 844}, {width: 844, height: 390}]) {
  test(`pairing text stays clear and reachable in every locale at ${viewport.width}x${viewport.height}`, async ({page}, testInfo) => {
    await page.setViewportSize(viewport); await page.goto('/'); await loadHarness(page);
    await page.locator('#remoteNav').click(); await expect(page.locator('#remoteLink img')).toBeVisible();
    const reports = await page.evaluate(() => {
      const {LANGS, setLang, t} = window.Pista;
      const dialog = document.querySelector('#modal');
      if (!(dialog instanceof HTMLDialogElement)) throw new Error('Missing dialog');
      const setText = (selector: string, text: string) => {
        const element = dialog.querySelector(selector); if (!element) throw new Error('Missing text');
        element.textContent = text;
      };
      return Object.keys(LANGS).map(lang => {
        setLang(lang as keyof typeof LANGS); document.documentElement.dir = lang === 'ur' ? 'rtl' : 'ltr';
        setText('.remote-heading .label', t('remote.label'));
        setText('.remote-heading h1', `${t('remote.title')}.`);
        setText('#remoteState', t('remote.scan')); setText('.remote-help', t('remote.help'));
        setText('#pairAgain', t('remote.again')); setText('#remoteLink a', t('remote.open'));
        dialog.scrollTop = 0;
        const close = dialog.querySelector('#closeModal')?.getBoundingClientRect();
        const heading = dialog.querySelector('.remote-heading')?.getBoundingClientRect();
        return {lang, closeTop: close?.top, headingTop: heading?.top, bodyTop: dialog.querySelector('#modalBody')?.getBoundingClientRect().top,
          horizontal: dialog.scrollWidth <= dialog.clientWidth + 1,
          clearance: (heading?.top ?? 0) - (close?.bottom ?? Infinity)};
      });
    });
    for (const report of reports) {
      expect(report.horizontal, report.lang).toBe(true); expect(report.clearance, JSON.stringify(report)).toBeGreaterThan(2);
    }
    await page.locator('#pairAgain').scrollIntoViewIfNeeded(); await expect(page.locator('#pairAgain')).toBeInViewport({ratio: 1});
    await expect(page.locator('#closeModal')).toBeInViewport({ratio: 1});
    await page.evaluate(() => {
      const {setLang, t} = window.Pista; setLang('en'); document.documentElement.dir = 'ltr';
      const fields = [['.remote-heading .label', 'remote.label'], ['.remote-heading h1', 'remote.title'],
        ['#remoteState', 'remote.scan'], ['.remote-help', 'remote.help'], ['#pairAgain', 'remote.again'], ['#remoteLink a', 'remote.open']] as const;
      for (const [selector, key] of fields) { const element = document.querySelector(selector); if (element) element.textContent = t(key); }
      const dialog = document.querySelector('#modal'); if (dialog) dialog.scrollTop = 0;
    });
    await page.screenshot({path: testInfo.outputPath(`pairing-en-${viewport.width}.png`), mask: [page.locator('#remoteLink')]});
  });
}
