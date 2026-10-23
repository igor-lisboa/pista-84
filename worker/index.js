import {publicConfig} from '../src/config.js';
import {signaling,d1Store} from '../src/signaling.js';
import {assets} from './generated-assets.js';
import {cloudProgress} from '../src/cloud.js';
export default {async fetch(request,env){
 const url=new URL(request.url);
 const config=publicConfig(env,typeof __PISTA_CONFIG__==='undefined'?{coins:null}:__PISTA_CONFIG__);
 if(url.pathname==='/src/runtime-config.js')return new Response(`export default ${JSON.stringify(config)};`,{headers:{'content-type':'text/javascript; charset=utf-8','cache-control':'no-store'}});
 if(url.pathname.startsWith('/api/rooms'))return signaling(request,d1Store(env.DB));
 if(url.pathname==='/api/progress')return cloudProgress(request,env.DB,config);
 if(url.pathname==='/health')return Response.json({ok:true,transport:'webrtc',cloudBackup:true});
 const file=assets[url.pathname==='/'?'/index.html':url.pathname];
 if(!file)return new Response('Não encontrado',{status:404});
 const body=file.binary?Uint8Array.from(atob(file.body),c=>c.charCodeAt(0)):file.body;
 return new Response(body,{headers:{'content-type':file.type,'x-content-type-options':'nosniff','cache-control':url.pathname==='/sw.js'?'no-cache':'private, max-age=0, must-revalidate'}});
}};
