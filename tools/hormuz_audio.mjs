// (hormuz) Natural soundscape for the flight, synthesised from the scene itself: no recordings, no music.
//   node tools/hormuz_audio.mjs [out.wav]      -> out/hormuz_audio.wav (48 kHz stereo float)
// Everything is driven by the picture's own data: the camera path (hormuz_flight.cjs), the ship tracks (hormuz_post.cjs)
// and the coastline (hormuz_site.json). Height sets how much sea you hear, distance to the coast sets the surf,
// distance and bearing to each ship set its level and stereo position.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] || path.join(ROOT, 'out/hormuz_audio.wav');
const SR = 48000, DUR = +(process.env.TOTAL || 57.5), SPEED = 3, N = Math.round(SR * DUR), CR = 100, NC = Math.round(DUR * CR) + 1;

// ---------- scene: camera, ships, coast (same maths as the renderer) ----------
const CINE = require('./hormuz_flight.cjs');
function pchip(ts, ys) {
  const n = ts.length, d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (ts[i + 1] - ts[i]));
  m[0] = d[0]; m[n - 1] = 0;
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else { const w1 = 2 * (ts[i + 1] - ts[i]) + (ts[i] - ts[i - 1]), w2 = (ts[i + 1] - ts[i]) + 2 * (ts[i] - ts[i - 1]); m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
  }
  return (t) => {
    t = Math.min(Math.max(t, ts[0]), ts[n - 1]);
    let i = 0; while (i < n - 2 && t >= ts[i + 1]) i++;
    const hh = ts[i + 1] - ts[i], u = (t - ts[i]) / hh, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * ys[i] + (u3 - 2 * u2 + u) * hh * m[i] + (-2 * u3 + 3 * u2) * ys[i + 1] + (u3 - u2) * hh * m[i + 1];
  };
}
const T = CINE.map((k) => k[0]), col = (i) => pchip(T, CINE.map((k) => k[i]));
const CS = { x: col(1), y: col(2), z: col(3), lx: col(4), lz: col(6) };
const cam = (tv) => { const tf = tv * SPEED; return { x: CS.x(tf), y: CS.y(tf), z: CS.z(tf), lx: CS.lx(tf), lz: CS.lz(tf) }; };
// ship tracks are read out of the render patch so sound and picture can never drift apart
const post = readFileSync(path.join(ROOT, 'tools/hormuz_post.cjs'), 'utf8');
const SHIPS = [...post.slice(post.indexOf('const HZ_SHIPS = ['), post.indexOf('const HZ_TS')).matchAll(/\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\]/g)].map((m) => m.slice(1, 6).map(Number));
if (SHIPS.length < 4) throw new Error('could not read HZ_SHIPS from hormuz_post.cjs');
const HL = [166, 70.5, 8.5];   // half lengths: tanker, frigate, patrol boat (hormuz_ships.glsl)
const site = JSON.parse(readFileSync(path.join(ROOT, 'tools/hormuz_site.json'), 'utf8'));
const SEG = [];
for (const lp of site.loops) for (let i = 0; i + 3 < lp.length; i += 2) {
  const ax = lp[i], az = lp[i + 1], bx = lp[i + 2], bz = lp[i + 3], mx = (ax + bx) / 2, mz = (az + bz) / 2, len = Math.hypot(bx - ax, bz - az);
  if (mx < -2990 || mz < -3190 || len > 400) continue;   // skip the artificial closing edges outside the world
  SEG.push(mx, mz, len);
}

// control-rate analysis of the flight
const c = { y: new Float32Array(NC), surf: new Float32Array(NC), surfPan: new Float32Array(NC), spd: new Float32Array(NC) };
const shipC = SHIPS.map(() => ({ d: new Float32Array(NC), pan: new Float32Array(NC), vr: new Float32Array(NC) }));
for (let k = 0; k < NC; k++) {
  const tv = k / CR, p = cam(tv), q = cam(tv + 0.02);
  let fx = p.lx - p.x, fz = p.lz - p.z; const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
  const rx = fz, rz = -fx;                                       // camera right (x east, z north)
  c.y[k] = p.y; c.spd[k] = Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z) / 0.02;
  let S = 0, P = 0; const d0 = 60;
  for (let i = 0; i < SEG.length; i += 3) {
    const dx = SEG[i] - p.x, dz = SEG[i + 1] - p.z, h2 = dx * dx + dz * dz, w = SEG[i + 2] / (h2 + p.y * p.y + d0 * d0);
    S += w; P += w * (dx * rx + dz * rz) / (Math.sqrt(h2) + 30);
  }
  c.surf[k] = Math.min(1, S * d0 / Math.PI); c.surfPan[k] = S > 0 ? P / S : 0;   // a long straight shore at distance D gives d0/sqrt(D^2+d0^2)
  SHIPS.forEach(([ty, x0, z0, hd, v], s) => {
    const h = hd * Math.PI / 180, hx = Math.sin(h), hz = Math.cos(h), sx = x0 + hx * v * tv, sz = z0 + hz * v * tv;
    const along = Math.max(-HL[ty], Math.min(HL[ty], (p.x - sx) * hx + (p.z - sz) * hz)), nx = sx + hx * along - p.x, nz = sz + hz * along - p.z;
    const hd2 = Math.hypot(nx, nz); shipC[s].d[k] = Math.hypot(hd2, p.y - (ty === 0 ? 14 : ty === 1 ? 8 : 1));
    shipC[s].pan[k] = (nx * rx + nz * rz) / (hd2 + 25);
  });
}
for (const s of shipC) for (let k = 0; k < NC; k++) s.vr[k] = (s.d[Math.min(k + 1, NC - 1)] - s.d[Math.max(k - 1, 0)]) * CR / 2;
const smooth = (a, n) => { const o = new Float32Array(a.length); let acc = 0; for (let i = 0; i < a.length; i++) { acc += a[i]; if (i >= n) acc -= a[i - n]; o[i] = acc / Math.min(i + 1, n); } return o; };

// ---------- dsp helpers ----------
let seed = 20261110;
const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const white = () => { const a = new Float32Array(N); for (let i = 0; i < N; i++) a[i] = rnd() * 2 - 1; return a; };
// pink noise (Kellet filter): the sea rolls off toward the highs, plain white noise sounds like static
const pink = () => { const a = new Float32Array(N); let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < N; i++) { const w = rnd() * 2 - 1; b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; a[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.22; b6 = w * 0.115926; }
  return a; };
const up = (ctl, f = (v) => v) => { const o = new Float32Array(N); for (let i = 0; i < N; i++) { const u = i * CR / SR, k = Math.min(u | 0, NC - 2), w = u - k; o[i] = f(ctl[k] * (1 - w) + ctl[k + 1] * w); } return o; };
const val = (a, i) => (typeof a === 'number' ? a : a[i]);
// state-variable filter (TPT form), cutoff may be an audio-rate array; type: 'lp' | 'bp' | 'hp'
function svf(x, fc, Q, type) {
  const o = new Float32Array(N); let ic1 = 0, ic2 = 0, g = 0, k = 1 / Q, a1 = 0, a2 = 0, a3 = 0, last = -1;
  for (let i = 0; i < N; i++) {
    const f = val(fc, i);
    if (f !== last) { g = Math.tan(Math.PI * Math.min(f, SR * 0.45) / SR); a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2; last = f; }
    const v3 = x[i] - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2;
    o[i] = type === 'lp' ? v2 : type === 'bp' ? v1 : x[i] - k * v1 - v2;
  }
  return o;
}
// slow random wander between lo and hi (smoothed random walk), for gusts and drifting filters
function wander(rate, lo, hi) {
  const o = new Float32Array(N), step = Math.round(SR / rate); let a = rnd(), b = rnd();
  for (let i = 0; i < N; i++) { const u = (i % step) / step; if (i % step === 0) { a = b; b = rnd(); } const s = u * u * (3 - 2 * u); o[i] = lo + (hi - lo) * (a + (b - a) * s); }
  return o;
}
// envelope made of wave events: smooth rise, long fall
function events(o, t0, t1, gap, atk, dec, amp) {
  let t = t0 + rnd() * gap[1];
  while (t < t1) {
    const a = atk[0] + rnd() * (atk[1] - atk[0]), d = dec[0] + rnd() * (dec[1] - dec[0]), A = amp[0] + rnd() * (amp[1] - amp[0]);
    const i0 = Math.max(0, Math.round(t * SR)), i1 = Math.min(N, Math.round((t + a + d * 3) * SR));
    for (let i = i0; i < i1; i++) { const u = i / SR - t; o[i] += A * (u < a ? Math.sin(Math.PI / 2 * u / a) ** 2 : Math.exp(-(u - a) / (d / 2.2))); }
    t += gap[0] + rnd() * (gap[1] - gap[0]);
  }
  return o;
}
const L = new Float32Array(N), R = new Float32Array(N);
// add a mono source to the mix with gain and pan (numbers or audio-rate arrays), equal-power panning
const METER = {}, BIN = 2.5;
function add(x, gain, pan, tag = 'other') {
  const m = METER[tag] || (METER[tag] = new Float64Array(Math.ceil(DUR / BIN)));
  for (let i = 0; i < N; i++) { m[Math.min(m.length - 1, (i / SR / BIN) | 0)] += (x[i] * val(gain, i)) ** 2; const g = val(gain, i); if (g === 0) continue; const p = Math.max(-1, Math.min(1, val(pan, i))) * 0.5 + 0.5, s = x[i] * g; L[i] += s * Math.cos(p * Math.PI / 2); R[i] += s * Math.sin(p * Math.PI / 2); }
}
const mul = (a, b) => { const o = new Float32Array(N); for (let i = 0; i < N; i++) o[i] = a[i] * val(b, i); return o; };

// ---------- controls at audio rate ----------
const ySm = smooth(c.y, 30), alt = up(ySm);
const seaG = up(ySm, (y) => 0.35 + 0.65 / (1 + (y / 95) ** 2));            // how much open sea reaches the camera
const lowG = up(ySm, (y) => 1 / (1 + (y / 16) ** 2));            // close water detail, only when skimming
const seaCut = up(ySm, (y) => 2000 + 5900 / (1 + (y / 70) ** 2)); // height dulls the sea
const surfG = up(smooth(c.surf, 40)), surfPan = up(smooth(c.surfPan, 40), (p) => p * 0.9);
const spd = up(smooth(c.spd, 50));
const windG = new Float32Array(N); for (let i = 0; i < N; i++) windG[i] = (0.25 + 0.75 * (1 - Math.exp(-alt[i] / 220))) * (0.55 + 0.45 * Math.min(spd[i] / 170, 1.2));

// ---------- 1. open sea: a steady bed plus slow overlapping swells ----------
for (const side of [-0.55, 0.55]) {                               // two decorrelated beds for width
  const bed = svf(svf(pink(), seaCut, 0.6, 'lp'), 110, 0.7, 'hp');
  add(mul(bed, wander(0.35, 0.7, 1.0)), mul(seaG, 0.16), side, 'sea');
  add(svf(white(), 150, 0.8, 'lp'), mul(seaG, 0.09), side * 0.4, 'sea');   // deep body of the water
}
for (let v = 0; v < 5; v++) {                                     // swells rolling past, each with its own colour and place
  const fc = 260 + rnd() * 1500, env = events(new Float32Array(N), -5, DUR, [3.6, 7.5], [0.8, 1.6], [1.6, 3.2], [0.3, 1.0]);
  const x = svf(svf(pink(), fc, 0.7, 'bp'), seaCut, 0.7, 'lp');
  add(mul(x, env), mul(seaG, 0.75), -0.8 + 1.6 * rnd(), 'swell');
}
// ---------- 2. close chop: small slaps and hiss when the camera skims the surface ----------
for (let v = 0; v < 4; v++) {
  const env = events(new Float32Array(N), -1, DUR, [0.25, 1.1], [0.03, 0.09], [0.10, 0.35], [0.3, 1.0]);
  add(mul(svf(white(), 900 + rnd() * 2200, 1.6, 'bp'), env), mul(lowG, 0.085), -0.9 + 1.8 * rnd(), 'chop');
}
add(mul(svf(white(), 3200, 0.7, 'hp'), wander(1.3, 0.5, 1.0)), mul(lowG, 0.035), 0, 'chop');
// ---------- 3. surf on the cliffs: a low thump, then a long hiss that drains away ----------
for (let v = 0; v < 3; v++) {
  const gap = [4.2, 7.5], hiss = events(new Float32Array(N), -6 + v * 2, DUR, gap, [0.5, 1.0], [2.2, 3.8], [0.6, 1.0]);
  const thump = new Float32Array(N); for (let i = 1; i < N; i++) thump[i] = Math.max(0, hiss[i] - hiss[i - 1]) * SR * 0.9;   // energy on the rising edge only
  const thumpS = svf(thump, 3, 0.7, 'lp');
  const pan = new Float32Array(N), off = -0.35 + 0.35 * v; for (let i = 0; i < N; i++) pan[i] = surfPan[i] + off * 0.6;
  add(mul(svf(pink(), wander(0.5, 1300, 2600), 0.6, 'hp'), hiss), mul(surfG, 0.85), pan, 'surf');
  add(mul(svf(pink(), 420, 0.9, 'bp'), hiss), mul(surfG, 0.55), pan, 'surf');
  add(mul(svf(white(), 120, 0.9, 'lp'), thumpS), mul(surfG, 0.5), pan, 'surf');
}
// ---------- 4. wind: soft, gusting, stronger with height and speed ----------
for (const side of [-0.6, 0.6]) {
  const w = svf(pink(), wander(0.45, 300, 900), 0.9, 'lp');
  add(mul(svf(w, 70, 0.7, 'hp'), wander(0.6, 0.55, 1.0)), mul(windG, 0.28), side, 'wind');
  add(mul(svf(white(), wander(0.3, 900, 1700), 3.0, 'bp'), wander(0.8, 0.2, 1.0)), mul(windG, 0.022), -side, 'wind');   // faint airy whistle
}
// ---------- 5. ships: engine rumble and bow wash, placed where the ship is on screen ----------
SHIPS.forEach(([ty], s) => {
  const d = shipC[s].d; let dmin = 1e9; for (let k = 0; k < NC; k++) dmin = Math.min(dmin, d[k]);
  if (dmin > 1500) return;                                         // the far tanker is never heard
  const ref = ty === 2 ? 70 : 90, gain = up(smooth(d, 12), (dd) => 1 / (1 + (dd / ref) ** 2)), pan = up(smooth(shipC[s].pan, 12), (p) => p * 0.95);
  const dop = up(smooth(shipC[s].vr, 20), (vr) => 1 - Math.max(-0.07, Math.min(0.07, vr / 343 * 0.12)));   // gentle Doppler, the footage is sped up
  const tone = new Float32Array(N); let ph = 0;
  const f0 = ty === 0 ? 31 : ty === 1 ? 46 : 68 + s * 5, throb = ty === 0 ? 5.2 : ty === 1 ? 9 : 17, harm = ty === 2 ? [1, .7, .5, .35, .25, .18, .12] : [1, .6, .35, .2];
  const jit = wander(3, 0.985, 1.015);
  for (let i = 0; i < N; i++) {
    ph += 2 * Math.PI * f0 * dop[i] * jit[i] / SR; let v = 0; for (let h = 0; h < harm.length; h++) v += harm[h] * Math.sin(ph * (h + 1));
    tone[i] = v * (0.7 + 0.3 * Math.sin(2 * Math.PI * throb * i / SR));
  }
  const rumble = mul(svf(white(), ty === 2 ? 320 : 150, 0.8, 'lp'), wander(throb, 0.6, 1.0));
  const wash = svf(svf(white(), ty === 2 ? 2200 : 1100, 0.7, 'bp'), 300, 0.7, 'hp');
  add(svf(tone, ty === 2 ? 900 : 420, 0.7, 'lp'), mul(gain, ty === 2 ? 0.12 : 0.12), pan, 'ship' + s);
  add(rumble, mul(gain, ty === 2 ? 0.25 : 0.34), pan, 'ship' + s);
  add(mul(wash, wander(1.5, 0.7, 1.0)), mul(gain, ty === 2 ? 0.32 : 0.28), pan, 'ship' + s);
});

// ---------- master: clean the bottom, fade, soft limit ----------
const master = (x) => { const o = svf(x, 28, 0.7, 'hp'); for (let i = 0; i < N; i++) { const t = i / SR, f = Math.min(1, t / 0.5) * Math.min(1, (DUR - t) / 2.2); o[i] = Math.tanh(o[i] * 1.6) / 1.6 * (f * f * (3 - 2 * f)); } return o; };
const Lm = master(L), Rm = master(R);
let pk = 0, ss = 0; for (let i = 0; i < N; i++) { pk = Math.max(pk, Math.abs(Lm[i]), Math.abs(Rm[i])); ss += Lm[i] * Lm[i] + Rm[i] * Rm[i]; }
const hdr = Buffer.alloc(44), data = Buffer.alloc(N * 8);
for (let i = 0; i < N; i++) { data.writeFloatLE(Lm[i], i * 8); data.writeFloatLE(Rm[i], i * 8 + 4); }
hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVEfmt ', 8); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(3, 20); hdr.writeUInt16LE(2, 22);
hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 8, 28); hdr.writeUInt16LE(8, 32); hdr.writeUInt16LE(32, 34); hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);
mkdirSync(path.dirname(OUT), { recursive: true }); writeFileSync(OUT, Buffer.concat([hdr, data]));
console.log(`${OUT}: ${DUR} s, peak ${pk.toFixed(3)}, rms ${(10 * Math.log10(ss / (2 * N))).toFixed(1)} dB`);
// cue sheet, so the mix can be checked against the picture
const at = (a, t) => a[Math.min(NC - 1, Math.round(t * CR))];
console.log('  t   height  speed  surf   ' + SHIPS.map((s, i) => `ship${i}(m)`).join(' '));
for (let t = 0; t <= DUR; t += 2.5) console.log(`${t.toFixed(1).padStart(5)} ${at(c.y, t).toFixed(0).padStart(6)} ${at(c.spd, t).toFixed(0).padStart(6)} ${at(c.surf, t).toFixed(2).padStart(6)}   ` + shipC.map((s) => at(s.d, t).toFixed(0).padStart(8)).join(' '));
// per-layer level in dB for each 2.5 s window (before the master), to judge the balance without listening
console.log('layer  ' + Array.from({ length: Math.ceil(DUR / BIN) }, (_, i) => String(i * BIN).padStart(4)).join(''));
for (const [tag, m] of Object.entries(METER)) console.log(tag.padEnd(7) + Array.from(m, (e) => (e > 0 ? (10 * Math.log10(e / (BIN * SR))).toFixed(0) : '').padStart(4)).join(''));
