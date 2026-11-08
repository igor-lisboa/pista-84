import {loadEnvFile} from 'node:process';
import {publicConfig} from '../src/shared/config.ts';
import type {RuntimeConfig} from '../src/shared/config.ts';

/** `.env.local` (written by `vercel env pull`) wins over `.env`; real environment variables win over both. */
function loadDotEnv(): void {
  // Hosted deployments use config vars; never pick up an accidentally packaged local file.
  if (process.env.NODE_ENV === 'production' || process.env.DYNO) return;
  for (const file of ['.env.local', '.env']) {
    try {
      loadEnvFile(file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}

loadDotEnv();

export const runtimeConfig: RuntimeConfig = publicConfig(process.env);
