const ICE={iceServers:[{urls:'stun:stun.cloudflare.com:3478'}]};
const waitIce=pc=>new Promise(resolve=>{if(pc.iceGatheringState==='complete')return resolve();const timer=setTimeout(done,3500);function done(){clearTimeout(timer);pc.removeEventListener('icegatheringstatechange',change);resolve();}function change(){if(pc.iceGatheringState==='complete')done();}pc.addEventListener('icegatheringstatechange',change);});
async function api(path,token,method='GET',body){
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),8000);
 try{const res=await fetch(`/api/rooms${path}`,{method,signal:abort.signal,cache:'no-store',credentials:'same-origin',headers:{...(token?{authorization:`Bearer ${token}`}:{ }),'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 if(!res.headers.get('content-type')?.includes('application/json'))throw Error('Entre com sua conta neste navegador e abra novamente o link do controle.');
 const data=await res.json();if(!res.ok)throw Error(data.error||'Não foi possível parear.');return data;
 }finally{clearTimeout(timer);}
}
export class RemoteConnection {
 constructor({onStatus=()=>{},onInput=()=>{},forceRelay=false}={}){
  this.onStatus=onStatus;this.onInput=onInput;this.closed=false;this.state='waiting';
  this.forceRelay=forceRelay||new URLSearchParams(location.search).get('transport')==='relay'||(/Safari/.test(navigator.userAgent)&&!/Chrome|Chromium|Edg/.test(navigator.userAgent));
  if(!this.forceRelay&&window.RTCPeerConnection)try{this.pc=new RTCPeerConnection(ICE);}catch{}
 }
 status(state,detail){if(this.closed||this.state===state)return;this.state=state;this.onStatus(state,detail);}
 attach(channel){this.channel=channel;channel.onopen=()=>this.status('connected','Conexão direta');channel.onclose=()=>{if(!this.closed)this.status('connected','Conexão de compatibilidade');};channel.onmessage=e=>{try{const m=JSON.parse(e.data);if(m.type==='input')this.onInput(this.clean(m.input));}catch{}};}
 clean(i={}){return {steer:Number.isFinite(i.steer)?Math.max(-1,Math.min(1,i.steer)):0,accelerate:i.accelerate===true,brake:i.brake===true,start:i.start===true,pause:i.pause===true};}
 async host(){
  let offer='{"type":"relay"}';
  if(this.pc){try{this.attach(this.pc.createDataChannel('pista84',{ordered:false,maxRetransmits:0}));await this.pc.setLocalDescription(await this.pc.createOffer());await waitIce(this.pc);offer=JSON.stringify(this.pc.localDescription);}catch{this.pc?.close();this.pc=null;}}
  if(this.closed)throw Error('Pareamento cancelado.');this.room=await api('',null,'POST',{offer});
  this.pollHost();return this.room;
 }
 async pollHost(){
  if(this.closed)return;
  try{const room=await api(`/${this.room.id}`,this.room.hostToken);if(this.closed)return;
   if(room.answer&&!this.answered){this.answered=true;const answer=JSON.parse(room.answer);if(answer.type!=='relay'&&this.pc)try{await this.pc.setRemoteDescription(answer);}catch{};}
   if(room.inputTime&&room.inputTime!==this.lastInputTime){this.lastInputTime=room.inputTime;this.lastInput=performance.now();this.status('connected',this.channel?.readyState==='open'?'Conexão direta':'Conexão de compatibilidade');if(this.channel?.readyState!=='open')this.onInput(this.clean(room.input));}
   if(this.lastInput&&performance.now()-this.lastInput>1800&&this.channel?.readyState!=='open'){this.status('disconnected');this.onInput({});}
  }catch(e){if(!this.closed)this.status('error',e.message);}
  if(!this.closed)this.timer=setTimeout(()=>this.pollHost(),this.answered?110:450);
 }
 async join(id,token){
  const room=await api(`/${id}`,token);if(room.answered)throw Error('Este QR já foi usado. Gere um novo na tela principal.');
  let answer='{"type":"relay"}';const offer=JSON.parse(room.offer);
  if(offer.type!=='relay'&&this.pc){try{this.pc.ondatachannel=e=>this.attach(e.channel);await this.pc.setRemoteDescription(offer);await this.pc.setLocalDescription(await this.pc.createAnswer());await waitIce(this.pc);answer=JSON.stringify(this.pc.localDescription);}catch{this.pc?.close();this.pc=null;}}
  if(this.closed)return;await api(`/${id}`,token,'POST',{answer});this.joined={id,token};
  // An acknowledged input proves the HTTPS compatibility path works before showing connected.
  await api(`/${id}/input`,token,'POST',{input:{steer:0,accelerate:false,brake:false}});this.status('connected','Conexão de compatibilidade');
 }
 send(input){
  if(this.closed||!this.joined)return;const clean=this.clean(input);
  if(this.channel?.readyState==='open'){try{this.channel.send(JSON.stringify({type:'input',input:clean}));}catch{}}
  // Keep a low-rate HTTPS heartbeat even on WebRTC; upgrade failures never strand Safari.
  const interval=this.channel?.readyState==='open'?500:100;
  if(this.sending||performance.now()-(this.lastSend||0)<interval)return;this.sending=true;this.lastSend=performance.now();
  api(`/${this.joined.id}/input`,this.joined.token,'POST',{input:clean}).then(()=>this.status('connected')).catch(e=>this.status('error',e.message)).finally(()=>this.sending=false);
 }
 async close(){if(this.closed)return;this.closed=true;clearTimeout(this.timer);this.channel?.close();this.pc?.close();if(this.room)try{await api(`/${this.room.id}`,this.room.hostToken,'DELETE');}catch{}}
}
