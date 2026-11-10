// (hormuz) Downloads the two public data sets the site bake needs into refs/ (git-ignored):
//   refs/osm/coast.json        coastline ways from OpenStreetMap (Overpass API), ODbL
//   refs/dem/z13_{x}_{y}.png   Terrarium elevation tiles (Terrain Tiles on AWS Open Data)
//   node tools/hormuz_fetch.mjs          then: node tools/hormuz_site.mjs
// Files that already exist are left alone.
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const REFS = process.env.REFS || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'refs');
const UA = { 'User-Agent': 'hormuz-flight-site-bake/1.0' };
const BBOX = '26.28,56.34,26.47,56.62';   // south, west, north, east: the northern tip of the Musandam peninsula
mkdirSync(REFS + '/osm', { recursive: true }); mkdirSync(REFS + '/dem', { recursive: true });
const coast = REFS + '/osm/coast.json';
if (!existsSync(coast)) {
  const q = `[out:json][timeout:90];(way["natural"="coastline"](${BBOX}););out geom tags;`;
  let j = null;   // the public Overpass servers are often busy: try each one a few times
  for (let i = 0; i < 6 && !j; i++) {
    const url = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'][i % 2];
    try { const r = await fetch(url, { method: 'POST', headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q), signal: AbortSignal.timeout(60000) }); if (r.ok) j = await r.json(); else console.log(`${url}: ${r.status}, retrying`); }
    catch (e) { console.log(`${url}: ${e.message}, retrying`); }
    if (!j) await new Promise((ok) => setTimeout(ok, 4000));
  }
  if (!j) throw new Error('Overpass did not answer, try again later');
  writeFileSync(coast, JSON.stringify(j));
  console.log(`coast.json: ${j.elements.length} coastline ways`);
} else console.log('coast.json: already there');
let got = 0;
for (let x = 5378; x <= 5383; x++) for (let y = 3471; y <= 3475; y++) {
  const f = `${REFS}/dem/z13_${x}_${y}.png`;
  if (existsSync(f)) continue;
  const r = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/13/${x}/${y}.png`, { headers: UA, signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`tile 13/${x}/${y}: ${r.status}`);
  writeFileSync(f, Buffer.from(await r.arrayBuffer())); got++;
}
console.log(`elevation tiles: ${got} downloaded, ${30 - got} already there`);
