import {readdir, readFile} from 'node:fs/promises';
import {resolve, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const limit = 299;

async function typescriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, {withFileTypes: true});
  const groups = await Promise.all(entries.map(async entry => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return typescriptFiles(path);
    return entry.name.endsWith('.ts') && entry.name !== 'generated-assets.ts' ? [path] : [];
  }));
  return groups.flat();
}

async function oversized(paths: readonly string[]): Promise<string[]> {
  const results = await Promise.all(paths.map(async path => {
    const content = await readFile(path, 'utf8');
    const lines = content.split(/\r?\n/).length - (content.endsWith('\n') ? 1 : 0);
    return lines > limit ? `${relative(root, path).replaceAll('\\', '/')}: ${lines}` : null;
  }));
  return results.filter(result => result !== null).sort();
}

const production = (await Promise.all(['src', 'api', 'worker', 'scripts', 'web'].map(directory =>
  typescriptFiles(resolve(root, directory))))).flat();
production.push(resolve(root, 'dev-server.ts'), resolve(root, 'production-server.ts'));
const failures = await oversized(production);
const testOverages = await oversized(await typescriptFiles(resolve(root, 'tests')));
console.log(`Production modules checked: ${production.length}; limit: ${limit} physical lines.`);
for (const failure of failures) console.error(`Production overage: ${failure}`);
for (const overage of testOverages) console.log(`Test module overage (reported separately): ${overage}`);
if (failures.length) process.exitCode = 1;
