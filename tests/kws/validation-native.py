from pathlib import Path
import json,subprocess,numpy as np,sherpa_onnx,time,os
p=Path(os.environ.get('KWS_BENCH_DIR',str(Path(__file__).parent/'work')));m=p/'sherpa-onnx-kws-zipformer-zh-en-3M-2025-12-20';(p/'single.txt').write_text('k āi sh ǐ j ì sh í @开始计时\n')
k=sherpa_onnx.KeywordSpotter(tokens=str(m/'tokens.txt'),encoder=str(m/'encoder-epoch-13-avg-2-chunk-16-left-64.onnx'),decoder=str(m/'decoder-epoch-13-avg-2-chunk-16-left-64.onnx'),joiner=str(m/'joiner-epoch-13-avg-2-chunk-16-left-64.onnx'),keywords_file=str(p/'single.txt'),keywords_score=.6,keywords_threshold=.35,max_active_paths=8,num_trailing_blanks=1,num_threads=1)
def audio(file):return np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(file),'-ar','16000','-ac','1','-f','f32le','-']),dtype=np.float32).copy()
manifest=json.loads(Path(__file__).with_name('samples.json').read_text())['validation'];background=np.concatenate([audio(p/f['file']) for f in json.loads(Path(__file__).with_name('samples.json').read_text())['tuning'] if f['kind']=='negative' and f['voice']=='zh-CN-YunxiNeural'])
rows=[];fixtures=[];rng=np.random.default_rng(20261109);out=p/'validation-fixtures';out.mkdir(exist_ok=True)
for f in manifest:
 a=audio(p/f['file']);expected=['开始计时'] if f['text']=='开始计时' else []
 for condition in ['clean','noise10','noise5','speech10','speech5']:
  b=a.copy();rms=np.sqrt(np.mean(a*a))
  if condition.startswith('noise'):b+=rng.normal(0,rms/(10**(int(condition[5:])/20)),len(a)).astype(np.float32)
  if condition.startswith('speech'):
   off=int(rng.integers(0,len(background)-len(a)));n=background[off:off+len(a)];b+=n*(rms/(np.sqrt(np.mean(n*n))+1e-8))/(10**(int(condition[6:])/20))
  b=np.concatenate([np.clip(b,-1,1),np.zeros(16000,dtype=np.float32)]);s=k.create_stream();hits=[]
  for off in range(0,len(b),1280):
   s.accept_waveform(16000,b[off:off+1280])
   while k.is_ready(s):
    k.decode_stream(s);r=k.get_result(s)
    if r:hits.append(r);k.reset_stream(s)
  row=dict(**f,condition=condition,hits=hits,expected=expected,ok=hits==expected);rows.append(row)
  name=f'{len(fixtures)}.f32';b.astype('<f4').tofile(out/name);fixtures.append(dict(**row,pcm=name,rateHz=16000,duration=len(b)/16000))
# Real human recordings supplied in official model pack, as negative continuous speech.
for file in sorted((m/'test_wavs').glob('*.wav')):
 a=np.concatenate([audio(file),np.zeros(16000,dtype=np.float32)]);s=k.create_stream();hits=[]
 for off in range(0,len(a),1280):
  s.accept_waveform(16000,a[off:off+1280])
  while k.is_ready(s):
   k.decode_stream(s);r=k.get_result(s)
   if r:hits.append(r);k.reset_stream(s)
 name=f'{len(fixtures)}.f32';a.astype('<f4').tofile(out/name);row=dict(text=file.name,kind='human-negative',condition='clean',hits=hits,expected=[],ok=not hits);rows.append(row);fixtures.append(dict(**row,pcm=name,rateHz=16000,duration=len(a)/16000))
(p/'validation-results.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2));(out/'manifest.json').write_text(json.dumps(fixtures,ensure_ascii=False))
for c in ['clean','noise10','noise5','speech10','speech5']:
 pos=[x for x in rows if x['expected'] and x['condition']==c];neg=[x for x in rows if not x['expected'] and x['condition']==c];print(c,'positive',sum(x['ok'] for x in pos),'/',len(pos),'negative',sum(x['ok'] for x in neg),'/',len(neg))
print('failures',json.dumps([x for x in rows if not x['ok']],ensure_ascii=False))
