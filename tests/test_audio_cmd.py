from zukan.audio import (
    build_narration_cmd,
    build_render_cmd,
    _color_arg,
    _is_color,
)
from zukan.models import Bgm, Script, VideoConfig
from zukan.timeline import Segment


def _seg(i, start, end, se=None):
    return Segment(
        index=i, start=start, end=end, text="t", caption="t",
        voice_path=f"voice{i}.wav", se=se,
    )


def test_is_color():
    assert _is_color("#101820")
    assert not _is_color("assets/bg.png")


def test_color_arg():
    assert _color_arg("#101820") == "0x101820"


def test_narration_cmd_basic():
    segs = [_seg(0, 0.0, 1.0), _seg(1, 1.5, 2.5)]
    cmd = build_narration_cmd(segs, total=3.0, out_path="narr.wav", ffmpeg="ffmpeg")
    # 入力が2本
    assert cmd.count("-i") == 2
    assert "voice0.wav" in cmd
    assert "voice1.wav" in cmd
    # filter に adelay と amix が含まれる
    fc = cmd[cmd.index("-filter_complex") + 1]
    assert "adelay=0:all=1" in fc          # 1行目は遅延0ms
    assert "adelay=1500:all=1" in fc       # 2行目は1.5s=1500ms
    assert "amix=inputs=2" in fc
    assert "apad=whole_dur=3.000" in fc
    assert cmd[-1] == "narr.wav"


def test_narration_cmd_includes_se():
    segs = [_seg(0, 0.0, 1.0, se="pon.wav")]
    cmd = build_narration_cmd(segs, total=1.5, out_path="narr.wav")
    # 音声1 + SE1 = 入力2本
    assert cmd.count("-i") == 2
    assert "pon.wav" in cmd
    fc = cmd[cmd.index("-filter_complex") + 1]
    assert "amix=inputs=2" in fc


def _script(output="output/out.mp4", bgm=None, background="#101820"):
    return Script(
        title="t",
        output=output,
        lines=[],
        bgm=bgm,
        video=VideoConfig(background=background, width=1280, height=720, fps=24, tail=1.0),
    )


def test_render_cmd_video_with_color_bg_and_subs():
    cmd = build_render_cmd(
        _script(), narration_path="narr.wav", ass_path="subs.ass", total=5.0,
    )
    fc = cmd[cmd.index("-filter_complex") + 1]
    assert "color=c=0x101820:s=1280x720:r=24" in " ".join(cmd)
    assert "ass=filename='subs.ass'" in fc
    assert "scale=1280:720" in fc
    assert "-c:v" in cmd and "libx264" in cmd
    assert "-c:a" in cmd and "aac" in cmd
    # 尺 = total + tail
    assert "6.000" in cmd


def test_render_cmd_with_bgm_mixes():
    bgm = Bgm(path="bgm.mp3", volume=0.2, loop=True, fade_out=1.0)
    cmd = build_render_cmd(
        _script(bgm=bgm), narration_path="narr.wav", ass_path="subs.ass", total=5.0,
    )
    assert "-stream_loop" in cmd
    assert "bgm.mp3" in cmd
    fc = cmd[cmd.index("-filter_complex") + 1]
    assert "volume=0.2" in fc
    assert "afade=t=out" in fc
    assert "amix=inputs=2" in fc


def test_render_cmd_audio_only_skips_video():
    cmd = build_render_cmd(
        _script(output="output/out.wav"), narration_path="narr.wav",
        ass_path=None, total=5.0,
    )
    # 映像マップ無し
    assert "[v]" not in cmd
    assert "libx264" not in cmd
    fc = cmd[cmd.index("-filter_complex") + 1]
    assert "ass=" not in fc
    assert "pcm_s16le" in cmd
    assert cmd[-1] == "output/out.wav"


def test_render_cmd_image_background():
    cmd = build_render_cmd(
        _script(background="assets/bg.png"), narration_path="narr.wav",
        ass_path="subs.ass", total=3.0,
    )
    assert "-loop" in cmd
    assert "assets/bg.png" in cmd
