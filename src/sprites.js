// Original rear-view pixel sprites, drawn once to a transparent atlas and cached.
// Bodies use a 128 × 80 grid; every model has its own roofline and rear treatment.
const cache=new Map();
let atlasLoaded=false;
const atlasTiles=new Map(),atlasPaints=new Map(),turnTiles=new Map(),turnPaints=new Map();
const atlasRegions={fusca:[0,.15,.25,.34],brasilia:[.25,.15,.25,.34],gol:[.5,.15,.25,.34],palio:[.75,.15,.25,.34],moto:[0,.54,.2,.36],gt:[.215,.54,.29,.36],suv:[.515,.54,.245,.36],superbike:[.79,.54,.21,.36]};
const basePaints={fusca:'#f5c542',brasilia:'#6ed4a0',gol:'#669df4',palio:'#f08364',moto:'#ddd8cf',gt:'#e76368',suv:'#c2a177',superbike:'#af94ec'};
function rgbHsl(r,g,b){r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;let h=0,s=0;if(d){s=l>.5?d/(2-max-min):d/(max+min);h=(max===r?(g-b)/d+(g<b?6:0):max===g?(b-r)/d+2:(r-g)/d+4)/6;}return [h,s,l];}
function hslRgb(h,s,l){const f=n=>{const k=(n+h*12)%12,a=s*Math.min(l,1-l);return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1))));};return [f(0),f(8),f(4)];}
export function spritesReady(){return atlasLoaded&&turnTiles.size===16;}
export const steeringPose=steer=>Math.abs(steer)<.18?0:Math.abs(steer)<.7?1:2;
export function spriteDimensions(car){const tile=atlasTiles.get(car.id),factor=car.shape==='bike'?.6:car.shape==='sport'?1.12:1;return tile?{width:112*factor,height:112*factor*tile.height/tile.width}:{width:128,height:80};}
async function loadAtlas(url,regions,target){
 const image=new Image();image.decoding='async';await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('Sprite atlas unavailable'));image.src=url;});
 const source=document.createElement('canvas');source.width=image.width;source.height=image.height;const ctx=source.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,image.width,image.height).data;
 for(const [id,region] of Object.entries(regions)){
  const rx=Math.floor(region[0]*image.width),ry=Math.floor(region[1]*image.height),rw=Math.floor(region[2]*image.width),rh=Math.floor(region[3]*image.height);let minX=rx+rw,minY=ry+rh,maxX=rx,maxY=ry;
  for(let y=ry;y<ry+rh;y++)for(let x=rx;x<rx+rw;x++){if(pixels[(y*image.width+x)*4+3]>80){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}}
  if(maxX<=minX)continue;const canvas=document.createElement('canvas');canvas.width=maxX-minX+1;canvas.height=maxY-minY+1;canvas.getContext('2d').drawImage(image,minX,minY,canvas.width,canvas.height,0,0,canvas.width,canvas.height);target.set(id,canvas);
 }
}
// Cell gutters follow the authored sheet; each crop includes the complete body.
const turnRegions={};
for(const [ids,y0,y1,cuts] of [
 [['fusca','brasilia'],0,350,[0,312,627,932,1254]],
 [['gol','palio'],350,630,[0,315,628,932,1254]],
 [['moto','gt'],630,930,[0,295,580,927,1254]],
 [['suv','superbike'],930,1254,[0,318,660,930,1254]]
])for(let i=0;i<4;i++)turnRegions[`${ids[Math.floor(i/2)]}:${i%2+1}`]=[cuts[i]/1254,y0/1254,(cuts[i+1]-cuts[i])/1254,(y1-y0)/1254];
export async function loadSprites(url='./assets/vehicle-atlas-v1.png',turnUrl='./assets/vehicle-turns-v2.png'){
 await Promise.all([loadAtlas(url,atlasRegions,atlasTiles),loadAtlas(turnUrl,turnRegions,turnTiles)]);
 atlasLoaded=atlasTiles.size===8;return spritesReady();
}
function paintedTile(car,pose=0){
 const tiles=pose?turnTiles:atlasTiles,paints=pose?turnPaints:atlasPaints;
 const original=tiles.get(pose?`${car.id}:${pose}`:car.id);if(!original)return null;if(car.color===basePaints[car.id])return original;
 const key=`${car.id}:${car.color}:${pose}`;if(paints.has(key))return paints.get(key);
 const canvas=document.createElement('canvas');canvas.width=original.width;canvas.height=original.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(original,0,0);const data=ctx.getImageData(0,0,canvas.width,canvas.height),p=data.data;
 const target=rgbHsl(...[1,3,5].map(i=>parseInt(car.color.slice(i,i+2),16))),bases={fusca:.115,brasilia:.25,gol:.62,palio:.065,moto:.6,gt:0,suv:.14,superbike:.76},base=bases[car.id];
 for(let i=0;i<p.length;i+=4){if(p[i+3]<80)continue;const [h,s,l]=rgbHsl(p[i],p[i+1],p[i+2]),diff=Math.min(Math.abs(h-base),1-Math.abs(h-base));if(diff<.13&&s>.16&&l>.14&&l<.93){const rgb=hslRgb(target[0],target[1]*.85+.1,l);p[i]=rgb[0];p[i+1]=rgb[1];p[i+2]=rgb[2];}}
 ctx.putImageData(data,0,0);if(paints.size>80)paints.clear();paints.set(key,canvas);return canvas;
}
function shade(hex,factor){const v=hex.replace('#','');return '#'+[0,2,4].map(i=>Math.min(255,Math.max(0,Math.round(parseInt(v.slice(i,i+2),16)*factor))).toString(16).padStart(2,'0')).join('');}
function sprite(car,brake,turn){
 const key=`${car.id}:${car.color}:${brake}:${turn}`;if(cache.has(key))return cache.get(key);
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=80;const c=canvas.getContext('2d');
 const body=car.color||'#efce5e',dark=shade(body,.52),mid=shade(body,.78),light=shade(body,1.22);
 const rect=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
 const poly=(points,color)=>{c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();};
 const offset=turn*3;c.translate(offset,0);
 // Tires remain visible beneath the chassis, giving the vehicle weight on the road.
 if(car.shape==='bike'){
  rect(58,43,13,34,'#10182d');rect(61,51,7,25,'#273046');rect(60,75,9,3,'#070f23');
  poly([[49,37],[57,29],[70,29],[78,37],[74,60],[53,60]],body);rect(55,51,19,9,dark);
  poly([[47,31],[52,23],[76,23],[82,31],[76,45],[52,45]],'#28384f');
  rect(51,31,25,8,mid);rect(52,40,9,20,'#1a2539');rect(68,40,9,20,'#1a2539');
  rect(55,5,19,3,'#dee4e8');rect(51,8,27,13,car.id==='superbike'?body:'#eee5d1');rect(54,19,22,8,'#141f32');rect(54,20,22,3,'#7db3c5');
  if(car.id==='superbike'){poly([[43,32],[49,27],[53,45],[48,55],[40,53]],body);poly([[80,28],[87,32],[88,53],[79,56],[75,44]],mid);rect(45,29,38,3,light);}
  rect(54,58,20,5,brake?'#fff0ad':'#ff526f');rect(62,65,6,5,'#d9dccf');rect(76,61,5,12,'#a3aec1');rect(76,72,5,3,'#172137');
 }else{
  const suv=car.shape==='suv',sport=car.shape==='sport',bug=car.shape==='bug';
  const left=sport?8:suv?16:17,right=128-left,roofL=bug?43:suv?29:sport?43:35,roofR=128-roofL,roofY=suv?7:bug?10:sport?24:15;
  rect(left+2,51,15,25,'#101728');rect(right-17,51,15,25,'#101728');rect(left+4,73,12,3,'#050e20');rect(right-16,73,12,3,'#050e20');
  poly([[left,43],[left+8,32],[roofL,roofY+4],[roofL+5,roofY],[roofR-5,roofY],[roofR,roofY+4],[right-8,32],[right,43],[right,66],[right-5,71],[left+5,71],[left,66]],'#0c1630');
  poly([[left+2,44],[left+10,34],[roofL+1,roofY+5],[roofL+6,roofY+2],[roofR-6,roofY+2],[roofR-1,roofY+5],[right-10,34],[right-2,44],[right-2,63],[left+2,63]],body);
  poly([[left+2,46],[left+12,39],[left+15,59],[left+8,66],[left+2,62]],mid);
  poly([[right-2,46],[right-12,39],[right-15,59],[right-8,66],[right-2,62]],dark);
  poly([[roofL+4,roofY+7],[roofR-4,roofY+7],[right-21,35],[left+21,35]],'#172b45');
  poly([[roofL+7,roofY+9],[roofR-6,roofY+9],[right-23,31],[left+24,31]],'#497a99');
  poly([[roofL+8,roofY+9],[roofL+20,roofY+9],[left+34,30],[left+25,30]],'#8db7c5');
  rect(roofL+7,roofY+3,roofR-roofL-14,2,light);
  poly([[left+14,38],[right-14,38],[right-5,48],[left+5,48]],light);
  rect(left+3,48,right-left-6,15,body);rect(left+3,59,right-left-6,6,mid);
  rect(left+9,48,right-left-18,2,light);rect(left+3,64,right-left-6,4,'#152238');
  const tail=brake?'#ffdf8b':'#f94e68';rect(left+5,52,21,7,'#431e3a');rect(right-26,52,21,7,'#431e3a');rect(left+6,53,19,4,tail);rect(right-25,53,19,4,tail);
  rect(55,58,18,7,'#e6d8ad');rect(58,60,12,2,'#7b867c');
  rect(left+8,68,16,3,'#92a9b8');rect(right-24,68,16,3,'#92a9b8');rect(left+17,70,7,4,'#1b273e');rect(right-25,70,7,4,'#1b273e');
  // Model-specific details make cars identifiable even with the same paint.
  if(bug){
   poly([[35,34],[39,22],[44,15],[52,11],[76,11],[84,15],[89,22],[93,34],[89,47],[39,47]],body);
   poly([[43,28],[46,20],[53,17],[75,17],[82,20],[85,28],[82,33],[46,33]],'#1a354d');
   poly([[46,26],[49,21],[55,19],[74,19],[79,21],[82,27],[79,30],[49,30]],'#6b9dad');poly([[49,22],[55,19],[65,19],[55,30],[48,30]],'#b8d4d1');
   poly([[38,38],[45,34],[83,34],[90,38],[87,54],[41,54]],light);poly([[43,40],[85,40],[88,53],[40,53]],body);
   for(let i=0;i<6;i++)rect(47+i*6,43,3,6,dark);
   poly([[21,43],[26,39],[34,40],[39,48],[38,62],[22,62]],mid);poly([[107,43],[102,39],[94,40],[89,48],[90,62],[106,62]],dark);
   rect(24,49,9,3,'#ffba8c');rect(22,52,13,8,tail);rect(95,49,9,3,'#ffba8c');rect(93,52,13,8,tail);rect(25,54,6,3,brake?'#fff8c5':'#ff8c81');rect(96,54,6,3,brake?'#fff8c5':'#ff8c81');
   rect(16,65,96,4,'#bfd0d0');rect(25,65,78,1,'#f6e8d2');
  }
  if(car.id==='brasilia'){rect(37,19,54,16,'#1d3750');rect(39,20,50,3,'#91b8c4');rect(63,20,2,14,mid);rect(36,37,56,4,light);rect(28,54,23,4,tail);rect(77,54,23,4,tail);rect(31,63,66,2,'#d0dad6');}
  if(car.id==='gol'){rect(37,34,54,4,dark);rect(61,25,3,8,'#adc5c7');rect(59,51,10,3,'#233750');rect(27,53,14,6,tail);rect(87,53,14,6,tail);rect(44,65,40,2,'#32465b');}
  if(car.id==='palio'){poly([[39,36],[44,31],[84,31],[89,36],[86,40],[42,40]],mid);rect(29,49,9,12,tail);rect(90,49,9,12,tail);rect(32,49,3,5,'#ffc792');rect(93,49,3,5,'#ffc792');rect(57,47,14,2,dark);}
  if(sport){rect(12,38,104,4,'#16233e');rect(11,36,106,3,light);rect(22,39,5,10,dark);rect(101,39,5,10,dark);rect(17,52,29,3,tail);rect(82,52,29,3,tail);rect(51,51,26,2,dark);rect(29,66,14,5,'#0a142a');rect(85,66,14,5,'#0a142a');rect(32,67,8,2,'#a8b7c1');rect(88,67,8,2,'#a8b7c1');rect(58,17,12,19,'#e1ded2');}
  if(suv){rect(32,14,64,20,'#1a3044');rect(35,16,58,4,'#85adbb');rect(62,15,3,19,mid);rect(24,9,80,3,light);rect(24,5,6,8,'#2e3a47');rect(98,5,6,8,'#2e3a47');rect(25,6,77,2,'#85969d');rect(54,40,24,28,'#15243a');rect(49,44,34,20,'#15243a');rect(55,43,22,22,'#384452');rect(60,47,12,14,'#94a4a4');rect(63,51,6,6,'#52626e');rect(24,49,8,13,tail);rect(96,49,8,13,tail);}
  rect(left-3,37,7,5,mid);rect(right-4,37,7,5,dark);
 }
 if(cache.size>150)cache.clear();cache.set(key,canvas);return canvas;
}
// Pick authored poses. Never shear, rotate or slice the rear image to fake yaw.
export function drawCar(ctx,x,y,scale,car,brake=false,steer=0){
 const pose=steeringPose(steer),tile=atlasLoaded?paintedTile(car,pose):null;
 const image=tile||sprite(car,brake,0),turn=!!tile&&pose>0;
 const dimensions=atlasLoaded?spriteDimensions(car):{width:128,height:80};
 const height=dimensions.height*scale*(turn?.96:1);
 const width=height*image.width/image.height;
 ctx.save();ctx.translate(Math.round(x),Math.round(y));
 if(turn&&steer<0)ctx.scale(-1,1);
 const left=-width*(turn?.4:.5);
 ctx.drawImage(image,Math.round(left),Math.round(-height),Math.round(width),Math.round(height));
 if(tile&&brake){
  ctx.globalAlpha=.72;ctx.fillStyle='#ff5445';
  const lamps=turn?[.1,.58]:[.12,.72];
  for(const lamp of lamps)ctx.fillRect(left+width*lamp,-height*.24,width*.13,Math.max(2,height*.045));
 }
 ctx.restore();
}
