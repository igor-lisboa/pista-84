import {runtimeConfig} from './env.mjs';
import {cp,mkdir,readdir,readFile,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
await mkdir('www/vendor',{recursive:true});await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
await cp('web','www',{recursive:true});await cp('src','www/src',{recursive:true});
await writeFile('www/src/runtime-config.js',`export default ${JSON.stringify(runtimeConfig)};`);
await build({entryPoints:['src/qr.js'],bundle:true,format:'esm',platform:'browser',outfile:'www/vendor/qr.js',minify:true});
const assets={};const types={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',json:'application/json',webmanifest:'application/manifest+json',svg:'image/svg+xml',png:'image/png'};
async function walk(dir,prefix=''){for(const e of await readdir(dir,{withFileTypes:true})){if(e.isDirectory())await walk(`${dir}/${e.name}`,`${prefix}/${e.name}`);else{const ext=e.name.split('.').pop(),binary=ext==='png';assets[`${prefix}/${e.name}`]={body:await readFile(`${dir}/${e.name}`,binary?'base64':'utf8'),type:types[ext]||'text/plain',binary};}}}
await walk('www');await writeFile('worker/generated-assets.js',`export const assets=${JSON.stringify(assets)};`);
await build({entryPoints:['worker/index.js'],bundle:true,format:'esm',platform:'browser',target:'es2022',define:{__PISTA_CONFIG__:JSON.stringify(runtimeConfig)},outfile:'dist/server/index.js',minify:true});
await cp('.openai/hosting.json','dist/.openai/hosting.json');
console.log('PISTA 84: web/native assets in www/; Worker in dist/server/index.js');
