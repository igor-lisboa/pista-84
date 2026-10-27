// Configuration arrives through stdin; never put service credentials in arguments.
import {createInterface} from 'node:readline';
import {chromium, webkit, expect} from '@playwright/test';
import type {BrowserContext} from '@playwright/test';

interface HostedConfig {
  url: string;
  token: string;
}

interface RoomCredentials {
  id: string;
  hostToken: string;
  joinToken: string;
}

const REMOTE_TIMEOUT_MS = 20_000;
const MIN_SPEED_KMH = 15;
const PHONE_VIEWPORT = {width: 390, height: 844};

async function readConfig(): Promise<HostedConfig> {
  const lines = createInterface({input: process.stdin, terminal: false});
  for await (const line of lines) {
    lines.close();
    return JSON.parse(line) as HostedConfig;
  }
  throw new Error('Hosted configuration missing on stdin.');
}

const config = await readConfig();
const origin = new URL(config.url).origin;
const authHeaders = {'OAI-Sites-Authorization': `Bearer ${config.token}`};

async function call<T = Record<string, unknown>>(
  path: string,
  method = 'GET',
  body?: unknown,
  token?: string | null,
): Promise<T> {
  const response = await fetch(origin + path, {
    redirect: 'error',
    method,
    headers: {
      ...authHeaders,
      'content-type': 'application/json',
      ...(token ? {authorization: `Bearer ${token}`} : {}),
    },
    ...(body ? {body: JSON.stringify(body)} : {}),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Hosted API ${path.split('/').slice(0, 3).join('/')}: ${response.status}`);
  }
  return data as T;
}

async function verifyApi(): Promise<void> {
  const health = await call<{cloudBackup?: boolean; transport?: string}>('/health');
  if (!health.cloudBackup || health.transport !== 'webrtc') {
    throw new Error('Hosted runtime is not the expected Worker.');
  }
  const room = await call<RoomCredentials>('/api/rooms', 'POST', {offer: '{"type":"offer","sdp":"smoke"}'});
  try {
    const offer = await call<{offer?: string}>(`/api/rooms/${room.id}`, 'GET', null, room.joinToken);
    if (!offer.offer) {
      throw new Error('Hosted D1 did not retain offer.');
    }
    await call(`/api/rooms/${room.id}`, 'POST', {answer: 'smoke-answer'}, room.joinToken);
    const answer = await call<{answer?: string}>(`/api/rooms/${room.id}`, 'GET', null, room.hostToken);
    if (answer.answer !== 'smoke-answer') {
      throw new Error('Hosted answer did not persist.');
    }
  } finally {
    await call(`/api/rooms/${room.id}`, 'DELETE', null, room.hostToken);
  }
  console.log('Hosted health, D1 room creation, authenticated answer, and deletion passed.');
}

async function addAuthRouting(context: BrowserContext): Promise<void> {
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    const extra = url.origin === origin ? authHeaders : {};
    return route.continue({headers: {...route.request().headers(), ...extra}});
  });
}

async function verifyBrowsers(): Promise<void> {
  const browser = await chromium.launch();
  const phoneBrowser = await webkit.launch();
  try {
    const context = await browser.newContext({locale: 'pt-BR'});
    const phoneContext = await phoneBrowser.newContext({
      viewport: PHONE_VIEWPORT,
      isMobile: true,
      hasTouch: true,
      locale: 'pt-BR',
    });
    await addAuthRouting(context);
    await addAuthRouting(phoneContext);

    const page = await context.newPage();
    await page.goto(`${origin}/?transport=relay`);
    await expect(page.locator('#start')).toBeVisible();
    await page.locator('#remoteNav').click();
    await expect(page.locator('#remoteLink a')).toBeVisible({timeout: REMOTE_TIMEOUT_MS});

    const controller = await phoneContext.newPage();
    await controller.goto((await page.locator('#remoteLink a').getAttribute('href')) ?? '');
    await expect(controller.locator('#connection')).toHaveText('Conectado. Boa viagem!', {
      timeout: REMOTE_TIMEOUT_MS,
    });
    await controller.locator('#remoteStart').tap();
    await expect(page.locator('#menu')).toBeHidden();
    await expect(page.locator('#raceUI')).toBeVisible();

    const speed = async (): Promise<number> => parseInt(await page.locator('#speed').innerText(), 10);
    const brake = controller.locator('[data-control="brake"]');
    const accelerate = controller.locator('[data-control="accelerate"]');
    await brake.dispatchEvent('pointerdown', {pointerId: 1});
    await expect.poll(speed).toBe(0);
    await expect(page.locator('#restart')).toHaveCount(0);
    await brake.dispatchEvent('pointerup', {pointerId: 1});
    await accelerate.dispatchEvent('pointerdown', {pointerId: 2});
    await expect.poll(speed).toBeGreaterThan(MIN_SPEED_KMH);

    const solo = await phoneContext.newPage();
    await solo.goto(origin);
    await solo.locator('#start').tap();
    await expect(solo.locator('#raceUI')).toBeVisible();
    await expect(solo.locator('[data-control="accelerate"]')).toBeVisible();
    console.log('Hosted Chromium + mobile WebKit: QR, HTTPS fallback, remote start/brake, and solo touch entry passed.');
  } finally {
    await browser.close();
    await phoneBrowser.close();
  }
}

await verifyApi();
await verifyBrowsers();
