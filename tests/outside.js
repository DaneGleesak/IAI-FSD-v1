'use strict';
/* The outside-request audit. The app may talk to exactly three OpenStreetMap hosts, only after the
   owner turns lookups on, and only with the place and filters: never a lead, contact, price or note.
   The "outside world" here is mocked and the buildings are invented. */
const { launch, suite } = require('./lib');
const t = suite('outside requests');
const SECRETS = ['ZZ-SECRET-NOTE','secret.person@example.test','555-0199','ZZ-SECRET-CO','7.77'];
(async()=>{
  const T = await launch(); const { page } = T;
  const S = ()=>page.evaluate(()=>JSON.parse(localStorage.getItem(KEY)));
  const tab = async k=>{ await page.click('#nav [data-tab="'+k+'"]'); await page.waitForTimeout(120); };
  await T.open();

  /* plant things that must never leave the phone */
  await page.evaluate(()=>{
    const l=newLead({name:'ZZ-SECRET-CO Plaza', addr:'9 Private Ln', src:'manual'});
    l.notes.push({id:uid(), text:'ZZ-SECRET-NOTE', ts:Date.now()});
    l.contacts.push({id:uid(), name:'Secret Person', title:'', email:'secret.person@example.test', phone:'555-0199', role:'decision', conf:'', src:'You typed it'});
    state.properties.unshift(l); state.settings.services.forEach(s=>{ if(s.core) s.rate=7.77; });
    state.settings.sender.company='ZZ-SECRET-CO'; save();
  });
  await page.reload(); await page.waitForSelector('#nav button');

  for (const k of ['dash','map','leads','pipe','settings']) await tab(k);
  t.eq(T.outside.length, 0, 'with lookups off, using every screen sends nothing outside');

  /* turn lookups on from the map consent card */
  await tab('map'); t.ok(await page.isVisible('[data-act="lookups-on"]'), 'the map explains the three hosts before anything is sent');
  const txt = await page.textContent('#main');
  for (const h of ['tile.openstreetmap.org','overpass-api.de','nominatim.openstreetmap.org']) t.ok(txt.includes(h), 'the consent card names '+h);
  t.eq(T.outside.length, 0, 'still nothing sent while reading the card');
  await page.click('[data-act="lookups-on"]'); await page.waitForSelector('#mapHost');
  await page.waitForTimeout(300);
  const tiles = T.outside.filter(r=>/tile\.openstreetmap\.org/.test(r.url));
  t.ok(tiles.length>0, 'after opting in, map pictures are requested');
  t.ok(T.outside.every(r=>/^https:\/\/(tile|[abc]\.tile)\.openstreetmap\.org\//.test(r.url)), 'and only from the tile host so far');

  /* address search: the exact request is shown first */
  const n0 = T.outside.length;
  await page.fill('#mAddr','1 Test Ave, Mocktown'); await page.click('#mGo');
  await page.waitForSelector('#cfPay');
  t.ok((await page.textContent('#dlg')).includes('nominatim.openstreetmap.org'), 'the address search shows its host');
  t.ok((await page.inputValue('#cfPay')).includes('1 Test Ave'), 'and the exact words that will be sent');
  t.eq(T.outside.filter(r=>/nominatim/.test(r.url)).length, 0, 'nothing is sent until “Search” is tapped');
  await page.click('[data-act="dlg-close"]'); await page.waitForTimeout(100);
  t.eq(T.outside.filter(r=>/nominatim/.test(r.url)).length, 0, 'Cancel sends nothing');
  await page.click('#mGo'); await page.waitForSelector('#cfOk'); await page.click('#cfOk'); await page.waitForTimeout(400);
  t.eq(T.outside.filter(r=>/nominatim/.test(r.url)).length, 1, 'tapping Search sends exactly one address request');
  const pin = (await S()).map.pin; t.ok(pin && Math.abs(pin.lat-39.96)<0.01, 'the pin lands on the mocked result');

  /* building search */
  await page.click('#cGo'); await page.waitForSelector('#cfPay');
  const body = await page.inputValue('#cfPay');
  t.ok(/around/.test(body) && /building/.test(body), 'the building search shows the Overpass request it will send');
  t.ok(SECRETS.every(x=>!body.includes(x)), 'the request text holds none of the planted private data');
  await page.click('#cfOk'); await page.waitForSelector('#results .rcard', {timeout:8000});
  const op = T.outside.filter(r=>/overpass/.test(r.url)); t.eq(op.length, 1, 'one building-search request was made');
  t.eq(op[0].method, 'POST', 'it is a POST to the building-search host');
  const rows = await page.$$eval('#results .rcard', e=>e.map(x=>x.innerText));
  t.ok(rows.length>=2, 'ranked buildings come back ('+rows.length+')');
  t.ok(rows.every(r=>/High|Medium|Lower/.test(r)), 'each shows a band');
  t.ok(rows.some(r=>/Mock Tower A/.test(r)), 'the invented tower is listed');
  t.ok(await page.isVisible('#fewHint'), 'with few results and unknown floors excluded, the app explains why and how to widen it');
  t.ok(!/Mock Tower A/.test(JSON.stringify((await S()).properties)), 'search results are not leads until the owner adds one');

  /* nothing private ever left, to any host */
  const all = T.bodies.join('\n');
  for (const s of SECRETS) t.ok(!all.includes(encodeURIComponent(s)) && !all.includes(s), 'the planted value “'+s+'” was never sent');
  const hosts = [...new Set(T.outside.map(r=>new URL(r.url).host.replace(/^[abc]\./,'')))].sort();
  t.eq(hosts, ['nominatim.openstreetmap.org','overpass-api.de','tile.openstreetmap.org'], 'exactly the three declared hosts were contacted');
  t.ok(T.outside.every(r=>r.method==='GET' || /overpass/.test(r.url)), 'only the building search uses POST');

  /* adding a result to the pipeline: map facts are estimates with a source, never verified */
  await page.click('#results [data-act="cand-add"]'); await page.waitForTimeout(200);
  const st = await S(); const added = st.properties.find(p=>p.osm);
  t.ok(added && added.src==='map', 'a tapped result becomes a map-sourced lead');
  t.ok(added.bld.levels!=null, 'its floor count comes from the map data it was given');
  t.ok(added.f.owner.st==='unknown' && added.f.owner.v==='', 'ownership stays blank: the map does not say who owns it');
  t.eq(added.contacts.length, 0, 'no contact is made up');
  t.ok(added.events[0] && added.events[0].init===true, 'its first event is marked as the starting point, not a touch');
  t.eq(await page.evaluate(i=>lastTouch(findLead(i)), added.id), 0, 'it counts as not yet contacted');

  /* turning lookups off stops it again */
  await tab('settings'); const n1 = T.outside.length;
  await page.uncheck('#swLook'); await tab('map'); await tab('dash'); await tab('map'); await page.waitForTimeout(300);
  t.eq(T.outside.length, n1, 'with lookups off again, the map screen sends nothing');

  t.eq(T.dialogs.length, 0, 'no native dialogs'); t.eq(T.errors, [], 'no page errors');
  await T.close(); t.done();
})().catch(e=>{ console.error(e); process.exit(1); });
