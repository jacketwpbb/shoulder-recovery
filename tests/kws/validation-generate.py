from pathlib import Path
exec(open(Path(__file__).with_name('generate.py')).read().split('async def main():')[0])
async def main():
 await asyncio.gather(*[make(v,r,'开始计时',0,'validation') for v in ['zh-CN-YunxiaNeural','zh-CN-YunyangNeural'] for r in [-20,30,70]],*[make(v,30,t,i,'validation-negative') for v in ['zh-CN-YunxiaNeural','zh-CN-YunyangNeural'] for i,t in enumerate(['开始计算','开始计数','开始开始','开水开水','停止计时','现在几点了'])])
 (p/'validation-manifest.json').write_text(json.dumps(rows,ensure_ascii=False));print('generated',len(rows),flush=True)
asyncio.run(main())
