const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');const html=fs.readFileSync('index.html','utf8');const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const context={window:{},performance:{now:()=>123},settings:{solo:false},voiceTestObserver:null,lastTick:0,$:()=>({hidden:false}),cancel(){},render(){},save(){},say(){},acquireWake(){},runCue(){}};vm.createContext(context);vm.runInContext(scripts[1],context);vm.runInContext(scripts[2],context);
const primary=html.slice(html.indexOf('function primary(){'),html.indexOf('function flushExtra(){'));vm.runInContext(primary,context);
const start=html.indexOf(' onCommand:(word,result)=>{'),end=html.indexOf('\n});',start);const handler=html.slice(start,end).trim().replace(/^onCommand:/,'');vm.runInContext('handle='+handler,context);
for(const word of ['开始']){
 const s=new context.window.RecoverySession({},1);s.start();s.cueFinished();s.startPrepared();s.tick(2300);s.pause();const remaining=s.remainingMs;context.session=s;context.handle(word,{});assert.equal(s.state,'running');assert.equal(s.remainingMs,remaining);assert(s.elbowContinuous);
}
for(const word of ['暂停','继续']){const s=new context.window.RecoverySession({},1);s.start();s.cueFinished();s.startPrepared();const before=s.state;context.session=s;context.handle(word,{});assert.equal(s.state,before);s.pause();context.handle(word,{});assert.equal(s.state,'paused');}
{const s=new context.window.RecoverySession({},1);s.start();s.cueFinished();s.startPrepared();s.tick(2300);const remaining=s.remainingMs;context.session=s;context.handle('开始',{});assert.equal(s.state,'running');assert.equal(s.remainingMs,remaining);}
console.log('PASS: the only voice action starts/resumes; running timers never pause or reset');
