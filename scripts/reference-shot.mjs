// A deterministic in-engine composition for reviewing the supplied art direction.
import {chromium} from '@playwright/test';
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:760,height:744}});
await page.goto('http://127.0.0.1:4173');
await page.evaluate(async()=>{
 const [{Renderer},{loadSprites},{Race,CARS}]=await Promise.all([import('/src/render.js'),import('/src/sprites.js'),import('/src/engine.js')]);await loadSprites();
 const canvas=document.createElement('canvas');canvas.style.cssText='width:100vw;height:100vh;image-rendering:pixelated;display:block';document.body.replaceChildren(canvas);
 const race=new Race(CARS.find(c=>c.id==='gt'));race.status='running';race.distance=0;race.entities=[
 {type:'traffic',lane:-1,z:.34,car:{...CARS[5],color:'#e9c14a'}},
 {type:'traffic',lane:1,z:.25,car:CARS[0]},
 {type:'traffic',lane:1,z:.57,car:CARS[2]},
 {type:'traffic',lane:-1,z:.86,car:{...CARS[3],color:'#d14c4d'}}];new Renderer(canvas).draw(race,0,{});
});
await page.screenshot({path:'docs/screenshots/reference-scene.png'});await browser.close();
