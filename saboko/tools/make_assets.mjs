import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import ffmpeg from "@ffmpeg-installer/ffmpeg";

const toolDir = dirname(fileURLToPath(import.meta.url));
const python = process.env.PYTHON || "python3";
const result = spawnSync(
	python,
	[join(toolDir, "make_assets.py"), "--ffmpeg", ffmpeg.path],
	{ stdio: "inherit" }
);

if (result.status !== 0) process.exit(result.status || 1);
