const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync('assets/voice-control.js','utf8');
let mode='ok',terminated=0,fetches=0;
class Model{constructor(){this.ready=true;}on(name,cb){if(name==='load')queueMicrotask(()=>cb({result:true}));}terminate(){terminated++;}KaldiRecognizer=class{setWords(){}on(){}remove(){}};}
const context={window:null,Vosk:{Model},AudioContext:class{},WebAssembly,AbortController,performance,setTimeout,clearTimeout,console,Float32Array,
 fetch:async(url,{signal})=>{fetches++;if(mode==='error')return {ok:false,status:503};return {ok:true,headers:{get:()=>mode==='unknown'?null:'6'},body:{getReader:()=>{let n=0;return {read:async()=>{if(mode==='abort')await new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted'))));return n++<2?{done:false,value:new Uint8Array(3)}:{done:true};}}}}};}};
context.window=context;vm.createContext(context);vm.runInContext(code,context);
(async()=>{
 let progress=[],status=[],failures=[];
 const control=new context.RecoveryVoiceControl({onProgress:p=>progress.push(p),onStatus:s=>status.push(s),onFailure:e=>failures.push(e),onCommand:()=>{},blocked:()=>false});
 await control.enable({file:true});assert(control.active);assert.deepEqual(progress.filter(Boolean).map(p=>p.loaded),[0,3,6]);assert(status.some(s=>s.includes('100%')));assert(status.some(s=>s.includes('初始化')));
 control.disable();const calls=fetches;await control.enable({file:true});assert.equal(fetches,calls,'reuse initialized model');control.fail('reset');
 mode='unknown';progress=[];await control.enable({file:true});assert(progress.filter(Boolean).every(p=>p.total===0));control.fail('reset');
 mode='error';await control.enable({file:true});assert(!control.active&&!control.loading);assert(failures.at(-1).includes('503'));
 mode='abort';const pending=control.enable({file:true});await new Promise(r=>setImmediate(r));control.disable();await pending;assert(!control.active&&!control.loading);
 const html=fs.readFileSync('index.html','utf8');for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
 assert(html.includes("if(location.hash!=='#test')void enableCommands();"));assert(html.includes('voiceControl:true'));assert(!html.includes('>开启声控</button>'));
 console.log('PASS: real byte progress, unknown size, model reuse, download failure, cancellation, automatic startup and HTML syntax');
})().catch(e=>{console.error(e);process.exitCode=1;});
