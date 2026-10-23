import runtimeConfig from './runtime-config.js';
export const CARS = [
 {id:'fusca',name:'Fusca 76',tag:'O clássico brasileiro',color:'#f5c542',max:155,accel:26,consumption:.72,handling:1,price:0,shape:'bug'},
 {id:'brasilia',name:'Brasília 80',tag:'Espaço para aventura',color:'#6ed4a0',max:165,accel:29,consumption:.8,handling:1,price:180,shape:'box'},
 {id:'gol',name:'Gol Bolinha',tag:'Pequeno. Valente. Nacional.',color:'#669df4',max:185,accel:36,consumption:.9,handling:1.12,price:420,shape:'box'},
 {id:'palio',name:'Palio 98',tag:'Todo dia é estrada',color:'#f08364',max:180,accel:34,consumption:.82,handling:1.08,price:350,shape:'box'},
 {id:'moto',name:'Moto urbana',tag:'Leve e ligeira',color:'#ddd8cf',max:175,accel:48,consumption:.6,handling:1.4,price:260,shape:'bike'},
 {id:'gt',name:'Veloce GT',tag:'Série especial · modo demonstração',color:'#e76368',max:285,accel:60,consumption:1.65,handling:1.15,price:1200,shape:'sport'},
 {id:'suv',name:'Bruto 4×4',tag:'Força em cada quilômetro',color:'#c2a177',max:195,accel:22,consumption:1.35,handling:.8,price:850,shape:'suv'},
 {id:'superbike',name:'Raio 1000',tag:'Duas rodas, mil histórias',color:'#af94ec',max:300,accel:68,consumption:1.4,handling:1.5,price:1500,shape:'bike'}
];
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const LIGHTS=['Dia','Pôr do sol','Noite','Amanhecer'];
const ENDS=[65,95,155,180];
const WEATHER=['Limpo','Chuva','Limpo','Neblina'];
export function environment(time){
 const t=Math.max(0,time),cycle=t%180,index=ENDS.findIndex(end=>cycle<end);
 const mix=clamp((cycle-(ENDS[index]-10))/10,0,1),smooth=mix*mix*(3-2*mix);
 const phase=Math.floor(t/38)%4,blend=clamp((t%38)/5,0,1),previous=WEATHER[(phase+3)%4];
 const weather=WEATHER[phase];
 const intensity=kind=>(previous===kind?1-blend:0)+(weather===kind?blend:0);
 const night=[0,.15,1,.35];
 return {light:LIGHTS[index],weather,from:LIGHTS[index],to:LIGHTS[(index+1)%4],mix:smooth,night:night[index]*(1-smooth)+night[(index+1)%4]*smooth,rain:t<5?0:intensity('Chuva'),fog:t<5?0:intensity('Neblina')};
}
// Stateless, seeded road generation: any distance can be sampled in any order.
// Each section reserves straight road around a smooth bend; no stored segment
// list grows during an endless run, and there is no repeating track table.
const ROAD_SECTION=1600;
function roadRandom(section,seed,salt){
 let n=(Math.imul(section,0x9e3779b1)^seed^Math.imul(salt,0x85ebca6b))>>>0;
 n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);
 return ((n^(n>>>16))>>>0)/4294967296;
}
export function roadCurve(distance,seed=0){
 const d=Math.max(0,distance),section=Math.floor(d/ROAD_SECTION),at=d-section*ROAD_SECTION;
 const random=salt=>roadRandom(section,seed,salt),kind=random(1);
 if(kind<.18)return 0;
 const straight=section===0?420:240+random(2)*260;
 const entry=180+random(3)*60,hold=200+random(4)*160,exit=180+random(5)*60;
 const bend=(kind<.59?-1:1)*(.32+random(6)*.32)*120;
 const t=at-straight;if(t<=0||t>=entry+hold+exit)return 0;
 // Zero first and second derivatives at the joins avoid a sudden change in
 // cornering load as a straight becomes a bend or a bend straightens out.
 const smooth=v=>{const u=clamp(v,0,1);return u*u*u*(u*(u*6-15)+10);};
 return bend*smooth(t/entry)*(1-smooth((t-entry-hold)/exit));
}
export const PAINTS=[{id:'original',name:'Original de fábrica',color:null,price:0},{id:'ocean',name:'Azul oceano',color:'#69bddd',price:60},{id:'cherry',name:'Cereja',color:'#e87582',price:60},{id:'cream',name:'Creme vintage',color:'#e7dbb0',price:60},{id:'night',name:'Preto grafite',color:'#75818c',price:90}];
// Metres represented by the visible road. A lower camera makes nearby paint
// and scenery sweep past faster without inflating the odometer or speed.
export const WALL=1.35,EDGE=.96,CHECKPOINT=1000,PATH_UNIT=240;
export const LANE_COUNT=5,LANE_WIDTH=1.86/LANE_COUNT,VEHICLE_SCALE=3/LANE_COUNT;
export const LANES=Object.freeze(Array.from({length:LANE_COUNT},(_,i)=>i-(LANE_COUNT-1)/2));
export const laneCenter=lane=>lane*LANE_WIDTH;
export const LANE_DIVIDERS=Object.freeze(LANES.slice(1).map(lane=>laneCenter(lane)-LANE_WIDTH/2));
export const PLAYER_T=.855;
// Shared perspective and contact plane for the road, scenery and traffic.
export const depthToScreen=z=>(1-z)/(1+4*z);
export const screenToDepth=t=>(1-t)/(1+4*t);
export const PLAYER_DEPTH=screenToDepth(PLAYER_T);
export const roadBend=(distance,seed=0)=>roadCurve(distance,seed)/120;
export const trafficIntensity=time=>clamp(time/180,0,1);
export function trafficSpeed(playerCar,trafficCar,intensity,cruise){
 return Math.min(trafficCar.max*.85,playerCar.max*(.34+.16*intensity+cruise*(.18+.14*intensity)));
}
export class Race {
 constructor(car=CARS[0],random=Math.random){this.car=car;this.random=random;this.reset();}
 reset(){Object.assign(this,{status:'ready',roadSeed:Math.floor(this.random()*4294967296)>>>0,x:0,speed:0,fuel:100,distance:0,time:0,entities:[],spawn:1.6,fuelSpawn:4,coins:0,reason:'',invincible:0,continued:false,crashes:0,events:[],path:0,checkpoints:0,offroad:false,drift:0,steer:0,wall:0});}
 start(){this.reset();this.status='running';}
 finish(reason){this.status='over';this.reason=reason;}
 resume(){if(this.status!=='over'||this.continued)return false;this.continued=true;this.status='running';this.fuel=Math.max(45,this.fuel);this.speed=90;this.entities=[];this.x=clamp(this.x,-.6,.6);this.offroad=false;this.invincible=3;return true;}
 hit(){
  if(this.invincible>0)return;
  this.crashes++;this.events.push('hit');
  this.speed*=this.car.shape==='suv'?.7:.42;
  this.invincible=1.3;
 }
 update(dt,input={}){
  this.events=[];if(this.status!=='running')return;dt=clamp(dt,0,.05);this.time+=dt;this.invincible=Math.max(0,this.invincible-dt);
  const difficulty=trafficIntensity(this.time);
  // Accelerator, coast and brake are distinct. Automatic gearing gives strong
  // low-speed pull and less acceleration near the vehicle's top speed.
  const speedRatio=clamp(this.speed/this.car.max,0,1);
  const acceleration=this.car.accel*1.8*(1-.45*speedRatio);
  const force=input.brake?-110:input.accelerate?acceleration:-(12+this.speed*.025);
  this.speed=clamp(this.speed+force*dt,0,this.car.max);
  const grip=1-environment(this.time).rain*(this.car.shape==='bike'?.22:.1);
  const rolling=clamp(this.speed/90,0,1),load=clamp((this.speed/180)**2,0,3);
  this.steer+=(clamp(input.steer||0,-1,1)-this.steer)*(1-Math.exp(-dt*22));
  this.drift=roadBend(this.path+PATH_UNIT*PLAYER_DEPTH,this.roadSeed)*load*.9*VEHICLE_SCALE/Math.sqrt(this.car.handling)/grip;
  const steering=(1.35-.25*speedRatio)*rolling*this.car.handling*grip*VEHICLE_SCALE;
  this.x+=(this.steer*steering-this.drift)*dt;
  this.offroad=Math.abs(this.x)>EDGE;
  if(this.offroad){
   const limit=this.car.shape==='suv'?85:60;
   if(this.speed>limit)this.speed=Math.max(limit,this.speed-100*dt);
  }
  this.wall=0;
  if(Math.abs(this.x)>=WALL){this.wall=Math.sign(this.x);this.x=this.wall*(WALL-.16);this.hit();}
  const before=this.distance,advance=this.speed/3.6*dt;this.distance+=advance;this.path+=advance;this.coins=Math.floor(this.distance/25);
  if(Math.floor(this.distance/CHECKPOINT)>Math.floor(before/CHECKPOINT)){this.checkpoints=Math.floor(this.distance/CHECKPOINT);this.fuel=Math.min(100,this.fuel+15);this.events.push('checkpoint');}
  this.fuel=Math.max(0,this.fuel-dt*this.car.consumption*(.45+this.speed/190));
  if(this.fuel<=0){this.finish('Pane seca! O trânsito alcançou você.');return;}
  this.spawn-=dt;this.fuelSpawn-=dt;
  if(this.spawn<=0){
   const lane=LANES[Math.floor(this.random()*LANE_COUNT)];
   const addTraffic=lane=>{
    const car=CARS[Math.floor(this.random()*CARS.length)],cruise=this.random();
    this.entities.push({type:'traffic',lane,z:1.1,cruise,car,speed:trafficSpeed(this.car,car,difficulty,cruise)});
   };
   addTraffic(lane);
   // More frequent paired waves, with distinct lanes and three gaps per wave.
   if(this.random()<difficulty*.65){const other=LANES[(LANES.indexOf(lane)+1+Math.floor(this.random()*(LANE_COUNT-1)))%LANE_COUNT];addTraffic(other);}
   this.spawn=2.4-difficulty*1.5+this.random()*.4;
  }
  if(this.fuelSpawn<=0){this.entities.push({type:'fuel',lane:LANES[Math.floor(this.random()*LANE_COUNT)],z:1.1});this.fuelSpawn=7+this.random()*3;}
  for(const e of this.entities){
   // Cars already on the road also gain pace, with no instantaneous jumps.
   if(e.type==='traffic'&&Number.isFinite(e.cruise)){
    const target=trafficSpeed(this.car,e.car,difficulty,e.cruise);
    e.speed+=clamp(target-e.speed,-3*dt,3*dt);
   }
   const oldZ=e.z,trafficAdvance=e.type==='traffic'?(e.speed??90)/3.6*dt:0;
   e.z+=(trafficAdvance-advance)/PATH_UNIT;
   const crossed=Math.min(oldZ,e.z)<=PLAYER_DEPTH+.018&&Math.max(oldZ,e.z)>=PLAYER_DEPTH-.018;
   if(!e.passed&&crossed){
    const width=(this.car.shape==='bike'?.19:.27)*VEHICLE_SCALE;
    if(Math.abs(this.x-laneCenter(e.lane))<width){
     e.passed=true;
     if(e.type==='fuel'){this.fuel=Math.min(100,this.fuel+32);e.collected=true;this.events.push('fuel');}
     else this.hit();
    }
   }
  }
  this.entities=this.entities.filter(e=>e.z>-.15&&e.z<1.5&&!e.collected);
 }
}
export function loadSave(storage,config=runtimeConfig){
 const fallback={version:2,coins:0,best:0,owned:['fusca'],selected:'fusca',paints:['original'],paint:'original',sound:false};
 const coinsOverride=Number.isSafeInteger(config.coins)&&config.coins>=0?config.coins:null;
 if(coinsOverride!==null)fallback.coins=coinsOverride;
 try{const s=JSON.parse(storage.getItem('pista84')||'{}');if(!s||typeof s!=='object')return fallback;
 const owned=[...new Set(['fusca',...(Array.isArray(s.owned)?s.owned.filter(id=>CARS.some(c=>c.id===id)):[])])];
 const paints=[...new Set(['original',...(Array.isArray(s.paints)?s.paints.filter(id=>PAINTS.some(p=>p.id===id)):[])])];
 return {...fallback,coins:coinsOverride??(Number.isFinite(s.coins)?Math.max(0,Math.floor(s.coins)):0),best:Number.isFinite(s.best)?Math.max(0,s.best):0,owned,selected:owned.includes(s.selected)?s.selected:'fusca',paints,paint:paints.includes(s.paint)?s.paint:'original',sound:s.sound===true};
 }catch{return fallback;}
}
