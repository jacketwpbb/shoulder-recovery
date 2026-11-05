const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');let now=1000,blocked=false;const sent=[];
const env={window:null,performance:{now:()=>now},Float32Array,console};env.window=env;vm.createContext(env);vm.runInContext(fs.readFileSync('assets/voice-control.js','utf8'),env);
const c=new env.RecoveryVoiceControl({blocked:()=>blocked,onStatus:()=>{},onFailure:()=>{},onCommand:()=>{}});c.active=true;c.newRecognizer=()=>{c.rec={acceptWaveformFloat:s=>sent.push(...s),remove(){}};};
c.interrupt();c.feed([1,2],16000);now+=200;c.feed([3],16000);assert.equal(sent.length,0);now+=300;c.feed([4],16000);assert.deepEqual(sent,[1,2,3,4]);
c.interrupt();c.feed([5],16000);blocked=true;c.feed([99],16000);blocked=false;now+=500;c.feed([6],16000);assert.deepEqual(sent,[1,2,3,4,6],'discard playback and stale queued audio');
c.interrupt();c.feed([7],16000);c.interrupt();now+=500;c.feed([8],16000);assert.deepEqual(sent,[1,2,3,4,6,8]);
console.log('PASS: preserve fast command onset; discard prompt audio and interrupted queues');
