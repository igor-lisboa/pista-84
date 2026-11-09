import type {BrowserContext} from '@playwright/test';
import {playerApi} from '../../../src/server/player-api.ts';
import {memoryAccountStore} from '../../support/memory-account-store.ts';
import {memoryPlayerStore} from '../../support/memory-player-store.ts';

/**
 * Routes every /api request of a browser context to the production player API, backed by isolated
 * in-memory stores. Never touches a live database.
 */
export async function accountBackend(context: BrowserContext) {
  const store = {...memoryPlayerStore(), accounts: memoryAccountStore()};
  await context.route('**/api/**', async route => {
    const req = route.request();
    const headers = await req.allHeaders();
    // WebKit omits Cookie from intercepted request headers. Use its URL-scoped jar.
    const cookies = await context.cookies(req.url());
    if (cookies.length) headers.cookie = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
    const response = await playerApi(new Request(req.url(), {
      method: req.method(), headers,
      ...(['GET', 'HEAD'].includes(req.method()) ? {} : {body: req.postData()}),
    }), store);
    await route.fulfill({status: response.status, headers: Object.fromEntries(response.headers), body: await response.text()});
  });
  return store;
}
