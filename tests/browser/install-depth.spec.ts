import { expect, test } from '@playwright/test';
import { loadHarness } from './support/harness.ts';

test('traffic passes behind and in front of the player according to road depth', async ({ page }) => {
  await page.goto('/');
  await loadHarness(page);
  const orders = await page.evaluate(() => {
    const { Renderer, Race, CARS, PLAYER_T, screenToDepth } = window.Pista;
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:960px;height:720px';
    document.body.append(canvas);
    const renderer = new Renderer(canvas);
    const race = new Race();
    race.start();
    // Record the real renderer's paint calls while one car overtakes the player.
    const painter = renderer as unknown as {
      paintPlayer(...args: unknown[]): void;
      paintTraffic(...args: unknown[]): void;
    };
    let order: string[] = [];
    const player = painter.paintPlayer.bind(renderer);
    const traffic = painter.paintTraffic.bind(renderer);
    painter.paintPlayer = (...args) => { order.push('player'); player(...args); };
    painter.paintTraffic = (...args) => { order.push('traffic'); traffic(...args); };
    return [PLAYER_T - 0.06, PLAYER_T + 0.06, PLAYER_T - 0.06].map((t) => {
      race.entities = [{ type: 'traffic', lane: 2, targetLane: 2, z: screenToDepth(t),
        speed: 0, cruise: 0.5, car: CARS[0]!, timer: 1e9, cooldown: 0, passed: false }];
      order = [];
      renderer.draw(race, 0);
      return order;
    });
  });
  expect(orders).toEqual([['traffic', 'player'], ['player', 'traffic'], ['traffic', 'player']]);
});

test('install stays available and accepts a late native prompt only once', async ({ page }) => {
  await page.goto('/');
  await page.locator('#settingsNav').click();
  const button = page.locator('#install');
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.locator('#installHelp')).toContainText('menu do navegador');
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, { prompt: async () => {
      document.documentElement.dataset.installCalls = String(Number(document.documentElement.dataset.installCalls ?? 0) + 1);
      return { outcome: 'dismissed' };
    } });
    window.dispatchEvent(event);
  });
  await button.click();
  await expect(page.locator('html')).toHaveAttribute('data-install-calls', '1');
  await button.click();
  await expect(page.locator('html')).toHaveAttribute('data-install-calls', '1');
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  await expect(button).toHaveText('Jogo instalado');
  await expect(button).toBeDisabled();
  await expect(page.locator('#installHelp')).toBeHidden();
});

test('iPhone has home-screen instructions and detects an installed launch', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'pt-BR',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
    isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await page.goto('/');
    await page.locator('#settingsNav').tap();
    await page.locator('#install').tap();
    await expect(page.locator('#installHelp')).toContainText('No Safari, abra Compartilhar');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
    await page.reload();
    await page.locator('#settingsNav').tap();
    await expect(page.locator('#install')).toBeDisabled();
    await expect(page.locator('#install')).toHaveText('Jogo instalado');
  } finally { await context.close(); }
});

test('a failed native prompt falls back to instructions without an uncaught error', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, { prompt: async () => { throw new Error('Unavailable'); } });
    window.dispatchEvent(event);
  });
  await page.locator('#settingsNav').click();
  await page.locator('#install').click();
  await expect(page.locator('#installHelp')).toBeVisible();
  await expect(page.locator('#install')).toBeEnabled();
  expect(errors).toEqual([]);
});
