#!/usr/bin/env node
/* IAI market scan: runs on a Mac mini (or any computer with Node 18+), not on the phone.
   It asks OpenStreetMap for the buildings around a place, ranks them with the app's own engine
   (js/engine.js, so the order matches what the phone would show), and writes a "market pack" file
   the phone imports (Map > Recent searches > Import a scan file).
   Only a place, a radius and the building filters are sent. Never a lead, contact, price or note.

   node tools/market-scan.mjs --address "1 Example St, Sampletown" --miles 3 --out sampletown.json
   node tools/market-scan.mjs --box 41.35,-81.95,41.60,-81.45 --miles 2 --out county-sweep.json   (a sweep: many small circles over a box S,W,N,E, best 400 kept)
   node tools/market-scan.mjs --batch markets.json --out-dir packs
   node tools/market-scan.mjs --lat 40.0 --lon -83.0 --from-file saved-overpass.json   (no network) */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(here, '../js/engine.js'), 'utf8') +
  '\nthis.E={buildQuery,buildQueries,parseOverpass,keepCand,rankCands,candClean,critClean,critText,radLabel,PRESETS,TYPE_KEYS,CATS};', ctx);
const E = ctx.E;

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
/* the main building server first; the backup only when the main one is busy, down or silent (IAI_OVERPASS can name others, for tests) */
const HOSTS = (process.env.IAI_OVERPASS || 'https://overpass-api.de/api/interpreter,https://overpass.private.coffee/api/interpreter').split(',').map(x => x.trim()).filter(Boolean);
const SCALE = process.env.IAI_WAIT_SCALE != null ? Number(process.env.IAI_WAIT_SCALE) : 1;   // 1 = real waits; tests make them tiny
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wait = ms => sleep(ms * SCALE);
const hold = {};   // host -> time before which it is left alone

export function parseArgs(argv) {
  const a = {}; for (let i = 0; i < argv.length; i++) { const k = argv[i]; if (!k.startsWith('--')) continue; const n = argv[i + 1]; if (n === undefined || n.startsWith('--')) a[k.slice(2)] = true; else { a[k.slice(2)] = n; i++; } }
  return a;
}

/* Gentle on the free service, which asks for this: after "too many requests" (429) that server is left alone for a minute;
   a gateway error earns another round after a pause; a server that says it ran out of time is not asked again. */
async function askOverpass(q) {
  let last = null, rate = null;
  for (let round = 0; round < 3; round++) {
    let gateway = false, asked = 0;
    for (const url of HOSTS) {
      if ((hold[url] || 0) > Date.now()) continue;
      asked++;
      try {
        const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q), signal: AbortSignal.timeout(240000) });
        if (r.status === 429) { hold[url] = Date.now() + 60000 * SCALE; rate = new Error('HTTP 429 (too many requests)'); last = rate; continue; }
        if (!r.ok) { last = new Error('HTTP ' + r.status); if ([502, 503, 504].includes(r.status)) gateway = true; continue; }
        const j = await r.json();
        if (j && typeof j.remark === 'string' && /timed out|out of memory|runtime error/i.test(j.remark)) throw Object.assign(new Error('The server ran out of time: this area is too big for one request. Use a smaller --miles.'), { fatal: true });
        return j;
      } catch (e) { if (e.fatal) throw e; last = e; }
    }
    if (!asked) { const t = Math.min(...HOSTS.map(u => hold[u] || 0)) - Date.now(); await sleep(Math.max(0, t)); continue; }
    await wait(gateway ? 20000 : 30000);
  }
  throw rate || last || new Error('No answer from the building servers');
}

async function getJSON(url, opt, tries = 4) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, Object.assign({ signal: AbortSignal.timeout(60000) }, opt));
      if (r.ok) return await r.json();
      last = new Error('HTTP ' + r.status);
      if (![429, 502, 503, 504].includes(r.status)) break;
    } catch (e) { last = e; }
    await wait(8000 * (i + 1));
  }
  throw last;
}

/* circles that overlap enough to cover a box (south, west, north, east) */
export function gridCenters(box, miles) {
  const [s, w, n, e] = box, r = miles * 1609.344, step = r * 1.4, dLat = step / 110574, out = [];
  for (let lat = s + dLat / 2; lat < n + dLat / 2; lat += dLat) {
    const dLon = step / (111320 * Math.cos(lat * Math.PI / 180));
    for (let lon = w + dLon / 2; lon < e + dLon / 2; lon += dLon) out.push({ lat: Number(lat.toFixed(5)), lon: Number(lon.toFixed(5)) });
  }
  return { r, centers: out };
}

async function geocode(address) {
  const ua = 'IAI-market-scan/1' + (process.env.IAI_CONTACT ? ' (' + process.env.IAI_CONTACT + ')' : '');
  const j = await getJSON(NOMINATIM + '?format=jsonv2&limit=1&q=' + encodeURIComponent(address), { headers: { 'user-agent': ua, 'accept-language': 'en' } });
  if (!Array.isArray(j) || !j[0]) throw new Error('No place found for "' + address + '"');
  return { lat: Number(j[0].lat), lon: Number(j[0].lon), label: String(j[0].display_name || address).split(',').slice(0, 3).join(',').trim() };
}

export async function scan(o) {
  const miles = Number(o.miles || (o.box ? 2 : 3)); if (!(miles > 0 && miles <= 10)) throw new Error('--miles must be between 0 and 10');
  const radius = Math.round(miles * 1609.344); let radiusM = radius;
  let center = null;
  if (o.lat != null && o.lon != null) center = { lat: Number(o.lat), lon: Number(o.lon), label: o.label || '' };
  else if (o.address) { center = await geocode(String(o.address)); if (o.label) center.label = o.label; }
  else if (!o.box) throw new Error('Give --address, or --lat and --lon, or --box');
  if (center && !(Math.abs(center.lat) <= 90 && Math.abs(center.lon) <= 180)) throw new Error('That place is not on the map');
  const crit = E.critClean(Object.assign({ preset: o.preset || 'targets' },
    o.types ? { types: String(o.types).split(',').filter(Boolean) } : {},
    o['min-levels'] != null ? { minLevels: Number(o['min-levels']) } : {},
    o['unknown-levels'] != null ? { unknownLevels: !/^(no|false|0)$/i.test(String(o['unknown-levels'])) } : {}));
  let json;
  if (o['from-file']) json = JSON.parse(fs.readFileSync(o['from-file'], 'utf8'));
  else if (o.box) {
    const box = String(o.box).split(',').map(Number); if (box.length !== 4 || box.some(x => !Number.isFinite(x)) || !(box[0] < box[2] && box[1] < box[3])) throw new Error('--box must be south,west,north,east');
    const { r, centers } = gridCenters(box, miles), cap = Number(o['max-tiles'] || 80);
    if (centers.length > cap) throw new Error('That box needs ' + centers.length + ' circles (the limit is ' + cap + '). Use a bigger --miles, a smaller box, or --max-tiles.');
    const merged = [], seen = new Set(); let ok = 0;
    for (let i = 0; i < centers.length; i++) {
      process.stderr.write('  circle ' + (i + 1) + ' of ' + centers.length + '\r');
      try {
        const j = await askOverpass(E.buildQueries(centers[i].lat, centers[i].lon, Math.round(r), crit)[0].q); ok++;
        (j.elements || []).forEach(el => { const k = el.type + el.id; if (!seen.has(k)) { seen.add(k); merged.push(el); } });
      } catch (e) { if (/ran out of time/.test(e.message)) throw e; console.error('\n  circle ' + (i + 1) + ' skipped: ' + e.message); }
      await wait(8000);
    }
    process.stderr.write('\n'); if (!ok) throw new Error('No circle could be searched.');
    center = { lat: (box[0] + box[2]) / 2, lon: (box[1] + box[3]) / 2, label: o.label || 'Sweep' };
    try { const a = await askOverpass(E.buildQueries(center.lat, center.lon, Math.round(r * 4), crit)[1].q); (a.elements || []).forEach(el => { const k = el.type + el.id; if (!seen.has(k)) { seen.add(k); merged.push(el); } }); } catch (e) { console.error('  airport distances skipped: ' + e.message); }
    json = { elements: merged }; radiusM = Math.min(32000, Math.round(Math.max(box[2] - box[0], (box[3] - box[1]) * Math.cos(center.lat * Math.PI / 180)) * 110574 / 2));
  } else {
    const parts = E.buildQueries(center.lat, center.lon, radius, crit), merged = [], seen = new Set();
    for (let i = 0; i < parts.length; i++) {
      try {
        const j = await askOverpass(parts[i].q);
        (j.elements || []).forEach(el => { const k = el.type + el.id; if (!seen.has(k)) { seen.add(k); merged.push(el); } });
      } catch (e) { if (!parts[i].optional) throw e; console.error('  airport distances skipped: ' + e.message); }
      if (i < parts.length - 1) await wait(5000);
    }
    json = { elements: merged };
  }
  const parsed = E.parseOverpass(json);
  const kept = parsed.items.filter(c => E.keepCand(c, crit));
  const rows = E.rankCands(kept, 'balanced', center, radiusM);
  const items = rows.slice(0, 400).map(r => E.candClean(r.c)).filter(Boolean);
  const label = center.label || (center.lat.toFixed(3) + ', ' + center.lon.toFixed(3));
  return {
    pack: { kind: 'iai-market-pack', v: 1, made: new Date().toISOString(), tool: 'market-scan', source: 'OpenStreetMap via Overpass',
      center: { lat: center.lat, lon: center.lon, label }, radius: radiusM, crit, total: parsed.items.length, kept: kept.length,
      airports: parsed.air.slice(0, 20), items },
    rows: rows.slice(0, 400)
  };
}

function table(rows, n = 15) {
  return rows.slice(0, n).map((r, i) => String(i + 1).padStart(2) + '. ' + (r.band || '').padEnd(6) + ' ' + ((r.c.name || r.c.addr || r.c.id) + '').slice(0, 34).padEnd(34) + ' ' +
    ((E.CATS[r.c.cat] || E.CATS.mixed).label).padEnd(10) + ' ' + (r.c.levels ? r.c.levels + ' fl' : '? fl').padEnd(6) + (r.c.sqft ? r.c.sqft.toLocaleString() + ' sf' : '')).join('\n');
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.help || process.argv.length < 3) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace('#!/usr/bin/env node\n', '')); return; }
  const jobs = a.batch ? JSON.parse(fs.readFileSync(a.batch, 'utf8')) : [a];
  if (!Array.isArray(jobs) || !jobs.length) throw new Error('The batch file must be a list of markets');
  const dir = a['out-dir'] || '.'; fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < jobs.length; i++) {
    const j = Object.assign({}, a, jobs[i]); delete j.batch;
    const name = (j.out || ((j.label || j.address || ('market-' + (i + 1))).toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) + '.json'));
    const file = path.isAbsolute(name) || a.batch === undefined && j.out ? name : path.join(dir, name);
    try {
      const { pack, rows } = await scan(j);
      fs.writeFileSync(file, JSON.stringify(pack));
      console.log('\n' + pack.center.label + ' · ' + E.radLabel(pack.radius) + ' · ' + E.critText(pack.crit));
      console.log(pack.total + ' buildings on the map, ' + pack.kept + ' match. Wrote ' + file + '\n' + table(rows));
    } catch (e) { console.error('✗ ' + (jobs[i].label || jobs[i].address || 'market ' + (i + 1)) + ': ' + e.message); process.exitCode = 1; }
    if (i < jobs.length - 1 && !jobs[i]['from-file'] && !a['from-file']) await wait(15000);
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main().catch(e => { console.error('✗ ' + e.message); process.exit(1); });
