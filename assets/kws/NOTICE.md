# Browser keyword spotting dependencies

The application uses **sherpa-onnx keyword spotting**, not browser speech-to-text.

- Vendored JavaScript: `@sherpaw/kws` **0.3.0**, https://github.com/sumimakito/sherpaw (Apache-2.0; copy in `LICENSE`). Only its dependency-free core is used. The one modification permits passing `wasmBinary` after downloading and verifying it, so the UI can show actual byte progress.
- WASM runtime: the same package/version, pinned at `https://cdn.jsdelivr.net/npm/@sherpaw/kws@0.3.0/dist/prebuilt/kws.wasm`. SHA-256: `b75814d1f900cc99efc7de51ae561ffb2517456307488ec4387689c953b9b983`.
- Model: official k2-fsa/sherpa-onnx `sherpa-onnx-kws-zipformer-zh-en-3M-2025-12-20`, FP32, chunk 16, left context 64. Upstream: https://github.com/k2-fsa/sherpa-onnx/releases/tag/kws-models (Apache-2.0).
- Model distribution: https://huggingface.co/moeru-ai/sherpa-onnx-kws-zipformer-zh-en-3M-2025-12-20 at commit `1770a4b22db32184c110ac43c601db17cc9c93f8`. Pack SHA-256: `4ca3ae0d147df1576fac87a4837f5a8959f4f87600a8306c57cc67eb8b40494d`. Each of the four extracted files was byte-compared with the official release archive and matched exactly.

The downloaded runtime and model total 25,557,651 bytes. They are verified before use and cached locally when Cache Storage is available. The microphone PCM is processed locally in a dedicated Worker; it is never sent to these asset hosts. AudioWorklet captures at the actual device sample rate; sherpa-onnx performs streaming resampling.
