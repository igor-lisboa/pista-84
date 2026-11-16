import {test, expect} from '@playwright/test';
import {accountBackend} from './support/account-backend.ts';

test.use({serviceWorkers: 'block'});
const password = 'a unique browser test passphrase';

test('signed-in account separates logout and reveals password fields on request', async ({page, context}, testInfo) => {
  await accountBackend(context);
  await page.goto('/');
  await page.locator('#settingsNav').click();
  await page.locator('#account').click();
  await page.locator('#accountTab-signup').click();
  await page.locator('#accountUsername').fill('driver');
  await page.locator('#accountPassword').fill(password);
  await page.locator('#accountForm button[type=submit]').click();
  await expect(page.locator('#modal')).toBeHidden();

  await page.setViewportSize({width: 390, height: 844});
  await page.locator('#settingsNav').click();
  await expect(page.locator('#newPlayer')).toHaveCount(0);
  await page.locator('#account').click();
  await expect(page.locator('#changePasswordToggle')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#passwordForm, #currentPassword, #newPassword')).toHaveCount(0);
  await expect(page.locator('.account-logout-section #accountLogout')).toBeVisible();
  await expect(page.locator('.account-password-section #accountLogout')).toHaveCount(0);
  await expect(page.locator('#accountLogout')).toBeInViewport();
  await page.screenshot({path: testInfo.outputPath('account-signed-in-portrait.png')});

  await page.setViewportSize({width: 844, height: 390});
  await expect(page.locator('#changePasswordToggle')).toBeInViewport();
  await expect(page.locator('#accountLogout')).toBeInViewport();
  await page.screenshot({path: testInfo.outputPath('account-signed-in-landscape.png')});
  await page.setViewportSize({width: 1440, height: 900});
  await expect(page.locator('#changePasswordToggle')).toBeInViewport();
  await expect(page.locator('#accountLogout')).toBeInViewport();
  await page.screenshot({path: testInfo.outputPath('account-signed-in-desktop.png')});

  await page.locator('#changePasswordToggle').click();
  await expect(page.locator('#changePasswordToggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#passwordForm')).toBeVisible();
  await page.locator('#changePasswordToggle').click();
  await expect(page.locator('#passwordForm')).toHaveCount(0);
  await page.locator('#changePasswordToggle').click();
  await expect(page.locator('#passwordForm')).toBeVisible();
  await page.locator('#currentPassword').fill('not the password');
  await page.locator('#newPassword').fill('a different passphrase');
  await page.locator('#passwordForm button[type=submit]').click();
  await expect(page.locator('#passwordStatus')).toContainText('senha atual');
  await expect(page.locator('#currentPassword')).toBeFocused();

  await page.locator('#currentPassword').fill(password);
  await page.locator('#passwordForm button[type=submit]').click();
  await expect(page.locator('#passwordStatus')).toContainText('Senha alterada');
  await expect(page.locator('#currentPassword')).toHaveValue('');
  await expect(page.locator('#newPassword')).toHaveValue('');
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('a different passphrase');

  await context.clearCookies();
  await page.reload();
  await page.locator('#settingsNav').click();
  await page.locator('#account').click();
  await page.locator('#accountPassword').fill(password);
  await page.locator('#accountForm button[type=submit]').click();
  await expect(page.locator('#accountStatus')).toContainText('incorretos');
  await page.locator('#accountPassword').fill('a different passphrase');
  await page.locator('#accountForm button[type=submit]').click();
  await expect(page.locator('#modal')).toBeHidden();
});
