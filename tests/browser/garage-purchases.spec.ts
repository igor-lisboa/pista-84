import {expect, test} from '@playwright/test';

test.describe('garage', () => {
  // The service worker would bypass the stubbed runtime config below.
  test.use({ serviceWorkers: 'block' });

  test('new paint purchases debit coins once and persist the selected color', async ({ page }) => {
    await page.route('**/runtime-config.json', (route) => route.fulfill({ json: { coins: null } }));
    await page.addInitScript(() => {
      if (!JSON.parse(localStorage.getItem('pista84') ?? '{}').owned) localStorage.setItem('pista84', JSON.stringify({ username: 'Tester', tutorialDone: true, demoUsed: true, coins: 500, owned: ['fusca'], selected: 'fusca' }));
    });
    await page.goto('/');
    await page.locator('#garageNav').click();
    await page.getByRole('button', { name: /Preto obsidiana/ }).click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pista84')!));
    expect(saved.coins).toBe(380);
    expect(saved.paint).toBe('black');
    expect(saved.paints).toContain('black');
    await page.reload();
    await page.locator('#garageNav').click();
    await expect(page.locator('.paint-option.active')).toHaveAttribute('aria-label', /Preto obsidiana/);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pista84')!).coins)).toBe(380);
  });

  test('garage purchases persist; all cars use coins and expensive cars require sufficient funds', async ({ page }) => {
    // A local .env may configure a balance; this test needs the stored one.
    await page.route('**/runtime-config.json', (route) => route.fulfill({ json: { coins: null } }));
    // Seed before the first load: rewriting storage on a live page would be overwritten on pagehide.
    await page.addInitScript(() => {
      if (localStorage.getItem('garage-fixture')) return;
      localStorage.setItem('pista84', JSON.stringify({ username: 'Tester', tutorialDone: true, demoUsed: true, coins: 500, best: 100, owned: ['fusca'], selected: 'fusca' }));
      localStorage.setItem('garage-fixture', 'yes');
    });
    await page.goto('/');
    await page.locator('#garageNav').click();

    await expect(page.locator('.car-card h3')).toHaveText([
      'Fusca 76', 'Uno', 'CG 125', 'Fiat 147', 'Brasília 80', 'Biz 125', 'Kombi 78', 'Chevette 82',
      'Moto urbana', 'Palio 98', 'Gol Bolinha', 'Passat 85', 'Bruto 4×4', 'Opala SS', 'Puma GT', 'Maverick GT', 'Marea Turbo',
      'Uno com Escada', 'Harley Electra Glide', 'Raio 1000', 'Hayabusa', 'Veloce GT',
    ]);

    const brasilia = page.locator('.car-card').filter({ has: page.getByRole('heading', { name: 'Brasília 80' }) });
    await brasilia.getByRole('button').click();
    await expect(brasilia.getByRole('button')).toHaveText('SELECIONADO');
    await page.getByRole('button', { name: /Cereja/ }).click();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pista84')!).coins)).toBe(260);

    await expect(page.locator('.car-badge')).toHaveCount(0);
    const gt = page.locator('.car-card').filter({ has: page.getByRole('heading', { name: 'Veloce GT' }) });
    await expect(gt.getByRole('button')).toContainText(/30\.000/);
    await expect(gt.getByRole('button')).toBeDisabled();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pista84')!).owned)).not.toContain('gt');

    await page.reload();
    await expect(page.locator('#carName')).toHaveText('BRASÍLIA 80');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pista84')!).paint)).toBe('cherry');
  });
});

test('new models and high-price vehicles can be purchased and stay owned after reload', async ({ page }) => {
  await page.route('**/runtime-config.json', (route) => route.fulfill({ json: { coins: null } }));
  await page.addInitScript(() => {
    if (localStorage.getItem('garage-fixture')) return;
    localStorage.setItem('pista84', JSON.stringify({ username: 'Tester', tutorialDone: true, demoUsed: true, coins: 60_000, owned: ['fusca'], selected: 'fusca' }));
    localStorage.setItem('garage-fixture', 'yes');
  });
  await page.goto('/');
  await page.locator('#garageNav').click();
  for (const name of ['Fiat 147', 'Marea Turbo', 'Passat 85', 'Puma GT', 'Raio 1000', 'Veloce GT']) {
    const card = page.locator('.car-card').filter({ has: page.getByRole('heading', { name, exact: true }) });
    if (name === 'Puma GT') {
      await expect(card.locator('dd').nth(0)).toHaveText('250 km/h');
      await expect(card.locator('dd').nth(1)).toHaveText('45');
    }
    await card.getByRole('button').click();
    await expect(card.getByRole('button')).toHaveText('SELECIONADO');
  }
  await page.reload();
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('pista84')!));
  expect(save.coins).toBe(5760);
  expect(save.owned).toEqual(expect.arrayContaining(['fiat147', 'marea', 'passat', 'puma', 'superbike', 'gt']));
  expect(save.selected).toBe('gt');
});

test('an environment balance overrides stored and cloud balances while purchases still spend coins', async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: 'block', locale: 'pt-BR' });
  const page = await context.newPage();
  await page.route('**/runtime-config.json', (route) => route.fulfill({ json: { coins: 10000 } }));
  await page.route('**/health', (route) => route.fulfill({ json: { ok: true, cloudBackup: true } }));
  // A guest never contacts the server, so a cloud balance can no longer be pulled into this device.
  let cloudReads = 0;
  await page.route('**/api/progress**', (route) => {
    cloudReads++;
    return route.fulfill({ json: { save: { coins: 7, owned: ['fusca'], selected: 'fusca' }, revision: 1 } });
  });
  await page.addInitScript(() => {
    if (localStorage.getItem('env-balance-fixture')) return;
    localStorage.setItem('pista84', JSON.stringify({ username: 'Tester', tutorialDone: true, demoUsed: true, coins: 3, owned: ['fusca'], selected: 'fusca' }));
    localStorage.setItem('env-balance-fixture', 'yes');
  });
  await page.goto('/');
  await expect(page.locator('#wallet')).toContainText('10.000');
  await page.locator('#garageNav').click();
  await page.locator('.car-card').filter({ has: page.getByRole('heading', { name: 'Uno com Escada' }) }).getByRole('button').click();
  await expect(page.locator('#wallet')).toContainText('6.800');
  expect(cloudReads).toBe(0);
  await page.reload();
  await expect(page.locator('#wallet')).toContainText('10.000');
  await context.close();
});
