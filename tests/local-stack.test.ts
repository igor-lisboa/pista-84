import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Static guards for the Docker-based local stack. They read files only: no Docker, no network,
// no live services. The running stack is verified by `bash scripts/local.sh check`.

const root = new URL('../', import.meta.url);
const text = (path: string) => readFile(new URL(path, root), 'utf8');

test('compose runs the app against private MongoDB and Redis services with pinned URLs', async () => {
  const compose = await text('docker-compose.yml');
  assert.match(compose, /image: mongo:\d+/);
  assert.match(compose, /image: redis:\d+/);
  // The app can only reach the Compose services, whatever the env file or host shell says.
  assert.match(compose, /MONGODB_URI: mongodb:\/\/mongo:27017/);
  assert.match(compose, /REDIS_URL: redis:\/\/redis:6379/);
  // Databases are private to Docker; only the game port is published, on loopback by default.
  assert.doesNotMatch(compose, /27017:27017|6379:6379/);
  assert.match(compose, /\$\{BIND_ADDRESS:-127\.0\.0\.1\}/);
  // The HTTP development launcher is used so cookies and accounts work on http://localhost.
  assert.match(compose, /NODE_ENV: development/);
  assert.match(compose, /service_healthy/);
});

test('the Dockerfile builds the game and starts the development launcher without copying secrets', async () => {
  const dockerfile = await text('Dockerfile');
  assert.match(dockerfile, /FROM node:24/);
  assert.match(dockerfile, /RUN npm ci/);
  assert.match(dockerfile, /RUN npm run build/);
  assert.match(dockerfile, /CMD \["node", "dev-server\.ts"\]/);
  const ignore = (await text('.dockerignore')).split(/\r?\n/);
  for (const entry of ['.env', '.env.*', '!.env.example', 'node_modules', 'www']) assert.ok(ignore.includes(entry), entry);
});

test('the local script generates .env.docker from .env.example and refuses real credentials', async () => {
  const script = await text('scripts/local.sh');
  assert.match(script, /^#!\/usr\/bin\/env bash/);
  assert.match(script, /set -euo pipefail/);
  assert.ok(!script.includes('\r'), 'scripts/local.sh must use LF line endings');
  const example = await text('.env.example');
  // Every setting the script rewrites must still exist in the template.
  for (const key of ['PISTA84_COINS', 'PISTA84_PROGRESS_TOOLS', 'PORT', 'MONGODB_URI', 'MONGODB_DATABASE', 'REDIS_URL', 'API_ORIGIN', 'PUBLIC_ORIGIN']) {
    assert.match(example, new RegExp(`^${key}=`, 'm'), `.env.example lacks ${key}`);
    assert.match(script, new RegExp(`\\^${key}=`), `scripts/local.sh does not rewrite ${key}`);
  }
  assert.match(script, /MONGODB_URI=mongodb:\/\/mongo:27017/);
  assert.match(script, /REDIS_URL=redis:\/\/redis:6379/);
  // The generated file is private to the developer's machine.
  const ignored = await text('.gitignore');
  assert.match(ignored, /^\.env\.\*$/m);
  const attributes = await text('.gitattributes');
  assert.match(attributes, /\*\.sh text eol=lf/);
});

test('the local smoke check only runs against local services and removes its probe data', async () => {
  const check = await text('scripts/check-local.ts');
  assert.match(check, /LOCAL_HOSTS/);
  assert.match(check, /refusing to write probe data/);
  assert.doesNotMatch(check, /env\.ts/, 'it must never load .env files');
  assert.match(check, /finally/);
  const pkg = JSON.parse(await text('package.json')) as {scripts: Record<string, string>};
  assert.equal(pkg.scripts['local:check'], 'node scripts/check-local.ts');
  // Normal `npm test` stays isolated: the live check is not part of the test glob.
  assert.equal(pkg.scripts.test, 'node --test tests/*.test.ts');
});
