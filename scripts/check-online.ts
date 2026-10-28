import './env.ts';
import {blobStore} from '../src/server/blob-store.ts';
import {blobRoomStore} from '../src/server/blob-rooms.ts';

/** `npm run online:check`: proves the Vercel Blob connection can be read and written. */

const PROBE_ID = '00000000-0000-4000-8000-000000000000';

/** Phone pairing: a room must survive being read back, answered once and closed. */
async function checkPairing(): Promise<boolean> {
  const rooms = blobRoomStore(process.env);
  if (!rooms) return false;
  try {
    const id = 'f'.repeat(48);
    await rooms.create({id, hostToken: 'h', joinToken: 'j', offer: 'check', answer: null, expires: Date.now() + 60_000});
    const first = await rooms.answer(id, 'a');
    const second = await rooms.answer(id, 'b');
    const room = await rooms.get(id);
    await rooms.remove(id);
    const gone = await rooms.get(id);
    const ok = first && !second && room?.offer === 'check' && room.answer === 'a' && !gone;
    console.log(ok ? 'OK    pairing: Blob room created, answered once and removed.' : 'FAIL  pairing: unexpected Blob behaviour.');
    return Boolean(ok);
  } catch (error) {
    console.error('FAIL  pairing:', error instanceof Error ? error.message : error);
    return false;
  }
}

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
    return await checkPairing();
  } catch (error) {
    console.error('FAIL  write:', error instanceof Error ? error.message : error);
    return false;
  }
}

// exitCode (not process.exit) lets open connections close cleanly on Windows.
process.exitCode = (await check()) ? 0 : 1;
