import {loadEnvFile} from 'node:process';
import {publicConfig} from '../src/config.js';
try{loadEnvFile('.env');}catch(error){if(error.code!=='ENOENT')throw error;}
export const runtimeConfig=publicConfig(process.env);
