import {test,expect} from '@playwright/test';
test('production atlas loads eight complete transparent sprites with no clipped bodywork',async({page})=>{
 await page.goto('/');const report=await page.evaluate(async()=>{const {loadSprites,spritesReady,spriteDimensions,drawCar}=await import('/src/sprites.js'),{CARS}=await import('/src/engine.js');await loadSprites();const details=CARS.map(car=>{const dimensions=spriteDimensions(car),canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const c=canvas.getContext('2d');drawCar(c,128,240,Math.min(210/dimensions.width,210/dimensions.height),car);const image=c.getImageData(0,0,256,256).data;let count=0,edge=0;for(let y=0;y<256;y++)for(let x=0;x<256;x++)if(image[(y*256+x)*4+3]>80){count++;if(x===0||y===0||x===255||y===255)edge++;}return {count,edge};});return {ready:spritesReady(),details};});expect(report.ready).toBe(true);expect(report.details).toHaveLength(8);for(const sprite of report.details){expect(sprite.count).toBeGreaterThan(1000);expect(sprite.edge).toBe(0);}
});
test('menu disappears in race, pause and return to menu preserve usable flows',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await expect(page.locator('#menu')).toBeVisible();await expect(page.locator('#raceUI')).toBeHidden();await page.locator('#start').click();await expect(page.locator('#menu')).toBeHidden();await expect(page.locator('#raceUI')).toBeVisible();await expect(page.locator('#settingsNav')).toBeHidden();await page.keyboard.down('ArrowUp');await expect.poll(async()=>parseInt(await page.locator('#speed').innerText())).toBeGreaterThan(95);await page.keyboard.up('ArrowUp');
 await page.keyboard.press('p');await expect(page.locator('#resume')).toBeVisible();const distance=await page.locator('#distance').innerText();await page.waitForTimeout(250);expect(await page.locator('#distance').innerText()).toBe(distance);
 await page.locator('#resume').click();await page.keyboard.down(' ');await expect.poll(async()=>parseInt(await page.locator('#speed').innerText())).toBe(0);await page.keyboard.up(' ');await expect(page.locator('#restart')).toHaveCount(0);
 await page.keyboard.down('ArrowUp');await expect.poll(async()=>parseInt(await page.locator('#speed').innerText())).toBeGreaterThan(25);await page.keyboard.up('ArrowUp');
 await page.keyboard.press('p');await page.locator('#toMenu').click();await expect(page.locator('#menu')).toBeVisible();await page.locator('#garageNav').click();await expect(page.locator('.car-card')).toHaveCount(8);expect(errors).toEqual([]);
});
test('garage and paint purchase persist; changing car returns to initial menu',async({page})=>{
 await page.goto('/');await page.evaluate(()=>localStorage.setItem('pista84',JSON.stringify({coins:500,best:100,owned:['fusca'],selected:'fusca'})));await page.reload();await page.locator('#garageNav').click();const car=page.locator('.car-card').filter({has:page.getByRole('heading',{name:'Brasília 80'})});await car.getByRole('button').click();await expect(car.getByRole('button')).toHaveText('SELECIONADO');await page.getByRole('button',{name:/Cereja/}).click();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('pista84')).coins)).toBe(260);await page.reload();await expect(page.locator('#carName')).toHaveText('BRASÍLIA 80');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('pista84')).paint)).toBe('cherry');
});
test('offline cache contains new sprite and garage modules',async({page,context})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.locator('#settingsNav').click();await page.locator('#sound').click();if(await page.evaluate(()=>!!(window.AudioContext||window.webkitAudioContext)))await expect(page.locator('#sound')).toHaveAttribute('aria-pressed','true');else await expect(page.locator('#toast')).toBeVisible();await page.locator('#closeModal').click();await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);await context.setOffline(true);await page.reload();await page.locator('#start').click();await expect(page.locator('#raceUI')).toBeVisible();expect(errors).toEqual([]);
});
test('remote HTTPS fallback works with WebRTC unavailable and can start from phone',async({browser,page})=>{
 await page.addInitScript(()=>Object.defineProperty(window,'RTCPeerConnection',{value:undefined,configurable:true}));await page.goto('/');await page.locator('#remoteNav').click();await expect(page.locator('#remoteLink a')).toBeVisible({timeout:15000});const url=new URL(await page.locator('#remoteLink a').getAttribute('href'));url.hostname='127.0.0.1';const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});await context.addInitScript(()=>Object.defineProperty(window,'RTCPeerConnection',{value:undefined,configurable:true}));const controller=await context.newPage();await controller.goto(url.href);await expect(controller.locator('#connection')).toHaveText('Conectado. Boa viagem!');await controller.locator('#remoteStart').tap();await expect(page.locator('#raceUI')).toBeVisible();await expect(page.locator('#menu')).toBeHidden();await expect(page.locator('#modal')).not.toBeVisible();await controller.locator('[data-control="brake"]').dispatchEvent('pointerdown',{pointerId:1});await expect.poll(async()=>parseInt(await page.locator('#speed').innerText())).toBe(0);await expect(page.locator('#restart')).toHaveCount(0);await controller.locator('[data-control="brake"]').dispatchEvent('pointerup',{pointerId:1});await controller.locator('[data-control="accelerate"]').dispatchEvent('pointerdown',{pointerId:2});await expect.poll(async()=>parseInt(await page.locator('#speed').innerText())).toBeGreaterThan(15);await controller.close();await context.close();
});
test('remote loss pauses and a new QR code can reconnect',async({browser,page})=>{
 await page.goto('/?transport=relay');await page.locator('#remoteNav').click();await expect(page.locator('#remoteLink a')).toBeVisible();const first=await page.locator('#remoteLink a').getAttribute('href'),url=new URL(first);url.hostname='127.0.0.1';const controller=await browser.newPage();await controller.goto(url.href);await expect(controller.locator('#connection')).toHaveText('Conectado. Boa viagem!');await page.locator('#remotePlay').click();await controller.close();await expect(page.locator('#resume')).toBeVisible({timeout:8000});await page.locator('#pauseSettings').click();await page.locator('#closeModal').click();await page.locator('#toMenu').click();await page.locator('#remoteNav').click();await expect(page.locator('#remoteLink a')).toBeVisible();expect(await page.locator('#remoteLink a').getAttribute('href')).not.toBe(first);
});

test('all vehicles use complete distinct straight/mild/strong turn sprites with mirrored left turns',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {loadSprites,drawCar,steeringPose}=await import('/src/sprites.js'),{CARS}=await import('/src/engine.js');await loadSprites();
  const reports=CARS.map(car=>{
   const frames=[];for(const steer of [0,.45,1,-1]){
    const canvas=document.createElement('canvas');canvas.width=400;canvas.height=320;const c=canvas.getContext('2d');
    let drawCalls=0,rotations=0;const draw=c.drawImage.bind(c),rotate=c.rotate.bind(c);c.drawImage=(...args)=>{drawCalls++;draw(...args);};c.rotate=(...args)=>{rotations++;rotate(...args);};
    drawCar(c,200,290,1,car,false,steer);const data=c.getImageData(0,0,400,320).data;
    let pixels=0,clipped=0,left=400,right=0,top=320,bottom=0;
    for(let y=0;y<320;y++)for(let x=0;x<400;x++)if(data[(y*400+x)*4+3]>80){pixels++;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);if(!x||!y||x===399||y===319)clipped++;}
    frames.push({pixels,clipped,drawCalls,rotations,width:right-left,height:bottom-top,signature:canvas.toDataURL()});
   }
   return frames;
  });
  return {reports,poses:[0,.1,.45,.8,-1].map(steeringPose)};
 });
 expect(result.poses).toEqual([0,0,1,2,2]);
 for(const frames of result.reports){
  for(const frame of frames){expect(frame.pixels).toBeGreaterThan(700);expect(frame.clipped).toBe(0);expect(frame.drawCalls).toBe(1);expect(frame.rotations).toBe(0);}
  expect(new Set(frames.map(frame=>frame.signature)).size).toBe(4);
  expect(Math.abs(frames[2].width-frames[3].width)).toBeLessThanOrEqual(2);expect(frames[2].height).toBe(frames[3].height);
 }
});

test('environment balance overrides stored and cloud balances while purchases still spend coins',async({browser})=>{
 const context=await browser.newContext({serviceWorkers:'block'});const page=await context.newPage();
 await page.route('**/src/runtime-config.js',route=>route.fulfill({contentType:'text/javascript',body:'export default {coins:10000};'}));
 await page.route('**/health',route=>route.fulfill({json:{ok:true,cloudBackup:true}}));
 await page.route('**/api/progress',route=>route.fulfill({json:{save:{coins:7,owned:['fusca'],selected:'fusca'},revision:1}}));
 await page.goto('/');await page.evaluate(()=>localStorage.setItem('pista84',JSON.stringify({coins:3,owned:['fusca'],selected:'fusca'})));await page.reload();
 await expect(page.locator('#wallet')).toContainText('10000');await page.locator('#garageNav').click();
 await page.locator('.car-card').nth(1).getByRole('button').click();await expect(page.locator('#wallet')).toContainText('9820');
 await page.locator('#cloudRestore').click();await expect(page.locator('#wallet')).toContainText('10000');
 await page.reload();await expect(page.locator('#wallet')).toContainText('10000');await context.close();
});

test('road renders four lane dividers and five traffic lanes using the race seed',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const [{Renderer},{Race,CARS,LANES,PLAYER_T,laneCenter,screenToDepth,PATH_UNIT},{loadSprites}]=await Promise.all([import('/src/render.js'),import('/src/engine.js'),import('/src/sprites.js')]);
  await loadSprites();const canvas=document.createElement('canvas');canvas.style='width:960px;height:720px';document.body.replaceChildren(canvas);
  const race=new Race();race.start();race.roadSeed=1;race.entities=LANES.map(lane=>({type:'traffic',lane,z:.2,car:CARS[0]}));
  const renderer=new Renderer(canvas),y=644,horizon=Math.round(canvas.height*.275);
  // Place the sample in the middle of a painted dash, independent of camera depth.
  race.path=(12-screenToDepth((y-horizon)/(canvas.height-horizon))*PATH_UNIT%12)%12+3;
  renderer.draw(race,0,{});
  const pixels=canvas.getContext('2d').getImageData(80,y,800,1).data;let lines=0,inLine=false;
  for(let i=0;i<pixels.length;i+=4){const x=80+i/4,white=(x<420||x>540)&&pixels[i]>150&&pixels[i+1]>150&&pixels[i+2]>130&&pixels[i]>pixels[i+2];if(white&&!inLine)lines++;inLine=white;}
  renderer.profile(600,1);const first=Array.from(renderer.offsets);renderer.profile(600,2);
  const different=first.some((v,i)=>Math.abs(v-renderer.offsets[i])>.01);
  return {lines,different,lanes:LANES.map(lane=>laneCenter(lane)),playerT:PLAYER_T};
 });
 expect(result.lines).toBe(4);expect(result.different).toBe(true);expect(result.lanes).toHaveLength(5);
});

test('fuel exhaustion gives one continuation; stopping alone keeps the race running',async({page})=>{
 await page.route('**/src/engine.js',async route=>{
  const response=await route.fetch();const source=(await response.text()).replace('fuel:100','fuel:.15').replace('Math.max(45,this.fuel)','Math.max(.15,this.fuel)');
  await route.fulfill({response,body:source});
 });
 await page.goto('/');await page.locator('#start').click();await expect(page.locator('#restart')).toBeVisible();
 await page.locator('#continue').click();await expect(page.locator('#restart')).toBeVisible();await expect(page.locator('#continue')).toHaveCount(0);
});

test('rendered dash movement responds to actual speed and stops with the car',async({page})=>{
 await page.goto('/');
 const movement=await page.evaluate(async()=>{
  const [{Renderer},{Race,CARS}]=await Promise.all([import('/src/render.js'),import('/src/engine.js')]);
  const canvas=document.createElement('canvas');canvas.style='width:960px;height:720px';document.body.replaceChildren(canvas);
  const renderer=new Renderer(canvas),c=canvas.getContext('2d'),original=c.fillRect.bind(c);let rows=new Set();
  c.fillRect=(x,y,w,h)=>{if(c.fillStyle==='#f0f0e2')rows.add(y);original(x,y,w,h);};
  const ends=()=>{const ys=[...rows].sort((a,b)=>a-b);return ys.filter((y,i)=>i===ys.length-1||ys[i+1]>y+2);};
  function shift(speed,paused=false){
   const r=new Race(CARS[5]);r.start();r.roadSeed=0;r.speed=speed;r.spawn=100;r.fuelSpawn=100;if(paused)r.status='paused';
   rows=new Set();renderer.draw(r,0,{});const before=ends().reduce((a,b)=>Math.abs(b-525)<Math.abs(a-525)?b:a);
   r.update(.05);rows=new Set();renderer.draw(r,.05,{});
   const after=ends().reduce((a,b)=>Math.abs(b-before)<Math.abs(a-before)?b:a);
   return after-before;
  }
  return {slow:shift(60),fast:shift(180),stopped:shift(0),paused:shift(180,true)};
 });
 expect(movement.slow).toBeGreaterThan(0);expect(movement.fast).toBeGreaterThan(movement.slow*2);expect(movement.stopped).toBe(0);expect(movement.paused).toBe(0);
});
