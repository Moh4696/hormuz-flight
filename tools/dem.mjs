// (hormuz) Real-elevation helper. Reads Terrarium PNG tiles (refs/dem/z{z}_{x}_{y}.png, fetched separately) and
//   node tools/dem.mjs map  z x0 x1 y0 y1 out.jpg            -> shaded relief map of the stitched tiles
//   node tools/dem.mjs crop z x0 x1 y0 y1 lat lon sizeM rotDeg N out.json [out.jpg]
//        -> N x N height grid (metres) of a sizeM square centred on lat/lon, rotated rotDeg (clockwise from north-up)
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../refs/dem');
const [mode, Z, X0, X1, Y0, Y1, ...rest] = process.argv.slice(2);
const z = +Z, x0 = +X0, x1 = +X1, y0 = +Y0, y1 = +Y1, T = 256;
const W = (x1 - x0 + 1) * T, H = (y1 - y0 + 1) * T, hgt = new Float32Array(W * H);
for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', `${DIR}/z${z}_${tx}_${ty}.png`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 26 });
  if (r.status) throw new Error('tile ' + tx + ',' + ty + ': ' + r.stderr);
  const b = r.stdout;
  for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) { const k = (j * T + i) * 3; hgt[((ty - y0) * T + j) * W + (tx - x0) * T + i] = b[k] * 256 + b[k + 1] + b[k + 2] / 256 - 32768; }
}
const n = 2 ** z;
const lon2px = (lon) => ((lon + 180) / 360 * n - x0) * T;
const lat2px = (lat) => ((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * n - y0) * T;
const px2lon = (px) => (px / T + x0) / n * 360 - 180;
const px2lat = (py) => Math.atan(Math.sinh(Math.PI * (1 - 2 * (py / T + y0) / n))) * 180 / Math.PI;
const samp = (fx, fy) => { fx = Math.min(Math.max(fx, 0), W - 1.001); fy = Math.min(Math.max(fy, 0), H - 1.001); const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
  return (hgt[j * W + i] * (1 - u) + hgt[j * W + i + 1] * u) * (1 - v) + (hgt[(j + 1) * W + i] * (1 - u) + hgt[(j + 1) * W + i + 1] * u) * v; };
function relief(get, w, h, cell, out, marks = []) {
  const buf = Buffer.alloc(w * h * 3);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const e = get(i, j), dx = (get(i + 1, j) - get(i - 1, j)) / (2 * cell), dy = (get(i, j + 1) - get(i, j - 1)) / (2 * cell);
    let c;
    if (e <= 0.5) { const d = Math.min(1, -e / 80); c = [30 - 20 * d, 110 - 60 * d, 150 - 50 * d]; }
    else { const sh = Math.min(1.25, Math.max(0.25, 0.75 - (dx * -0.7 + dy * -0.7) * 0.9)), t = Math.min(1, e / 1200); c = [(150 + 90 * t) * sh, (125 + 95 * t) * sh, (90 + 110 * t) * sh]; }
    for (const [mx, my, r] of marks) { const q = Math.max(Math.abs(i - mx), Math.abs(j - my)); if (q <= r && q >= r - 1) c = [255, 30, 30]; }
    const k = (j * w + i) * 3; buf[k] = Math.min(255, c[0]); buf[k + 1] = Math.min(255, c[1]); buf[k + 2] = Math.min(255, c[2]);
  }
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${w}x${h}`, '-i', '-', out], { input: buf, maxBuffer: 1 << 28 });
  if (r.status) throw new Error(String(r.stderr));
}
const mPerPx = 40075016.686 * Math.cos(px2lat(H / 2) * Math.PI / 180) / n / T;
if (mode === 'map') {
  const marks = []; for (let k = 1; k < rest.length; k += 3) marks.push([lon2px(+rest[k + 1]), lat2px(+rest[k]), +rest[k + 2] / mPerPx / 2]);
  relief((i, j) => samp(i, j), W, H, mPerPx, rest[0], marks);
  let mx = -1e9; for (const v of hgt) mx = Math.max(mx, v);
  console.log(`map ${W}x${H}, ${mPerPx.toFixed(1)} m/px, lon ${px2lon(0).toFixed(4)}..${px2lon(W).toFixed(4)}, lat ${px2lat(H).toFixed(4)}..${px2lat(0).toFixed(4)}, max ${mx.toFixed(0)} m`);
} else {
  const [lat, lon, sizeM, rot, N, outJson, outJpg] = rest; const S = +sizeM, G = +N, a = +rot * Math.PI / 180, cx = lon2px(+lon), cy = lat2px(+lat);
  const g = new Float32Array(G * G); let mx = -1e9, mn = 1e9, land = 0;
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {   // grid: i -> +x (east when rot=0), j -> +z (north when rot=0)
    const u = ((i + .5) / G - .5) * S, v = ((j + .5) / G - .5) * S, e = u * Math.cos(a) + v * Math.sin(a), nn = -u * Math.sin(a) + v * Math.cos(a);
    const hh = samp(cx + e / mPerPx, cy - nn / mPerPx); g[j * G + i] = hh; mx = Math.max(mx, hh); mn = Math.min(mn, hh); if (hh > 0.5) land++;
  }
  writeFileSync(outJson, JSON.stringify({ lat: +lat, lon: +lon, sizeM: S, rot: +rot, N: G, h: Array.from(g, (v) => Math.round(v)) }));
  if (outJpg) relief((i, j) => g[Math.min(G - 1, Math.max(0, G - 1 - j)) * G + Math.min(G - 1, Math.max(0, i))], G, G, S / G, outJpg);
  console.log(`crop ${G}x${G}, ${(S / G).toFixed(1)} m/cell, height ${mn.toFixed(0)}..${mx.toFixed(0)} m, land ${(100 * land / G / G).toFixed(0)} %`);
}
if (process.env.PROBE) for (const s of process.env.PROBE.split(';')) { const [la, lo] = s.split(',').map(Number); console.log('probe', la, lo, samp(lon2px(lo), lat2px(la)).toFixed(1)); }
if (process.env.HIST) { const hs = {}; for (const v of hgt) if (v > -6 && v < 8) { const k = Math.round(v); hs[k] = (hs[k] || 0) + 1; } console.log('hist', JSON.stringify(hs)); }
