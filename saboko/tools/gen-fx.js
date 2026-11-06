// エフェクトやUIの画像を作る(星・キラキラ・けむり・輪・穴の看板・吹き出し・影・汗・集中線・赤いふち)
// 使い方: node tools/gen-fx.js
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "image");

function build() {
	const out = {};
	const mk = (w, h, draw) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.lineJoin = "round"; draw(x, w, h); return c.toDataURL("image/png"); };
	const star = (x, cx, cy, r1, r2, n) => {
		x.beginPath();
		for (let k = 0; k < n * 2; k++) { const a = k / (n * 2) * Math.PI * 2 - Math.PI / 2, r = k % 2 ? r2 : r1; x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
		x.closePath();
	};
	out.fx_star = mk(48, 48, (x) => { star(x, 24, 24, 22, 10, 5); x.fillStyle = "#ffe14a"; x.fill(); x.lineWidth = 3; x.strokeStyle = "#c8781a"; x.stroke(); });
	out.fx_spark = mk(32, 32, (x) => {
		const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,240,180,0)");
		star(x, 16, 16, 16, 3, 4); x.fillStyle = g; x.fill();
	});
	out.fx_dust = mk(48, 48, (x) => {
		const g = x.createRadialGradient(24, 24, 2, 24, 24, 22); g.addColorStop(0, "rgba(230,220,200,0.9)"); g.addColorStop(1, "rgba(200,190,170,0)");
		x.fillStyle = g; x.beginPath(); x.arc(24, 24, 22, 0, Math.PI * 2); x.fill();
	});
	out.fx_ring = mk(128, 128, (x) => { x.beginPath(); x.arc(64, 64, 58, 0, Math.PI * 2); x.lineWidth = 8; x.strokeStyle = "rgba(255,255,255,0.95)"; x.stroke(); });
	out.fx_candy = mk(40, 40, (x) => { star(x, 20, 20, 18, 8, 4); x.fillStyle = "#ff8ad8"; x.fill(); });
	out.shadow = mk(160, 40, (x) => { x.fillStyle = "rgba(0,0,0,0.35)"; x.beginPath(); x.ellipse(80, 20, 78, 18, 0, 0, Math.PI * 2); x.fill(); });
	out.sweat = mk(30, 40, (x) => {
		x.beginPath(); x.moveTo(15, 2); x.quadraticCurveTo(28, 24, 15, 38); x.quadraticCurveTo(2, 24, 15, 2);
		x.fillStyle = "#8ad8ff"; x.fill(); x.lineWidth = 3; x.strokeStyle = "#2a6aa8"; x.stroke();
		x.fillStyle = "#ffffff"; x.beginPath(); x.ellipse(11, 24, 3, 5, 0, 0, Math.PI * 2); x.fill();
	});
	out.speedline = mk(320, 8, (x) => { const g = x.createLinearGradient(0, 0, 320, 0); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(255,255,255,0.85)"); x.fillStyle = g; x.fillRect(0, 2, 320, 4); });
	out.vignette = mk(1280, 720, (x) => {
		const g = x.createRadialGradient(640, 360, 300, 640, 360, 760); g.addColorStop(0, "rgba(255,0,40,0)"); g.addColorStop(1, "rgba(255,0,40,0.75)");
		x.fillStyle = g; x.fillRect(0, 0, 1280, 720);
	});
	// 穴の看板
	out.warn_hole = mk(170, 120, (x) => {
		x.fillStyle = "#6a4020"; x.fillRect(78, 60, 14, 60);
		x.beginPath(); x.moveTo(85, 4); x.lineTo(160, 74); x.lineTo(10, 74); x.closePath();
		x.fillStyle = "#ffd030"; x.fill(); x.lineWidth = 7; x.strokeStyle = "#2a1a10"; x.stroke();
		x.font = "bold 46px IPAGothic"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = "#e01a1a"; x.fillText("!", 85, 50);
		x.font = "bold 22px IPAGothic"; x.fillStyle = "#ffffff"; x.lineWidth = 6; x.strokeStyle = "#2a1a10"; x.strokeText("穴", 85, 100); x.fillText("穴", 85, 100);
	});
	// 吹き出し(しっぽ左下・右下)
	const bubble = (tailRight) => mk(360, 130, (x) => {
		x.beginPath(); x.moveTo(30, 6); x.arcTo(354, 6, 354, 96, 26); x.arcTo(354, 96, 6, 96, 26);
		const tx = tailRight ? 290 : 70;
		x.lineTo(tx + 26, 96); x.lineTo(tx + (tailRight ? 30 : -14), 126); x.lineTo(tx, 96);
		x.arcTo(6, 96, 6, 6, 26); x.arcTo(6, 6, 354, 6, 26); x.closePath();
		x.fillStyle = "#ffffff"; x.fill(); x.lineWidth = 6; x.strokeStyle = "#2a1a30"; x.stroke();
	});
	out.bubble_l = bubble(false); out.bubble_r = bubble(true);
	// 突進の予告ライン
	out.dash_lane = mk(64, 64, (x) => {
		x.fillStyle = "rgba(255,40,60,0.55)"; x.fillRect(0, 0, 64, 64);
		x.fillStyle = "rgba(255,230,60,0.8)"; x.beginPath(); x.moveTo(10, 8); x.lineTo(40, 32); x.lineTo(10, 56); x.lineTo(24, 32); x.closePath(); x.fill();
	});
	return out;
}

(async () => {
	const b = await chromium.launch();
	const p = await b.newPage();
	const res = await p.evaluate(build);
	await b.close();
	Object.keys(res).forEach((k) => fs.writeFileSync(path.join(OUT, k + ".png"), Buffer.from(res[k].split(",")[1], "base64")));
	console.log("wrote", Object.keys(res).length, "images");
})();
