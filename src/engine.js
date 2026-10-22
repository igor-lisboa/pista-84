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
export function roadCurve(distance){const difficulty=clamp(distance/9000,0,1);return Math.sin((distance+140)/(245-difficulty*85))*105+Math.sin(distance/600)*15;}
export const PAINTS=[{id:'original',name:'Original de fábrica',color:null,price:0},{id:'ocean',name:'Azul oceano',color:'#69bddd',price:60},{id:'cherry',name:'Cereja',color:'#e87582',price:60},{id:'cream',name:'Creme vintage',color:'#e7dbb0',price:60},{id:'night',name:'Preto grafite',color:'#75818c',price:90}];
export class Race {
 constructor(car=CARS[0],random=Math.random){this.car=car;this.random=random;this.reset();}
 reset(){Object.assign(this,{status:'ready',x:0,speed:80,fuel:100,distance:0,time:0,entities:[],spawn:1.6,fuelSpawn:4,coins:0,reason:'',invincible:0,continued:false,health:this.car.shape==='suv'?2:1,events:[]});}
 start(){this.reset();this.status='running';}
 finish(reason){this.status='over';this.reason=reason;}
 resume(){if(this.status!=='over'||this.continued)return false;this.continued=true;this.status='running';this.fuel=Math.max(45,this.fuel);this.speed=90;this.entities=[];this.health=this.car.shape==='suv'?2:1;this.invincible=3;return true;}
 update(dt,input={}){
  this.events=[];if(this.status!=='running')return;dt=clamp(dt,0,.05);this.time+=dt;this.invincible=Math.max(0,this.invincible-dt);
  const difficulty=Math.min(2.8,this.distance/4500);const target=input.brake?0:input.accelerate?this.car.max:Math.min(this.car.max,105+difficulty*24);
  this.speed+=clamp(target-this.speed,-(input.brake?60:20)*dt,this.car.accel*dt);
  const grip=1-environment(this.time).rain*(this.car.shape==='bike'?.22:.1);
  this.x=clamp(this.x+(input.steer||0)*dt*1.2*this.car.handling*grip-roadCurve(this.distance)/120*(.012+difficulty*.03)*dt,-1.2,1.2);
  if(Math.abs(this.x)>.96)this.speed=Math.max(input.brake?0:15,this.speed-(this.car.shape==='suv'?20:38)*dt);
  this.distance+=this.speed/3.6*dt;this.coins=Math.floor(this.distance/25);
  this.fuel=Math.max(0,this.fuel-dt*this.car.consumption*(.45+this.speed/190));
  if(this.fuel<=0){this.finish('Pane seca! O trânsito alcançou você.');return;}
  if(this.speed<5){this.finish('Você parou na pista. O trânsito alcançou você.');return;}
  this.spawn-=dt;this.fuelSpawn-=dt;
  if(this.spawn<=0){this.entities.push({type:'traffic',lane:Math.floor(this.random()*3)-1,z:1.1,car:CARS[Math.floor(this.random()*CARS.length)]});this.spawn=Math.max(.7,2.5-difficulty*.5)+this.random()*.7;}
  if(this.fuelSpawn<=0){this.entities.push({type:'fuel',lane:Math.floor(this.random()*3)-1,z:1.1});this.fuelSpawn=7+this.random()*3;}
  for(const e of this.entities){e.z-=dt*(.16+this.speed/600)*(e.type==='traffic'?.72:1);if(!e.passed&&e.z<.12&&e.z>-.09){const width=this.car.shape==='bike'?.19:.27;if(Math.abs(this.x-e.lane*.61)<width){e.passed=true;if(e.type==='fuel'){this.fuel=Math.min(100,this.fuel+32);e.collected=true;this.events.push('fuel');}else if(this.invincible<=0){this.health--;this.events.push('hit');if(this.health<=0){this.finish('Fim de corrida. Cuidado com o trânsito!');return;}this.speed=Math.max(35,this.speed*.65);this.invincible=2;}}}}
  this.entities=this.entities.filter(e=>e.z>-.15&&!e.collected);
 }
}
export function loadSave(storage){
 const fallback={version:2,coins:0,best:0,owned:['fusca'],selected:'fusca',paints:['original'],paint:'original',sound:false};
 try{const s=JSON.parse(storage.getItem('pista84')||'{}');if(!s||typeof s!=='object')return fallback;
 const owned=[...new Set(['fusca',...(Array.isArray(s.owned)?s.owned.filter(id=>CARS.some(c=>c.id===id)):[])])];
 const paints=[...new Set(['original',...(Array.isArray(s.paints)?s.paints.filter(id=>PAINTS.some(p=>p.id===id)):[])])];
 return {...fallback,coins:Number.isFinite(s.coins)?Math.max(0,Math.floor(s.coins)):0,best:Number.isFinite(s.best)?Math.max(0,s.best):0,owned,selected:owned.includes(s.selected)?s.selected:'fusca',paints,paint:paints.includes(s.paint)?s.paint:'original',sound:s.sound===true};
 }catch{return fallback;}
}
