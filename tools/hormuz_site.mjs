// (hormuz) Builds tools/hormuz_site.json: the real site (Ras Musandam / Fakk al Asad, northern tip of the Musandam
// peninsula, Strait of Hormuz) in engine world coordinates: OSM coastline loops + a coarse real-elevation grid.
//   node tools/hormuz_site.mjs [info]
import { writeFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ways, toM, LAT0, LON0 } from './coast.mjs';
const DIR = path.dirname(fileURLToPath(import.meta.url));
export const SITE = { CE: 3500, CN: -1700, flipX: +(process.env.FLIPX ?? 1) };   // window centre (m east / north of LAT0, LON0)
const RECT = [-3200, -3200, 6400];   // 6.4 km world centred on the origin: x east, z north
const toW = (ll) => { const [e, n] = toM(ll); return [SITE.flipX * (e - SITE.CE), n - SITE.CN + RECT[1] + RECT[2] / 2]; };
// join OSM ways into chains
const key = (p) => p[0].toFixed(7) + ',' + p[1].toFixed(7);
let chains = ways.map((w) => w.slice());
for (let merged = true; merged;) { merged = false;
  outer: for (let i = 0; i < chains.length; i++) for (let j = 0; j < chains.length; j++) { if (i === j) continue;
    const a = chains[i], b = chains[j];
    if (key(a[a.length - 1]) === key(b[0]) && key(a[0]) !== key(a[a.length - 1])) { chains[i] = a.concat(b.slice(1)); chains.splice(j, 1); merged = true; break outer; } } }
const info = chains.map((c) => { const w = c.map(toW); const xs = w.map((p) => p[0]), zs = w.map((p) => p[1]);
  return { n: c.length, closed: key(c[0]) === key(c[c.length - 1]), bb: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)].map(Math.round), a: w[0].map(Math.round), b: w[w.length - 1].map(Math.round), w }; });
if (process.argv[2] === 'info') { for (const c of info) console.log(c.n, c.closed ? 'closed' : 'OPEN  ', 'bbox', c.bb.join(' '), c.closed ? '' : 'ends ' + c.a + ' -> ' + c.b); }
export { info, RECT, toW };
if (process.argv[2] !== 'info') {
  // Douglas-Peucker; fine inside the window (+1.5 km), coarse far away
  const dp = (pts, tol) => { if (pts.length < 3) return pts; const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const st = [[0, pts.length - 1]];
    while (st.length) { const [a, b] = st.pop(); let m = 0, mi = -1; const [ax, az] = pts[a], [bx, bz] = pts[b], dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1e-9;
      for (let i = a + 1; i < b; i++) { const d = l < 1e-6 ? Math.hypot(pts[i][0] - ax, pts[i][1] - az) : Math.abs((pts[i][0] - ax) * dz - (pts[i][1] - az) * dx) / l; if (d > m) { m = d; mi = i; } }
      if (m > tol) { keep[mi] = 1; st.push([a, mi], [mi, b]); } }
    return pts.filter((_, i) => keep[i]); };
  const M = 1500, near = (p) => p[0] > RECT[0] - M && p[0] < RECT[0] + RECT[2] + M && p[1] > RECT[1] - M && p[1] < RECT[1] + RECT[2] + M;
  const simplify = (w) => { const out = []; let run = [w[0]], rn = near(w[0]);
    for (let i = 1; i < w.length; i++) { const nn = near(w[i]); run.push(w[i]); if (nn !== rn || i === w.length - 1) { const s = dp(run, rn ? 1.5 : 250); out.push(...(out.length ? s.slice(1) : s)); run = [w[i]]; rn = nn; } }
    return out; };
  const loops = [];
  for (const c of info) {
    if (c.bb[2] < RECT[0] - 6000 || c.bb[0] > RECT[0] + RECT[2] + 6000 || c.bb[3] < RECT[1] - 6000 || c.bb[1] > RECT[1] + RECT[2] + 6000) continue;
    let w = simplify(c.w); if (c.closed) w = w.slice(0, -1); else w = w.concat([[-60000 * SITE.flipX, -60000]]);   // mainland: close far to the south-west
    if (!c.closed) {   // mainland: cut it at x = -2200 so it leaves the world through the south edge only (no smeared plateau to the west)
      const X = RECT[0] + 200, out = [];
      for (let i = 0; i < w.length; i++) { const a = w[i], b = w[(i + 1) % w.length], ia = a[0] >= X, ib = b[0] >= X;
        if (ia) out.push(a); if (ia !== ib) { const t = (X - a[0]) / (b[0] - a[0]); out.push([X, a[1] + (b[1] - a[1]) * t]); } }
      w = out;
    }
    if (w.length >= 3) loops.push(w.flat().map((v) => Math.round(v * 10) / 10));
  }
  const lat = LAT0 + SITE.CN / 110800, lon = LON0 + SITE.CE / (111320 * Math.cos(LAT0 * Math.PI / 180)), N = Math.round(RECT[2] / 30);
  const r = spawnSync('node', [DIR + '/dem.mjs', 'crop', '13', '5378', '5383', '3471', '3475', String(lat), String(lon), String(RECT[2]), '0', String(N), DIR + '/../refs/site_dem.json', DIR + '/../refs/site_dem.jpg'], { encoding: 'utf8' });
  console.log(r.stdout.trim(), r.stderr.trim());
  let dem = JSON.parse(readFileSync(DIR + '/../refs/site_dem.json', 'utf8')).h;
  { // priority-flood depression filling: every land cell drains to the sea (closed basins in the 30 m data made the
    // engine's erosion pass pile up a tower). eps = 0.25 m per cell keeps a slight fall across the filled flats.
    const heap = [], push = (v, i) => { heap.push([v, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { let m = k; const l = 2 * k + 1, r = l + 1; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    const done = new Uint8Array(N * N); let raised = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = j * N + i; if (dem[k] <= 0.5 || i === 0 || j === 0 || i === N - 1 || j === N - 1) { done[k] = 1; push(dem[k], k); } }
    while (heap.length) { const [v, k] = pop(), i = k % N, j = (k - i) / N;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= N || b >= N) continue; const q = b * N + a; if (done[q]) continue; done[q] = 1;
        if (dem[q] < v + 0.25) { dem[q] = v + 0.25; raised++; } push(dem[q], q); } }
    console.log('depression fill raised', raised, 'cells');
  }
  if (SITE.flipX < 0) { const f = new Array(N * N); for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) f[j * N + i] = dem[j * N + N - 1 - i]; dem = f; }
  writeFileSync(DIR + '/hormuz_site.json', JSON.stringify({ lat, lon, flipX: SITE.flipX, rect: RECT, loops, demN: N, dem }));
  console.log('site: centre', lat.toFixed(5), lon.toFixed(5), '| loops', loops.length, 'segments', loops.reduce((a, l) => a + l.length / 2, 0), '| json bytes', JSON.stringify({ loops, dem }).length);
}
