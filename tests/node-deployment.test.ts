import {test} from 'node:test';
import type {TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const env = {
  ...process.env,
  NODE_ENV: 'production',
  DYNO: 'web.1',
  PORT: '0',
  PUBLIC_ORIGIN: '',
  PISTA84_COINS: '',
  MONGODB_URI: '',
  REDIS_URL: '',
};

async function start(t: TestContext, publicOrigin: string): Promise<string> {
  const child = spawn(process.execPath, ['production-server.ts'], {
    cwd: root,
    env: {...env, PUBLIC_ORIGIN: publicOrigin,
      MONGODB_URI: 'mongodb://127.0.0.1:1', REDIS_URL: 'redis://127.0.0.1:1'},
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, 'exit');
    child.kill();
    await exited;
  });
  return new Promise((resolve, reject) => {
    let output = '';
    child.stdout.on('data', chunk => {
      output += String(chunk);
      const port = output.match(/listening on port (\d+)/)?.[1];
      if (port) resolve(`http://127.0.0.1:${port}`);
    });
    child.once('error', reject);
    child.once('exit', () => reject(new Error('Production server exited before listening.')));
  });
}

test('Heroku starts built assets without rebuilding or invoking the development server', async () => {
  const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
  assert.equal(pkg.scripts.start, 'node production-server.ts');
  assert.equal('prestart' in pkg.scripts, false);
  assert.equal(pkg.scripts['heroku-postbuild'], 'npm run build');
  assert.equal((await readFile(new URL('Procfile', root), 'utf8')).trim(), 'web: npm start');
});

test('production exits before listening when storage config is missing', {timeout: 10_000}, async () => {
  const child = spawn(process.execPath, ['production-server.ts'], {cwd: root, env});
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += String(chunk); });
  const [code] = await once(child, 'exit');
  assert.notEqual(code, 0);
  assert.match(stderr, /Missing required config vars: MONGODB_URI, REDIS_URL/);
});

test('production serves assets and preserves HTTPS API origin validation behind Heroku', {timeout: 20_000}, async t => {
  for (const publicOrigin of ['', 'https://game.example']) {
    await t.test(publicOrigin ? 'explicit public origin' : 'forwarded HTTPS origin', async t => {
      const base = await start(t, publicOrigin);
      const headers = {'x-forwarded-proto': 'https', origin: publicOrigin || `https://${new URL(base).host}`};
      const response = await fetch(base);
      assert.equal(response.status, 200);
      assert.match(await response.text(), /game\.js/);
      assert.deepEqual(await (await fetch(`${base}/health`)).json(),
        {ok: true, cloudBackup: true, storage: 'mongodb', pairing: 'redis'});
      const runtime = await (await fetch(`${base}/runtime-config.json`)).text();
      assert.doesNotMatch(runtime, /MONGODB|REDIS|127\.0\.0\.1/);
      assert.equal((await fetch(`${base}/network`)).status, 404);
      const rooms = await fetch(`${base}/api/rooms`, {method: 'POST', headers, body: '{'});
      assert.equal(rooms.status, 400, 'same-origin HTTPS reaches body validation, without contacting Redis');
      assert.deepEqual(await rooms.json(), {error: 'Invalid JSON.'});
      const crossOrigin = await fetch(`${base}/api/rooms`, {
        method: 'POST', headers: {...headers, origin: 'https://other.example'}, body: '{',
      });
      assert.equal(crossOrigin.status, 403);
      const progress = await fetch(`${base}/api/progress`, {headers});
      assert.equal(progress.status, 401, 'configured MongoDB reaches player authorization without contacting storage');
    });
  }
});
