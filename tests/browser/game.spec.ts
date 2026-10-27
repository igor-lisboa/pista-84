import { expect, test, type Page } from '@playwright/test';
import { hudSpeed, loadHarness } from './support/harness.ts';

const CAR_COUNT = 14;

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test('the production atlas and the procedural sprites draw complete, unclipped vehicles', async ({ page }) => {
  await page.goto('/');
  await loadHarness(page);
  const report = await page.evaluate(async () => {
    const { loadSprites, spritesReady, spriteDimensions, drawCar, CARS } = window.Pista;
    await loadSprites();
    const details = CARS.map((car) => {
      const { width, height } = spriteDimensions(car);
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;
      drawCar(ctx, 128, 240, Math.min(210 / width, 210 / height), car);
      const pixels = ctx.getImageData(0, 0, 256, 256).data;
      let count = 0;
      let edge = 0;
      for (let y = 0; y < 256; y++) {
        for (let x = 0; x < 256; x++) {
          if (pixels[(y * 256 + x) * 4 + 3]! > 80) {
            count++;
            if (x === 0 || y === 0 || x === 255 || y === 255) edge++;
          }
        }
      }
      return { id: car.id, count, edge };
    });
    return { ready: spritesReady(), details };
  });
  expect(report.ready).toBe(true);
  expect(report.details).toHaveLength(CAR_COUNT);
  for (const sprite of report.details) {
    expect(sprite.count, sprite.id).toBeGreaterThan(1000);
    expect(sprite.edge, sprite.id).toBe(0);
  }
});

test('menu disappears in race; pause and return to menu keep usable flows', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await expect(page.locator('#menu')).toBeVisible();
  await expect(page.locator('#raceUI')).toBeHidden();
  await page.locator('#start').click();
  await expect(page.locator('#menu')).toBeHidden();
  await expect(page.locator('#raceUI')).toBeVisible();
  await expect(page.locator('#settingsNav')).toBeHidden();

  await page.keyboard.down('ArrowUp');
  await expect.poll(() => hudSpeed(page)).toBeGreaterThan(95);
  await page.keyboard.up('ArrowUp');

  await page.keyboard.press('p');
  await expect(page.locator('#resume')).toBeVisible();
  const distance = await page.locator('#distance').innerText();
  await page.waitForTimeout(250);
  expect(await page.locator('#distance').innerText()).toBe(distance);

  await page.locator('#resume').click();
  await page.keyboard.down(' ');
  await expect.poll(() => hudSpeed(page)).toBe(0);
  await page.keyboard.up(' ');
  await expect(page.locator('#restart')).toHaveCount(0);

  await page.keyboard.down('ArrowUp');
  await expect.poll(() => hudSpeed(page)).toBeGreaterThan(25);
  await page.keyboard.up('ArrowUp');
  await page.keyboard.press('p');
  await page.locator('#toMenu').click();
  await expect(page.locator('#menu')).toBeVisible();
  await page.locator('#garageNav').click();
  await expect(page.locator('.car-card')).toHaveCount(CAR_COUNT);
  expect(errors).toEqual([]);
});

test('the barrier ends the race with the crash screen', async ({ page }) => {
  await page.goto('/');
  await page.locator('#start').click();
  await page.keyboard.down('ArrowUp');
  await page.keyboard.down('ArrowRight');
  await expect(page.locator('#overlay h2')).toHaveText('VOCÊ BATEU!', { timeout: 20000 });
  await expect(page.locator('#overlay')).toHaveClass(/crash/);
  await expect(page.locator('#restart')).toBeVisible();
  await page.keyboard.up('ArrowRight');
  await page.keyboard.up('ArrowUp');
});

test('leaving the road drags the speed down to about 40 km/h', async ({ page }) => {
  await page.goto('/');
  await page.locator('#start').click();
  await page.keyboard.down('ArrowUp');
  await expect.poll(() => hudSpeed(page)).toBeGreaterThan(110);
  await page.keyboard.down('ArrowRight');
  await expect(page.locator('#cpLabel')).toContainText('⚠', { timeout: 10000 });
  await expect.poll(() => hudSpeed(page), { timeout: 5000 }).toBeLessThan(55);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.up('ArrowUp');
});

test('the language can be switched in the options', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#start span')).toHaveText('JOGAR');
  await page.locator('#settingsNav').click();
  await page.locator('[data-lang="en"]').click();
  await page.locator('#closeModal').click();
  await expect(page.locator('#start span')).toHaveText('PLAY');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.locator('#settingsNav').click();
  await page.locator('[data-lang="ja"]').click();
  await page.locator('#closeModal').click();
  await expect(page.locator('#start span')).toHaveText('プレイ');
});

test.describe('garage', () => {
  // The service worker would bypass the stubbed runtime config below.
  test.use({ serviceWorkers: 'block' });

  test('garage purchases persist; premium cars cannot be bought with coins', async ({ page }) => {
    // A local .env may configure a balance; this test needs the stored one.
    await page.route('**/runtime-config.json', (route) => route.fulfill({ json: { coins: null } }));
    await page.goto('/');
    await page.evaluate(() =>
      localStorage.setItem('pista84', JSON.stringify({ coins: 500, best: 100, owned: ['fusca'], selected: 'fusca' })),
    );
    await page.reload();
    await page.locator('#garageNav').click();

    await expect(page.locator('.car-card h3')).toHaveText([
      'Fusca 76', 'Uno com Escada', 'CG 125', 'Brasília 80', 'Kombi 78', 'Chevette 82',
      'Moto urbana', 'Palio 98', 'Gol Bolinha', 'Bruto 4×4', 'Opala SS', 'Maverick GT',
      'Raio 1000', 'Veloce GT',
    ]);

    const brasilia = page.locator('.car-card').filter({ has: page.getByRole('heading', { name: 'Brasília 80' }) });
    await brasilia.getByRole('button').click();
    await expect(brasilia.getByRole('button')).toHaveText('SELECIONADO');
    await page.getByRole('button', { name: /Cereja/ }).click();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pista84')!).coins)).toBe(260);

    const premium = page.locator('.car-card').filter({ has: page.getByRole('heading', { name: 'Veloce GT' }) });
    await expect(premium.getByRole('button')).toContainText('R$');
    await premium.getByRole('button').click();
    await expect(page.locator('#toast')).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pista84')!).owned)).not.toContain('gt');

    await page.reload();
    await expect(page.locator('#carName')).toHaveText('BRASÍLIA 80');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pista84')!).paint)).toBe('cherry');
  });
});

test('the offline cache serves the app and sound can be switched on', async ({ page, context }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await page.locator('#settingsNav').click();
  await page.locator('#sound').click();
  const hasAudio = await page.evaluate(() => !!(window.AudioContext ?? (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext));
  if (hasAudio) await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', /true|false/);
  else await expect(page.locator('#toast')).toBeVisible();
  await page.locator('#closeModal').click();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.reload();
  await page.locator('#start').click();
  await expect(page.locator('#raceUI')).toBeVisible();
  expect(errors).toEqual([]);
});

test('the phone controller works over the HTTPS relay when WebRTC is unavailable', async ({ browser, page }) => {
  const disableRtc = (): void => {
    Object.defineProperty(window, 'RTCPeerConnection', { value: undefined, configurable: true });
  };
  await page.addInitScript(disableRtc);
  await page.goto('/');
  await page.locator('#remoteNav').click();
  await expect(page.locator('#remoteLink a')).toBeVisible({ timeout: 15000 });
  const url = new URL((await page.locator('#remoteLink a').getAttribute('href'))!);
  url.hostname = '127.0.0.1';

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, locale: 'pt-BR' });
  await context.addInitScript(disableRtc);
  const controller = await context.newPage();
  await controller.goto(url.href);
  await expect(controller.locator('#connection')).toHaveText('Conectado. Boa viagem!');
  await controller.locator('#remoteStart').tap();
  await expect(page.locator('#raceUI')).toBeVisible();
  await expect(page.locator('#menu')).toBeHidden();
  await expect(page.locator('#modal')).not.toBeVisible();

  await controller.locator('[data-control="brake"]').dispatchEvent('pointerdown', { pointerId: 1 });
  await expect.poll(() => hudSpeed(page)).toBe(0);
  await expect(page.locator('#restart')).toHaveCount(0);
  await controller.locator('[data-control="brake"]').dispatchEvent('pointerup', { pointerId: 1 });
  await controller.locator('[data-control="accelerate"]').dispatchEvent('pointerdown', { pointerId: 2 });
  await expect.poll(() => hudSpeed(page)).toBeGreaterThan(15);
  await controller.close();
  await context.close();
});

test('losing the phone pauses the race and a new QR code can reconnect', async ({ browser, page }) => {
  await page.goto('/?transport=relay');
  await page.locator('#remoteNav').click();
  await expect(page.locator('#remoteLink a')).toBeVisible();
  const first = (await page.locator('#remoteLink a').getAttribute('href'))!;
  const url = new URL(first);
  url.hostname = '127.0.0.1';
  const controller = await browser.newPage({ locale: 'pt-BR' });
  await controller.goto(url.href);
  await expect(controller.locator('#connection')).toHaveText('Conectado. Boa viagem!');
  await page.locator('#remotePlay').click();
  await controller.close();
  await expect(page.locator('#resume')).toBeVisible({ timeout: 8000 });
  await page.locator('#pauseSettings').click();
  await page.locator('#closeModal').click();
  await page.locator('#toMenu').click();
  await page.locator('#remoteNav').click();
  await expect(page.locator('#remoteLink a')).toBeVisible();
  expect(await page.locator('#remoteLink a').getAttribute('href')).not.toBe(first);
});

test('every vehicle has complete, distinct straight, mild and strong turn sprites', async ({ page }) => {
  await page.goto('/');
  await loadHarness(page);
  const result = await page.evaluate(async () => {
    const { loadSprites, drawCar, steeringPose, CARS } = window.Pista;
    await loadSprites();
    const reports = CARS.map((car) =>
      [0, 0.45, 1, -1].map((steer) => {
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 320;
        const ctx = canvas.getContext('2d')!;
        let drawCalls = 0;
        let rotations = 0;
        const draw = ctx.drawImage.bind(ctx) as (...args: unknown[]) => void;
        const rotate = ctx.rotate.bind(ctx);
        (ctx as unknown as { drawImage: (...args: unknown[]) => void }).drawImage = (...args) => {
          drawCalls++;
          draw(...args);
        };
        ctx.rotate = (angle: number) => {
          rotations++;
          rotate(angle);
        };
        drawCar(ctx, 200, 290, 1, car, false, steer);
        const data = ctx.getImageData(0, 0, 400, 320).data;
        let pixels = 0;
        let clipped = 0;
        let left = 400;
        let right = 0;
        let top = 320;
        let bottom = 0;
        for (let y = 0; y < 320; y++) {
          for (let x = 0; x < 400; x++) {
            if (data[(y * 400 + x) * 4 + 3]! > 80) {
              pixels++;
              left = Math.min(left, x);
              right = Math.max(right, x);
              top = Math.min(top, y);
              bottom = Math.max(bottom, y);
              if (!x || !y || x === 399 || y === 319) clipped++;
            }
          }
        }
        // Compare cropped artwork so a sideways translation cannot pass as a turning pose.
        const crop = document.createElement('canvas');
        crop.width = right - left + 1;
        crop.height = bottom - top + 1;
        crop.getContext('2d')!.drawImage(canvas, left, top, crop.width, crop.height, 0, 0, crop.width, crop.height);
        return { id: car.id, pixels, clipped, drawCalls, rotations, width: right - left, height: bottom - top, signature: crop.toDataURL() };
      }),
    );
    return { reports, poses: [0, 0.1, 0.45, 0.8, -1].map(steeringPose) };
  });

  expect(result.poses).toEqual([0, 0, 1, 2, 2]);
  for (const frames of result.reports) {
    const id = frames[0]!.id;
    for (const frame of frames) {
      expect(frame.pixels, id).toBeGreaterThan(700);
      expect(frame.clipped, id).toBe(0);
      expect(frame.drawCalls, id).toBe(1);
      expect(frame.rotations, id).toBe(0);
    }
    // Every vehicle has separate authored straight, mild and hard turn artwork.
    expect(new Set(frames.slice(0, 3).map((frame) => frame.signature)).size, id).toBe(3);
    expect(Math.abs(frames[2]!.width - frames[3]!.width), id).toBeLessThanOrEqual(2);
    expect(frames[2]!.height, id).toBe(frames[3]!.height);
  }
});

test('portrait, landscape and square preserve the complete gameplay camera on resize', async ({ page }) => {
  await page.goto('/');
  await loadHarness(page);
  await page.evaluate(async () => {
    await window.Pista.loadSprites();
  });
  const frames: string[] = [];
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 720 }, { width: 720, height: 720 }]) {
    await page.setViewportSize(viewport);
    const frame = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;object-fit:contain';
      document.body.append(canvas);
      const renderer = new window.Pista.Renderer(canvas);
      const race = new window.Pista.Race(undefined, () => 0.25);
      race.start();
      race.speed = 150;
      race.path = 700;
      renderer.draw(race, 1);
      renderer.resize();
      renderer.draw(race, 1);
      const report = { width: canvas.width, height: canvas.height, fit: getComputedStyle(canvas).objectFit, pixels: canvas.toDataURL() };
      canvas.remove();
      return report;
    });
    expect([frame.width, frame.height]).toEqual([960, 720]);
    expect(frame.fit).toBe('contain');
    frames.push(frame.pixels);
  }
  expect(new Set(frames).size).toBe(1);
});

test('an environment balance overrides stored and cloud balances while purchases still spend coins', async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: 'block', locale: 'pt-BR' });
  const page = await context.newPage();
  await page.route('**/runtime-config.json', (route) => route.fulfill({ json: { coins: 10000 } }));
  await page.route('**/health', (route) => route.fulfill({ json: { ok: true, cloudBackup: true } }));
  await page.route('**/api/progress', (route) =>
    route.fulfill({ json: { save: { coins: 7, owned: ['fusca'], selected: 'fusca' }, revision: 1 } }),
  );
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('pista84', JSON.stringify({ coins: 3, owned: ['fusca'], selected: 'fusca' })));
  await page.reload();
  await expect(page.locator('#wallet')).toContainText('10.000');
  await page.locator('#garageNav').click();
  await page.locator('.car-card').filter({ has: page.getByRole('heading', { name: 'Uno com Escada' }) }).getByRole('button').click();
  await expect(page.locator('#wallet')).toContainText('9.880');
  await page.locator('#cloudRestore').click();
  await expect(page.locator('#wallet')).toContainText('10.000');
  await page.reload();
  await expect(page.locator('#wallet')).toContainText('10.000');
  await context.close();
});

test('the road renders four lane dividers and five lanes using the race seed', async ({ page }) => {
  await page.goto('/');
  await loadHarness(page);
  const result = await page.evaluate(async () => {
    const { Renderer, Race, CARS, LANES, PLAYER_T, PATH_UNIT, laneCenter, screenToDepth, loadSprites } = window.Pista;
    await loadSprites();
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:960px;height:720px';
    document.body.replaceChildren(canvas);
    const race = new Race();
    race.start();
    race.roadSeed = 1;
    race.entities = LANES.map((lane) => ({
      type: 'traffic' as const,
      lane,
      targetLane: lane,
      z: 0.2,
      speed: 0,
      cruise: 0.5,
      car: CARS[0]!,
      timer: 1e9,
      cooldown: 0,
      passed: false,
    }));
    const renderer = new Renderer(canvas);
    const y = 644;
    const horizon = Math.round(canvas.height * 0.275);
    // Sample in the middle of a painted dash, independent of camera depth.
    race.path = (12 - ((screenToDepth((y - horizon) / (canvas.height - horizon)) * PATH_UNIT) % 12)) % 12 + 3;
    renderer.draw(race, 0, {});
    const pixels = canvas.getContext('2d')!.getImageData(80, y, 800, 1).data;
    let lines = 0;
    let inLine = false;
    for (let i = 0; i < pixels.length; i += 4) {
      const x = 80 + i / 4;
      const white = (x < 420 || x > 540) && pixels[i]! > 150 && pixels[i + 1]! > 150 && pixels[i + 2]! > 130 && pixels[i]! > pixels[i + 2]!;
      if (white && !inLine) lines++;
      inLine = white;
    }
    return { lines, lanes: LANES.map((lane) => laneCenter(lane)), playerT: PLAYER_T };
  });
  expect(result.lines).toBe(4);
  expect(result.lanes).toHaveLength(5);
});

test('fuel exhaustion gives one continuation; stopping alone keeps the race running', async ({ page }) => {
  await page.route('**/app.js', async (route) => {
    const response = await route.fetch();
    const source = (await response.text()).replace('this.fuel=100', 'this.fuel=.15').replace(/Math\.max\(\w+,this\.fuel\)/, 'Math.max(.15,this.fuel)');
    await route.fulfill({ response, body: source });
  });
  await page.goto('/');
  await page.locator('#start').click();
  await expect(page.locator('#restart')).toBeVisible();
  await page.locator('#continue').click();
  await expect(page.locator('#restart')).toBeVisible();
  await expect(page.locator('#continue')).toHaveCount(0);
});
