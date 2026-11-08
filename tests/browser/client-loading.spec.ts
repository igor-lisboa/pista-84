import {test, expect} from '@playwright/test';

test('the controller loads its own code without downloading the game renderer', async ({page}) => {
  const scripts: string[] = [];
  page.on('request', request => {
    if (request.resourceType() === 'script') scripts.push(new URL(request.url()).pathname);
  });
  await page.goto('/?controller=missing&token=missing');
  await expect(page.locator('body')).toHaveAttribute('data-view', 'controller');
  expect(scripts.some(path => /controller-page/.test(path))).toBe(true);
  expect(scripts.some(path => /game-app/.test(path))).toBe(false);
  expect(await page.evaluate(() => navigator.serviceWorker.controller)).toBeNull();
});

test('the installed game reloads with its lazy chunks while offline', async ({page, context}) => {
  await page.goto('/');
  await expect(page.locator('#settingsNav')).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {once: true}));
    }
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#settingsNav')).toBeVisible();
  await page.locator('#settingsNav').click();
  await expect(page.locator('#account')).toBeVisible();
  await page.locator('#closeModal').click();
  await page.locator('#start').click();
  await expect(page.locator('#raceUI')).toBeVisible();
});
