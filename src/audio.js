export const AUDIO_PROFILES={
 fusca:{base:39,ratio:.65,wave:'sawtooth',filter:480,brake:650},
 brasilia:{base:46,ratio:.62,wave:'triangle',filter:650,brake:850},
 gol:{base:54,ratio:.8,wave:'sawtooth',filter:720,brake:1100},
 palio:{base:50,ratio:.76,wave:'triangle',filter:800,brake:1000},
 moto:{base:95,ratio:1.4,wave:'square',filter:1100,brake:1500},
 gt:{base:27,ratio:1.1,wave:'sawtooth',filter:1300,brake:2200},
 suv:{base:22,ratio:.5,wave:'sawtooth',filter:320,brake:520},
 superbike:{base:125,ratio:1.8,wave:'square',filter:1800,brake:2500}
};
export class AudioEngine {
 constructor(){this.enabled=false;this.step=0;this.next=0;}
 async toggle(){
  if(!window.AudioContext&&!window.webkitAudioContext)throw Error('Áudio indisponível neste navegador.');
  if(!this.ctx){
   this.ctx=new (window.AudioContext||window.webkitAudioContext)();this.master=this.ctx.createGain();this.master.connect(this.ctx.destination);
   this.engine=this.ctx.createOscillator();this.gain=this.ctx.createGain();this.gain.gain.value=0;
   this.filter=this.ctx.createBiquadFilter();this.filter.type='lowpass';this.engine.connect(this.filter);this.filter.connect(this.gain);this.gain.connect(this.master);this.engine.start();
   const buffer=this.ctx.createBuffer(1,this.ctx.sampleRate,this.ctx.sampleRate),data=buffer.getChannelData(0);
   for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
   this.noise=this.ctx.createBufferSource();this.noise.buffer=buffer;this.noise.loop=true;
   this.brakeFilter=this.ctx.createBiquadFilter();this.brakeFilter.type='bandpass';this.brakeFilter.Q.value=2;
   this.brakeGain=this.ctx.createGain();this.brakeGain.gain.value=0;this.noise.connect(this.brakeFilter);this.brakeFilter.connect(this.brakeGain);this.brakeGain.connect(this.master);this.noise.start();
  }
  await this.ctx.resume();this.enabled=!this.enabled;this.master.gain.value=this.enabled?.11:0;return this.enabled;
 }
 tone(f,d=.13,type='square',volume=.12){if(!this.enabled)return;const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.value=f;g.gain.setValueAtTime(volume,this.ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,this.ctx.currentTime+d);o.connect(g);g.connect(this.master);o.start();o.stop(this.ctx.currentTime+d);o.onended=()=>{o.disconnect();g.disconnect();};}
 update(race,brake){
  if(!this.enabled)return;const active=race.status==='running',p=AUDIO_PROFILES[race.car.id]||AUDIO_PROFILES.fusca;
  this.gain.gain.setTargetAtTime(active?.2:0,this.ctx.currentTime,.08);this.engine.type=p.wave;
  this.engine.frequency.setTargetAtTime(p.base+race.speed*p.ratio,this.ctx.currentTime,.08);this.filter.frequency.value=p.filter+race.speed*2;
  this.brakeFilter.frequency.value=p.brake+race.speed*1.5;this.brakeGain.gain.setTargetAtTime(active&&brake&&race.speed>15?.14:0,this.ctx.currentTime,.04);
  if(active&&this.ctx.currentTime>this.next){const notes=[110,164.81,220,164.81,130.81,196,261.63,196];this.tone(notes[this.step%8],.16,'triangle',.3);if(this.step%2===0)this.tone(55,.12,'sine',.5);if(this.step%4===2)this.tone(880,.035,'square',.035);if(race.time>50)this.tone(notes[(this.step+2)%8]*2,.08,'square',.04);this.step++;this.next=this.ctx.currentTime+Math.max(.12,.26-race.time/1800);}
 }
}
