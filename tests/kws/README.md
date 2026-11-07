# Single wakephrase validation — 2026-11-07

Chosen phrase: **开始计时**. It starts a ready exercise or resumes a paused timer. Saying it during an active timer does nothing. “暂停” and “继续” are no longer voice commands; the pause button remains available.

The browser uses genuine sherpa-onnx KWS with the official bilingual 3M Zipformer model. See `assets/kws/NOTICE.md` for pinned sources, hashes and licenses. Final parameters: score 0.6, threshold 0.35, maxActivePaths 8. Do not interpret these synthetic tests as real-room or microphone accuracy.

## Selection and results

Initial equal-parameter comparison (four Edge TTS voices, rates 0/+40/+80%, clean and white noise at 10/5 dB SNR) included 开始开始, 开始计时, 你好小康, 小康开始 and 开始训练. 开始开始 detected 34/36 but triggered on 开水开水 in six negative cases. 开始计时 detected 35/36 without triggering on these initial negatives. Repetition alone did not make the wakephrase safer.

Expanded tuning used Xiaoxiao, Xiaoyi, Yunxi and Yunjian at 0/+20/+40/+60/+80%; near phrases, ordinary speech, white noise and competing speech; and nine real speech files from the official model release as negatives. The final browser WASM run matched native sherpa-onnx results exactly:

| Condition | Detected / positive | False triggers / negative |
|---|---:|---:|
| Clean | 20/20 | 0/113 |
| White noise, 10 dB | 20/20 | 0/104 |
| White noise, 5 dB | 19/20 | 0/104 |
| Competing speech, 10 dB | 20/20 | 0/104 |
| Competing speech, 5 dB | 19/20 | 0/104 |

Parameters were then frozen before testing new Yunxia and Yunyang voices at −20/+30/+70%. All 30 positive conditions and 60 new negative conditions passed in both native and browser replay (plus the nine repeated human negatives). See `results.json` for details and exact tuning-set misses. Nine official human recordings recur in validation; they are not additional unique samples.

A real Chromium AudioWorklet graph played Xiaoxiao MP3 at 48 kHz through the production controller, Worker, model and page handler. It started a ready timer, resumed without changing remaining time, and ignored repeated wakephrases while running. The pause button still worked. This is file injection through a browser audio graph, not a test using a physical microphone. During application speech, capture is deliberately excluded; immediately after speech ends there is no cooldown that discards the beginning of the user's phrase.

Byte download progress was observed during real HTTPS downloads of both assets. Model hashes were verified; the four model files matched the official release byte-for-byte. The separate Worker keeps inference off the page's UI thread.

## Reproduce

Use Python with `edge-tts`, `numpy`, `sherpa-onnx==2.0.1`, `playwright`, plus FFmpeg and Chromium. Set `KWS_BENCH_DIR` for temporary audio/model files if desired (default `tests/kws/work`, do not commit it). `CHROMIUM_PATH` can select a local browser. HTTPS uses the environment's proxy and CA trust; configure the browser trust store if your managed environment supplies a CA.

Download and extract the official archive `sherpa-onnx-kws-zipformer-zh-en-3M-2025-12-20.tar.bz2` from https://github.com/k2-fsa/sherpa-onnx/releases/tag/kws-models into that work directory. Then run:

```sh
python tests/kws/generate.py
python tests/kws/extend.py
python tests/kws/native.py
python tests/kws/browser.py
python tests/kws/validation-generate.py
python tests/kws/validation-native.py
python tests/kws/browser.py --validation
node tests/flow/voice-kws.cjs
node tests/flow/voice-start-resumes.cjs
node tests/flow/continuous-elbow.cjs
```

Noise is deterministically seeded; replay uses the committed sample order, independent of synthesis completion order. The manifest records original MP3 SHA-256 hashes (the remote TTS service may change its output over time). SNR is computed from whole-clip RMS, including silence. Samples are clipped to [-1,1], decoded at 16 kHz, and followed by one second of silence; the microphone path continuously supplies input instead. Positive and negative case manifests are in `samples.json`. No microphone audio is uploaded.
