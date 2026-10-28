import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';

const json = async (path: string) => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));

test('vercel.json uses the standard setup, so api/ files are served without their extension', async () => {
  const config = await json('vercel.json');
  // The legacy `builds` array publishes /api/leaderboard.ts instead of /api/leaderboard (404 for every call).
  assert.equal('builds' in config, false);
  // Pins the preset to "Other" so no backend framework is auto-detected for the project.
  assert.equal(config.framework, null);
  assert.equal(config.outputDirectory, 'www');
  assert.equal(config.buildCommand, 'npm run build');
  assert.deepEqual(config.rewrites, [{source: '/health', destination: '/api/health'}]);
});

test('every public endpoint the client calls has a function, and helpers are not exposed', async () => {
  const files = (await readdir(new URL('../api/', import.meta.url))).filter((name) => name.endsWith('.ts'));
  for (const endpoint of ['health', 'leaderboard', 'score', 'progress']) assert.ok(files.includes(`${endpoint}.ts`), endpoint);
  // Files starting with an underscore are shared helpers, never routes.
  assert.deepEqual(files.filter((name) => !['health.ts', 'leaderboard.ts', 'score.ts', 'progress.ts'].includes(name)), ['_store.ts']);
});

test('the function builder is told not to load @types/node, which it cannot find from its temp directory', async () => {
  const config = await json('api/tsconfig.json');
  assert.deepEqual(config.compilerOptions.types, []);
});

test('no file is named like a server entrypoint, so Vercel serves the static site instead of running it', async () => {
  // Vercel's backend auto-detection runs the first of these it finds as a Node server for `/`.
  const {existsSync} = await import('node:fs');
  const names = ['app', 'index', 'server', 'main'];
  const found: string[] = [];
  for (const dir of ['', 'src/']) {
    for (const name of names) {
      for (const ext of ['js', 'cjs', 'mjs', 'ts', 'cts', 'mts']) {
        if (existsSync(new URL(`../${dir}${name}.${ext}`, import.meta.url))) found.push(`${dir}${name}.${ext}`);
      }
    }
  }
  assert.deepEqual(found, []);
});
