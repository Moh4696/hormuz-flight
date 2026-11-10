// (hormuz) Final render in crash-safe segments, then one lossless join.
//   node tools/render_final.mjs            -> out/hormuz_flight_1080p.mp4 (1920x1080, 30 fps, 4 samples per frame, SPEED=3)
// A segment that already exists with the right frame count is skipped, so the script can simply be run again after a crash.
import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);
const W = +(process.env.W || 1920), H = +(process.env.H || 1080), FPS = 30, SPP = +(process.env.SPP || 4), SPEED = 3;
const TOTAL = +(process.env.TOTAL || 57.5), SEG = +(process.env.SEG || 5), DIR = process.env.OUTDIR || 'out/final', OUT = process.env.OUT || 'out/hormuz_flight_1080p.mp4';
mkdirSync(DIR, { recursive: true });
const log = (s) => { const l = `[${new Date().toISOString().slice(11, 19)}] ${s}`; console.log(l); appendFileSync(DIR + '/render.log', l + '\n'); };
const frames = (f) => { const r = spawnSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', f], { encoding: 'utf8' }); return +r.stdout.trim() || 0; };
const segs = [];
for (let t0 = 0, i = 0; t0 < TOTAL - 1e-6; t0 += SEG, i++) segs.push({ i, t0, t1: Math.min(t0 + SEG, TOTAL), f: `${DIR}/seg_${String(i).padStart(2, '0')}.mp4` });
const T = Date.now();
for (const s of segs) {
  const want = Math.round(s.t1 * FPS) - Math.round(s.t0 * FPS);
  for (let attempt = 0; attempt < 4; attempt++) {
    if (existsSync(s.f) && frames(s.f) === want) { log(`segment ${s.i + 1}/${segs.length} ok (${want} frames)`); break; }
    rmSync(s.f, { force: true });
    log(`segment ${s.i + 1}/${segs.length}: ${s.t0}-${s.t1} s, attempt ${attempt + 1}`);
    const r = spawnSync('node', ['tools/video.mjs', s.f, String(W), String(H), String(FPS), String(SPP), 'hud=0'],
      { env: { ...process.env, SPEED: String(SPEED), T0: String(s.t0), T1: String(s.t1), GPU_COOLDOWN_MS: '4000' }, stdio: ['ignore', 'inherit', 'inherit'] });   // progress lines go straight to this script's output
    if (attempt === 3 && !(existsSync(s.f) && frames(s.f) === want)) { log(`segment ${s.i + 1} FAILED after 4 attempts`); process.exit(1); }
  }
}
writeFileSync(DIR + '/list.txt', segs.map((s) => `file '${path.resolve(s.f)}'`).join('\n') + '\n');
const c = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', DIR + '/list.txt', '-c', 'copy', '-movflags', '+faststart', OUT], { encoding: 'utf8' });
if (c.status) { log('JOIN FAILED ' + c.stderr); process.exit(1); }
log(`done: ${OUT}, ${frames(OUT)} frames, ${((Date.now() - T) / 3600000).toFixed(2)} h`);
