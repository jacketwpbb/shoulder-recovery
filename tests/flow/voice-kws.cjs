const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
let clock=10000,blocked=false,worker;const commands=[],statuses=[],progress=[];
class Worker {constructor(){worker=this;this.sent=[];}postMessage(m){this.sent.push(m);if(m.type==='init')queueMicrotask(()=>this.onmessage({data:{type:'ready'}}));}terminate(){this.terminated=true;}emit(m){this.onmessage({data:m});}}
const window={AudioContext:function(){},Worker,WebAssembly};const ctx={window,document:{currentScript:{src:'https://example.test/assets/voice-control.js'}},URL,Worker,performance:{now:()=>clock},setTimeout,clearTimeout,Float32Array,Map,Promise,console};vm.createContext(ctx);vm.runInContext(fs.readFileSync('assets/voice-control.js','utf8'),ctx);
(async()=>{
const c=new window.RecoveryVoiceControl({onCommand:(...x)=>commands.push(x),onStatus:x=>statuses.push(x),onProgress:x=>progress.push(x),blocked:()=>blocked,onFailure:x=>{throw Error(x);}});
await c.enable({file:true});assert(c.active);assert.equal(window.RecoveryVoiceControl.keyword,'开始计时');
const feed=(label='开始计时')=>{const p=c.feed([.2,.4],16000);const m=worker.sent.at(-1);worker.emit({type:'result',id:m.id,epoch:m.epoch,hits:[{label}]});return p;};
await feed();assert.equal(commands.length,1);assert.equal(commands[0][0],'开始');await feed();assert.equal(commands.length,1,'debounce');
clock+=1300;await feed('暂停');await feed('继续');await feed('开始开始');assert.equal(commands.length,1,'only the configured full keyword is accepted');
const stale=c.feed([.2],16000),old=worker.sent.at(-1);c.interrupt();worker.emit({type:'result',id:old.id,epoch:old.epoch,hits:[{label:'开始计时'}]});await stale;assert.equal(commands.length,1,'queued pre-prompt detections are ignored');
blocked=true;const before=worker.sent.length;await c.feed([.5],16000);assert.equal(worker.sent.length,before,'prompt audio is discarded');blocked=false;await feed();assert.equal(commands.length,2,'first post-prompt audio is kept without a cooldown');
worker.emit({type:'progress',loaded:500,total:1000});assert.equal(progress.at(-1).loaded,500);assert(statuses.at(-1).includes('50%'));
const pending=c.feed([.3],16000);const oldWorker=worker;c.disable();await pending;assert(oldWorker.terminated);assert.equal(c.pending.size,0);assert(!c.active);
await c.enable({file:true});assert(c.active);assert.notEqual(worker,oldWorker);c.disable();
console.log('PASS: KWS lifecycle, byte progress, full keyword, debounce, stale results, prompt gating and immediate post-prompt audio');
})().catch(e=>{console.error(e);process.exitCode=1;});
