import textwrap

import pytest

from zukan.script_loader import ScriptError, load_script


def _write(tmp_path, name, content):
    p = tmp_path / name
    p.write_text(textwrap.dedent(content), encoding="utf-8")
    return str(p)


def test_load_yaml_full(tmp_path):
    path = _write(
        tmp_path,
        "s.yaml",
        """
        title: テスト
        output: out/test.mp4
        defaults:
          speaker: 3
          post_gap: 0.4
        video:
          width: 1280
          height: 720
        bgm:
          path: bgm.mp3
          volume: 0.1
        lines:
          - text: 一行目
          - text: 二行目
            speaker: 1
            speed: 1.2
            se: pon.wav
          - こんにちは
        """,
    )
    script = load_script(path)
    assert script.title == "テスト"
    assert script.output == "out/test.mp4"
    assert len(script.lines) == 3
    # defaults が効いている
    assert script.lines[0].voice.speaker == 3
    assert script.lines[0].post_gap == 0.4
    # 行側の上書き
    assert script.lines[1].voice.speaker == 1
    assert script.lines[1].voice.speed == 1.2
    assert script.lines[1].se == "pon.wav"
    # 文字列だけの行
    assert script.lines[2].text == "こんにちは"
    assert script.video.width == 1280
    assert script.bgm is not None
    assert script.bgm.volume == 0.1


def test_bgm_shorthand(tmp_path):
    path = _write(
        tmp_path, "s.yaml",
        """
        lines:
          - text: あ
        bgm: music.mp3
        """,
    )
    script = load_script(path)
    assert script.bgm is not None
    assert script.bgm.path == "music.mp3"


def test_missing_lines_raises(tmp_path):
    path = _write(tmp_path, "s.yaml", "title: x\n")
    with pytest.raises(ScriptError):
        load_script(path)


def test_empty_text_raises(tmp_path):
    path = _write(
        tmp_path, "s.yaml",
        """
        lines:
          - text: "   "
        """,
    )
    with pytest.raises(ScriptError):
        load_script(path)


def test_missing_file_raises(tmp_path):
    with pytest.raises(ScriptError):
        load_script(str(tmp_path / "nope.yaml"))


def test_load_csv(tmp_path):
    path = _write(
        tmp_path, "s.csv",
        """\
        text,speaker,speed,se,subtitle,post_gap
        一行目,3,1.0,,,0.3
        二行目,1,1.1,pon.wav,字幕,0.5
        """,
    )
    script = load_script(path)
    assert len(script.lines) == 2
    assert script.lines[1].voice.speaker == 1
    assert script.lines[1].voice.speed == 1.1
    assert script.lines[1].se == "pon.wav"
    assert script.lines[1].caption == "字幕"
    assert script.lines[1].post_gap == 0.5
