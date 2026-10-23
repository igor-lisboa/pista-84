import {loadSave} from './engine.js';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
export async function cloudProgress(request,db,config={coins:null}){
 const user=request.headers.get('oai-authenticated-user-id');if(!user)return json({error:'Entre com sua conta para usar o backup em nuvem.'},401);
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Origem inválida.'},403);
 if(request.method==='GET'){const row=await db.prepare('SELECT data, revision, updated FROM player_progress WHERE user_id = ?').bind(user).first();return json(row?{save:loadSave({getItem:()=>row.data},config),revision:row.revision,updated:row.updated}:{save:null,revision:0});}
 if(request.method!=='PUT')return json({error:'Método inválido.'},405);
 try{const text=await request.text();if(text.length>16000)return json({error:'Arquivo muito grande.'},413);const body=JSON.parse(text);if(!Number.isInteger(body.revision)||body.revision<0||!body.save||!Array.isArray(body.save.owned)||!Number.isFinite(body.save.coins))return json({error:'Progresso inválido.'},400);
  const save=loadSave({getItem:()=>JSON.stringify(body.save)}),updated=Date.now();
  const result=body.revision===0
   ?await db.prepare('INSERT OR IGNORE INTO player_progress (user_id, data, revision, updated) VALUES (?, ?, 1, ?)').bind(user,JSON.stringify(save),updated).run()
   :await db.prepare('UPDATE player_progress SET data = ?, revision = revision + 1, updated = ? WHERE user_id = ? AND revision = ?').bind(JSON.stringify(save),updated,user,body.revision).run();
  if(result.meta.changes!==1)return json({error:'O backup mudou em outro aparelho. Carregue a versão atual antes de salvar.'},409);
  return json({revision:body.revision+1,updated});
 }catch(error){if(error instanceof SyntaxError)return json({error:'JSON inválido.'},400);throw error;}
}
