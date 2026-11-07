import {n as createKeywordSpotter,t as initKWSModule} from './sherpaw-core.js';
const ASSETS=[
 {url:'https://cdn.jsdelivr.net/npm/@sherpaw/kws@0.3.0/dist/prebuilt/kws.wasm',size:12481468,sha:'b75814d1f900cc99efc7de51ae561ffb2517456307488ec4387689c953b9b983'},
 {url:'https://huggingface.co/moeru-ai/sherpa-onnx-kws-zipformer-zh-en-3M-2025-12-20/resolve/1770a4b22db32184c110ac43c601db17cc9c93f8/install/bin/wasm/preload.data',size:13076183,sha:'4ca3ae0d147df1576fac87a4837f5a8959f4f87600a8306c57cc67eb8b40494d'}
];
const FILES=[['/decoder.onnx',0,759829],['/encoder.onnx',759829,12736101],['/joiner.onnx',12736101,13074255],['/tokens.txt',13074255,13076183]];
export const KEYWORD={label:'开始计时',matches:[{tokens:['k','āi','sh','ǐ','j','ì','sh','í']}],score:.6,threshold:.35};
let spotter,epoch=0,loading=false;
const loaded=[0,0],total=ASSETS.reduce((n,x)=>n+x.size,0);
async function download(asset,i){
 let cache;try{cache=await caches.open('recovery-sherpa-kws-v1');}catch{}
 let response=await cache?.match(asset.url),cached=!!response;
 if(!response)response=await fetch(asset.url,{cache:'force-cache'});
 if(!response.ok)throw Error('语音包下载失败（'+response.status+'）');
 const chunks=[];let size=0;
 if(response.body){const reader=response.body.getReader();while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);size+=value.length;loaded[i]=Math.min(size,asset.size);postMessage({type:'progress',loaded:loaded[0]+loaded[1],total});}}
 else{const b=new Uint8Array(await response.arrayBuffer());chunks.push(b);size=b.length;loaded[i]=size;postMessage({type:'progress',loaded:loaded[0]+loaded[1],total});}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
 if(size!==asset.size||digest!==asset.sha){await cache?.delete(asset.url);throw Error('语音包校验失败，请重试');}
 if(!cached&&cache)try{await cache.put(asset.url,new Response(bytes,{headers:{'Content-Type':'application/octet-stream'}}));}catch{}
 return bytes;
}
onmessage=async({data:m})=>{
 try{
  if(m.type==='init'){
   if(loading||spotter)return;loading=true;
   const wasm=await download(ASSETS[0],0),model=await download(ASSETS[1],1);
   postMessage({type:'initializing'});
   const module=await initKWSModule({wasmBinary:wasm});
   for(const [name,start,end] of FILES)module.FS.writeFile(name,model.subarray(start,end));
   spotter=createKeywordSpotter(module,{model:{encoder:'/encoder.onnx',decoder:'/decoder.onnx',joiner:'/joiner.onnx',tokens:'/tokens.txt'},keywords:m.keywords||[KEYWORD],maxActivePaths:8});
   postMessage({type:'ready',keyword:KEYWORD.label});
  }else if(m.type==='reset'){
   spotter?.reset();epoch=m.epoch;postMessage({type:'reset',id:m.id,epoch});
  }else if(m.type==='audio'&&spotter){
   if(m.epoch!==epoch){postMessage({type:'result',id:m.id,epoch:m.epoch,hits:[],stale:true});return;}
   const start=performance.now(),hits=[];
   // Streaming chunks use this same decoder path; file fixtures may contain a full clip.
   const samples=m.samples;for(let offset=0;offset<samples.length;offset+=1280)hits.push(...spotter.processAudio(samples.subarray(offset,offset+1280),m.rate));
   postMessage({type:'result',id:m.id,epoch,hits,ms:performance.now()-start,sampleCount:samples.length});
  }
 }catch(e){postMessage({type:'error',message:e.message||String(e),id:m.id});}
};
