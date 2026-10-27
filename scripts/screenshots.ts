import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const BASE_URL = 'http://127.0.0.1:4173';
const OUT_DIR = 'docs/screenshots';
const RESIZE_SETTLE_MS = 250;

await mkdir(OUT_DIR, {recursive: true});

const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 1440, height: 900}, locale: 'pt-BR'});

async function shot(name: string): Promise<void> {
  await page.screenshot({path: `${OUT_DIR}/${name}.png`});
}

async function resizeAndShoot(width: number, height: number, name: string): Promise<void> {
  await page.setViewportSize({width, height});
  await page.waitForTimeout(RESIZE_SETTLE_MS);
  await shot(name);
}

await page.goto(BASE_URL);
await page.evaluate(() => document.fonts.ready);
await shot('desktop');

await page.locator('#garageNav').click();
await shot('garage');
await page.locator('#closeModal').click();

await page.locator('#start').click();
await shot('race');

await resizeAndShoot(390, 844, 'mobile');
await resizeAndShoot(844, 390, 'mobile-landscape');

await browser.close();
