from pathlib import Path
exec(open(Path(__file__).with_name('generate.py')).read().split('async def main():')[0])
async def main():
 original=json.loads((p/'manifest.json').read_text());rows.extend(original)
 neg2=['开始计算','开始记录','开始几次','开车计时','停止计时','开始计数','开设计师','快点开始','计时结束','计时器响了','开始开会，会议还有十分钟。','把开水倒进杯子，稍微放凉再喝。']
 await asyncio.gather(*[make(v,r,'开始计时',i,'holdout') for i,v in enumerate(['zh-CN-XiaoxiaoNeural','zh-CN-XiaoyiNeural','zh-CN-YunxiNeural','zh-CN-YunjianNeural']) for r in [20,60]],*[make(v,40,t,i,'near') for v in ['zh-CN-XiaoyiNeural','zh-CN-YunxiNeural'] for i,t in enumerate(neg2)])
 (p/'extended-manifest.json').write_text(json.dumps(rows,ensure_ascii=False));print(len(rows),flush=True)
asyncio.run(main())
