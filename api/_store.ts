import {blobStore} from '../src/server/blob-store.ts';

/** `null` until the Blob store token is set on the project. */
export const store = blobStore(process.env);
