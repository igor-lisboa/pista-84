// Render the project's vector artwork into installable app assets.
import {chromium} from '@playwright/test';
import type {Page} from '@playwright/test';
import {readFile, readdir} from 'node:fs/promises';
import {join} from 'node:path';

const BACKGROUND = '#141a1e';
const ACCENT = '#f3c85b';

const ANDROID_RES = 'android/app/src/main/res';
const IOS_ICON_SET = 'ios/App/App/Assets.xcassets/AppIcon.appiconset';
const IOS_SPLASH_SET = 'ios/App/App/Assets.xcassets/Splash.imageset';

const ANDROID_LAUNCHER_SIZES: Record<string, number> = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
};
const ANDROID_FOREGROUND_SCALE = 2.25;
const ANDROID_SPLASH_SIZE = 960;
const IOS_SPLASH_SIZE = 2048;
const SPLASH_ICON_RATIO = 0.22;
const SPLASH_FONT_RATIO = 0.035;

const browser = await chromium.launch();
const page = await browser.newPage();
const svg = await readFile('web/icon.svg', 'utf8');

async function renderIcon(target: Page, path: string, size: number): Promise<void> {
  await target.setViewportSize({width: size, height: size});
  await target.setContent(
    `<style>body{margin:0;background:${BACKGROUND}}svg{width:100vw;height:100vh}</style>${svg}`,
  );
  await target.screenshot({path});
}

async function renderSplash(target: Page, path: string, size: number): Promise<void> {
  const iconSize = Math.round(size * SPLASH_ICON_RATIO);
  const fontSize = Math.round(size * SPLASH_FONT_RATIO);
  await target.setViewportSize({width: size, height: size});
  await target.setContent(
    `<style>body{margin:0;background:${BACKGROUND};display:grid;place-content:center;height:100vh;` +
      `color:${ACCENT};text-align:center;font:bold ${fontSize}px monospace}` +
      `svg{width:${iconSize}px;height:${iconSize}px;margin:auto}p{letter-spacing:.12em}</style>` +
      `${svg}<p>PISTA 84</p>`,
  );
  await target.screenshot({path});
}

async function renderWebIcons(): Promise<void> {
  await renderIcon(page, 'web/icon-192.png', 192);
  await renderIcon(page, 'web/icon-512.png', 512);
  await renderIcon(page, 'web/apple-touch-icon.png', 180);
  await renderIcon(page, `${IOS_ICON_SET}/AppIcon-512@2x.png`, 1024);
}

async function renderAndroidLaunchers(): Promise<void> {
  for (const [density, size] of Object.entries(ANDROID_LAUNCHER_SIZES)) {
    const folder = `${ANDROID_RES}/mipmap-${density}`;
    await renderIcon(page, `${folder}/ic_launcher.png`, size);
    await renderIcon(page, `${folder}/ic_launcher_round.png`, size);
    await renderIcon(page, `${folder}/ic_launcher_foreground.png`, Math.round(size * ANDROID_FOREGROUND_SCALE));
  }
}

async function renderAndroidSplashes(): Promise<void> {
  for (const entry of await readdir(ANDROID_RES, {withFileTypes: true})) {
    if (!entry.isDirectory() || !entry.name.startsWith('drawable')) {
      continue;
    }
    const files = await readdir(join(ANDROID_RES, entry.name));
    if (files.includes('splash.png')) {
      await renderSplash(page, join(ANDROID_RES, entry.name, 'splash.png'), ANDROID_SPLASH_SIZE);
    }
  }
}

async function renderIosSplashes(): Promise<void> {
  for (const file of await readdir(IOS_SPLASH_SET)) {
    if (file.endsWith('.png')) {
      await renderSplash(page, join(IOS_SPLASH_SET, file), IOS_SPLASH_SIZE);
    }
  }
}

await renderWebIcons();
await renderAndroidLaunchers();
await renderAndroidSplashes();
await renderIosSplashes();
await browser.close();
console.log('Web and native icons/splashes rendered from project vector artwork.');
