"""zukan — YAML → VOICEVOX → ffmpeg の純コード音声/動画生成パイプライン。

台本(YAML)から VOICEVOX(ローカルAPI)で音声を合成し、
ffmpeg で「音声結合 + 字幕焼き込み + BGM/SE 合成」まで一気通貫で行う。
YMM4(.ymmp) を介さず、コードだけで完結させることを狙いとする。
"""

__version__ = "0.1.0"
