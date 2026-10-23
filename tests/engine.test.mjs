import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Race,CARS,loadSave,environment,roadCurve,PLAYER_DEPTH,PLAYER_T,depthToScreen,screenToDepth,LANES,LANE_COUNT,LANE_WIDTH,LANE_DIVIDERS,laneCenter,trafficIntensity,trafficSpeed} from '../src/engine.js';
import {blendColor} from '../src/render.js';
import {AUDIO_PROFILES} from '../src/audio.js';
const step=(r,seconds,input={})=>{for(let t=0;t<seconds;t+=.02)r.update(.02,input);};
test('start, acceleration, distance and fuel are simulated',()=>{const r=new Race();r.start();r.spawn=100;r.fuelSpawn=100;step(r,2,{accelerate:true});assert.ok(r.speed>75);assert.ok(r.distance>20);assert.ok(r.fuel<100);assert.equal(r.coins,Math.floor(r.distance/25));});
test('braking reaches zero without ending the run; accelerator restarts the car',()=>{
 const r=new Race();r.start();r.speed=120;r.spawn=100;r.fuelSpawn=100;step(r,2,{brake:true});
 assert.equal(r.speed,0);assert.equal(r.status,'running');const path=r.path;step(r,1);assert.equal(r.path,path);
 step(r,1,{accelerate:true});assert.ok(r.speed>35);assert.ok(r.path>path);
});
test('throttle, coast and brake give distinct speed changes and brake takes priority',()=>{
 const cars=Array.from({length:4},()=>{const r=new Race();r.start();r.spawn=100;r.fuelSpawn=100;r.speed=100;return r;});
 const inputs=[{accelerate:true},{},{brake:true},{accelerate:true,brake:true}];
 cars.forEach((r,i)=>step(r,.5,inputs[i]));
 assert.ok(cars[0].speed>100);assert.ok(cars[1].speed<100);assert.ok(cars[2].speed<cars[1].speed-30);assert.equal(cars[2].speed,cars[3].speed);
});
test('fuel exhaustion ends race and cannot move afterward',()=>{const r=new Race();r.start();r.fuel=.001;r.update(.05);assert.equal(r.status,'over');const d=r.distance;r.update(.05);assert.equal(r.distance,d);});
test('traffic contact loses speed and grants recovery time; another lane is safe',()=>{
 for(const lane of [0,1]){
  const r=new Race();r.start();r.speed=120;r.entities=[{type:'traffic',lane,z:PLAYER_DEPTH,car:CARS[1]}];r.update(.02);
  assert.equal(r.status,'running');assert.equal(r.crashes,lane===0?1:0);assert.equal(r.events.includes('hit'),lane===0);
  assert.ok(lane===0?r.speed<60:r.speed>115);
 }
});
test('pickup restores 32 fuel, caps at 100 and is consumed once',()=>{const r=new Race();r.start();r.fuel=80;r.entities=[{type:'fuel',lane:0,z:PLAYER_DEPTH}];r.update(.02);assert.equal(r.fuel,100);assert.equal(r.entities.length,0);r.update(.02);assert.ok(r.fuel<100);});
test('second chance is allowed once and clears hazards',()=>{const r=new Race();r.start();r.finish('x');r.fuel=0;assert.equal(r.resume(),true);assert.equal(r.fuel,45);assert.equal(r.invincible,3);r.finish('x');assert.equal(r.resume(),false);});
test('pause freezes simulation; reset clears race state',()=>{const r=new Race();r.start();r.status='paused';r.update(.05,{accelerate:true});assert.equal(r.distance,0);assert.equal(r.fuel,100);r.start();assert.equal(r.continued,false);assert.equal(r.status,'running');});
test('different vehicles affect acceleration and consumption',()=>{const a=new Race(CARS[0]),b=new Race(CARS[5]);for(const r of [a,b]){r.start();r.spawn=100;step(r,1,{accelerate:true});}assert.ok(b.speed>a.speed);assert.ok(b.fuel<a.fuel);});
test('environment includes all light and weather states',()=>{const lights=new Set(),weather=new Set();for(let t=0;t<360;t++){const e=environment(t);lights.add(e.light);weather.add(e.weather);}assert.equal(lights.size,4);assert.equal(weather.size,3);});
test('save recovers corrupt data and rejects invalid ownership',()=>{assert.equal(loadSave({getItem:()=>'{broken'}).selected,'fusca');const s=loadSave({getItem:()=>JSON.stringify({coins:-1,best:100,selected:'gt',owned:[]})});assert.equal(s.coins,0);assert.equal(s.selected,'fusca');assert.equal(s.best,100);});
test('SUV retains more speed after an impact and repeated crashes do not end a run',()=>{
 const a=new Race(),b=new Race(CARS.find(c=>c.id==='suv'));
 for(const r of [a,b]){r.start();r.speed=120;r.entities=[{type:'traffic',lane:0,z:PLAYER_DEPTH}];r.update(.02);assert.equal(r.crashes,1);assert.ok(r.invincible>0);}
 assert.ok(b.speed>a.speed);
 for(const r of [a,b]){r.invincible=0;r.entities=[{type:'traffic',lane:0,z:PLAYER_DEPTH}];r.update(.02);assert.equal(r.status,'running');assert.equal(r.crashes,2);r.start();assert.equal(r.crashes,0);}
});
test('light palette and weather intensities are continuous at transitions',()=>{for(const end of [65,95,155,180]){const before=environment(end-.001),after=environment(end+.001);const colBefore=blendColor('#000000','#ffffff',before.mix);assert.ok(colBefore.startsWith('#'));assert.ok(Math.abs(before.night-after.night)<.001);}for(let t=1;t<400;t++){const a=environment(t-.001),b=environment(t+.001);assert.ok(Math.abs(a.rain-b.rain)<.001);assert.ok(Math.abs(a.fog-b.fog)<.001);}});
test('braking on shoulder reaches a standstill without ending the run',()=>{const r=new Race();r.start();r.x=1.1;r.speed=100;step(r,3,{brake:true});assert.equal(r.status,'running');assert.equal(r.speed,0);});
test('rain reduces motorcycle steering grip',()=>{const a=new Race(CARS[4]),b=new Race(CARS[4]);a.start();b.start();a.speed=100;b.speed=100;a.time=10;b.time=50;a.update(.05,{steer:1});b.update(.05,{steer:1});assert.ok(b.x<a.x);});
test('curves remain bounded and each car has its own audio profile',()=>{for(let d=0;d<100000;d+=157)assert.ok(Math.abs(roadCurve(d))<=120);assert.equal(Object.keys(AUDIO_PROFILES).length,CARS.length);assert.equal(new Set(Object.values(AUDIO_PROFILES).map(p=>p.base)).size,CARS.length);});
test('endless road varies by seed and distance with smooth bounded left/right bends and straights',()=>{
 for(const seed of [0,1,12345,4294967295]){
  const kinds=new Set();
  for(const d of [0,150,400])assert.equal(roadCurve(d,seed),0);
  for(let d=0;d<100000;d+=3){
   const curve=roadCurve(d,seed);kinds.add(Math.sign(curve));
   assert.ok(Math.abs(curve)<=.64*120);
   assert.ok(Math.abs(curve-roadCurve(d-.01,seed))<.02);
   assert.equal(curve,roadCurve(d,seed));
  }
  assert.equal(kinds.size,3);
 }
 const samples=seed=>Array.from({length:200},(_,i)=>roadCurve(i*137,seed));
 assert.notDeepEqual(samples(1),samples(2));
 assert.notDeepEqual(samples(1),Array.from({length:200},(_,i)=>roadCurve(i*137+5260,1)));
 // Sampling far ahead and then behind never changes already generated geometry.
 const before=roadCurve(750,12345);assert.ok(Number.isFinite(roadCurve(1e12,12345)));assert.equal(roadCurve(750,12345),before);
});
test('new races receive a new road seed while pause and second chance preserve it',()=>{
 let value=0;const r=new Race(CARS[0],()=>{value+=.1;return value;});r.start();const seed=r.roadSeed;
 r.status='paused';r.update(.05);assert.equal(r.roadSeed,seed);
 r.finish('test');r.resume();assert.equal(r.roadSeed,seed);
 r.start();assert.notEqual(r.roadSeed,seed);
});

test('save migration validates paints, duplicates, and null data',()=>{assert.equal(loadSave({getItem:()=> 'null'}).selected,'fusca');const s=loadSave({getItem:()=>JSON.stringify({coins:2.8,owned:['fusca','fusca','bogus'],paints:['cherry','bad'],paint:'cherry'})});assert.deepEqual(s.owned,['fusca']);assert.deepEqual(s.paints,['original','cherry']);assert.equal(s.paint,'cherry');assert.equal(s.coins,2);assert.equal(s.version,2);});
test('a right-hand bend pushes an unattended car to the outside and steering counters it',()=>{const a=new Race(),b=new Race();for(const r of [a,b]){r.start();r.spawn=100;r.fuelSpawn=100;r.speed=180;r.roadSeed=0;r.path=Array.from({length:1000},(_,i)=>420+i*20).find(d=>roadCurve(d,0)>55);}for(let t=0;t<.5;t+=.02){a.update(.02,{accelerate:true});b.update(.02,{accelerate:true,steer:1});}assert.ok(a.x<-.05);assert.ok(b.x>a.x+.3);});
test('grass slows the car and barrier contact bounces it back without ending the run',()=>{
 const r=new Race();r.start();r.spawn=100;r.fuelSpawn=100;r.speed=150;r.x=1.05;r.update(.05,{accelerate:true});assert.equal(r.offroad,true);assert.ok(r.speed<150);
 const w=new Race();w.start();w.spawn=100;w.speed=150;w.x=-1.34;w.update(.05,{steer:-1});assert.equal(w.status,'running');assert.equal(w.crashes,1);assert.ok(Math.abs(w.x)<1.3);assert.ok(w.speed<80);
});
test('every kilometre is a checkpoint that refuels once',()=>{const r=new Race();r.start();r.spawn=100;r.fuelSpawn=100;r.distance=999.9;r.fuel=50;r.speed=150;r.update(.05,{accelerate:true});assert.ok(r.events.includes('checkpoint'));assert.equal(r.checkpoints,1);assert.ok(r.fuel>60);r.update(.05,{accelerate:true});assert.ok(!r.events.includes('checkpoint'));});

test('straight driving stays centered and path advancement matches distance',()=>{
 const r=new Race();r.start();r.spawn=100;r.fuelSpawn=100;step(r,5,{accelerate:true});
 assert.equal(r.x,0);assert.equal(r.drift,0);assert.equal(r.path,r.distance);
});
test('traffic collides at the projected player plane, not while still ahead',()=>{
 assert.ok(Math.abs(depthToScreen(PLAYER_DEPTH)-PLAYER_T)<1e-12);
 for(const t of [0,.1,.5,1])assert.ok(Math.abs(depthToScreen(screenToDepth(t))-t)<1e-12);
 const r=new Race();r.start();r.spawn=100;r.entities=[{type:'traffic',lane:0,z:.1}];r.update(.02);assert.equal(r.status,'running');
 assert.equal(r.crashes,0);r.entities[0].z=PLAYER_DEPTH;r.update(.02);assert.equal(r.crashes,1);assert.equal(r.status,'running');
});
test('steering responds smoothly and returns to neutral when released',()=>{
 const r=new Race();r.start();r.spawn=100;r.fuelSpawn=100;r.update(.02,{steer:1});
 assert.ok(r.steer>0&&r.steer<.5);step(r,.3,{steer:1});assert.ok(r.steer>.95);
 step(r,.5);assert.ok(r.steer<.01);
});
test('configured balance takes precedence over local/imported balances, including zero and corrupt saves',()=>{
 for(const text of ['{}','null','{broken',JSON.stringify({coins:45,owned:['fusca','gol'],selected:'gol'})]){
  assert.equal(loadSave({getItem:()=>text},{coins:10000}).coins,10000);
  assert.equal(loadSave({getItem:()=>text},{coins:0}).coins,0);
 }
 const text=JSON.stringify({coins:45,owned:['fusca','gol'],selected:'gol'});
 assert.equal(loadSave({getItem:()=>text},{coins:null}).coins,45);
 assert.equal(loadSave({getItem:()=>text},{coins:10000}).selected,'gol');
});

test('all five lanes align with collisions and pickups; adjacent lanes remain clear',()=>{
 assert.equal(LANE_COUNT,5);assert.deepEqual(LANES,[-2,-1,0,1,2]);assert.equal(LANE_DIVIDERS.length,4);
 for(const lane of LANES){
  assert.ok(Math.abs(laneCenter(lane))+LANE_WIDTH/2<=.931);
  for(const target of LANES){
   const r=new Race();r.start();r.x=laneCenter(lane);r.entities=[{type:'traffic',lane:target,z:PLAYER_DEPTH}];r.update(.02);
   assert.equal(r.status,'running');assert.equal(r.crashes,lane===target?1:0);
  }
  const r=new Race();r.start();r.x=laneCenter(lane);r.fuel=40;r.entities=[{type:'fuel',lane,z:PLAYER_DEPTH}];r.update(.02);
  assert.ok(r.fuel>71);assert.equal(r.entities.length,0);
 }
});
test('traffic and fuel spawn throughout all five lanes and double waves use distinct lanes',()=>{
 let seed=123;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const r=new Race(CARS[0],random);r.start();r.time=180;
 const traffic=new Set(),fuel=new Set();let doubles=0;
 for(let i=0;i<300;i++){
  r.entities=[];r.spawn=0;r.fuelSpawn=0;r.update(0);
  const cars=r.entities.filter(e=>e.type==='traffic');
  assert.equal(new Set(cars.map(e=>e.lane)).size,cars.length);if(cars.length===2)doubles++;
  for(const e of r.entities){assert.ok(LANES.includes(e.lane));(e.type==='traffic'?traffic:fuel).add(e.lane);}
 }
 assert.equal(traffic.size,5);assert.equal(fuel.size,5);assert.ok(doubles>0);
});

test('road travel is proportional to speed and freezes when stopped or paused',()=>{
 const travel=speed=>{const r=new Race(CARS[5]);r.start();r.speed=speed;r.spawn=100;r.fuelSpawn=100;r.update(.05);return r.path;};
 const slow=travel(60),fast=travel(180);assert.ok(fast>slow*2.9&&fast<slow*3.1);assert.equal(travel(0),0);
 const r=new Race();r.start();r.speed=180;r.status='paused';r.update(.05,{accelerate:true});assert.equal(r.path,0);
});
test('traffic keeps its own speed so braking lets it pull away while stationary pickups stay fixed',()=>{
 const r=new Race();r.start();r.spawn=100;r.fuelSpawn=100;r.entities=[{type:'traffic',lane:2,z:.5,speed:90},{type:'fuel',lane:2,z:.5}];
 step(r,1);assert.ok(r.entities[0].z>.5);assert.equal(r.entities[1].z,.5);
 r.speed=180;const z=r.entities[0].z;r.update(.05);assert.ok(r.entities[0].z<z);
});
test('braking reduces outward cornering force, and a stopped car cannot slide sideways',()=>{
 const a=new Race(),b=new Race();const path=Array.from({length:1000},(_,i)=>420+i*20).find(d=>roadCurve(d,0)>55);
 for(const r of [a,b]){r.start();r.spawn=100;r.fuelSpawn=100;r.speed=180;r.roadSeed=0;r.path=path;}
 step(a,.5,{accelerate:true});step(b,.5,{brake:true});assert.ok(Math.abs(b.x)<Math.abs(a.x));
 const r=new Race();r.start();r.path=path;r.roadSeed=0;step(r,1,{steer:1});assert.equal(r.x,0);
});

test('120 km/h for one simulation minute covers exactly 2 km; braking and pause preserve the same units',()=>{
 const r=new Race({...CARS[0],max:120});r.start();r.speed=120;r.spawn=1000;r.fuelSpawn=1000;
 for(let i=0;i<1200;i++){r.x=0;r.update(.05,{accelerate:true});}
 assert.ok(Math.abs(r.distance-2000)<1e-8);assert.ok(Math.abs(r.time-60)<1e-8);assert.equal(r.path,r.distance);
 let expected=r.distance;
 for(let i=0;i<60;i++){r.x=0;r.update(.05,{brake:true});expected+=r.speed/3.6*.05;}
 assert.ok(Math.abs(r.distance-expected)<1e-8);assert.equal(r.speed,0);assert.equal(r.path,r.distance);
 const distance=r.distance,time=r.time;r.status='paused';step(r,10,{accelerate:true});assert.equal(r.distance,distance);assert.equal(r.time,time);
});

test('elapsed time increases traffic density and speed, with caps for every vehicle',()=>{
 const sample=time=>{
  let seed=123;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const r=new Race(CARS[0],random);r.start();r.time=time;r.fuelSpawn=1000;
  let count=0,interval=0,speed=0;
  for(let i=0;i<300;i++){
   r.entities=[];r.spawn=0;r.update(0);count+=r.entities.length;interval+=r.spawn;
   assert.ok(r.entities.length<=2);assert.equal(new Set(r.entities.map(e=>e.lane)).size,r.entities.length);
   for(const e of r.entities)speed+=e.speed;
  }
  return {rate:count/interval,speed:speed/count};
 };
 const start=sample(0),middle=sample(90),late=sample(180);
 assert.ok(middle.rate>start.rate);assert.ok(late.rate>middle.rate*1.5);
 assert.ok(middle.speed>start.speed);assert.ok(late.speed>middle.speed);
 assert.deepEqual(sample(3600),late);
 for(const car of CARS)for(const npc of CARS)for(const bias of [0,.5,1]){
  const first=trafficSpeed(car,npc,trafficIntensity(0),bias),last=trafficSpeed(car,npc,trafficIntensity(180),bias);
  assert.ok(last>=first);assert.ok(last<=car.max*.82+1e-8);assert.ok(last<=npc.max*.85+1e-8);
 }
});

test('existing traffic accelerates gradually and difficulty freezes while paused',()=>{
 const r=new Race(CARS[5]);r.start();r.time=90;r.spawn=1000;r.fuelSpawn=1000;
 const car=CARS[5],cruise=.5,speed=trafficSpeed(r.car,car,0,cruise);
 r.entities=[{type:'traffic',lane:2,z:.2,car,cruise,speed}];
 r.update(.05);assert.ok(r.entities[0].speed>speed);assert.ok(r.entities[0].speed<=speed+.15+1e-8);
 const before=structuredClone(r.entities),time=r.time;r.status='paused';step(r,2);
 assert.equal(r.time,time);assert.deepEqual(r.entities,before);
 r.start();assert.equal(trafficIntensity(r.time),0);
});
