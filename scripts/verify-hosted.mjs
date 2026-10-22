// Configuration arrives through stdin; never put service credentials in arguments.
import {createInterface} from 'node:readline';
import {chromium,webkit,expect} from '@playwright/test';
const input=createInterface({input:process.stdin,terminal:false});
let config;for await(const line of input){config=JSON.parse(line);input.close();break;}
const origin=new URL(config.url).origin,headers={'OAI-Sites-Authorization':`Bearer ${config.token}`};
async function call(path,method='GET',body,token){const res=await fetch(origin+path,{redirect:'error',method,headers:{...headers,'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await res.json();if(!res.ok)throw Error(`Hosted API ${path.split('/').slice(0,3).join('/')}: ${res.status}`);return data;}
const health=await call('/health');if(!health.cloudBackup||health.transport!=='webrtc')throw Error('Hosted runtime is not the expected Worker.');
const room=await call('/api/rooms','POST',{offer:'{"type":"offer","sdp":"smoke"}'});
try{const offer=await call(`/api/rooms/${room.id}`,'GET',null,room.joinToken);if(!offer.offer)throw Error('Hosted D1 did not retain offer.');await call(`/api/rooms/${room.id}`,'POST',{answer:'smoke-answer'},room.joinToken);const answer=await call(`/api/rooms/${room.id}`,'GET',null,room.hostToken);if(answer.answer!=='smoke-answer')throw Error('Hosted answer did not persist.');}finally{await call(`/api/rooms/${room.id}`,'DELETE',null,room.hostToken);}
console.log('Hosted health, D1 room creation, authenticated answer, and deletion passed.');
const browser=await chromium.launch(),phoneBrowser=await webkit.launch();
try{
 const context=await browser.newContext(),phoneContext=await phoneBrowser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 for(const ctx of [context,phoneContext])await ctx.route('**/*',route=>{const url=new URL(route.request().url());return route.continue({headers:{...route.request().headers(),...(url.origin===origin?headers:{})}});});
 const page=await context.newPage();await page.goto(origin+'/?transport=relay');await expect(page.locator('#start')).toBeVisible();await page.locator('#remoteNav').click();await expect(page.locator('#remoteLink a')).toBeVisible({timeout:20000});
 const controller=await phoneContext.newPage();await controller.goto(await page.locator('#remoteLink a').getAttribute('href'));await expect(controller.locator('#connection')).toHaveText('Conectado. Boa viagem!',{timeout:20000});
 await controller.locator('#remoteStart').tap();await expect(page.locator('#menu')).toBeHidden();await expect(page.locator('#raceUI')).toBeVisible();await controller.locator('[data-control="brake"]').dispatchEvent('pointerdown',{pointerId:1});await expect(page.locator('#restart')).toBeVisible({timeout:10000});
 const solo=await phoneContext.newPage();await solo.goto(origin);await solo.locator('#start').tap();await expect(solo.locator('#raceUI')).toBeVisible();await expect(solo.locator('[data-control="accelerate"]')).toBeVisible();
 console.log('Hosted Chromium + mobile WebKit: QR, HTTPS fallback, remote start/brake, and solo touch entry passed.');
}finally{await browser.close();await phoneBrowser.close();}
