import asyncio,edge_tts,json,pathlib,ssl,os
from pathlib import Path
import edge_tts.communicate as comm
comm._SSL_CTX=ssl.create_default_context(cafile='/etc/ssl/certs/ca-certificates.crt')
p=Path(os.environ.get('KWS_BENCH_DIR',str(Path(__file__).parent/'work')));p.mkdir(parents=True,exist_ok=True);sem=asyncio.Semaphore(4);rows=[]
words=['开始开始','你好小康','小康开始','开始训练','开始计时']
neg=['开始','暂停','继续','开始开会','开水开水','开心开心','开始吃饭','重新开始','你好小刚','现在几点了','我们出去走走','本次练习完成，可以刷牙了。','抬起小臂，肩膀不动。','还有十秒，准备下一组。','电视正在播放今天的新闻。','今天吃什么，明天去哪里？']
async def make(v,r,t,i,kind):
 async with sem:
  name=f'{kind}-{v}-{r}-{i}.mp3';path=p/name
  for attempt in range(3):
   try:
    if not path.exists() or not path.stat().st_size:await edge_tts.Communicate(t,v,rate=f'{r:+d}%').save(str(path))
    rows.append(dict(voice=v,rate=r,text=t,file=name,kind=kind));return
   except Exception:
    path.unlink(missing_ok=True)
    if attempt==2:raise
    await asyncio.sleep(1)
async def main():
 await asyncio.gather(*[make(v,r,t,i,'positive') for v in ['zh-CN-XiaoxiaoNeural','zh-CN-XiaoyiNeural','zh-CN-YunxiNeural','zh-CN-YunjianNeural'] for r in [0,40,80] for i,t in enumerate(words)],*[make(v,40,t,i,'negative') for v in ['zh-CN-XiaoyiNeural','zh-CN-YunxiNeural'] for i,t in enumerate(neg)])
 (p/'manifest.json').write_text(json.dumps(rows,ensure_ascii=False));print('generated',len(rows),flush=True)
asyncio.run(main())
