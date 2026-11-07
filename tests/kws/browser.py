"""Replay prepared fixtures through the deployed Worker in Chromium."""
import asyncio,functools,http.server,json,os,pathlib,threading,argparse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2]
BENCH=pathlib.Path(os.environ.get('KWS_BENCH_DIR',str(pathlib.Path(__file__).parent/'work'))).resolve()
parser=argparse.ArgumentParser();parser.add_argument('--validation',action='store_true');args=parser.parse_args()
FIXTURES=BENCH/('validation-fixtures' if args.validation else 'fixtures')
class Handler(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def translate_path(self,path):
  if path.startswith('/fixtures/'):
   target=(FIXTURES/path.removeprefix('/fixtures/')).resolve()
   if target.is_relative_to(FIXTURES):return str(target)
  return super().translate_path(path)
 def log_message(self,*args):pass
async def main():
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
 async with async_playwright() as pw:
  options={'args':['--no-sandbox']}
  if os.environ.get('CHROMIUM_PATH'):options['executable_path']=os.environ['CHROMIUM_PATH']
  if os.environ.get('HTTPS_PROXY'):options['proxy']={'server':os.environ['HTTPS_PROXY'],'bypass':'127.0.0.1,localhost'}
  if os.environ.get('KWS_BROWSER_HOME'):options['env']={**os.environ,'HOME':os.environ['KWS_BROWSER_HOME']}
  browser=await pw.chromium.launch(**options);page=await browser.new_page()
  await page.goto(f'http://127.0.0.1:{server.server_port}/index.html#test')
  await page.evaluate('''()=>{window.requests=new Map();window.seq=1;window.w=new Worker('assets/kws/worker.js',{type:'module'});window.ready=new Promise((resolve,reject)=>{w.onmessage=({data:m})=>{if(m.type==='ready')resolve();else if(m.type==='error')reject(Error(m.message));else if(m.id){requests.get(m.id)?.(m);requests.delete(m.id);}};w.onerror=e=>reject(Error(e.message));});window.call=m=>new Promise(resolve=>{m.id=seq++;requests.set(m.id,resolve);w.postMessage(m);});w.postMessage({type:'init'});}''')
  await page.evaluate('ready');rows=json.loads((FIXTURES/'manifest.json').read_text())
  for i,f in enumerate(rows):
   r=await page.evaluate('''async f=>{await call({type:'reset',epoch:1});const samples=new Float32Array(await(await fetch('/fixtures/'+f.pcm)).arrayBuffer());return await call({type:'audio',epoch:1,samples,rate:f.rateHz});}''',f)
   f['browserHits']=[h['label'] for h in r['hits']];f['browserOK']=f['browserHits']==f['expected'];f['ms']=r['ms']
   if i%50==0:print(f'{i}/{len(rows)}',flush=True)
  (BENCH/('browser-validation-results.json' if args.validation else 'browser-final-results.json')).write_text(json.dumps(rows,ensure_ascii=False,indent=2))
  print('positives',sum(r['browserOK'] for r in rows if r['expected']),'/',sum(bool(r['expected']) for r in rows),'false positives',sum(not r['browserOK'] for r in rows if not r['expected']))
  await browser.close()
 server.shutdown()
asyncio.run(main())
