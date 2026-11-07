/* Browser-local sherpa-onnx keyword spotting. Audio stays on this device. */
(function(root){
'use strict';
const BASE=new URL('kws/',document.currentScript.src),KEYWORD='开始计时';
class VoiceControl{
 constructor({onCommand,onStatus,blocked,onFailure,onProgress=()=>{}}){
  Object.assign(this,{onCommand,onStatus,blocked,onFailure,onProgress});
  this.active=false;this.loading=false;this.generation=0;this.epoch=0;this.status='声控未开启';this.lastAt=-Infinity;this.pending=new Map();this.nextId=0;this.queuedSeconds=0;this.wasBlocked=false;
 }
 notify(text){if(this.status!==text){this.status=text;this.onStatus(text);}}
 async enable({file=false}={}){
  if(this.active||this.loading)return;
  const generation=++this.generation;this.loading=true;this.fileMode=file;
  this.notify(file?'正在加载文件测试…':'正在开启麦克风…');
  try{
   if(!root.AudioContext||!root.Worker||!root.WebAssembly)throw Error('此浏览器暂不支持声控，可使用屏幕按钮');
   if(!file){
    if(!isSecureContext||!navigator.mediaDevices?.getUserMedia)throw Error('请使用 HTTPS 页面开启麦克风');
    this.ctx=new AudioContext();
    const stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
    if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}
    this.stream=stream;
    if(this.ctx.state!=='running'){this.notify('请点一下页面，允许浏览器启用声音');await this.ctx.resume();}
    if(generation!==this.generation)return;
    if(!this.ctx.audioWorklet)throw Error('此浏览器不支持声控录音，可使用屏幕按钮');
    await this.ctx.audioWorklet.addModule(new URL('capture.js',BASE));
    if(generation!==this.generation)return;
   }
   const worker=new Worker(new URL('worker.js',BASE),{type:'module'});this.worker=worker;
   await new Promise((resolve,reject)=>{
    this.initReject=reject;this.initTimer=setTimeout(()=>reject(Error('语音包加载超时，请重试')),180000);
    worker.onerror=()=>{if(generation===this.generation)this.fail('声控组件加载失败，请重试');};
    worker.onmessage=({data:m})=>{
     if(generation!==this.generation)return;
     if(m.type==='progress'){
      this.onProgress(m);this.notify('下载语音包 '+Math.floor(m.loaded/m.total*100)+'% · '+(m.loaded/1e6).toFixed(1)+' / '+(m.total/1e6).toFixed(1)+' MB');
     }else if(m.type==='initializing'){this.onProgress(null);this.notify('下载完成，正在准备声控…');}
     else if(m.type==='ready'){clearTimeout(this.initTimer);this.initReject=null;resolve();}
     else if(m.type==='error'){if(this.loading)reject(Error(m.message));else this.fail(m.message);}
     else if(m.type==='result'){
      const pending=this.pending.get(m.id);this.pending.delete(m.id);this.queuedSeconds=Math.max(0,this.queuedSeconds-(pending?.seconds||0));pending?.resolve(m);
      if(m.epoch!==this.epoch||!this.active||this.blocked())return;
      for(const hit of m.hits){if(hit.label===KEYWORD&&performance.now()-this.lastAt>=1200){this.lastAt=performance.now();this.onCommand('开始',{keyword:KEYWORD,...hit});}}
     }
    };
    worker.postMessage({type:'init'});
   });
   if(generation!==this.generation)return;
   this.active=true;this.loading=false;this.onProgress(null);this.reset();
   if(!file){
    this.source=this.ctx.createMediaStreamSource(this.stream);this.processor=new AudioWorkletNode(this.ctx,'recovery-capture');
    this.processor.port.onmessage=({data})=>{void this.feed(data.samples,data.rate);};
    this.source.connect(this.processor);this.processor.connect(this.ctx.destination);
    this.stream.getAudioTracks()[0].onended=()=>{if(this.active)this.fail('麦克风已断开，请重试声控');};
    this.ctx.onstatechange=()=>{if(this.active&&this.ctx?.state!=='running')this.notify('请点一下页面恢复声控');};
   }
   this.notify('正在聆听：'+KEYWORD);this.onStatus(this.status);
  }catch(e){
   if(generation!==this.generation)return;
   const messages={NotAllowedError:'未取得麦克风权限，可重试或使用屏幕按钮',NotFoundError:'未找到麦克风，可使用屏幕按钮',NotReadableError:'麦克风正被占用，请关闭其他录音后重试'};
   this.fail(messages[e.name]||e.message||'声控开启失败');
  }
 }
 reset(){this.epoch++;this.worker?.postMessage({type:'reset',epoch:this.epoch});}
 feed(samples,rate){
  if(!this.active)return Promise.resolve(null);
  if(this.blocked()){
   if(!this.wasBlocked)this.reset();this.wasBlocked=true;this.notify('播报或页面操作结束后聆听');return Promise.resolve(null);
  }
  // No post-prompt dead zone: the first sound after the prompt is retained.
  this.wasBlocked=false;this.notify('正在聆听：'+KEYWORD);
  if(!this.fileMode&&this.queuedSeconds>6){this.fail('声控处理跟不上录音，请重试或使用屏幕按钮');return Promise.resolve(null);}
  const copy=new Float32Array(samples),id=++this.nextId,seconds=copy.length/rate;
  for(let i=0;i<copy.length;i++)copy[i]=Number.isFinite(copy[i])?Math.max(-1,Math.min(1,copy[i])):0;
  this.queuedSeconds+=seconds;
  return new Promise(resolve=>{this.pending.set(id,{resolve,seconds});this.worker.postMessage({type:'audio',samples:copy,rate,epoch:this.epoch,id},[copy.buffer]);});
 }
 resumeAudio(){if(this.ctx?.state==='suspended')void this.ctx.resume().then(()=>{if(this.active)this.notify('正在聆听：'+KEYWORD);}).catch(()=>{});}
 interrupt(){this.reset();this.wasBlocked=true;}
 fail(message){this.disable();this.notify(message);this.onFailure(message);}
 disable(){
  this.generation++;this.active=false;this.loading=false;clearTimeout(this.initTimer);this.initReject?.(Error('cancelled'));this.initReject=null;
  this.worker?.terminate();this.worker=null;for(const p of this.pending.values())p.resolve(null);this.pending.clear();this.queuedSeconds=0;this.lastAt=-Infinity;this.wasBlocked=false;
  this.processor?.disconnect();if(this.processor)this.processor.port.onmessage=null;this.processor=null;this.source?.disconnect();this.source=null;
  this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;
  if(this.ctx){this.ctx.onstatechange=null;this.ctx.close().catch(()=>{});this.ctx=null;}
  this.onProgress(null);this.notify('声控未开启');this.onStatus(this.status);
 }
}
VoiceControl.keyword=KEYWORD;root.RecoveryVoiceControl=VoiceControl;
})(window);
