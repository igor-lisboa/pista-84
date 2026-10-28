import {globalConfigStore} from '../src/server/global-config.ts';

/** `null` until GLOBAL_CONFIG and VERCEL_API_TOKEN are set on the project. */
export const store = globalConfigStore(process.env);
