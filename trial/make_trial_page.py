import re, sys
src, dst, title, color = sys.argv[1:5]
s = open(src).read()
# Akashic の入力処理は、ゲーム座標(例: 横1280)を表示サイズ(縦持ちスマホだと横約390px)と比べて
# 「画面外」と判定してしまう。縦持ちで右側のタップが捨てられるので、この上限チェックだけ外す。
BUG = "e.offsetX<0||e.offsetY<0||e.offsetX>this.inputView.offsetWidth||e.offsetY>this.inputView.offsetHeight"
assert s.count(BUG) == 1, "input bounds check not found"
s = s.replace(BUG, "e.offsetX<0||e.offsetY<0")
scripts = re.findall(r'<script>.*?</script>', s, flags=re.S)
head = f'''<title>{title}</title>
<style>
:root {{ --bg: {color}; --fg: #fff6e4; --chip: rgba(30, 12, 4, 0.72); color-scheme: dark; }}
* {{ margin: 0; border: 0; padding: 0; }}
html, body {{ width: 100%; height: 100%; }}
body {{ overflow: hidden; background: var(--bg); color: var(--fg); font-family: "Hiragino Maru Gothic ProN", "Hiragino Sans", "Noto Sans JP", sans-serif; }}
#container {{ position: absolute; inset: 0; overflow: hidden; touch-action: none; }}
#container canvas {{ background-size: contain; }}
.chip {{ position: fixed; z-index: 10; background: var(--chip); color: var(--fg); border-radius: 999px; font-size: 13px; font-weight: 700; }}
#restart {{ top: calc(env(safe-area-inset-top, 0px) + 6px); left: 50%; transform: translateX(-50%); padding: 6px 14px; cursor: pointer; }}
#restart:focus-visible {{ outline: 2px solid var(--fg); outline-offset: 2px; }}
#turn {{ position: fixed; inset: 0; z-index: 20; display: none; flex-direction: column; align-items: center; justify-content: center; gap: 20px; padding-inline: 24px; background: var(--bg); text-align: center; }}
#turn .phone {{ width: 56px; height: 92px; border: 5px solid var(--fg); border-radius: 12px; animation: turn 2.4s ease-in-out infinite; }}
#turn h1 {{ font-size: 22px; line-height: 1.4; text-wrap: balance; }}
#turn p {{ font-size: 14px; opacity: 0.85; line-height: 1.6; }}
#turn button {{ font: inherit; font-size: 14px; font-weight: 700; color: var(--fg); background: var(--chip); border: 2px solid var(--fg); border-radius: 999px; padding: 10px 22px; cursor: pointer; }}
@keyframes turn {{ 0%, 25% {{ transform: rotate(0deg); }} 55%, 100% {{ transform: rotate(-90deg); }} }}
@media (prefers-reduced-motion: reduce) {{ #turn .phone {{ animation: none; transform: rotate(-90deg); }} }}
@media (orientation: portrait) {{ body:not(.stay) #turn {{ display: flex; }} }}
</style>
'''
body = '''<div id="container"></div>
<button id="restart" class="chip" type="button" onclick="location.reload()">↻ さいしょから</button>
<div id="turn" role="dialog" aria-labelledby="turn-title">
  <div class="phone" aria-hidden="true"></div>
  <h1 id="turn-title">スマホを横向きにして遊んでね</h1>
  <p>縦向きだと画面が小さくて押しにくいです。<br>音が出ます。</p>
  <button id="stay" type="button" onclick="document.body.classList.add('stay')">このまま縦で遊ぶ</button>
</div>
'''
open(dst, 'w').write(head + '\n'.join(scripts) + '\n' + body)
