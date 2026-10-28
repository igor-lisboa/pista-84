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
  assert.deepEqual(config.rewrites, [
    {source: '/health', destination: '/api/health'},
    // Every pairing route must land in the one function that holds the rooms in memory.
    // No modifier in the destination: a trailing + would reach the function as an encoded space.
    {source: '/api/rooms/:path+', destination: '/api/rooms?route=:path'},
  ]);
});

test('every public endpoint the client calls has a function, and helpers are not exposed', async () => {
  const files = (await readdir(new URL('../api/', import.meta.url))).filter((name) => name.endsWith('.ts'));
  for (const endpoint of ['health', 'leaderboard', 'score', 'progress', 'rooms']) assert.ok(files.includes(`${endpoint}.ts`), endpoint);
  // Files starting with an underscore are shared helpers, never routes.
  assert.deepEqual(files.filter((name) => !['health.ts', 'leaderboard.ts', 'score.ts', 'progress.ts', 'rooms.ts'].includes(name)).sort(), ['_rooms.ts', '_store.ts']);
});

test('the function builder is told not to load @types/node, which it cannot find from its temp directory', async () => {
  const config = await json('api/tsconfig.json');
  assert.deepEqual(config.compilerOptions.types, []);
});

/** The names Vercel's backend auto-detection treats as a server entrypoint (@vercel/backends). */
const ENTRYPOINT_NAMES = ['app', 'index', 'server', 'main'];
const ENTRYPOINT_EXTENSIONS = ['js', 'cjs', 'mjs', 'ts', 'cts', 'mts'];

async function entrypointsIn(dirs: string[]): Promise<string[]> {
  const {existsSync} = await import('node:fs');
  const found: string[] = [];
  for (const dir of dirs) {
    for (const name of ENTRYPOINT_NAMES) {
      for (const ext of ENTRYPOINT_EXTENSIONS) {
        if (existsSync(new URL(`../${dir}${name}.${ext}`, import.meta.url))) found.push(`${dir}${name}.${ext}`);
      }
    }
  }
  return found;
}

test('no source file is named like a server entrypoint, so Vercel serves the static site instead of running it', async () => {
  // Vercel runs the first of these it finds as a Node server answering `/`.
  assert.deepEqual(await entrypointsIn(['', 'src/']), []);
});

test('the built browser files are not named like a server entrypoint either', async () => {
  // Detection also searches the output directory, and the bundle once was www/app.js (it crashed with `location is not defined`).
  const build = await readFile(new URL('../scripts/build.ts', import.meta.url), 'utf8');
  const outputs = [...build.matchAll(/outfile: `\$\{WWW_DIR\}\/([^`]+)`/g)].map((match) => match[1]!);
  assert.ok(outputs.length >= 2, 'expected the client and service worker bundles');
  for (const output of outputs) {
    const name = output.replace(/\.[^.]+$/, '');
    assert.equal(ENTRYPOINT_NAMES.includes(name), false, `${output} would be run as a server by Vercel`);
  }
  const html = await readFile(new URL('../web/index.html', import.meta.url), 'utf8');
  assert.match(html, /src="game\.js"/);
});
