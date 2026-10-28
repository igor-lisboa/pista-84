import './env.ts';
import {blobStore} from '../src/server/blob-store.ts';

/** `npm run online:check`: proves the Vercel Blob connection can be read and written. */

const PROBE_ID = '00000000-0000-4000-8000-000000000000';

async function check(): Promise<boolean> {
  const store = blobStore(process.env);
  if (!store) {
    console.error(
      'FAIL  no Blob token: set BLOB_STORAGE_READ_WRITE_TOKEN (and BLOB_STORAGE_STORE_ID) in .env.local,\n' +
        '      or run `vercel env pull .env.local`.',
    );
    return false;
  }

  try {
    const scores = await store.read<unknown[]>('scores', []);
    console.log(`OK    read: the ranking has ${scores.length} player(s).`);
  } catch (error) {
    console.error('FAIL  read:', error instanceof Error ? error.message : error);
    return false;
  }

  try {
    // Round-trip a throwaway player through the real code path, then take it out again.
    await store.update<unknown[][], void>('scores', [], (rows) => {
      rows.push([PROBE_ID, 'write-check', 1, 1, Date.now()]);
    });
    await store.update<unknown[][], void>('scores', [], (rows) => {
      const at = rows.findIndex((row) => row[0] === PROBE_ID);
      if (at >= 0) rows.splice(at, 1);
    });
    console.log('OK    write: saved and removed a test row.');
    return true;
  } catch (error) {
    console.error('FAIL  write:', error instanceof Error ? error.message : error);
    return false;
  }
}

// exitCode (not process.exit) lets open connections close cleanly on Windows.
process.exitCode = (await check()) ? 0 : 1;
