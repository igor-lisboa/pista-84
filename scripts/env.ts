import {loadEnvFile} from 'node:process';
import {publicConfig} from '../src/shared/config.ts';
import type {RuntimeConfig} from '../src/shared/config.ts';

function loadDotEnv(): void {
  try {
    loadEnvFile('.env');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

loadDotEnv();

export const runtimeConfig: RuntimeConfig = publicConfig(process.env);
