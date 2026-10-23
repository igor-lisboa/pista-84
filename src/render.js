import {environment,clamp,roadBend,PATH_UNIT,WALL,PLAYER_T,depthToScreen,screenToDepth,LANES,LANE_WIDTH,LANE_DIVIDERS,laneCenter,VEHICLE_SCALE} from './engine.js';
import {drawSkyline,drawClouds,drawTree,drawMountains,drawSun,drawLamp,drawBillboard,drawBush} from './scenery.js';
export {drawCar} from './sprites.js';
import {drawCar} from './sprites.js';
// [sky top, horizon haze, far ridge, near ridge, grass A, grass B, sun]
const palettes={
 Dia:['#2f7fd0','#c4e6f4','#8fb2d0','#6e9aa8','#58a845','#4d9a3d','#fff0a8'],
 'Pôr do sol':['#3f3a86','#ff9a5c','#9a6c9c','#6e5280','#527f3c','#487234','#ffd070'],
 Noite:['#080e2c','#2b386c','#2a3760','#1d2849','#1f4632','#1a3b2b','#e4ecff'],
 Amanhecer:['#5f64b0','#ffb7a0','#a58ab2','#7a749c','#5e8c47','#53803f','#ffe2a2']
};
const sunAltitude={Dia:.72,'Pôr do sol':.1,Noite:.78,Amanhecer:.13};
const sunSize={Dia:15,'Pôr do sol':27,Noite:9,Amanhecer:22};
const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
export function blendColor(a,b,t){const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));const x=rgb(a),y=rgb(b);return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,'0')).join('');}
const SAMPLES=160,UOF=screenToDepth;
export class Renderer{
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.cameraOffset=0;this.offsets=new Float32Array(SAMPLES+1);this.heading=0;this.lastClock=0;this.hitShake=0;this.flash=0;this.lastPath=null;this.resize();}
 resize(){const box=this.canvas.getBoundingClientRect();if(!box.width||!box.height)return;const width=box.width<600?480:960,height=Math.round(width*box.height/box.width);if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}this.ctx.imageSmoothingEnabled=false;}
 // Lateral road offset per depth row: curvature is integrated along the *upcoming* track, so a bend
 // enters at the horizon and sweeps toward the car instead of the whole road swaying rigidly.
 profile(path,seed=0){
  const w=this.canvas.width,raw=new Float32Array(SAMPLES+1),iP=Math.round(PLAYER_T*SAMPLES),u0=UOF(PLAYER_T);
  for(const dir of [-1,1]){
   let X=0,dx=0,prev=u0;
   for(let i=iP+dir;i>=0&&i<=SAMPLES;i+=dir){const u=UOF(i/SAMPLES),du=u-prev,change=roadBend(path+(u+prev)/2*PATH_UNIT,seed)*du;X+=(dx+change*.5)*du;dx+=change;raw[i]=X;prev=u;}
  }
  for(let i=0;i<=SAMPLES;i++){const t=i/SAMPLES,px=raw[i]*10*(.018+.67*t)*w,limit=w*.55;this.offsets[i]=limit*Math.tanh(px/limit);}
 }
 road(t){const w=this.canvas.width,f=clamp(t,0,1)*SAMPLES,i=Math.min(SAMPLES-1,Math.floor(f)),k=f-i,o=this.offsets[i]*(1-k)+this.offsets[i+1]*k;return w*.5+o-(this.cameraOffset||0)*((.018+.67*clamp(t,0,1))/(.018+.67*PLAYER_T));}
 draw(race,clock=0,input={}){
  const c=this.ctx,w=this.canvas.width,h=this.canvas.height,preview=race.status==='ready';
  const dtc=clamp(clock-this.lastClock,0,.1);this.lastClock=clock;
  clock=preview?clock:race.time;
  const path=preview?clock*30:race.path,scroll=path/PATH_UNIT,speed=preview?100:race.speed,fast=clamp((speed-65)/180,0,1);
  const env=environment(race.time),p=palettes[env.from].map((col,i)=>blendColor(col,palettes[env.to][i],env.mix));
  const horizon=Math.round(h*.275),roadH=h-horizon,playerHalf=w*(.018+.67*PLAYER_T),sceneScale=w<600?w/405:Math.min(w,h*1.25)/550;
  const wanted=race.x*playerHalf;this.cameraOffset=wanted*.4;
  this.profile(path,race.roadSeed);
  const bendNow=preview?0:roadBend(path,race.roadSeed);
  for(const e of race.events||[]){if(e==='hit'){this.hitShake=1;this.flash=1;}}
  this.hitShake=Math.max(0,this.hitShake-dtc*2.2);this.flash=Math.max(0,this.flash-dtc*3);
  const travelled=this.lastPath===null||path<this.lastPath?0:path-this.lastPath;this.lastPath=path;
  this.heading+=bendNow*travelled*.67;
  const rumble=(race.offroad?2.8:0)+Math.max(0,speed-210)/90+this.hitShake*7;
  const shakeX=Math.sin(clock*91)*rumble,shakeY=Math.cos(clock*77)*rumble*.7;
  c.save();c.translate(Math.round(shakeX),Math.round(shakeY));
  const rect=(x,y,ww,hh,col)=>{c.fillStyle=col;c.fillRect(Math.round(x),Math.round(y),Math.ceil(ww),Math.ceil(hh));};
  const quad=(x1,y1,hw1,x2,y2,hw2,color)=>{c.fillStyle=color;c.beginPath();c.moveTo(x1-hw1,y1);c.lineTo(x1+hw1,y1);c.lineTo(x2+hw2,y2);c.lineTo(x2-hw2,y2);c.closePath();c.fill();};
  // Sky, sun, stars, clouds, ridges and city, each panning at its own rate as the heading changes.
  for(let i=0;i<28;i++)rect(-20,i*horizon/28-(i?0:20),w+40,horizon/28+1+(i?0:20),blendColor(p[0],p[1],(i/27)**1.5));
  const alt=sunAltitude[env.from]*(1-env.mix)+sunAltitude[env.to]*env.mix,size=sunSize[env.from]*(1-env.mix)+sunSize[env.to]*env.mix;
  if(env.night>.3){c.globalAlpha=env.night;for(let i=0;i<40;i++)rect((i*137)%w,(i*31)%(horizon*.55),1+(i%5===0?1:0),1+(i%5===0?1:0),'#d1dded');c.globalAlpha=1;}
  drawSun(c,w,horizon,w*.68-bendNow*14,alt*horizon,p[6],size);
  c.globalAlpha=1-env.night*.7;drawClouds(c,w,horizon,clock);c.globalAlpha=1;
  drawMountains(c,w,horizon,this.heading,p[2],p[3]);
  c.globalAlpha=.9;drawSkyline(c,w,horizon,env.night,-bendNow*26-this.cameraOffset*.1);c.globalAlpha=1;
  const haze=c.createLinearGradient(0,horizon*.55,0,horizon+4);haze.addColorStop(0,p[1]+'00');haze.addColorStop(1,p[1]+'b0');c.fillStyle=haze;c.fillRect(-20,horizon*.55,w+40,horizon*.45+4);
  rect(-20,horizon+2,w+40,roadH+20,p[4]);
  // Ground, kerbs, asphalt and guard rail are painted from the horizon to the camera, row by row.
  const wet=env.rain,asphalt=[blendColor('#50545f','#4f6176',wet),blendColor('#484c57','#475a70',wet)];
  for(let y=horizon+2;y<h;y+=2){
   const t=(y-horizon)/roadH,center=this.road(t),half=w*(.018+.67*t),world=path+UOF(t)*PATH_UNIT,far=t<.07;
   const band=far?0:Math.floor(world/7)%2,kerb=Math.floor(world/4)%2;
   rect(-20,y,w+40,y>h-3?22:2,band?p[4]:p[5]);
   const edge=1+w*.022*t;
   rect(center-half-edge,y,(half+edge)*2,2,far?'#c9d0d9':kerb?'#e8ecef':'#d9473f');
   rect(center-half,y,half*2,2,asphalt[band]);
   const line=Math.max(1,w*.0045*t);
   rect(center-half*.93,y,line,2,'#dfe3ea');rect(center+half*.93-line,y,line,2,'#dfe3ea');
   if(!far&&world%12<6)for(const divider of LANE_DIVIDERS)rect(center+divider*half-line*.5,y,line,2,'#f0f0e2');
   // Darker wheel tracks in each lane add depth to the otherwise flat asphalt.
   if(t>.18)for(const lane of LANES){rect(center+laneCenter(lane)*half-half*LANE_WIDTH*.24,y,line,2,'#00000014');rect(center+laneCenter(lane)*half+half*LANE_WIDTH*.24,y,line,2,'#00000014');}

  }
  for(const side of [-1,1]){
   for(let i=1;i<SAMPLES;i++){
    const t1=i/SAMPLES,t2=(i+1)/SAMPLES;
    const half1=w*(.018+.67*t1),half2=w*(.018+.67*t2);
    const x1=this.road(t1)+side*half1*WALL,x2=this.road(t2)+side*half2*WALL;
    const y1=horizon+t1*roadH-w*.026*t1,y2=horizon+t2*roadH-w*.026*t2;
    quad(x1,y1,Math.max(.6,w*.003*t1),x2,y2,Math.max(.6,w*.003*t2),'#b8c4cc');
   }
   for(let k=Math.ceil(scroll/.025);k<=(scroll+1)/.025;k++){
    const t=depthToScreen(k*.025-scroll);if(t<.035||t>1)continue;
    const x=this.road(t)+side*w*(.018+.67*t)*WALL,y=horizon+t*roadH;
    rect(x-w*.002*t,y-w*.026*t,w*.004*t,w*.026*t,'#647382');
   }
  }
  c.globalAlpha=.55;const fog0=c.createLinearGradient(0,horizon,0,horizon+roadH*.45);fog0.addColorStop(0,p[1]);fog0.addColorStop(1,p[1]+'00');c.fillStyle=fog0;c.fillRect(-20,horizon+2,w+40,roadH*.45);c.globalAlpha=1;
  // Everything standing on the ground shares one depth list so it overlaps correctly.
  const drawables=[],spacing=12/PATH_UNIT,kmin=Math.ceil((scroll-.09)/spacing),kmax=Math.floor((scroll+1.02)/spacing);
  for(let k=kmin;k<=kmax;k++){
   const u=k*spacing-scroll,t=depthToScreen(u);if(t<.03||t>1.12)continue;
   const side=k%2?1:-1,sample=Math.abs(k);
   drawables.push({t,draw:()=>{
    const half=w*(.018+.67*t),y=horizon+t*roadH,s=(.11+t*1.08)*w/480,edge=this.road(t)+side*half*WALL;
    if(sample%19===7)drawBillboard(c,edge+side*(half*.2+w*.025*t),y,s*1.1,Math.floor(sample/19));
    else if(sample%14===0)drawLamp(c,edge+side*half*.05,y,s,side,env.night);
    else if(sample%7===3)drawBush(c,edge+side*(w*.012+half*.1),y,s,sample%2===0);
    else drawTree(c,edge+side*(w*.03+w*.1*t+hash(sample)*half*.28),y,s*(.88+hash(sample+9)*.3));
   }});
  }
  const entities=preview?[
   {type:'traffic',lane:-2,z:.29,car:{id:'gt',color:'#e5bc47',shape:'sport'}},
   {type:'traffic',lane:1,z:.4,car:{id:'fusca',color:'#cdbd8b',shape:'bug'}},
   {type:'traffic',lane:2,z:.68,car:{id:'gol',color:'#5476aa',shape:'box'}},
   {type:'traffic',lane:-1,z:.84,car:{id:'palio',color:'#cc6158',shape:'box'}}
  ]:race.entities;
  for(const e of entities){
   const t=depthToScreen(e.z);if(t<0||t>1.3)continue;
   drawables.push({t,draw:()=>{
    const y=horizon+t*roadH,half=w*(.018+.67*t),x=this.road(t)+laneCenter(e.lane)*half,s=(.08+t)*sceneScale*VEHICLE_SCALE/.93;
    if(e.type==='traffic'){
     rect(x-45*s,y-2*s,90*s,6*s,'#17212f66');drawCar(c,x,y,s,e.car,false,roadBend(path+e.z*PATH_UNIT,race.roadSeed)*.65);
     if(env.night>.2){c.globalAlpha=env.night*.25;rect(x-35*s,y+2*s,14*s,8*s,'#f37a86');rect(x+21*s,y+2*s,14*s,8*s,'#f37a86');c.globalAlpha=1;}
    }else{
     const bob=Math.sin(clock*5+e.lane)*2*s;
     c.globalAlpha=.35+.15*Math.sin(clock*6);c.fillStyle='#8ae3be';c.beginPath();c.ellipse(x,y-18*s+bob,30*s,32*s,0,0,Math.PI*2);c.fill();c.globalAlpha=1;
     rect(x-15*s,y-39*s+bob,30*s,37*s,'#234d3e');rect(x-12*s,y-36*s+bob,24*s,30*s,'#b8d68f');rect(x-8*s,y-43*s+bob,16*s,8*s,'#dce4b3');rect(x-5*s,y-40*s+bob,10*s,3*s,'#47663f');rect(x-2*s,y-31*s+bob,4*s,19*s,'#52764b');rect(x-9*s,y-24*s+bob,18*s,5*s,'#52764b');
    }
   }});
  }
  drawables.sort((a,b)=>a.t-b.t);for(const d of drawables)d.draw();
  const bob=Math.sin(path*1.4)*fast*1.6*sceneScale,playerY=horizon+PLAYER_T*roadH+bob,playerX=this.road(PLAYER_T)+wanted,scale=sceneScale*VEHICLE_SCALE;
  rect(playerX-49*scale,playerY-3,98*scale,8*scale,'#151d2f77');
  if(env.night>.1){c.globalAlpha=env.night*.13;quad(playerX,playerY-55*scale,32*scale,playerX,playerY-190*scale,92*scale,'#eee0af');c.globalAlpha=1;}
  // Dust and grass clods thrown by the tyres whenever the car leaves the asphalt.
  if(race.offroad&&speed>25)for(let i=0;i<22;i++){
   const age=(clock*3.2+i*.137)%1,side=i%2?1:-1,px=playerX+side*(30+hash(i)*22)*scale+(hash(i+5)-.5)*age*60*scale,py=playerY-age*(14+hash(i+2)*30)*scale;
   c.globalAlpha=(1-age)*.75;rect(px,py,(3+hash(i+8)*4)*scale*(1+age),(3+hash(i+8)*3)*scale*(1+age),i%3?'#8a6b46':p[4]);c.globalAlpha=1;
  }
  if(race.invincible<=0||Math.floor(clock*12)%2===0)drawCar(c,playerX,playerY,scale,race.car,input.brake,(race.steer||0)*clamp(speed/35,0,1));
  if(env.rain>0){c.globalAlpha=env.rain*.5;c.strokeStyle='#c2d1e2';c.lineWidth=1;for(let i=0;i<65;i++){const x=((i*97-clock*120)%w+w)%w,y=(i*83+clock*400)%h;c.beginPath();c.moveTo(x,y);c.lineTo(x-4,y+13);c.stroke();}c.globalAlpha=1;}
  if(env.fog>0){c.globalAlpha=env.fog;const fog=c.createLinearGradient(0,horizon,0,h);fog.addColorStop(0,'#bdc9dbdc');fog.addColorStop(.5,'#b8c7d570');fog.addColorStop(1,'#a0b7cf00');c.fillStyle=fog;c.fillRect(0,horizon,w,roadH);c.globalAlpha=1;}
  // Speed streaks radiate from the vanishing point; they only show once you are really moving.
  if(fast>.05){
   c.lineWidth=Math.max(1,w/480);const vx=this.road(0),vy=horizon+roadH*.06;
   for(let i=0;i<26;i++){
    const angle=(hash(i+3)-.5)*Math.PI*.95+Math.PI/2,phase=(path/35+hash(i))%1,r0=.12+phase**2*.9,r1=r0+.04+fast*.2*phase;
    const reach=Math.max(w,h)*1.1,cx=Math.cos(angle),cy=Math.sin(angle);
    if(cy<.15)continue;
    c.globalAlpha=fast*.5*Math.min(1,phase*3)*(1-phase*.3);c.strokeStyle=env.night>.5?'#c8d8ff':'#ffffff';
    c.beginPath();c.moveTo(vx+cx*reach*r0,vy+cy*reach*r0);c.lineTo(vx+cx*reach*r1,vy+cy*reach*r1);c.stroke();
   }
   c.globalAlpha=1;
  }
  c.restore();
  // Vignette tightens with speed, and a red flash marks every impact.
  const edgeShade=c.createRadialGradient(w/2,h*.6,h*.35,w/2,h*.6,Math.max(w,h)*.75);edgeShade.addColorStop(0,'#00000000');edgeShade.addColorStop(1,`rgba(4,8,24,${.2+fast*.42})`);c.fillStyle=edgeShade;c.fillRect(0,0,w,h);
  if(race.offroad&&speed>25){c.fillStyle='rgba(120,80,30,.12)';c.fillRect(0,0,w,h);}
  if(this.flash>0){c.fillStyle=`rgba(255,60,80,${this.flash*.4})`;c.fillRect(0,0,w,h);}
 }
}
