import {environment,clamp,roadCurve} from './engine.js';
import {drawSkyline,drawClouds,drawTree} from './scenery.js';
export {drawCar} from './sprites.js';
import {drawCar} from './sprites.js';
const palettes={Dia:['#536e9c','#bea0ab','#7085a0','#3c4e6d','#456c57','#416652'], 'Pôr do sol':['#55577e','#d5a6a4','#8c819a','#4d4e70','#4a6956','#466351'],Noite:['#17233f','#465779','#425674','#283b58','#2d4e40','#294939'],Amanhecer:['#64749c','#c6a5ad','#8594ae','#566e8b','#4f705c','#496a57']};
export function blendColor(a,b,t){const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));const x=rgb(a),y=rgb(b);return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,'0')).join('');}
export class Renderer{
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.cameraOffset=0;this.resize();}
 resize(){const box=this.canvas.getBoundingClientRect();if(!box.width||!box.height)return;const width=box.width<600?480:960,height=Math.round(width*box.height/box.width);if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}this.ctx.imageSmoothingEnabled=false;}
 road(t,dist){const w=this.canvas.width,bend=roadCurve(dist)/120;return w*.5+w*.43*bend*(1-t)**1.4-w*.15*bend*Math.sin(t*Math.PI)-(this.cameraOffset||0)*(.18+.82*t);}
 draw(race,clock=0,input={}){
  const c=this.ctx,w=this.canvas.width,h=this.canvas.height,preview=race.status==='ready',d=preview?340+clock*20:race.distance;
  const env=environment(race.time),p=palettes[env.from].map((col,i)=>blendColor(col,palettes[env.to][i],env.mix));
  const horizon=Math.round(h*.255),roadH=h-horizon,playerT=.855,playerHalf=w*(.018+.67*playerT),sceneScale=w<600?w/405:Math.min(w,h*1.25)/550;
  const wanted=race.x*playerHalf*.9;this.cameraOffset=wanted-clamp(wanted,-w*.335,w*.335);
  const rect=(x,y,ww,hh,col)=>{c.fillStyle=col;c.fillRect(Math.round(x),Math.round(y),Math.ceil(ww),Math.ceil(hh));};
  const quad=(x1,y1,hw1,x2,y2,hw2,color)=>{c.fillStyle=color;c.beginPath();c.moveTo(x1-hw1,y1);c.lineTo(x1+hw1,y1);c.lineTo(x2+hw2,y2);c.lineTo(x2-hw2,y2);c.closePath();c.fill();};
  // Cool, layered dusk palette and a dense original skyline follow the supplied reference.
  for(let i=0;i<24;i++)rect(0,i*horizon/24,w,horizon/24+1,blendColor(p[0],p[1],i/23));
  c.globalAlpha=1-env.night*.7;drawClouds(c,w,horizon,clock);c.globalAlpha=1;
  if(env.night>.3){c.globalAlpha=env.night;for(let i=0;i<35;i++)rect((i*137)%w,(i*31)%(horizon*.5),1,1,'#d1dded');c.globalAlpha=1;}
  drawSkyline(c,w,horizon,env.night,-roadCurve(d)*.25-this.cameraOffset*.1);
  rect(0,horizon+2,w,roadH,p[4]);
  const roads=[blendColor('#535767','#52657a',env.rain),blendColor('#515564','#52657a',env.rain)];
  for(let y=horizon+2;y<h;y+=2){const t=(y-horizon)/roadH;
   const center=this.road(t,d),half=w*(.018+.67*t);
   const stripe=Math.floor(d/7+18/(t+.12))%2;rect(0,y,w,2,stripe?p[4]:p[5]);
   const edge=1+w*.019*t;
   rect(center-half-edge,y,(half+edge)*2,2,stripe?'#e2e9e8':'#74add7');
   rect(center-half,y,half*2,2,roads[stripe]);
   const line=Math.max(1,w*.005*t);
   rect(center-half+line*.7,y,line*.64,2,'#c6ced8');rect(center+half-line*1.3,y,line*.64,2,'#c6ced8');
   if(Math.floor(d/8+16/(t+.12))%3!==0)for(const side of [-1,1])rect(center+side*half/3-line*.52,y,line*1.04,2,'#dadbe2');
  }
  // Far objects first, with winding road positions shared by traffic and trees.
  const objects=[];
  for(let i=0;i<30;i++){const t=((i/30+d/1200)%1)**1.6;objects.push({t,side:i%2?1:-1,index:i});}
  for(const o of objects.sort((a,b)=>a.t-b.t)){
   const half=w*(.018+.67*o.t),y=horizon+o.t*roadH,x=this.road(o.t,d)+o.side*(half+w*(.025+.11*o.t));
   const s=(.11+o.t*1.08)*w/480;
   drawTree(c,x,y,s);
  }
  const entities=preview?[
   {type:'traffic',lane:-1,z:.29,car:{id:'gt',color:'#e5bc47',shape:'sport'}},
   {type:'traffic',lane:1,z:.4,car:{id:'fusca',color:'#cdbd8b',shape:'bug'}},
   {type:'traffic',lane:1,z:.68,car:{id:'gol',color:'#5476aa',shape:'box'}},
   {type:'traffic',lane:-1,z:.84,car:{id:'palio',color:'#cc6158',shape:'box'}}
  ]:race.entities;
  for(const e of [...entities].sort((a,b)=>b.z-a.z)){
   const t=clamp(1-e.z,0,1.13)**1.6,y=horizon+t*roadH,half=w*(.018+.67*t),x=this.road(t,d)+e.lane*.61*half*.9,s=(.08+t)*sceneScale/.93;
   if(e.type==='traffic'){
    rect(x-45*s,y-2*s,90*s,6*s,'#17212f66');drawCar(c,x,y,s,e.car);
    if(env.night>.2){c.globalAlpha=env.night*.25;rect(x-35*s,y+2*s,14*s,8*s,'#f37a86');rect(x+21*s,y+2*s,14*s,8*s,'#f37a86');c.globalAlpha=1;}
   }else{
    rect(x-15*s,y-39*s,30*s,37*s,'#234d3e');rect(x-12*s,y-36*s,24*s,30*s,'#b8d68f');rect(x-8*s,y-43*s,16*s,8*s,'#dce4b3');rect(x-5*s,y-40*s,10*s,3*s,'#47663f');rect(x-2*s,y-31*s,4*s,19*s,'#52764b');rect(x-9*s,y-24*s,18*s,5*s,'#52764b');
   }
  }
  const playerY=horizon+playerT*roadH,playerX=this.road(playerT,d)+wanted,scale=sceneScale;
  rect(playerX-49*scale,playerY-3,98*scale,8*scale,'#151d2f77');
  if(env.night>.1){c.globalAlpha=env.night*.13;quad(playerX,playerY-55*scale,32*scale,playerX,playerY-190*scale,92*scale,'#eee0af');c.globalAlpha=1;}
  if(race.invincible<=0||Math.floor(clock*12)%2===0)drawCar(c,playerX,playerY,scale,race.car,input.brake,input.steer||0);
  if(env.rain>0){c.globalAlpha=env.rain*.5;c.strokeStyle='#c2d1e2';c.lineWidth=1;for(let i=0;i<65;i++){const x=((i*97-clock*120)%w+w)%w,y=(i*83+clock*400)%h;c.beginPath();c.moveTo(x,y);c.lineTo(x-4,y+13);c.stroke();}c.globalAlpha=1;}
  if(env.fog>0){c.globalAlpha=env.fog;const fog=c.createLinearGradient(0,horizon,0,h);fog.addColorStop(0,'#bdc9dbdc');fog.addColorStop(.5,'#b8c7d570');fog.addColorStop(1,'#a0b7cf00');c.fillStyle=fog;c.fillRect(0,horizon,w,roadH);c.globalAlpha=1;}
 }
}
