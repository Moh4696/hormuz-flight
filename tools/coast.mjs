// (hormuz) OSM coastline helper (refs/osm/coast.json from Overpass, fetched separately).
//   node tools/coast.mjs plot out.jpg mPerPx [lat lon sizeM rotDeg ...]   -> overview with candidate squares
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ways = JSON.parse(readFileSync(ROOT + '/refs/osm/coast.json', 'utf8')).elements.filter((e) => e.type === 'way' && e.tags?.natural === 'coastline').map((e) => e.geometry.map((g) => [g.lat, g.lon]));
export const LAT0 = 26.375, LON0 = 56.48, MLAT = 110574 + 1175 * 0 + 0, MLON = 111320 * Math.cos(LAT0 * Math.PI / 180);
export const toM = ([lat, lon]) => [(lon - LON0) * MLON, (lat - LAT0) * 110800];   // east, north (metres) about LAT0/LON0
if (process.argv[2] === 'plot') {
  const [out, mpp, ...sq] = process.argv.slice(3); const s = +mpp, E0 = -14500, N0 = 10800, W = Math.round(29000 / s), H = Math.round(21500 / s);
  const buf = Buffer.alloc(W * H * 3, 235);
  const px = (e, n) => [Math.round((e - E0) / s), Math.round((N0 - n) / s)];
  const line = (a, b, c, t = 0) => { const [x0, y0] = px(...a), [x1, y1] = px(...b), n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let k = 0; k <= n; k++) for (let dy = -t; dy <= t; dy++) for (let dx = -t; dx <= t; dx++) { const x = Math.round(x0 + (x1 - x0) * k / n) + dx, y = Math.round(y0 + (y1 - y0) * k / n) + dy; if (x >= 0 && y >= 0 && x < W && y < H) { const i = (y * W + x) * 3; buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; } } };
  for (const w of ways) for (let i = 1; i < w.length; i++) line(toM(w[i - 1]), toM(w[i]), [20, 40, 60]);
  for (let e = -14000; e <= 14000; e += 2000) line([e, N0], [e, N0 - 150], [200, 0, 0], 1);   // 2 km ticks
  const cols = [[220, 30, 30], [30, 140, 30], [30, 60, 220], [200, 120, 0]];
  for (let k = 0; k + 3 < sq.length; k += 4) { const [e0, n0] = toM([+sq[k], +sq[k + 1]]), h = +sq[k + 2] / 2, a = +sq[k + 3] * Math.PI / 180, c = cols[(k / 4) % 4];
    const P = [[-h, -h], [h, -h], [h, h], [-h, h]].map(([u, v]) => [e0 + u * Math.cos(a) + v * Math.sin(a), n0 - u * Math.sin(a) + v * Math.cos(a)]);
    for (let i = 0; i < 4; i++) line(P[i], P[(i + 1) % 4], c, 1); line(P[3], P[2], c, 3); }   // thick edge = +z ("far") side
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-i', '-', out], { input: buf, maxBuffer: 1 << 28 });
  if (r.status) throw new Error(String(r.stderr)); console.log('plot', W, H);
}
