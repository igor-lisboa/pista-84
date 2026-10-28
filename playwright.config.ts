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
    // Tests must never write fake players into the real Blob store: empty values win over .env.
    env: {
      BLOB_STORAGE_READ_WRITE_TOKEN: '',
      BLOB_STORAGE_STORE_ID: '',
      BLOB_READ_WRITE_TOKEN: '',
      BLOB_STORE_ID: '',
    },
    url: `${BASE_URL}/health`,
    reuseExistingServer: !process.env.CI,
  },
  reporter: 'list',
});
