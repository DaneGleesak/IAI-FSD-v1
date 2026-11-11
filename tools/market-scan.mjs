#!/usr/bin/env node
/* IAI market scan: runs on a Mac mini (or any computer with Node 18+), not on the phone.
   It asks OpenStreetMap for the buildings around a place, ranks them with the app's own engine
   (js/engine.js, so the order matches what the phone would show), and writes a "market pack" file
   the phone imports (Map > Recent searches > Import a scan file).
   Only a place, a radius and the building filters are sent. Never a lead, contact, price or note.

   node tools/market-scan.mjs --address "1 Example St, Sampletown" --miles 3 --out sampletown.json
   node tools/market-scan.mjs --batch markets.json --out-dir packs
   node tools/market-scan.mjs --lat 40.0 --lon -83.0 --from-file saved-overpass.json   (no network) */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(here, '../js/engine.js'), 'utf8') +
  '\nthis.E={buildQuery,parseOverpass,keepCand,rankCands,candClean,critClean,critText,radLabel,PRESETS,TYPE_KEYS,CATS};', ctx);
const E = ctx.E;

const OVERPASS = 'https://overpass-api.de/api/interpreter';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const sleep = ms => new Promise(r => setTimeout(r, ms));

export function parseArgs(argv) {
  const a = {}; for (let i = 0; i < argv.length; i++) { const k = argv[i]; if (!k.startsWith('--')) continue; const n = argv[i + 1]; if (n === undefined || n.startsWith('--')) a[k.slice(2)] = true; else { a[k.slice(2)] = n; i++; } }
  return a;
}

async function getJSON(url, opt, tries = 4) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, Object.assign({ signal: AbortSignal.timeout(210000) }, opt));
      if (r.ok) return await r.json();
      last = new Error('HTTP ' + r.status);
      if (![429, 502, 503, 504].includes(r.status)) break;
    } catch (e) { last = e; }
    await sleep(8000 * (i + 1));
  }
  throw last;
}

async function geocode(address) {
  const ua = 'IAI-market-scan/1' + (process.env.IAI_CONTACT ? ' (' + process.env.IAI_CONTACT + ')' : '');
  const j = await getJSON(NOMINATIM + '?format=jsonv2&limit=1&q=' + encodeURIComponent(address), { headers: { 'user-agent': ua, 'accept-language': 'en' } });
  if (!Array.isArray(j) || !j[0]) throw new Error('No place found for "' + address + '"');
  return { lat: Number(j[0].lat), lon: Number(j[0].lon), label: String(j[0].display_name || address).split(',').slice(0, 3).join(',').trim() };
}

export async function scan(o) {
  const miles = Number(o.miles || 3); if (!(miles > 0 && miles <= 10)) throw new Error('--miles must be between 0 and 10');
  const radius = Math.round(miles * 1609.344);
  let center;
  if (o.lat != null && o.lon != null) center = { lat: Number(o.lat), lon: Number(o.lon), label: o.label || '' };
  else if (o.address) { center = await geocode(String(o.address)); if (o.label) center.label = o.label; }
  else throw new Error('Give --address, or --lat and --lon');
  if (!(Math.abs(center.lat) <= 90 && Math.abs(center.lon) <= 180)) throw new Error('That place is not on the map');
  const crit = E.critClean(Object.assign({ preset: o.preset || 'targets' },
    o.types ? { types: String(o.types).split(',').filter(Boolean) } : {},
    o['min-levels'] != null ? { minLevels: Number(o['min-levels']) } : {},
    o['unknown-levels'] != null ? { unknownLevels: !/^(no|false|0)$/i.test(String(o['unknown-levels'])) } : {}));
  let json;
  if (o['from-file']) json = JSON.parse(fs.readFileSync(o['from-file'], 'utf8'));
  else {
    const q = E.buildQuery(center.lat, center.lon, radius, crit).replace('[timeout:25]', '[timeout:180]');
    json = await getJSON(OVERPASS, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) });
  }
  const parsed = E.parseOverpass(json);
  const kept = parsed.items.filter(c => E.keepCand(c, crit));
  const rows = E.rankCands(kept, 'balanced', center, radius);
  const items = rows.slice(0, 400).map(r => E.candClean(r.c)).filter(Boolean);
  const label = center.label || (center.lat.toFixed(3) + ', ' + center.lon.toFixed(3));
  return {
    pack: { kind: 'iai-market-pack', v: 1, made: new Date().toISOString(), tool: 'market-scan', source: 'OpenStreetMap via Overpass',
      center: { lat: center.lat, lon: center.lon, label }, radius, crit, total: parsed.items.length, kept: kept.length,
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
    if (i < jobs.length - 1 && !jobs[i]['from-file'] && !a['from-file']) await sleep(15000);
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main().catch(e => { console.error('✗ ' + e.message); process.exit(1); });
