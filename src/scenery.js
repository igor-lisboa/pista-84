// Layered city and roadside sprites built on a fixed pixel grid.
const treeCache=new Map();
const cityCache=new Map();
const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
function drawSkylineRaw(c,w,horizon,night,pan=0){
 const unit=w/480,base=horizon+2,vertical=horizon/(125*unit);
 const rect=(x,y,ww,hh,color)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(base+(y-base)*vertical),Math.ceil(ww),Math.max(1,Math.ceil(hh*vertical)));};
 // A distant, broad city mass makes the route feel connected to a place.
 for(let layer=0;layer<3;layer++){
  const scale=layer===0?.52:layer===1?.75:1,offset=pan*(.1+layer*.06);
  for(let i=-3;i<43;i++){
   const seed=i+50+layer*71,bw=(8+hash(seed)*12)*unit,x=i*13*unit+offset;
   const center=1-Math.abs(x/w-.5)*1.3;
   const bh=(12+hash(seed+8)*52)*unit*scale*Math.max(.35,center),y=base-bh;
   const fill=layer===0?'#68758d':layer===1?'#4b5e7c':'#303e5c',edge=layer===0?'#8190aa':layer===1?'#7e8eac':'#7182a1';
   rect(x,y,bw,bh,fill);rect(x,y,Math.max(1,unit),bh,'#273750');rect(x+unit,y+unit,bw-2*unit,unit,edge);rect(x+bw-2*unit,y+unit,unit,bh,'#26324c');
   if(hash(seed+3)>.45){rect(x+bw*.3,y-4*unit,bw*.4,4*unit,fill);rect(x+bw*.3,y-4*unit,bw*.4,unit,edge);}
   if(layer===2&&i%7===0){rect(x+bw*.5,y-13*unit,unit,13*unit,'#27354e');rect(x+bw*.5,y-14*unit,unit,unit,night>.3?'#e8a4a6':'#a5b9d3');}
   // Individual lit windows, broken floors, and shaded glass strips.
   for(let row=0;row<Math.floor(bh/(5*unit));row++)for(let col=0;col<Math.floor(bw/(4*unit));col++){
    const lit=hash(seed*30+row*7+col*3)>.6;
    rect(x+2*unit+col*4*unit,y+3*unit+row*5*unit,unit,2*unit,lit?(night>.4?'#e7c896':'#a6bbcb'):'#526c8e');
   }
   if(i%4===0)rect(x+bw*.5,y+4*unit,unit,bh-8*unit,'#8796b3');
  }
 }
 // Four distinct landmark towers anchor the skyline, rather than repeating boxes.
 for(const [fraction,height,width] of [[.3,76,15],[.46,93,13],[.59,83,18],[.72,61,14]]){
  const x=w*fraction+pan*.2,bh=height*unit,bw=width*unit,y=base-bh;
  rect(x,y,bw,bh,'#26354f');rect(x+unit,y+unit,bw-2*unit,bh-unit,'#435975');rect(x+2*unit,y+2*unit,2*unit,bh-3*unit,'#8495b0');
  rect(x+bw*.25,y-5*unit,bw*.5,5*unit,'#344661');rect(x+bw*.5,y-15*unit,unit,12*unit,'#9ba9c2');
  for(let k=0;k<Math.floor(bh/(5*unit));k++){rect(x+5*unit,y+3*unit+k*5*unit,bw-7*unit,unit,k%3===0?'#c7c2a4':'#8090ae');}
 }
 rect(0,base-2*unit,w,2*unit,'#23374b');rect(0,base,w,2*unit,'#759391');
}
export function drawSkyline(c,w,horizon,night,pan=0){
 const key=`${w}:${horizon}:${night>.4}`,margin=Math.ceil(w*.15);let image=cityCache.get(key);
 if(!image){image=document.createElement('canvas');image.width=w+margin*2;image.height=horizon+8;drawSkylineRaw(image.getContext('2d'),image.width,horizon,night,0);if(cityCache.size>5)cityCache.clear();cityCache.set(key,image);}
 c.drawImage(image,Math.round(-margin+pan*.2),0);
}
export function drawClouds(c,w,horizon,clock){
 const unit=w/480;
 for(let i=0;i<6;i++){
  const x=((i*w*.23-clock*1.2)%(w+80)+w+80)%(w+80)-45,y=horizon*(.08+(i%3)*.105),s=(.6+hash(i+10)*.6)*unit;
  const r=(xx,yy,ww,hh,col)=>{c.fillStyle=col;c.fillRect(Math.round(x+xx*s),Math.round(y+yy*s),Math.ceil(ww*s),Math.ceil(hh*s));};
  r(0,11,55,5,'#8a9cbe');r(7,6,13,9,'#a1b1cb');r(19,1,19,14,'#b4c1d7');r(15,5,29,11,'#b4c1d7');r(38,8,17,7,'#a8b8d1');r(24,0,11,4,'#c0cbe0');r(5,13,53,3,'#8194b6');r(25,7,7,6,'#9badcb');
 }
}
function treeImage(){
 if(treeCache.has('pine'))return treeCache.get('pine');
 const canvas=document.createElement('canvas');canvas.width=64;canvas.height=96;const c=canvas.getContext('2d');
 const poly=(points,col)=>{c.fillStyle=col;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();};
 c.fillStyle='#293c36';c.fillRect(28,73,9,21);c.fillStyle='#6e6950';c.fillRect(29,74,4,20);c.fillStyle='#8a7d59';c.fillRect(30,78,2,13);
 for(let layer=3;layer>=0;layer--){const yy=5+layer*17,spread=11+layer*6;
  poly([[32,yy],[37,yy+7],[35+spread*.3,yy+10],[32+spread*.65,yy+17],[31+spread,yy+24],[33+spread,yy+30],[39,yy+35],[26,yy+37],[30-spread,yy+31],[28-spread,yy+26],[32-spread*.65,yy+17],[27,yy+11]],'#263d35');
  poly([[32,yy+2],[35,yy+11],[31+spread*.55,yy+19],[30+spread*.8,yy+26],[35,yy+31],[26,yy+32],[31-spread*.8,yy+27],[34-spread*.5,yy+18],[29,yy+10]],layer%2?'#4a6c48':'#55764e');
  poly([[32,yy+4],[34,yy+13],[29,yy+22],[33-spread*.6,yy+25],[34-spread*.4,yy+17]],'#6f8a59');
  for(let i=0;i<7;i++){c.fillStyle=i%2?'#344f3b':'#758e5d';c.fillRect(24+Math.floor(hash(layer*15+i)*16),yy+12+i*2,2,2);}
 }
 treeCache.set('pine',canvas);return canvas;
}
export function drawTree(c,x,y,scale){const image=treeImage();c.fillStyle='#233b3545';c.fillRect(Math.round(x-21*scale),Math.round(y-3*scale),Math.ceil(44*scale),Math.ceil(5*scale));c.drawImage(image,Math.round(x-32*scale),Math.round(y-96*scale),Math.round(64*scale),Math.round(96*scale));}
// Periodic mountain ridges: harmonics are integers of the tile width, so panning by heading never shows a seam.
export function drawMountains(c,w,horizon,offset,far,near){
 const unit=w/480,period=w*1.7;
 const ridge=(seed,amp,base,color,speed)=>{
  c.fillStyle=color;c.beginPath();c.moveTo(0,horizon+2);
  for(let x=0;x<=w+8;x+=8){
   const u=(x+offset*speed)/period*Math.PI*2;
   const hgt=base+amp*(.5+.28*Math.sin(u+seed)+.17*Math.sin(u*3+seed*2.3)+.09*Math.sin(u*7+seed*.7));
   c.lineTo(x,horizon+2-hgt*unit);
  }
  c.lineTo(w,horizon+2);c.closePath();c.fill();
 };
 ridge(1.2,70,18,far,.35);ridge(4.1,48,10,near,.6);
}
export function drawSun(c,w,horizon,x,altitude,color,size){
 const y=horizon-altitude,r=size*w/480;
 c.save();c.beginPath();c.rect(0,0,w,horizon+2);c.clip();
 const glow=c.createRadialGradient(x,y,r*.4,x,y,r*4.2);glow.addColorStop(0,color+'aa');glow.addColorStop(1,color+'00');c.fillStyle=glow;c.fillRect(x-r*5,y-r*5,r*10,r*10);
 c.fillStyle=color;const step=Math.max(2,Math.round(w/240));
 for(let yy=-r;yy<=r;yy+=step){const half=Math.sqrt(Math.max(0,r*r-yy*yy));c.fillRect(Math.round(x-half),Math.round(y+yy),Math.ceil(half*2),step);}
 c.restore();
}
export function drawLamp(c,x,y,s,side,night){
 const pole=Math.max(1,Math.round(2.2*s));
 c.fillStyle='#233b3545';c.fillRect(Math.round(x-9*s),Math.round(y-2*s),Math.ceil(18*s),Math.ceil(3*s));
 c.fillStyle='#4b5568';c.fillRect(Math.round(x-pole/2),Math.round(y-62*s),pole,Math.ceil(62*s));
 c.fillRect(Math.round(x-(side>0?16:0)*s),Math.round(y-64*s),Math.ceil(16*s),Math.max(1,Math.round(2.2*s)));
 const hx=x-side*14*s;c.fillStyle=night>.25?'#fff0b0':'#c9ced6';c.fillRect(Math.round(hx-4*s),Math.round(y-63*s),Math.ceil(8*s),Math.ceil(3*s));
 if(night>.25){c.globalAlpha=night*.28;c.fillStyle='#ffe9a6';c.fillRect(Math.round(hx-14*s),Math.round(y-60*s),Math.ceil(28*s),Math.ceil(10*s));c.globalAlpha=1;}
}
const BOARDS=[['#ff638d','#fff3d6'],['#ffda65','#24315a'],['#8ae3be','#17302b'],['#669df4','#f7f5ec']];
export function drawBillboard(c,x,y,s,index){
 const [bg,fg]=BOARDS[index%BOARDS.length],W=74*s,H=34*s,top=y-82*s;
 c.fillStyle='#233b3545';c.fillRect(Math.round(x-W/2),Math.round(y-2*s),Math.ceil(W),Math.ceil(4*s));
 c.fillStyle='#3a4256';c.fillRect(Math.round(x-W*.3),Math.round(top+H),Math.max(1,Math.round(3*s)),Math.ceil(48*s));c.fillRect(Math.round(x+W*.3),Math.round(top+H),Math.max(1,Math.round(3*s)),Math.ceil(48*s));
 c.fillStyle='#1d2438';c.fillRect(Math.round(x-W/2-2*s),Math.round(top-2*s),Math.ceil(W+4*s),Math.ceil(H+4*s));
 c.fillStyle=bg;c.fillRect(Math.round(x-W/2),Math.round(top),Math.ceil(W),Math.ceil(H));
 c.fillStyle=fg;
 const bars=[[.1,.2,.55],[.1,.45,.35],[.1,.7,.45],[.72,.18,.16]];
 for(const [bx,by,bw] of bars)c.fillRect(Math.round(x-W/2+bx*W),Math.round(top+by*H),Math.ceil(bw*W*(bx>.5?.9:1)),Math.max(1,Math.ceil(H*.14)));
}
export function drawBush(c,x,y,s,tint){
 c.fillStyle='#233b3545';c.fillRect(Math.round(x-14*s),Math.round(y-2*s),Math.ceil(28*s),Math.ceil(4*s));
 const r=(xx,yy,ww,hh,col)=>{c.fillStyle=col;c.fillRect(Math.round(x+xx*s),Math.round(y+yy*s),Math.ceil(ww*s),Math.ceil(hh*s));};
 r(-13,-12,26,12,tint?'#2e6a3c':'#2a5f38');r(-9,-18,18,8,tint?'#3f8a4a':'#38794a');r(-4,-20,8,4,'#55a35a');r(-12,-6,24,3,'#214a2d');
}
