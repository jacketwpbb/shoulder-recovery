const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(require('path').join(__dirname,'../../index.html'),'utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const context={window:{}};vm.createContext(context);vm.runInContext(scripts[1],context);vm.runInContext(scripts[2],context);
const S=context.window.RecoverySession;
function finish(s){while(s.state==='running')s.tick(Math.min(1000,s.remainingMs));}
for(const voiceControl of [false,true])for(const rest of [0,4]){
 const s=new S({voiceControl,elbowRounds:5,elbowRestSeconds:rest},1);
 s.start();s.cueFinished();assert.equal(s.state,'ready');s.startPrepared();
 let work=0;
 while(s.state!=='done'){
  if(s.current.kind!=='rest')work++;
  if(s.current.round===2&&s.current.kind==='up'){
   s.tick(1000);s.pause();const remaining=s.remainingMs;s.tick(1000);assert.equal(s.remainingMs,remaining);
   const restored=S.restore(s.snapshot());assert(restored.elbowContinuous);restored.resume();assert.equal(restored.remainingMs,remaining);
   s.resume();
  }
  finish(s);if(s.state==='cue'){s.cueFinished();assert.equal(s.state,'running','All remaining elbow phases must continue without another start');}
 }
 assert.equal(work,10);console.log(JSON.stringify({voiceControl,rest,workPhases:work,manualStarts:1,status:'passed'}));
}
const s=new S({liftRounds:2,restSeconds:1});s.start();s.cueFinished();assert.equal(s.state,'ready');s.startPrepared();finish(s);s.cueFinished();assert.equal(s.state,'running');finish(s);s.cueFinished();assert.equal(s.state,'ready','Lift still waits for readiness every round');
const b=new S({elbowRounds:1},1);b.start();b.cueFinished();b.startPrepared();b.jumpTo(0);assert(b.elbowContinuous);b.state='idle';b.jumpTo(0);assert(!b.elbowContinuous);
assert(!/id="(?:soloMode|assistedMode)"/.test(html));
console.log('Lift readiness, pause/restore and unified voice toggle verified');
