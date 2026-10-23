import {runtimeConfig} from './scripts/env.mjs';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {networkInterfaces} from 'node:os';
import {randomBytes} from 'node:crypto';
import {WebSocketServer,WebSocket} from 'ws';
import QRCode from 'qrcode';
import {signaling,memoryStore} from './src/signaling.js';
const roomStore=memoryStore();
const root=resolve('www'),port=Number(process.env.PORT)||4173;
const hostIP=Object.values(networkInterfaces()).flat().find(i=>i.family==='IPv4'&&!i.internal)?.address;
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,process.env.PUBLIC_ORIGIN||`http://${req.headers.host}`);if(url.pathname.startsWith('/api/rooms')){let body='';for await(const chunk of req){body+=chunk;if(body.length>24000){res.writeHead(413);res.end();return;}}const request=new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body}: {})});const response=await signaling(request,roomStore);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;}if(url.pathname==='/src/runtime-config.js'){res.writeHead(200,{'content-type':'text/javascript; charset=utf-8','cache-control':'no-store'});res.end(`export default ${JSON.stringify(runtimeConfig)};`);return;}if(url.pathname==='/network'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({host:hostIP}));return;}if(url.pathname==='/health'){res.writeHead(200,{'content-type':'application/json'});res.end('{"ok":true}');return;}if(url.pathname==='/qr'){const text=url.searchParams.get('text')||'';if(text.length>2048){res.writeHead(400);res.end();return;}const image=await QRCode.toBuffer(text,{width:300,margin:2,color:{dark:'#152824',light:'#f2eedf'}});res.writeHead(200,{'content-type':'image/png','cache-control':'no-store'});res.end(image);return;}const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}const data=await readFile(path);res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream','x-content-type-options':'nosniff'});res.end(data);}catch{res.writeHead(404);res.end('Não encontrado');}});
const wss=new WebSocketServer({server,path:'/relay',maxPayload:1024});const rooms=new Map();
const send=(ws,m)=>{if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(m));};
wss.on('connection',(ws,req)=>{const origin=req.headers.origin;try{if(origin&&new URL(origin).host!==req.headers.host){ws.close(1008,'Origin rejected');return;}}catch{ws.close(1008);return;}let roomId,role,last=0;
 ws.on('message',raw=>{try{const m=JSON.parse(raw.toString());if(m.type==='host'&&!role){roomId=randomBytes(4).toString('hex').toUpperCase();const token=randomBytes(18).toString('hex');rooms.set(roomId,{host:ws,token,controller:null,created:Date.now()});role='host';send(ws,{type:'room',room:roomId,token,host:hostIP});}
 else if(m.type==='join'&&!role){const room=rooms.get(m.room);if(!room||room.token!==m.token||room.controller||Date.now()-room.created>3600000){send(ws,{type:'error',message:'Sala expirada, ocupada ou código inválido.'});ws.close();return;}role='controller';roomId=m.room;room.controller=ws;send(ws,{type:'connected'});send(room.host,{type:'connected'});}
 else if(m.type==='input'&&role==='controller'){const now=Date.now();if(now-last<25)return;last=now;const room=rooms.get(roomId);if(!room)return;const i=m.input||{};send(room.host,{type:'input',input:{steer:typeof i.steer==='number'&&Number.isFinite(i.steer)?Math.max(-1,Math.min(1,i.steer)):0,accelerate:i.accelerate===true,brake:i.brake===true}});}}catch{ws.close(1008,'Invalid message');}});
 ws.on('close',()=>{const room=rooms.get(roomId);if(!room)return;if(role==='host'){send(room.controller,{type:'disconnected'});room.controller?.close();rooms.delete(roomId);}else{room.controller=null;send(room.host,{type:'disconnected'});}});
 ws.on('error',()=>{});
});
server.listen(port,'0.0.0.0',()=>{console.log(`PISTA 84 · Local: http://localhost:${port}`);if(hostIP)console.log(`Celular na mesma rede: http://${hostIP}:${port}`);});
