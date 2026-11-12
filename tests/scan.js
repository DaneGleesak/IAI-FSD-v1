'use strict';
/* The Mac mini market scan: tools/market-scan.mjs makes a pack from invented buildings (no network),
   and the app reads the pack from a file. Nothing is sent anywhere, and no lead is touched. */
const fs = require('fs'), os = require('os'), path = require('path'), { execFileSync, spawnSync } = require('child_process');
const { launch, suite } = require('./lib');
const t = suite('Mac mini scan');
const TOOL = path.resolve(__dirname, '../tools/market-scan.mjs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'iai-scan-'));

/* an invented Overpass answer: four buildings worth reaching, one low strip, one airfield */
const LAT = 39.96, LON = -83.0;
const sq = (dy, dx, h = 0.00055, w = 0.0007) => { const a = LAT + dy, b = LON + dx; return [[a, b], [a + h, b], [a + h, b + w], [a, b + w], [a, b]].map(([la, lo]) => ({ lat: la, lon: lo })); };
const way = (id, tags, g) => ({ type: 'way', id, tags, geometry: g });
const fixture = { elements: [
  way(1, { building: 'office', name: 'Mock Tower A', 'building:levels': '14', 'addr:housenumber': '1', 'addr:street': 'Test Ave' }, sq(0.001, 0.001)),
  way(2, { building: 'hotel', tourism: 'hotel', name: 'Mock Hotel B', 'building:levels': '8' }, sq(0.003, 0.002)),
  way(3, { building: 'apartments', name: 'Mock Flats C', 'building:levels': '12' }, sq(-0.003, 0.001)),
  way(4, { building: 'hospital', amenity: 'hospital', name: 'Mock Medical D', 'building:levels': '6' }, sq(-0.002, -0.004)),
  way(5, { building: 'retail', name: 'Mock Strip E', 'building:levels': '1' }, sq(0.004, -0.003)),
  { type: 'node', id: 9, lat: LAT + 0.1, lon: LON + 0.1, tags: { aeroway: 'aerodrome', name: 'Mock Field' } }
] };
const fx = path.join(dir, 'overpass.json'); fs.writeFileSync(fx, JSON.stringify(fixture));
const packFile = path.join(dir, 'mocktown.json');

(async()=>{
  /* the tool, offline */
  const out = execFileSync('node', [TOOL, '--lat', String(LAT), '--lon', String(LON), '--label', 'Mocktown', '--miles', '3', '--from-file', fx, '--out', packFile], { encoding: 'utf8' });
  const pack = JSON.parse(fs.readFileSync(packFile, 'utf8'));
  t.eq(pack.kind, 'iai-market-pack', 'the scan writes a market pack file');
  t.eq(pack.radius, 4828, 'a 3 mile scan is 4828 m');
  t.eq(pack.crit.preset, 'targets', 'it starts on the hotels, apartments, offices and medical mix');
  const names = pack.items.map(i => i.name);
  t.ok(['Mock Tower A', 'Mock Hotel B', 'Mock Flats C', 'Mock Medical D'].every(n => names.includes(n)), 'the hotel, apartments, office and medical buildings are all in it');
  t.ok(!names.includes('Mock Strip E'), 'the one-floor strip is filtered out');
  t.ok(/Mock Tower A/.test(out) && /Wrote/.test(out), 'the screen shows a ranked table and where the file went');
  t.ok(pack.airports.length === 1, 'the mapped airfield is kept for the distance note');
  t.ok(!/rate|quote|contact|note"/i.test(Object.keys(pack).join(' ') + pack.items.map(i => Object.keys(i).join(' ')).join(' ')), 'the pack holds map facts only: no price, quote, contact or note fields');
  const bad = spawnSync('node', [TOOL, '--miles', '3', '--from-file', fx], { encoding: 'utf8' });
  t.ok(bad.status !== 0 && /--address|--lat/.test(bad.stderr), 'a scan with no place says so and stops');
  const far = spawnSync('node', [TOOL, '--lat', '1', '--lon', '1', '--miles', '40', '--from-file', fx], { encoding: 'utf8' });
  t.ok(far.status !== 0 && /--miles/.test(far.stderr), 'a radius over 10 miles is refused');

  /* the app reads it, with lookups off */
  const T = await launch({ touch: true }); const { page } = T;
  const S = () => page.evaluate(() => JSON.parse(localStorage.getItem(KEY)));
  await T.open(); await page.click('#nav [data-tab="map"]');
  const before = (await S()).properties.length;
  t.ok(await page.isVisible('[data-act="pack-import"]'), 'the Map offers “Import a scan file” even with lookups off');
  const junk = path.join(dir, 'junk.json'); fs.writeFileSync(junk, '{"hello":1}');
  let [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('[data-act="pack-import"]')]); await fc.setFiles(junk);
  await page.waitForSelector('#toast.show'); t.ok(/isn’t an IAI scan file/.test(await page.textContent('#toast')), 'a file that is not a scan is refused with a plain message');
  t.eq((await S()).search.last, null, 'and nothing changed');
  [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('[data-act="pack-import"]')]); await fc.setFiles(packFile);
  await page.waitForSelector('#cfOk'); t.ok(/Mocktown/.test(await page.textContent('#dlg')), 'the scan is described before it is shown');
  await page.click('#cfOk'); await page.waitForSelector('#results .rcard');
  const rows = await page.$$eval('#results .rcard', e => e.map(x => x.innerText));
  t.eq(rows.length, 4, 'the four ranked buildings show');
  t.ok(rows.every(r => /High|Medium|Lower/.test(r)), 'each shows a band');
  t.ok(rows.some(r => /Mock Tower A/.test(r)), 'the tower is listed');
  const st = await S();
  t.eq(st.properties.length, before, 'no lead was added or changed');
  t.eq(st.search.last.label, 'Mocktown', 'the scan is the current result');
  t.ok(st.search.runs[0].label.includes('scan file'), 'and it is in Recent searches, marked as a scan file');
  t.eq(T.outside.length, 0, 'reading the file sent nothing outside');
  await page.click('[data-act="lookups-on"]'); await page.waitForSelector('#mapHost'); await page.waitForTimeout(300);
  t.ok(await page.isVisible('#ctlSum'), 'with lookups on, the map shows the scan with the filters folded to one line');
  t.ok(/3 mi/.test(await page.textContent('#ctlSum')), 'and the radius reads 3 mi');

  /* the tool on the network, against a local stand-in for the building servers (no real service is touched) */
  const http = require('http'), { spawn } = require('child_process');
  const runTool = (args, env) => new Promise(res => { const c = spawn('node', [TOOL, ...args], { env: Object.assign({}, process.env, env, { IAI_WAIT_SCALE: '0.0005' }) }); let o = '', e = ''; c.stdout.on('data', d => o += d); c.stderr.on('data', d => e += d); c.on('close', code => res({ code, o, e })); });
  const mock = handler => new Promise(res => { const log = []; const srv = http.createServer((rq, rs) => { let b = ''; rq.on('data', d => b += d); rq.on('end', () => { const q = decodeURIComponent(b.replace(/^data=/, '').replace(/\+/g, ' ')); log.push({ path: rq.url, q }); const h = handler(rq.url, q, log.length); if (h && h.status) { rs.writeHead(h.status); return rs.end('busy'); } rs.writeHead(200, { 'content-type': 'application/json' }); rs.end(JSON.stringify((h && h.json) || fixture)); }); }); srv.listen(0, '127.0.0.1', () => res({ srv, log, base: 'http://127.0.0.1:' + srv.address().port })); });
  const envOf = m => ({ IAI_OVERPASS: m.base + '/main,' + m.base + '/backup' });
  const base = ['--lat', String(LAT), '--lon', String(LON), '--label', 'Mocktown', '--miles', '3'];

  /* the main server is busy: the backup answers, and the tool is two requests, not one per kind */
  let m = await mock(u => u === '/main' ? { status: 429 } : null);
  let r = await runTool([...base, '--out', path.join(dir, 'a.json')], envOf(m)); m.srv.close();
  t.eq(r.code, 0, 'with the main server busy, the scan still finishes'); t.ok(m.log[0].path === '/main', 'the main server is asked first');
  t.ok(m.log.some(x => x.path === '/backup'), 'the backup server answered'); t.eq(m.log.filter(x => x.path === '/main').length <= 2, true, 'and the main one was not pushed again and again');
  t.ok(m.log.some(x => /aeroway/.test(x.q)) && m.log.some(x => /"building"="hotel"/.test(x.q)), 'it asks for the buildings and for the airports');
  t.eq(JSON.parse(fs.readFileSync(path.join(dir, 'a.json'), 'utf8')).items.length, 4, 'the pack has the four buildings');

  /* a server that runs out of time: said plainly, and nobody is asked again */
  m = await mock(() => ({ json: { elements: [], remark: 'runtime error: Query timed out in "query" at line 3 after 46 seconds.' } }));
  r = await runTool([...base, '--out', path.join(dir, 'b.json')], envOf(m)); m.srv.close();
  t.ok(r.code !== 0 && /too big for one request/.test(r.e), 'a timed-out search says the area is too big and to use a smaller --miles'); t.eq(m.log.length, 1, 'and it was asked once: no retry, no backup');

  /* both servers say 429 for ever: it gives up with the reason instead of hammering */
  m = await mock(() => ({ status: 429 }));
  r = await runTool([...base, '--out', path.join(dir, 'c.json')], envOf(m)); m.srv.close();
  t.ok(r.code !== 0 && /429/.test(r.e), 'if every server keeps saying 429 it stops and says so'); t.ok(m.log.length <= 8, 'after only a few polite tries ('+m.log.length+')');

  /* a sweep: many small circles over a box, each asked once, the buildings joined and counted once */
  m = await mock(() => null);
  r = await runTool(['--box', '39.90,-83.10,40.00,-82.90', '--miles', '2', '--label', 'Mock sweep', '--out', path.join(dir, 'd.json')], envOf(m)); m.srv.close();
  const sw = JSON.parse(fs.readFileSync(path.join(dir, 'd.json'), 'utf8'));
  t.eq(r.code, 0, 'a sweep over a box finishes'); t.ok(m.log.length > 4 && m.log.filter(x => !/aeroway/.test(x.q)).length === m.log.length - 1, 'one building request per circle, then one airport request ('+m.log.length+')');
  t.eq(sw.items.length, 4, 'a building seen in several circles is listed once'); t.ok(sw.radius <= 32000 && sw.center.label === 'Mock sweep', 'the pack covers the box');
  r = await runTool(['--box', '39,-84,41,-82', '--miles', '1', '--out', path.join(dir, 'e.json')], envOf(await mock(() => null)));
  t.ok(r.code !== 0 && /limit is 80/.test(r.e), 'a box that would need too many circles is refused before anything is sent');
  r = await runTool(['--box', '40,-83,39,-82', '--out', path.join(dir, 'f.json')], {}); t.ok(r.code !== 0 && /south,west,north,east/.test(r.e), 'a box the wrong way round is refused');
  t.eq(T.errors, [], 'no page errors');
  await T.close(); t.done();
})().catch(e => { console.error(e); process.exit(1); });
