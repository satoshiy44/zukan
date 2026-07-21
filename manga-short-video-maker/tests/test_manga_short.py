"""manga-short-video-maker の単体テスト。

VOICEVOX Engine / FFmpeg が無い環境でも動くよう、外部依存はモックする。

実行:
    python3 -m unittest discover -s tests
    （または） python3 tests/test_manga_short.py
"""

from __future__ import annotations

import struct
import sys
import tempfile
import unittest
from pathlib import Path
from typing import Any, Dict, List

# scripts/ を import path に追加
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import utils  # noqa: E402
import generate_voice  # noqa: E402
import generate_subtitles as subs  # noqa: E402
import build_video  # noqa: E402


# 話者一覧のダミー（/speakers 相当）
FAKE_SPEAKERS: List[Dict[str, Any]] = [
    {
        "name": "青山龍星",
        "styles": [{"name": "ノーマル", "id": 13}, {"name": "熱血", "id": 81}],
    },
    {
        "name": "四国めたん",
        "styles": [{"name": "ノーマル", "id": 2}, {"name": "あまあま", "id": 0}],
    },
]


def make_wav_bytes(seconds: float = 0.5, rate: int = 24000) -> bytes:
    """無音の PCM WAV バイト列を作る（テスト用）。"""
    n = int(seconds * rate)
    data = b"\x00\x00" * n
    header = b"RIFF"
    header += struct.pack("<I", 36 + len(data))
    header += b"WAVEfmt "
    header += struct.pack("<IHHIIHH", 16, 1, 1, rate, rate * 2, 2, 16)
    header += b"data" + struct.pack("<I", len(data))
    return header + data


class FakeVoicevoxClient:
    """VOICEVOX Engine のモック。HTTP を一切行わない。"""

    def __init__(self) -> None:
        self.synth_calls = 0

    def check_alive(self) -> None:
        return None

    def get_speakers(self) -> List[Dict[str, Any]]:
        return FAKE_SPEAKERS

    def audio_query(self, text: str, speaker_id: int) -> Dict[str, Any]:
        return {"speedScale": 1.0, "text": text, "speaker": speaker_id}

    def synthesis(self, query: Dict[str, Any], speaker_id: int) -> bytes:
        self.synth_calls += 1
        return make_wav_bytes()


class Test01SpeakerResolution(unittest.TestCase):
    """1. VOICEVOX 話者名の解決"""

    def test_resolves_known_speaker(self) -> None:
        sid, warns = generate_voice.resolve_speaker_id(
            FAKE_SPEAKERS, "青山龍星", "ノーマル"
        )
        self.assertEqual(sid, 13)
        self.assertEqual(warns, [])

    def test_unknown_speaker_raises(self) -> None:
        with self.assertRaises(utils.MangaShortError):
            generate_voice.resolve_speaker_id(FAKE_SPEAKERS, "存在しない人", "ノーマル")


class Test02StyleResolution(unittest.TestCase):
    """2. スタイル名の解決"""

    def test_resolves_style(self) -> None:
        sid, warns = generate_voice.resolve_speaker_id(
            FAKE_SPEAKERS, "四国めたん", "あまあま"
        )
        self.assertEqual(sid, 0)
        self.assertEqual(warns, [])

    def test_unknown_style_falls_back_with_warning(self) -> None:
        sid, warns = generate_voice.resolve_speaker_id(
            FAKE_SPEAKERS, "四国めたん", "存在しないスタイル"
        )
        self.assertEqual(sid, 2)  # 最初のスタイル
        self.assertEqual(len(warns), 1)
        self.assertIn("見つかりません", warns[0])


class Test03CsvReading(unittest.TestCase):
    """3. CSV 読み込み"""

    def test_reads_sample_csv(self) -> None:
        rows = utils.read_script(ROOT / "sample_project")
        self.assertEqual(len(rows), 5)
        self.assertEqual(rows[0].id, "001")
        self.assertEqual(rows[0].role, "narrator")
        self.assertEqual(rows[2].voicevox_name, "四国めたん")

    def test_missing_required_column_raises(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            p = Path(td)
            (p / "script.csv").write_text(
                "id,role,text\n001,narrator,こんにちは\n", encoding="utf-8"
            )
            with self.assertRaises(utils.MangaShortError):
                utils.read_script(p)

    def test_short_id_raises(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            p = Path(td)
            (p / "script.csv").write_text(
                "id,role,voicevox_name,voicevox_style,text,image\n"
                "1,narrator,青山龍星,ノーマル,text,001.png\n",
                encoding="utf-8",
            )
            with self.assertRaises(utils.MangaShortError):
                utils.read_script(p)

    def test_subtitle_falls_back_to_text(self) -> None:
        rows = utils.read_script(ROOT / "sample_project")
        # id 001 は subtitle 空 → text を使う
        self.assertEqual(rows[0].subtitle_text, rows[0].text)
        # id 005 は subtitle 指定あり
        self.assertEqual(rows[4].subtitle_text, "続きはリンクから")


class Test04SubtitleWrap(unittest.TestCase):
    """4. 字幕の自動改行"""

    def test_wraps_on_punctuation(self) -> None:
        lines = subs.wrap_subtitle("今日は先輩と二人きり、とても緊張する。", 16, 2)
        self.assertLessEqual(len(lines), 2)
        for ln in lines:
            self.assertLessEqual(len(ln), 20)  # 多少の超過は許容

    def test_respects_max_lines(self) -> None:
        text = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほ"
        lines = subs.wrap_subtitle(text, 12, 2)
        self.assertEqual(len(lines), 2)

    def test_emoji_stripped(self) -> None:
        cleaned = subs.sanitize_subtitle_text("やった😀🎉ね")
        self.assertNotIn("😀", cleaned)
        self.assertIn("やった", cleaned)

    def test_ass_braces_escaped(self) -> None:
        cleaned = subs.sanitize_subtitle_text("これは{危険}です")
        self.assertNotIn("{", cleaned)
        self.assertNotIn("}", cleaned)


class Test05FilenameSafety(unittest.TestCase):
    """5. ファイル名の安全化"""

    def test_removes_unsafe_chars(self) -> None:
        out = utils.sanitize_filename('a/b:c*d?e"f<g>h|i')
        for ch in '/:*?"<>|':
            self.assertNotIn(ch, out)

    def test_keeps_japanese(self) -> None:
        out = utils.sanitize_filename("自由すぎる職場")
        self.assertEqual(out, "自由すぎる職場")

    def test_voice_filename_format(self) -> None:
        row = utils.ScriptRow(
            id="001",
            role="narrator",
            voicevox_name="青山龍星",
            voicevox_style="ノーマル",
            text="自由すぎる職場の上司との昼休憩",
            image="001.png",
        )
        name = utils.voice_filename(row)
        self.assertTrue(name.startswith("001_青山龍星_"))
        self.assertTrue(name.endswith(".wav"))


class Test06MissingImageWarning(unittest.TestCase):
    """6. 画像不足時の警告"""

    def test_missing_image_reported_not_fatal(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            (root / "images").mkdir()
            (root / "bgm").mkdir()
            (root / "sfx").mkdir()
            (root / "output").mkdir()
            # 1 枚だけ実在させる
            (root / "images" / "ok.png").write_bytes(b"x")
            rows = [
                utils.ScriptRow("001", "narrator", "青山龍星", "ノーマル", "a", "ok.png"),
                utils.ScriptRow("002", "narrator", "青山龍星", "ノーマル", "b", "missing.png"),
            ]
            paths = utils.ProjectPaths.from_root(root)
            report = build_video.validate_materials(rows, paths, utils.DEFAULT_CONFIG)
            self.assertTrue(report.ok)  # 1 枚あるので致命的ではない
            self.assertTrue(any("missing.png" in m for m in report.missing_images))

    def test_all_images_missing_is_fatal(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            for d in ("images", "bgm", "sfx", "output"):
                (root / d).mkdir()
            rows = [
                utils.ScriptRow("001", "narrator", "青山龍星", "ノーマル", "a", "none.png"),
            ]
            paths = utils.ProjectPaths.from_root(root)
            report = build_video.validate_materials(rows, paths, utils.DEFAULT_CONFIG)
            self.assertFalse(report.ok)


class Test07Cache(unittest.TestCase):
    """7. キャッシュ判定（＋モック音声生成）"""

    def test_cache_key_stable_and_sensitive(self) -> None:
        base = dict(
            text="こんにちは",
            speaker_id=1,
            speed=1.0,
            pitch=0.0,
            intonation=1.0,
            volume=1.0,
            pre_phoneme=0.05,
            post_phoneme=0.1,
        )
        k1 = utils.voice_cache_key(**base)
        k2 = utils.voice_cache_key(**base)
        self.assertEqual(k1, k2)  # 同一入力 → 同一キー
        changed = dict(base, text="さようなら")
        self.assertNotEqual(k1, utils.voice_cache_key(**changed))

    def test_second_run_uses_cache(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            paths = utils.ProjectPaths.from_root(root)
            paths.ensure()
            rows = [
                utils.ScriptRow("001", "narrator", "青山龍星", "ノーマル", "テスト文", "001.png"),
            ]
            client = FakeVoicevoxClient()
            r1 = generate_voice.generate_voices(
                rows, utils.DEFAULT_CONFIG, paths, client=client
            )
            self.assertFalse(r1[0].from_cache)
            self.assertEqual(client.synth_calls, 1)
            # 2 回目: synthesis を呼ばずキャッシュ利用
            r2 = generate_voice.generate_voices(
                rows, utils.DEFAULT_CONFIG, paths, client=client
            )
            self.assertTrue(r2[0].from_cache)
            self.assertEqual(client.synth_calls, 1)


class Test08Defaults(unittest.TestCase):
    """8. project.yaml のデフォルト値"""

    def test_missing_yaml_raises(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            with self.assertRaises(utils.MangaShortError):
                utils.load_config(Path(td))

    def test_partial_yaml_is_filled(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            (root / "project.yaml").write_text(
                "project_name: mine\nvideo:\n  fps: 24\n", encoding="utf-8"
            )
            conf = utils.load_config(root)
            self.assertEqual(conf["project_name"], "mine")
            self.assertEqual(conf["video"]["fps"], 24)  # 上書き
            self.assertEqual(conf["video"]["width"], 1080)  # デフォルト補完
            self.assertIn("voicevox", conf)


class Test09FfmpegCommand(unittest.TestCase):
    """9. FFmpeg コマンド生成（純粋関数）"""

    def _row(self, motion: str = "zoom_in", effect: str = "none") -> utils.ScriptRow:
        return utils.ScriptRow(
            "001", "narrator", "青山龍星", "ノーマル", "text", "001.png",
            motion=motion, effect=effect,
        )

    def test_scene_cmd_structure(self) -> None:
        spec = build_video.SceneSpec(
            row=self._row(),
            image_path=Path("/x/001.png"),
            duration=3.0,
            out_path=Path("/x/scene_001.mp4"),
        )
        cmd = build_video.build_scene_cmd("ffmpeg", spec, utils.DEFAULT_CONFIG)
        self.assertEqual(cmd[0], "ffmpeg")
        self.assertIn("-filter_complex", cmd)
        self.assertIn("libx264", cmd)
        self.assertIn("zoompan", " ".join(cmd))
        self.assertIn("-t", cmd)

    def test_fit_modes(self) -> None:
        for mode in ("contain_blur", "cover", "contain_black"):
            f = build_video.build_fit_filter(mode, 1080, 1920, 20, "0:v", "out")
            self.assertIn("[out]", f)
            self.assertIn("scale=1080:1920", f)

    def test_effect_chain_known_and_none(self) -> None:
        self.assertEqual(build_video.build_effect_chain("none", 30, 3.0), "")
        self.assertIn("fade", build_video.build_effect_chain("flash", 30, 3.0))
        self.assertIn("gblur", build_video.build_effect_chain("blur", 30, 3.0))

    def test_preview_resolution(self) -> None:
        spec = build_video.SceneSpec(
            row=self._row(),
            image_path=Path("/x/001.png"),
            duration=3.0,
            out_path=Path("/x/scene_001.mp4"),
        )
        cmd = build_video.build_scene_cmd("ffmpeg", spec, utils.DEFAULT_CONFIG, preview=True)
        joined = " ".join(cmd)
        self.assertIn("540x960", joined)

    def test_final_cmd_has_loudnorm_and_codecs(self) -> None:
        cmd = build_video.build_final_cmd(
            "ffmpeg",
            Path("/x/v.mp4"),
            Path("/x/a.wav"),
            Path("/x/subs.ass"),
            utils.DEFAULT_CONFIG,
            Path("/x/out.mp4"),
        )
        joined = " ".join(cmd)
        self.assertIn("loudnorm", joined)
        self.assertIn("libx264", joined)
        self.assertIn("aac", joined)
        self.assertIn("subtitles", joined)

    def test_scene_duration_not_shorter_than_audio(self) -> None:
        d = build_video.resolve_scene_duration(3.0, 1.0, utils.DEFAULT_CONFIG["editing"])
        self.assertGreaterEqual(d, 3.0)  # override は音声より短くしない
        d2 = build_video.resolve_scene_duration(2.0, 4.0, utils.DEFAULT_CONFIG["editing"])
        self.assertEqual(d2, 4.0)


class Test10ProbeVerification(unittest.TestCase):
    """10. 出力動画の ffprobe 検証（モック JSON）"""

    def _good_info(self) -> Dict[str, Any]:
        return {
            "streams": [
                {
                    "codec_type": "video",
                    "codec_name": "h264",
                    "width": 1080,
                    "height": 1920,
                    "avg_frame_rate": "30/1",
                },
                {"codec_type": "audio", "codec_name": "aac"},
            ],
            "format": {"duration": "58.5"},
        }

    def test_good_output_passes(self) -> None:
        result = utils.verify_output(self._good_info(), file_size=1_000_000)
        self.assertTrue(result.ok, msg=str(result.problems))
        self.assertEqual(result.width, 1080)
        self.assertTrue(result.has_audio)

    def test_wrong_resolution_flagged(self) -> None:
        info = self._good_info()
        info["streams"][0]["width"] = 720
        result = utils.verify_output(info, file_size=1000)
        self.assertFalse(result.ok)
        self.assertTrue(any("解像度" in p for p in result.problems))

    def test_missing_audio_flagged(self) -> None:
        info = self._good_info()
        info["streams"] = [info["streams"][0]]
        result = utils.verify_output(info, file_size=1000)
        self.assertFalse(result.ok)
        self.assertTrue(any("音声トラック" in p for p in result.problems))

    def test_zero_duration_flagged(self) -> None:
        info = self._good_info()
        info["format"]["duration"] = "0"
        result = utils.verify_output(info, file_size=1000)
        self.assertFalse(result.ok)

    def test_parse_fps(self) -> None:
        self.assertEqual(utils.parse_fps("30/1"), 30.0)
        self.assertEqual(utils.parse_fps("30"), 30.0)
        self.assertAlmostEqual(utils.parse_fps("60000/1001"), 59.94, places=2)
        self.assertIsNone(utils.parse_fps(""))


if __name__ == "__main__":
    unittest.main(verbosity=2)
