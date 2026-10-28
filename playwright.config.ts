import {defineConfig} from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 45_000,
  expect: {timeout: 10_000},
  // Limit simultaneous emulated browsers so rendering load does not distort timed driving checks.
  workers: 4,
  projects: [
    {name: 'chromium', use: {browserName: 'chromium'}},
    {name: 'webkit', use: {browserName: 'webkit'}},
  ],
  use: {
    baseURL: BASE_URL,
    headless: true,
    locale: 'pt-BR',
    // Most tests start as a returning player; username.spec.ts opts out to see first launch.
    storageState: 'tests/browser/support/signed-in.json',
  },
  webServer: {
    command: 'npm start',
    url: `${BASE_URL}/health`,
    reuseExistingServer: !process.env.CI,
  },
  reporter: 'list',
});
