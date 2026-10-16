/* Browser-local command recognition. Vosk Browser Apache-2.0, Chinese model Apache-2.0.
   https://github.com/ccoreilly/vosk-browser  https://alphacephei.com/vosk/models */
(function(root){
'use strict';
const MODEL='https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-cn-0.3.tar.gz';
const SCRIPT='https://cdn.jsdelivr.net/npm/vosk-browser@0.0.8/dist/vosk.js';
const WORDS=['开始','暂停','继续'];
let library;
function loadLibrary(){
 if(root.Vosk)return Promise.resolve();
 if(library)return library;
 library=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=SCRIPT;script.onload=resolve;script.onerror=()=>{library=null;script.remove();reject(Error('语音组件下载失败，请重试'));};document.head.appendChild(script);});
 return library;
}
// Warm the browser HTTP cache using the original URL, preserving Vosk's stable model cache key.
async function downloadModel(signal,report){
 const response=await fetch(MODEL,{cache:'force-cache',signal});
 if(!response.ok)throw Error('语音包下载失败（'+response.status+'），请重试');
 const total=Number(response.headers.get('content-length'))||0;
 let loaded=0;report(loaded,total);
 if(response.body){const reader=response.body.getReader();while(true){const {done,value}=await reader.read();if(done)break;loaded+=value.byteLength;report(loaded,total);}}
 else{loaded=(await response.arrayBuffer()).byteLength;report(loaded,total);}
 if(!loaded)throw Error('语音包为空，请重试');
}
class VoiceControl{
 constructor({onCommand,onStatus,blocked,onFailure,onProgress=()=>{}}){
  Object.assign(this,{onCommand,onStatus,blocked,onFailure,onProgress});this.active=false;this.loading=false;this.generation=0;this.status='声控未开启';this.model=null;this.rec=null;this.cooldown=0;this.lastWord='';this.lastAt=0;this.fileMode=false;
 }
 notify(text){if(this.status!==text){this.status=text;this.onStatus(text);}}
 async enable({file=false}={}){
  if(this.active||this.loading)return;
  const generation=++this.generation;this.loading=true;this.fileMode=file;this.notify(file?'正在加载文件识别…':'正在开启麦克风…');
  let pendingStream,pendingContext;this.downloadAbort=new AbortController();
  try{
   if(!root.AudioContext||!root.WebAssembly)throw Error('此浏览器暂不支持声控，可使用屏幕按钮');
   if(!file){
    if(!isSecureContext||!navigator.mediaDevices?.getUserMedia)throw Error('请使用 HTTPS 浏览器页面开启麦克风');
    pendingContext=new AudioContext({sampleRate:16000});
    pendingStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
    if(generation!==this.generation){pendingStream.getTracks().forEach(t=>t.stop());await pendingContext.close();return;}
    this.ctx=pendingContext;this.stream=pendingStream;
    if(this.ctx.state!=='running'){this.notify('请点一下页面，允许浏览器启用声音');await this.ctx.resume();}
    if(generation!==this.generation)return;
   }
   this.notify('正在加载语音组件…');
   await loadLibrary();if(generation!==this.generation)return;
   if(!this.model){
    await downloadModel(this.downloadAbort.signal,(loaded,total)=>{if(generation!==this.generation)return;this.onProgress({loaded,total});const mb=(loaded/1000000).toFixed(1);this.notify(total?'下载语音包 '+Math.min(100,Math.floor(loaded/total*100))+'% · '+mb+' / '+(total/1000000).toFixed(1)+' MB':'下载语音包 · 已下载 '+mb+' MB');});
    if(generation!==this.generation)return;
    this.onProgress(null);this.notify('下载完成，正在初始化语音识别…');
    const m=new Vosk.Model(MODEL,-1);this.model=m;
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('语音包加载超时，请重试')),90000);m.on('load',e=>{clearTimeout(timer);e.result?resolve():reject(Error('语音包加载失败'));});m.on('error',e=>{clearTimeout(timer);reject(Error(e.error||'语音模型出错'));});});
   }
   if(generation!==this.generation)return;
   this.active=true;this.loading=false;this.newRecognizer();
   if(!file){
    this.source=this.ctx.createMediaStreamSource(this.stream);this.processor=this.ctx.createScriptProcessor(2048,1,1);this.silent=this.ctx.createGain();this.silent.gain.value=0;
    this.processor.onaudioprocess=e=>this.feed(e.inputBuffer.getChannelData(0),e.inputBuffer.sampleRate);
    this.source.connect(this.processor);this.processor.connect(this.silent);this.silent.connect(this.ctx.destination);
    this.stream.getAudioTracks()[0].onended=()=>{if(this.active)this.fail('麦克风已断开，请重新开启声控');};
    this.ctx.onstatechange=()=>{if(this.active&&this.ctx?.state!=='running')this.fail('声控已中断，请重新开启');};
   }
   this.notify('正在聆听：开始 / 暂停 / 继续');this.onStatus(this.status);
  }catch(e){
   if(generation!==this.generation){pendingStream?.getTracks().forEach(t=>t.stop());pendingContext?.close().catch(()=>{});return;}
   const messages={NotAllowedError:'未取得麦克风权限，可重试或使用屏幕按钮',NotFoundError:'未找到麦克风，可使用屏幕按钮',NotReadableError:'麦克风正被占用，请关闭其他录音后重试'};
   if(pendingContext&&pendingContext!==this.ctx)pendingContext.close().catch(()=>{});
   this.fail(messages[e.name]||e.message||'声控开启失败');
  }
 }
 newRecognizer(){
  this.rec?.remove();if(!this.active||!this.model?.ready){this.rec=null;return;}
  const rec=new this.model.KaldiRecognizer(16000,JSON.stringify([...WORDS,'<UNK>']));this.rec=rec;
  rec.setWords(true);rec.on('result',m=>{
   if(rec!==this.rec||!this.active||this.blocked()||performance.now()<this.cooldown)return;
   const word=(m.result.text||'').replace(/[\s，。！？,.!?]/g,'');
   if(!WORDS.includes(word))return;
   if(word===this.lastWord&&performance.now()-this.lastAt<1200)return;
   this.lastWord=word;this.lastAt=performance.now();this.onCommand(word,m.result);
  });
 }
 feed(samples,rate){
  if(!this.active)return;
  if(this.blocked()){
   this.cooldown=performance.now()+450;
   if(this.rec){this.rec.remove();this.rec=null;}
   this.notify('正在播报，结束后可说口令');return;
  }
  if(performance.now()<this.cooldown)return;
  if(!this.rec)this.newRecognizer();
  this.notify('正在聆听：开始 / 暂停 / 继续');
  try{this.rec.acceptWaveformFloat(new Float32Array(samples),rate);}catch(e){this.lastError=e.message;console.error('Voice input failed',e);this.fail('声控处理出错，请重新开启');}
 }
 resumeAudio(){if(this.ctx?.state==='suspended')void this.ctx.resume().catch(()=>{});}
 interrupt(){this.cooldown=performance.now()+450;if(this.rec){this.rec.remove();this.rec=null;}}
 fail(message){this.disable();if(this.model){this.model.terminate();this.model=null;}this.notify(message);this.onFailure(message);}
 disable(){
  this.downloadAbort?.abort();this.onProgress(null);
  this.generation++;this.active=false;if(this.loading&&this.model){this.model.terminate();this.model=null;}this.loading=false;this.rec?.remove();this.rec=null;
  if(this.processor){this.processor.onaudioprocess=null;this.processor.disconnect();this.processor=null;}
  this.source?.disconnect();this.source=null;this.silent?.disconnect();this.silent=null;
  this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;
  if(this.ctx){this.ctx.onstatechange=null;this.ctx.close().catch(()=>{});this.ctx=null;}
  this.notify('声控未开启');this.onStatus(this.status);
 }
}
root.RecoveryVoiceControl=VoiceControl;
})(window);
