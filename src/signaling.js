// Shared by the Node preview and the Cloudflare Worker. No gameplay data is stored.
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(24)),v=>v.toString(16).padStart(2,'0')).join('');
const fail=(message,status)=>json({error:message},status);
export async function signaling(request,store){
 const url=new URL(request.url),match=url.pathname.match(/^\/api\/rooms(?:\/([a-f0-9]{48}))?(\/input)?$/);
 if(!match)return fail('Rota inválida.',404);
 const origin=request.headers.get('origin');if(origin&&origin!==url.origin)return fail('Origem inválida.',403);
 if(!['GET','POST','DELETE'].includes(request.method))return fail('Método inválido.',405);
 try{
  if(request.method==='POST'&&!match[1]){
   const body=await request.text();if(body.length>24000)return fail('Oferta muito grande.',413);
   const {offer}=JSON.parse(body);if(typeof offer!=='string'||offer.length>20000)return fail('Oferta inválida.',400);
   const id=token(),hostToken=token(),joinToken=token(),expires=Date.now()+10*60*1000;
   await store.create({id,hostToken,joinToken,offer,answer:null,expires});return json({id,hostToken,joinToken,expires},201);
  }
  const id=match[1];if(!id)return fail('Sala não encontrada.',404);
  const authorization=request.headers.get('authorization')?.replace(/^Bearer /,'');
  const room=await store.get(id);if(!room||room.expires<Date.now())return fail('Sala expirada. Gere um novo QR Code.',410);
  const host=authorization===room.hostToken,controller=authorization===room.joinToken;if(!host&&!controller)return fail('Código inválido.',403);
  if(match[2]){
   if(request.method!=='POST'||host||!room.answer)return fail('Controle não autorizado.',403);
   const body=await request.text();if(body.length>1000)return fail('Comando muito grande.',413);
   const data=JSON.parse(body),i=data.input||{},now=Date.now();
   if(room.inputTime&&now-room.inputTime<70)return json({ok:true,throttled:true});
   const input={steer:typeof i.steer==='number'&&Number.isFinite(i.steer)?Math.max(-1,Math.min(1,i.steer)):0,accelerate:i.accelerate===true,brake:i.brake===true,start:i.start===true,pause:i.pause===true};
   await store.input(id,input,now);return json({ok:true});
  }
  if(request.method==='GET')return json(host?{answer:room.answer,expires:room.expires,input:room.input?JSON.parse(room.input):null,inputTime:room.inputTime||0}:{offer:room.offer,answered:!!room.answer,expires:room.expires});
  if(request.method==='DELETE'){if(!host)return fail('Apenas a tela principal pode encerrar a sala.',403);await store.remove(id);return json({ok:true});}
  if(host)return fail('A tela principal não pode responder à própria oferta.',403);
  const body=await request.text();if(body.length>24000)return fail('Resposta muito grande.',413);
  const {answer}=JSON.parse(body);if(typeof answer!=='string'||answer.length>20000)return fail('Resposta inválida.',400);
  const ok=await store.answer(id,answer);return ok?json({ok:true}):fail('Sala já ocupada. Gere um novo QR Code.',409);
 }catch(error){if(error instanceof SyntaxError)return fail('JSON inválido.',400);console.error('signaling failure',error.name);return fail('Serviço temporariamente indisponível.',503);}
}
export function d1Store(db){return {
 async create(r){await db.prepare('DELETE FROM control_rooms WHERE expires < ?').bind(Date.now()).run();await db.prepare('INSERT INTO control_rooms (id, host_token, join_token, offer, expires) VALUES (?, ?, ?, ?, ?)').bind(r.id,r.hostToken,r.joinToken,r.offer,r.expires).run();},
 async get(id){const r=await db.prepare('SELECT * FROM control_rooms WHERE id = ?').bind(id).first();return r&&{id:r.id,hostToken:r.host_token,joinToken:r.join_token,offer:r.offer,answer:r.answer,expires:r.expires,input:r.input,inputTime:r.input_time};},
 async answer(id,answer){const r=await db.prepare('UPDATE control_rooms SET answer = ? WHERE id = ? AND answer IS NULL').bind(answer,id).run();return r.meta.changes===1;},
 async remove(id){await db.prepare('DELETE FROM control_rooms WHERE id = ?').bind(id).run();}
 ,async input(id,input,time){await db.prepare('UPDATE control_rooms SET input = ?, input_time = ? WHERE id = ?').bind(JSON.stringify(input),time,id).run();}
};}
export function memoryStore(){const rooms=new Map();return {
 async create(r){for(const [id,room] of rooms)if(room.expires<Date.now())rooms.delete(id);if(rooms.size>=500)throw Error('Capacity');rooms.set(r.id,r);},
 async get(id){return rooms.get(id);},async answer(id,answer){const r=rooms.get(id);if(!r||r.answer)return false;r.answer=answer;return true;},async remove(id){rooms.delete(id);},async input(id,input,time){const r=rooms.get(id);if(r){r.input=JSON.stringify(input);r.inputTime=time;}}
};}
