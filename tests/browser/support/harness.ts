import type { Page } from '@playwright/test';
import { build } from 'esbuild';
import type * as PistaModules from './harness-entry.ts';

declare global {
  interface Window {
    Pista: typeof PistaModules;
  }
}

let bundle: Promise<string> | undefined;

/** Bundles the game modules once into a script that defines `Pista`. */
function harnessSource(): Promise<string> {
  bundle ??= build({
    entryPoints: ['tests/browser/support/harness-entry.ts'],
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'Pista',
    platform: 'browser',
    target: 'es2022',
  }).then((result) => result.outputFiles[0]!.text);
  return bundle;
}

/** Makes `window.Pista` (game, renderer and sprite modules) available to `page.evaluate`. */
export async function loadHarness(page: Page): Promise<void> {
  await page.addScriptTag({ content: `${await harnessSource()}\nwindow.Pista = Pista;` });
}

/** Reads the HUD speed as a number. */
export const hudSpeed = async (page: Page): Promise<number> => Number.parseInt(await page.locator('#speed').innerText(), 10);

/** Completes the first demo through real input; leaves its optional account action visible. */
export async function finishFirstDemo(page: Page): Promise<void> {
  await page.locator('#tutSkip').waitFor({state: 'visible'});
  await page.locator('#tutSkip').click();
  await page.locator('#modal').waitFor({state: 'hidden'});
  await page.locator('#start').click();
  await page.keyboard.down('ArrowUp');
  await page.keyboard.down('ArrowRight');
  await page.locator('#enter').waitFor({ state: 'visible', timeout: 25000 });
  await page.keyboard.up('ArrowRight');
  await page.keyboard.up('ArrowUp');
}
