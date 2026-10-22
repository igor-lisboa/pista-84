import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {signaling,memoryStore,d1Store} from '../src/signaling.js';
const req=(path,method='GET',token,body)=>new Request(`http://localhost/api/rooms${path}`,{method,headers:{origin:'http://localhost',...(token?{authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
function sqliteStore(){const db=new DatabaseSync(':memory:');return {db,adapter:{prepare(sql){return {bind(...args){const stmt=db.prepare(sql);return {async run(){const r=stmt.run(...args);return {meta:{changes:r.changes}};},async first(){return stmt.get(...args);}};}};}}};}
for(const mode of ['memory','d1'])test(`${mode}: room auth, atomic answer, expiry and deletion`,async()=>{let store,db;if(mode==='memory')store=memoryStore();else{const sqlite=sqliteStore();db=sqlite.db;db.exec(await readFile(new URL('../drizzle/0000_furry_marvex.sql',import.meta.url),'utf8'));store=d1Store(sqlite.adapter);}
 if(db)db.exec(await readFile(new URL('../drizzle/0002_steep_roulette.sql',import.meta.url),'utf8'));
 const create=await signaling(req('','POST',null,{offer:'{"type":"offer"}'}),store);assert.equal(create.status,201);const room=await create.json();assert.equal(room.id.length,48);const path=`/${room.id}`;
 assert.equal((await signaling(req(path,'GET','wrong'),store)).status,403);
 const offer=await (await signaling(req(path,'GET',room.joinToken),store)).json();assert.equal(offer.offer,'{"type":"offer"}');assert.equal(offer.hostToken,undefined);
 assert.equal((await signaling(req(path,'POST',room.hostToken,{answer:'x'}),store)).status,403);
 assert.equal((await signaling(req(path,'POST',room.joinToken,{answer:'answer'}),store)).status,200);
 assert.equal((await signaling(req(path,'POST',room.joinToken,{answer:'replace'}),store)).status,409);
 assert.equal((await (await signaling(req(path,'GET',room.hostToken),store)).json()).answer,'answer');
 assert.equal((await signaling(req(path+'/input','POST',room.hostToken,{input:{steer:1}}),store)).status,403);
 assert.equal((await signaling(req(path+'/input','POST',room.joinToken,{input:{steer:99,accelerate:true,start:true}}),store)).status,200);
 const state=await (await signaling(req(path,'GET',room.hostToken),store)).json();assert.equal(state.input.steer,1);assert.equal(state.input.start,true);assert.equal(state.input.brake,false);assert.ok(state.inputTime>0);
 assert.equal((await signaling(req(path,'DELETE',room.joinToken),store)).status,403);
 assert.equal((await signaling(req(path,'DELETE',room.hostToken),store)).status,200);assert.equal((await signaling(req(path,'GET',room.hostToken),store)).status,410);
 await store.create({id:'a'.repeat(48),hostToken:'h',joinToken:'j',offer:'x',expires:Date.now()-1});assert.equal((await signaling(req('/'+'a'.repeat(48),'GET','h'),store)).status,410);db?.close();
});
test('signaling rejects cross-origin, oversized and invalid JSON requests',async()=>{const s=memoryStore();assert.equal((await signaling(new Request('http://localhost/api/rooms',{method:'POST',headers:{origin:'http://evil.test'},body:'{}'}),s)).status,403);assert.equal((await signaling(new Request('http://localhost/api/rooms',{method:'POST',body:'bad json'}),s)).status,400);assert.equal((await signaling(req('','POST',null,{offer:'x'.repeat(25000)}),s)).status,413);assert.equal((await signaling(req('','POST',null,{offer:4}),s)).status,400);});
