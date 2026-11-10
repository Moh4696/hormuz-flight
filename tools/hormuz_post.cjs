// (hormuz) Final pass over the built index.html: portability fixes for Apple GPUs (ANGLE Metal).
//  1. pow(x, 2.) with a negative x is undefined in GLSL. D3D folds it to x*x, Metal returns NaN, and the bloom blur then
//     smears each NaN pixel into a black block. Rewrite every pow(<expr>, 2.) as ((expr)*(expr)).
//  2. Belt and braces: never let a NaN/Inf leave the main render shader.
const fs = require('fs');
const f = __dirname + '/../index.html';
let t = fs.readFileSync(f, 'utf8'), n = 0, out = '', i = 0;
const re = /(?<![A-Za-z0-9_])pow\(/g;
for (let m; (m = re.exec(t));) {
  let d = 1, j = m.index + 4, comma = -1;
  for (; j < t.length && d > 0; j++) { const c = t[j]; if (c === '(') d++; else if (c === ')') d--; else if (c === ',' && d === 1 && comma < 0) comma = j; }
  if (d !== 0 || comma < 0) continue;
  const base = t.slice(m.index + 4, comma), ex = t.slice(comma + 1, j - 1).trim();
  if (!/^2\.?0*$/.test(ex)) continue;
  out += t.slice(i, m.index) + '((' + base + ')*(' + base + '))'; i = j; n++; re.lastIndex = j;
}
t = out + t.slice(i);
const a = '  o=vec4(col,uAOut==1?';
if (!t.includes(a)) { console.error('MISSING output line'); process.exitCode = 1; }
t = t.replace(a, '  if(any(isnan(col))||any(isinf(col))) col=uDbgM==999?vec3(4.,0.,4.):vec3(0.); if(isnan(gHz)||isinf(gHz)) gHz=0.;\n' + a);
// ---- Hormuz look patches (arid Musandam coast) ----
const rep = (x, y) => { if (!t.includes(x)) { console.error('hormuz MISSING:', x.slice(0, 90)); process.exitCode = 1; return; } t = t.replace(x, y); };
// no vegetation at all: bare rock everywhere, no palms, no canopy displacement (the beach mask stays)
rep('  o=vec4(veg,palm,beach,disp);', '  o=vec4(0.,0.,0.,0.);');   // and no sand beaches or beach shrubs: rock meets the water
// and no plant instances at all: with zero density a hash that lands exactly on 0 still planted the odd lone shrub
rep('  if(h<1.4||vm.b>(uKind==1?.6:.25)) return;', '  return;');
// no grassy ledges on the cliffs
rep('float wVegA=clamp(max(vegG,ledge*.85),0.,1.);', 'float wVegA=clamp(vegG,0.,1.);');
// basalt -> Musandam limestone: pale tan-grey beds with darker brown beds, strongly horizontal bedding; the original
// block / crevice / weathering shading survives as a luminance modulation
rep('  return mix(c,c*vec3(.62,.62,.66),spray);', `  { float lum=dot(c,vec3(.3,.5,.2));
    // beds dip gently and are warped (folded strata), so the banding never reads as ruled horizontal stripes
    float by=p.y+.10*p.x+.06*p.z+22.*noise3(p*.0045+31.);
    float st=noise3(vec3(p.x*.004,by*.20,p.z*.004)+3.)+.5*noise3(vec3(p.x*.01,by*.5,p.z*.01)+9.);
    vec3 lime=mix(vec3(.125,.088,.054),vec3(.215,.165,.110),smoothstep(-.7,.8,st));          // warm tan to pale ochre (reference photos)
    lime=mix(lime,vec3(.090,.058,.034),smoothstep(.3,.9,noise3(vec3(p.x*.006,by*.08,p.z*.006)+17.))*.5);   // rust-brown beds
    lime=mix(lime,vec3(.19,.17,.14),smoothstep(.45,.9,noise3(p*.012+5.))*.3);                 // paler grey limestone patches
    c=lime*clamp(lum/.045,.55,1.35); }
  return mix(c,c*vec3(.62,.62,.66),spray);`);
// ---- the real site: Ras Musandam / Fakk al Asad (tools/hormuz_site.mjs -> hormuz_site.json) ----
const site = JSON.parse(fs.readFileSync(__dirname + '/hormuz_site.json', 'utf8'));
rep('function buildCoastSegments() {', `const HZ_SITE = ${JSON.stringify(site)};
function buildCoastSegments() {
  { const segs = []; for (const l of HZ_SITE.loops) for (let i = 0; i < l.length; i += 2) { const j = (i + 2) % l.length; segs.push(l[i], l[i + 1], l[j], l[j + 1]); }
    return { segs: new Float32Array(segs), n: segs.length / 4, coastDir: [1, 0], inland: [0, -1] }; }   // (hormuz) OSM coastline; open strait to the north (+z)`);
rep('function buildValleys() {', `function buildValleys() {
  { const z = () => new Float32Array(4); return { S: z(), P: z(), n: 0, SH: z(), nSH: 0, BZ: z(), nBZ: 0, CH: z(), nCH: 0, MS: z(), nMS: 0 }; }   // (hormuz) no hand-placed Na Pali valleys / beaches / massifs`);
// base relief = real elevation (30 m grid, bicubic B-spline), pinned to the OSM shoreline with a short rocky foot
rep('float baseLand(vec2 p){', `uniform sampler2D uDem;
float hzDemT(ivec2 c){ return texelFetch(uDem,clamp(c,ivec2(0),textureSize(uDem,0)-1),0).r; }
float hzDem(vec2 p){
  vec2 u=(p-vec2(${site.rect[0].toFixed(1)},${site.rect[1].toFixed(1)}))/${site.rect[2].toFixed(1)}*vec2(textureSize(uDem,0))-.5; vec2 f=fract(u); ivec2 c=ivec2(floor(u));
  vec2 f2=f*f, f3=f2*f;
  vec4 wx=vec4(1.-3.*f.x+3.*f2.x-f3.x, 4.-6.*f2.x+3.*f3.x, 1.+3.*f.x+3.*f2.x-3.*f3.x, f3.x)/6.;
  vec4 wy=vec4(1.-3.*f.y+3.*f2.y-f3.y, 4.-6.*f2.y+3.*f3.y, 1.+3.*f.y+3.*f2.y-3.*f3.y, f3.y)/6.;
  float s=0.; for(int j=uZero;j<4;j++) for(int i=uZero;i<4;i++) s+=wx[i]*wy[j]*hzDemT(c+ivec2(i-1,j-1));
  return s;
}
float hzLand(vec2 p,float L){
  float n1=vnoise(p*.0016+vec2(7.3,1.1))*.5+.5, n2=vnoise(p*.0055-vec2(3.1,8.2))*.5+.5;
  float foot=mix(10.,34.,n2)*smoothstep(0.,mix(14.,40.,n1),L);          // rock meets the water directly: a low cliff foot, no beach
  return max(max(hzDem(p),0.)*smoothstep(0.,70.,L)*1.08, foot);          // x1.08: gives back what the 30 m smoothing takes off the crests
}
float baseLand(vec2 p){`);
rep(`  return h;
}
\`;
const FS_BASE`, `  if(d>0.) h=hzLand(p,L);
  return h;
}
\`;
const FS_BASE`);
rep('  const setBase = (P) => {', `  world.demTex = tex(HZ_SITE.demN, HZ_SITE.demN, gl.R32F, gl.RED, gl.FLOAT, gl.NEAREST, new Float32Array(HZ_SITE.dem));
  const setBase = (P) => {
    bindTex(5, world.demTex); gl.uniform1i(P.u.uDem, 5);`);
// erode (nearly) the whole world, not just Leon's central valley
rep('const RECT = [-2400, -700, 4800];', `const RECT = [${site.rect}];`);
rep('const SPLR = [-1600, -200, 3200];', `const SPLR = [${site.rect[0] + 50}, ${site.rect[1] + 50}, ${site.rect[2] - 100}];`);
// water: sheltered Gulf coast, no surf. Shore foam is scaled to a faint trace (HZF) and the whitewater fringe is off.
rep('vec3 shadeWater(vec3 pos, vec3 rd, float t){', '#define HZF .07\nvec3 shadeWater(vec3 pos, vec3 rd, float t){');
rep('col=mix(col,fcol,foam*mix(.6,1.,fo.x)*opq);', 'col=mix(col,fcol,foam*mix(.6,1.,fo.x)*opq*HZF);');
rep('vec3(.04-.025*uWK11.y*aerA,.105,.14)*.3,foam*(1.-opq)*crF*.5);', 'vec3(.04-.025*uWK11.y*aerA,.105,.14)*.3,foam*(1.-opq)*crF*.5*HZF);');
rep("num('wk38', 1)", "num('wk38', 0)");
// ---- ships (tools/hormuz_ships.glsl) ----
{ const ships = fs.readFileSync(__dirname + '/hormuz_ships.glsl', 'utf8');
  rep('vec3 fogApply(vec3 col, vec3 ro, vec3 rd, float t){', ships + '\nvec3 fogApply(vec3 col, vec3 ro, vec3 rd, float t){');
  rep('  if(hitW){ col=shadeWater(ro+rd*tW,rd,tW); tt=tW; }', `  float tS=hzShipHit(ro,rd,min(hitW?tW:far,hitT?tT:far));
  if(tS>0.){ col=hzShipShade(ro+rd*tS,rd,tS); tt=tS; }
  else if(hitW){ vec3 pw=ro+rd*tW; col=hzWake(shadeWater(pw,rd,tW),pw,tW); tt=tW; }`);
  rep('  if(hitT&&!hitW) col=waterEdge(', '  if(hitT&&!hitW&&tS<0.) col=waterEdge(');
  // ship tracks: [type, x, z at t = 0, heading deg (0 = north, 90 = east), speed m/s]; type 0 tanker, 1 frigate, 2 patrol boat
  rep('function renderSample(cam, time, jit, oceanReady) {', `const HZ_SHIPS = [
  [0, 106, 3878, 82, 6.7],       // laden tanker outbound, north of Musandam Island (the camera crosses its deck at 8 s)
  [1, -361, 4394, 263, 10.5],    // frigate on the opposite course (the camera crosses its wake at 3 s)
  [2, -62, -775, 318, 19],       // two fast patrol boats coming up the Fakk al Asad channel (they pass the camera at 40 s)
  [2, -30, -840, 316, 18.5],
  [0, 2315, 5900, 258, 7.2],     // second tanker, far out in the haze
];
const HZ_TS = num('tscale', 1 / 3);   // water and ships run in video time: the flight is played back 3x (SPEED=3)
function hzShipState(time) {
  const a = new Float32Array(HZ_SHIPS.length * 4);
  HZ_SHIPS.forEach(([ty, x, z, hd, v], i) => { const h = hd * Math.PI / 180, s = v * (time + num('shipT', 0)); a[i * 4] = x + Math.sin(h) * s; a[i * 4 + 1] = z + Math.cos(h) * s; a[i * 4 + 2] = h; a[i * 4 + 3] = ty; });
  return a;
}
function renderSample(cam, time, jit, oceanReady) {
  time *= HZ_TS;`);
  rep('  gl.uniform3fv(u.uRo, cam.pos);', '  gl.uniform4fv(u.uShip, hzShipState(time));\n  gl.uniform3fv(u.uRo, cam.pos);');
}
// flight path (tools/hormuz_flight.cjs)
{ const re = /const CINE = \[[\s\S]*?\n\];/; if (!re.test(t)) { console.error('hormuz MISSING: CINE'); process.exitCode = 1; }
  t = t.replace(re, () => 'const CINE = ' + JSON.stringify(require('./hormuz_flight.cjs')) + ';');
  rep('  const settle = smoothstep(CS.end - 1.5, CS.end, t);', '  const settle = 0;   // (hormuz) no blend into the Na Pali reference camera'); }
// atmosphere: Leon's fog is tuned to Na Pali (humid valley mist keyed to world z, Rayleigh-blue veils). Replace it with one
// Gulf dust layer: exponential in height (scale height uMist.x), warm-white, glowing toward the sun; distant rock melts
// into the horizon sky the way the Musandam ridges do in the reference photos.
{ const re = /vec3 fogApply\(vec3 col, vec3 ro, vec3 rd, float t\)\{[\s\S]*?\n\}\n(?=\s*void main\(\)\{)/;
  if (!re.test(t)) { console.error('hormuz MISSING: fogApply'); process.exitCode = 1; }
  t = t.replace(re, () => `vec3 fogApply(vec3 col, vec3 ro, vec3 rd, float t){
  float hf=1./uMist.x, k=rd.y*hf;
  float tau=uFog*exp(-max(ro.y,0.)*hf)*(abs(k)>1e-6?(1.-exp(-t*k))/k:t);
  float ext=1.-exp(-tau);
  float s=max(dot(rd,uSun),0.);
  vec3 hz=skyDome(normalize(vec3(rd.x,.035,rd.z)))*vec3(1.05,1.,.93);
  hz*=1.+uMist.y*(.55*pow(s,6.)+.25*s*s);
  col=mix(col*(1.-vec3(.04,.10,.18)*ext),hz,ext);
  gHz=ext;
  return col;
}
`); }
// defaults: no plants, lower warm sun, dusty Gulf haze
rep("num('vfill', 1)", "num('vfill', 0)");   // Leon's hand-built valley floor (it stacked a tower on the island)
rep("num('cloud', 0.0)", "num('cloud', -0.6)");   // the Gulf sky is almost always cloudless
for (const [k, a, b] of [['wind', '9.5', '4.5'], ['swellH', '1.0', '0.35'], ['chop', '1.55', '1.1'],   // sheltered, calm water: small wind chop, no ocean swell
  ['treeDens', '1.7', '0'], ['bushDens', '0.85', '0'], ['sunEl', '44', '22'], ['fog', '0.0002', '0.00014'], ['mistH', '350', '1200'], ['mistK', '2.3', '1']]) rep(`${k}: num('${k}', ${a})`, `${k}: num('${k}', ${b})`);
fs.writeFileSync(f, t);
console.log('hormuz_post: pow(x,2.) rewritten', n, 'times');
