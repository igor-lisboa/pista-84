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
  },
  webServer: {
    command: 'npm start',
    url: `${BASE_URL}/health`,
    reuseExistingServer: !process.env.CI,
  },
  reporter: 'list',
});
