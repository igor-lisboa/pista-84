import {randomBytes, scrypt, timingSafeEqual} from 'node:crypto';

const COST = 131072;
const BLOCK_SIZE = 8;
const PARALLELISM = 1;
let activeDerivations = 0;

function derive(password: string, salt: string): Promise<Buffer> {
  if (activeDerivations >= 2) return Promise.reject(new Error('Password service is busy.'));
  activeDerivations++;
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, {N: COST, r: BLOCK_SIZE, p: PARALLELISM, maxmem: 192 * 1024 * 1024},
      (error, key) => {
        activeDerivations--;
        if (error) reject(error);
        else resolve(key);
      });
  });
}

export function validPassword(value: unknown): value is string {
  return typeof value === 'string' && [...value].length >= 15 && [...value].length <= 128;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt);
  return `scrypt$${COST}$${BLOCK_SIZE}$${PARALLELISM}$${salt}$${key.toString('hex')}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, cost, block, parallel, salt, hex, extra] = encoded.split('$');
  if (algorithm !== 'scrypt' || cost !== String(COST) || block !== String(BLOCK_SIZE) ||
    parallel !== String(PARALLELISM) || !/^[a-f0-9]{32}$/.test(salt ?? '') ||
    !/^[a-f0-9]{128}$/.test(hex ?? '') || extra !== undefined) return false;
  return timingSafeEqual(await derive(password, salt!), Buffer.from(hex!, 'hex'));
}

// Unknown users still incur exactly one password derivation.
export const DUMMY_PASSWORD = `scrypt$${COST}$${BLOCK_SIZE}$${PARALLELISM}$${'0'.repeat(32)}$${'0'.repeat(128)}`;
