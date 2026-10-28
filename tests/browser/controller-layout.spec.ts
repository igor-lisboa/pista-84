import { expect, test, type Browser, type Page } from '@playwright/test';

const box = async (page: Page, selector: string) => (await page.locator(selector).boundingBox())!;

/** Opens the main screen, creates a pairing room and opens its controller link on a phone-sized page. */
async function openController(browser: Browser, host: Page, viewport: { width: number; height: number }) {
  const disableRtc = (): void => {
    Object.defineProperty(window, 'RTCPeerConnection', { value: undefined, configurable: true });
    // Desktop Chromium has no motion sensor API; a phone does.
    const sensor = ((window as unknown as Record<string, unknown>).DeviceOrientationEvent ??= class {}) as Record<string, unknown>;
    sensor.requestPermission = async () => 'granted';
  };
  await host.addInitScript(disableRtc);
  await host.goto('/');
  await host.locator('#remoteNav').click();
  await expect(host.locator('#remoteLink a')).toBeVisible({ timeout: 15000 });
  const url = new URL((await host.locator('#remoteLink a').getAttribute('href'))!);
  url.hostname = '127.0.0.1';
  const context = await browser.newContext({ viewport, hasTouch: true, locale: 'pt-BR' });
  await context.addInitScript(disableRtc);
  const phone = await context.newPage();
  await phone.goto(url.href);
  await expect(phone.locator('#connection')).toHaveText('Conectado. Boa viagem!');
  return { phone, context };
}

const inside = (b: { x: number; y: number; width: number; height: number }, v: { width: number; height: number }) =>
  b.x >= 0 && b.y >= 0 && b.x + b.width <= v.width && b.y + b.height <= v.height;
const overlap = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test('sideways, the controller keeps the wheel visible between the steering buttons and the pedals', async ({ browser, page }) => {
  const viewport = { width: 844, height: 390 };
  const { phone, context } = await openController(browser, page, viewport);

  const wheel = await box(phone, '#wheel');
  const steer = await box(phone, '.controller-steer');
  const pedals = await box(phone, '.controller-pedals');
  expect(wheel.width).toBeGreaterThan(110);
  for (const part of [wheel, steer, pedals]) expect(inside(part, viewport)).toBe(true);
  expect(steer.x + steer.width).toBeLessThanOrEqual(wheel.x + 1);
  expect(wheel.x + wheel.width).toBeLessThanOrEqual(pedals.x + 1);
  expect(overlap(wheel, pedals) || overlap(wheel, steer)).toBe(false);
  for (const control of ['left', 'right', 'brake', 'accelerate']) {
    const b = await box(phone, `[data-control="${control}"]`);
    expect(b.width).toBeGreaterThan(60);
    expect(b.height).toBeGreaterThan(60);
    expect(inside(b, viewport)).toBe(true);
  }
  await expect(phone.locator('#remoteStart')).toBeVisible();
  await expect(phone.locator('#remotePause')).toBeVisible();
  expect(await phone.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
  await context.close();
});

for (const [name, viewport] of [['sideways', { width: 844, height: 390 }], ['upright', { width: 390, height: 844 }]] as const) {
  test(`turning tilt steering on removes the left/right buttons and keeps the wheel (${name})`, async ({ browser, page }) => {
    const { phone, context } = await openController(browser, page, viewport);
    await expect(phone.locator('[data-control="left"]')).toBeVisible();
    const before = await box(phone, '#wheel');

    await phone.locator('#tilt').click();
    await expect(phone.locator('body')).toHaveAttribute('data-tilt', 'on');
    await expect(phone.locator('[data-control="left"]')).toBeHidden();
    await expect(phone.locator('[data-control="right"]')).toBeHidden();
    await expect(phone.locator('#calibrate')).toBeVisible();
    const after = await box(phone, '#wheel');
    expect(after.width).toBeGreaterThanOrEqual(before.width);
    expect(inside(after, viewport)).toBe(true);
    for (const control of ['brake', 'accelerate']) expect(inside(await box(phone, `[data-control="${control}"]`), viewport)).toBe(true);

    // And the buttons come back when tilt is switched off again.
    await phone.locator('#tilt').click();
    await expect(phone.locator('[data-control="left"]')).toBeVisible();
    await context.close();
  });
}
