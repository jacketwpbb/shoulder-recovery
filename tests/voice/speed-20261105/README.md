# Voice speed regression, 2026-11-05

48 positive samples: Edge TTS Xiaoxiao, Xiaoyi, Yunxi, Yunjian; rates +0%, +35%, +70%, +100%; 开始 / 暂停 / 继续. Sixteen negative samples use Xiaoyi and Yunxi at +70%.

The browser harness `voice-speed-test.html` runs the baseline and candidate against the same decoded MP3 audio at 16 kHz, in 40 ms real-time chunks. It trims leading silence (retaining 100 ms), calls interrupt immediately before each utterance to reproduce speaking directly after a prompt, and appends 1.5 seconds of silence for endpoint detection. Both use the same Vosk model. Input during actual prompt playback remains discarded.

This is synthetic-file testing, not physical microphone, room-noise or acoustic echo validation. Edge TTS rate percentages are synthesis settings, not measured human syllable rates.

Completion voice: Edge TTS zh-CN-XiaoxiaoNeural, +0%, “本次练习完成，可以刷牙了。”

The first run exposed an onset-loss bug plus false positives from an excessively restrictive grammar. The candidate buffers post-prompt input and adds rejection phrases (negations and ordinary speech); only the three exact commands can trigger actions. In paused state, 开始 is also an alias for 继续.
