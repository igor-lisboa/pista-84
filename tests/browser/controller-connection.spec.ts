import {expect, test} from '@playwright/test';
import {hudSpeed} from './support/harness.ts';

test('the phone controller uses sockets without HTTP polling when WebRTC is unavailable', async ({ browser, page }) => {
  const roomRequests: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/rooms')) roomRequests.push(request.method()); });
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
  await controller.addInitScript(() => {
    const NativeSocket = window.WebSocket;
    window.WebSocket = class extends NativeSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        Reflect.set(window, 'testControllerSocket', this);
      }
    };
  });
  let socketsOpened = 0;
  controller.on('websocket', () => { socketsOpened++; });
  controller.on('request', request => { if (request.url().includes('/api/rooms')) roomRequests.push(request.method()); });
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
  await controller.evaluate(() => {
    const socket: unknown = Reflect.get(window, 'testControllerSocket');
    if (!(socket instanceof WebSocket)) throw new Error('Controller socket was not established');
    socket.close(4000);
  });
  await expect(page.locator('#resume')).toBeVisible();
  await expect.poll(() => socketsOpened).toBe(2);
  await expect(controller.locator('#connection')).toHaveText('Conectado. Boa viagem!');
  await controller.locator('#remoteStart').tap();
  await expect(page.locator('#resume')).not.toBeVisible();
  expect(roomRequests).toEqual(['POST', 'GET', 'POST']);
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
