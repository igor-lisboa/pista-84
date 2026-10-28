import {cp, mkdir, readdir, readFile, rm, writeFile} from 'node:fs/promises';
import {extname} from 'node:path';
import {build} from 'esbuild';
import {runtimeConfig} from './env.ts';

interface GeneratedAsset {
  body: string;
  type: string;
  binary: boolean;
}

const WEB_DIR = 'web';
const WWW_DIR = 'www';
const SERVER_OUT = 'dist/server/index.js';
const GENERATED_ASSETS = 'worker/generated-assets.ts';
const BROWSER_TARGET = 'es2019';

const CONTENT_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  json: 'application/json',
  map: 'application/json',
  webmanifest: 'application/manifest+json',
  svg: 'image/svg+xml',
  png: 'image/png',
  txt: 'text/plain; charset=utf-8',
  xml: 'application/xml',
  jpg: 'image/jpeg',
};
const BINARY_EXTENSIONS = new Set(['png', 'jpg']);

/** Copies `web/` to `www/`, skipping TypeScript sources (they are bundled separately). */
async function copyStaticFiles(): Promise<void> {
  await rm(WWW_DIR, {recursive: true, force: true});
  await cp(WEB_DIR, WWW_DIR, {
    recursive: true,
    filter: (source) => !source.endsWith('.ts'),
  });
}

/** Public origin used for canonical and social-share URLs: `SITE_URL`, else the Vercel production domain, else relative. */
function siteUrl(): string {
  const configured = process.env.SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  return (configured ?? '').replace(/\/+$/, '');
}

/** Fills the `%SITE_URL%` placeholders and writes the crawler files. */
async function writeSeoFiles(): Promise<void> {
  const origin = siteUrl();
  const page = await readFile(`${WWW_DIR}/index.html`, 'utf8');
  await writeFile(`${WWW_DIR}/index.html`, page.replaceAll('%SITE_URL%', origin));
  await writeFile(`${WWW_DIR}/robots.txt`, `User-agent: *
Allow: /
Disallow: /api/
${origin ? `
Sitemap: ${origin}/sitemap.xml
` : ''}`);
  if (origin) {
    await writeFile(
      `${WWW_DIR}/sitemap.xml`,
      `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url></urlset>
`,
    );
  }
}

async function bundleClient(): Promise<void> {
  await build({
    entryPoints: ['src/client.ts'],
    // Not `app.js`: Vercel runs a file called app/index/server/main found in the output directory as a Node server.
    outfile: `${WWW_DIR}/game.js`,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: BROWSER_TARGET,
    minify: true,
    sourcemap: true,
  });
}

async function bundleServiceWorker(): Promise<void> {
  await build({
    entryPoints: [`${WEB_DIR}/sw.ts`],
    outfile: `${WWW_DIR}/sw.js`,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: BROWSER_TARGET,
    minify: true,
  });
}

async function writeRuntimeConfig(): Promise<void> {
  await writeFile(`${WWW_DIR}/runtime-config.json`, JSON.stringify(runtimeConfig));
}

async function collectAssets(
  dir: string,
  prefix: string,
  assets: Record<string, GeneratedAsset>,
): Promise<void> {
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    const path = `${dir}/${entry.name}`;
    const publicPath = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      await collectAssets(path, publicPath, assets);
      continue;
    }
    const extension = extname(entry.name).slice(1);
    const binary = BINARY_EXTENSIONS.has(extension);
    assets[publicPath] = {
      body: await readFile(path, binary ? 'base64' : 'utf8'),
      type: CONTENT_TYPES[extension] || 'text/plain',
      binary,
    };
  }
}

async function generateWorkerAssets(): Promise<void> {
  const assets: Record<string, GeneratedAsset> = {};
  await collectAssets(WWW_DIR, '', assets);
  const source =
    'export const assets: Record<string, {body: string; type: string; binary: boolean}> = ' +
    `${JSON.stringify(assets)};\n`;
  await writeFile(GENERATED_ASSETS, source);
}

async function bundleWorker(): Promise<void> {
  await build({
    entryPoints: ['worker/index.ts'],
    outfile: SERVER_OUT,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: BROWSER_TARGET,
    define: {__PISTA_CONFIG__: JSON.stringify(runtimeConfig)},
    minify: true,
  });
}

async function main(): Promise<void> {
  await mkdir('dist/server', {recursive: true});
  await mkdir('dist/.openai', {recursive: true});
  await copyStaticFiles();
  await writeSeoFiles();
  await bundleClient();
  await bundleServiceWorker();
  await writeRuntimeConfig();
  await generateWorkerAssets();
  await bundleWorker();
  await cp('.openai/hosting.json', 'dist/.openai/hosting.json');
  console.log('PISTA 84: web/native assets in www/; Worker in dist/server/index.js');
}

await main();
