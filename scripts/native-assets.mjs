// Render the project's vector artwork into installable app assets.
import {chromium} from '@playwright/test';
import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
const browser=await chromium.launch(),page=await browser.newPage();
const svg=await readFile('web/icon.svg','utf8');
async function icon(path,size){await page.setViewportSize({width:size,height:size});await page.setContent(`<style>body{margin:0;background:#141a1e}svg{width:100vw;height:100vh}</style>${svg}`);await page.screenshot({path});}
await icon('web/icon-192.png',192);await icon('web/icon-512.png',512);await icon('web/apple-touch-icon.png',180);
await icon('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png',1024);
for(const [density,size] of Object.entries({mdpi:48,hdpi:72,xhdpi:96,xxhdpi:144,xxxhdpi:192})){const root=`android/app/src/main/res/mipmap-${density}`;await icon(`${root}/ic_launcher.png`,size);await icon(`${root}/ic_launcher_round.png`,size);await icon(`${root}/ic_launcher_foreground.png`,Math.round(size*2.25));}
async function splash(path,size){await page.setViewportSize({width:size,height:size});await page.setContent(`<style>body{margin:0;background:#141a1e;display:grid;place-content:center;height:100vh;color:#f3c85b;text-align:center;font:bold ${Math.round(size*.035)}px monospace}svg{width:${Math.round(size*.22)}px;height:${Math.round(size*.22)}px;margin:auto}p{letter-spacing:.12em}</style>${svg}<p>PISTA 84</p>`);await page.screenshot({path});}
const android='android/app/src/main/res';for(const e of await readdir(android,{withFileTypes:true})){if(e.isDirectory()&&e.name.startsWith('drawable')){const files=await readdir(join(android,e.name));if(files.includes('splash.png'))await splash(join(android,e.name,'splash.png'),960);}}
const ios='ios/App/App/Assets.xcassets/Splash.imageset';for(const file of await readdir(ios))if(file.endsWith('.png'))await splash(join(ios,file),2048);
await browser.close();console.log('Web and native icons/splashes rendered from project vector artwork.');
