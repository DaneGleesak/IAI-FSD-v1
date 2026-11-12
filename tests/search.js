'use strict';
/* The building search is two gentle requests. A busy main server is left alone for a while and the (owner-approved) backup answers; the app says exactly what happened. */
const { launch, suite } = require('./lib');
const t = suite('building search in parts');
(async()=>{
  const T = await launch({ touch: true }); const { page } = T;
  const S = ()=>page.evaluate(()=>JSON.parse(localStorage.getItem(KEY)));
  const SECRETS = ['ZZ-SECRET-NOTE','secret.person@example.test','ZZ-SECRET-CO'];
  await T.open();
  await page.evaluate(()=>{ state.settings.lookups.on=true; state.map.pin={lat:39.96,lon:-82.99,label:'Mocktown'}; state.map.radius=4828; state.map.crit=critClean({preset:'targets'}); state.settings.sender.company='ZZ-SECRET-CO';
    const l=newLead({name:'Mock Lead', notes:[{id:uid(),text:'ZZ-SECRET-NOTE',ts:1}]}); state.properties.unshift(l); save(); OVERPASS_RETRY_MS=40; });
  await page.reload(); await page.waitForSelector('#nav button'); await page.evaluate(()=>{ OVERPASS_RETRY_MS=40; });
  const reset = ()=>{ T.outside.length=0; T.bodies.length=0; };
  const run = async()=>{ await page.evaluate(()=>show('map')); await page.waitForSelector('#cGo'); await page.click('#cGo'); await page.waitForSelector('#cfPay'); return page.inputValue('#cfPay'); };
  const ops = ()=>T.outside.filter(r=>/overpass/.test(r.url));

  const main = ()=>T.outside.filter(r=>/overpass-api\.de/.test(r.url)), backup = ()=>T.outside.filter(r=>/overpass\.private\.coffee/.test(r.url));
  const calm = ()=>page.evaluate(()=>{ Object.keys(overpassHold).forEach(k=>delete overpassHold[k]); state.search.last=null; save(); });   // as if the 30 s wait were over
  const go = async()=>{ await run(); await page.click('#cfOk'); };
  const done = ()=>page.waitForSelector('#results .rcard', {timeout:10000});
  const toastHas = (re,ms)=>page.waitForFunction(r=>new RegExp(r).test(document.getElementById('toast').textContent), re.source, {timeout:ms||15000});

  /* the normal case: two gentle requests, to the main server only */
  reset(); const shown = await run();
  const marks = (shown.match(/^\/\/ ---- request \d+ of \d+: .*$/gm)||[]);
  t.eq(marks.length, 2, 'the confirm step lists two requests'); t.ok(/Buildings/.test(marks[0]) && /Airports/.test(marks[1]), 'the buildings, then the airports');
  const dtxt = await page.textContent('#dlg');
  t.ok(/gentle requests/.test(dtxt), 'and says they are gentle'); t.ok(/overpass-api\.de/.test(dtxt) && /overpass\.private\.coffee/.test(dtxt) && /backup/.test(dtxt), 'it names the main server and the backup, and says when the backup is used');
  t.ok(SECRETS.every(x=>!shown.includes(x)), 'none of the planted private data is in them');
  t.eq(ops().length, 0, 'nothing is sent before Search is tapped');
  await page.click('#cfOk'); await done();
  t.eq(main().length, 2, 'two POSTs were made, one for each request shown'); t.eq(backup().length, 0, 'the backup server was not contacted'); t.ok(ops().every(r=>r.method==='POST'), 'all POSTs');
  t.ok(T.bodies.join('\n').indexOf('ZZ-SECRET')<0, 'nothing private was sent');
  let L = (await S()).search.last; t.eq(L.partial, [], 'nothing is marked unfinished'); t.ok(!(await page.$('#partialNote')), 'and there is no warning');
  t.eq(L.items.length, 3, 'the buildings come back once each');

  /* the main server says "too many requests": it is left alone for a while and the backup answers */
  reset(); await calm();
  T.hooks.overpass = ()=>({status:429});
  await go(); await done();
  L = (await S()).search.last; t.eq(L.partial, [], 'the backup gave a complete answer'); t.ok(L.items.length>=2, 'with buildings');
  t.eq(main().length, 1, 'the main server was asked once and not pushed again after its 429'); t.eq(backup().length, 2, 'the backup answered both requests');
  t.ok(/backup server/.test(await page.textContent('#toast')) && /older/.test(await page.textContent('#toast')), 'the message says the backup was used and its data can be older');
  reset(); await page.evaluate(()=>{ state.search.last=null; save(); });
  await go(); await done();
  t.eq(main().length, 0, 'a second search straight after does not touch the main server (it asked us to wait)'); t.eq(backup().length, 2, 'the backup answers again');

  /* the main server cannot be reached at all: the backup answers */
  reset(); await calm(); T.hooks.overpass = ()=>({abort:true}); T.hooks.overpass2 = null;
  await go(); await done();
  t.eq((await S()).search.last.partial, [], 'no connection to the main server is not the end'); t.ok(backup().length>=1, 'the backup was used');

  /* both servers say 429: stop at once, say why, and ask nothing more until the wait is over */
  reset(); await calm(); T.hooks.overpass = ()=>({status:429}); T.hooks.overpass2 = ()=>({status:429});
  await go(); await toastHas(/Search failed/);
  t.ok(/too many requests \(HTTP 429\)/.test(await page.textContent('#toast')), 'the message names the problem and the code');
  t.eq(main().length, 1, 'one request to the main server'); t.eq(backup().length, 1, 'one to the backup'); t.eq(ops().length, 2, 'and the airports request was not even tried');
  t.eq((await S()).search.last, null, 'a search that found nothing at all saves nothing'); t.ok(await page.$eval('#cGo', b=>!b.disabled), 'the Search button is ready again');
  reset(); await page.click('#cGo'); await page.waitForSelector('#cfOk'); await page.click('#cfOk'); await toastHas(/slow down/);
  t.ok(/Wait \d+ seconds/.test(await page.textContent('#toast')), 'trying again at once is answered with how long to wait'); t.eq(ops().length, 0, 'and nothing was sent');

  /* a gateway error earns one more round after a pause, and a good answer leaves no trace */
  reset(); await calm(); let c1=0, c2=0; T.hooks.overpass = ()=>++c1===1 ? {status:504} : null; T.hooks.overpass2 = ()=>++c2===1 ? {status:504} : null;
  await go(); await done();
  t.eq((await S()).search.last.partial, [], 'the second round worked'); t.eq(main().length, 3, 'main: buildings, buildings again, airports'); t.eq(backup().length, 1, 'backup: asked once in the first round');
  t.ok(!(await page.$('#partialNote')), 'with no warning');

  /* the server ran out of time: that is a failed search, not "nothing found", and nobody is asked again */
  reset(); await calm(); T.hooks.overpass = body=>/"building"/.test(body) ? {json:{elements:[], remark:'runtime error: Query timed out in "query" at line 3 after 46 seconds.'}} : null; T.hooks.overpass2 = null;
  await go(); await toastHas(/Search failed/);
  t.ok(/ran out of time/.test(await page.textContent('#toast')) && /smaller radius/.test(await page.textContent('#toast')), 'it says the area was too big and to try a smaller radius');
  t.eq(ops().length, 1, 'one request in all: no retry, no backup, no airports'); t.eq((await S()).search.last, null, 'nothing saved');

  /* the airports are optional */
  reset(); await calm(); T.hooks.overpass = body=>/aeroway/.test(body) ? {status:503} : null; T.hooks.overpass2 = body=>/aeroway/.test(body) ? {status:503} : null;
  await go(); await done();
  L = (await S()).search.last; t.eq(L.partial, ['Airport distances'], 'losing the airports is said plainly'); t.ok(L.items.length>=2, 'and the buildings are kept');
  t.ok(/Not everything was searched/.test(await page.textContent('#partialNote')), 'with a warning on the results'); t.ok(/Partly done/.test(await page.textContent('#toast')), 'and a message');

  /* both busy with a gateway error: say so, with the code, and save nothing */
  reset(); await calm(); T.hooks.overpass = ()=>({status:504}); T.hooks.overpass2 = ()=>({status:504});
  await go(); await toastHas(/HTTP 504/);
  t.ok(/overloaded \(HTTP 504\)/.test(await page.textContent('#toast')), '504 is called overloaded, with its code'); t.eq(main().length, 2, 'main asked twice (one pause between)'); t.eq(backup().length, 2, 'backup asked twice');

  /* and then it works */
  reset(); await calm(); T.hooks.overpass = null; T.hooks.overpass2 = null; await page.click('#cGo'); await page.waitForSelector('#cfOk'); await page.click('#cfOk'); await done();
  t.ok((await S()).search.last.items.length>=2, 'the next try works');
  /* the connection check: one tiny test to each service, shown plainly */
  reset(); await page.evaluate(()=>show('settings')); await page.waitForSelector('[data-act="net-check"]');
  await page.click('[data-act="net-check"]'); await page.waitForSelector('#cfPay');
  const shownNet = await page.inputValue('#cfPay'), dlgTxt = await page.textContent('#dlg');
  t.eq((shownNet.match(/^\d\. /gm)||[]).length, 5, 'the confirm step lists the five tests');
  t.ok(['tile.openstreetmap.org','nominatim.openstreetmap.org','overpass-api.de','overpass.private.coffee','gis.cuyahogacounty.gov'].every(h=>dlgTxt.includes(h)), 'and names all five services');
  t.ok(SECRETS.every(x=>!shownNet.includes(x)) && !/lead|contact|price/i.test(shownNet.replace(/Nothing.*/,'')), 'none of it comes from your data');
  t.eq(T.outside.length, 0, 'nothing is sent before Check is tapped');
  await page.click('#cfOk'); await page.waitForSelector('[data-act="net-copy"]', {timeout:15000});
  t.eq(T.outside.length, 5, 'five tests were sent'); t.eq(T.outside.filter(r=>r.method==='POST').length, 2, 'two of them POSTs (main and backup building search)');
  let lines = await page.$$eval('#netOut p.sm', e=>e.map(x=>x.innerText));
  t.eq(lines.filter(x=>/^✅/.test(x)).length, 5, 'all five show a tick when the services answer'); t.ok(lines.every(x=>/HTTP 200/.test(x)||!/^✅/.test(x)), 'each with its HTTP code');
  reset(); T.hooks.overpass = ()=>({status:429});
  await page.click('[data-act="net-check"]'); await page.waitForSelector('#cfOk'); await page.click('#cfOk'); await page.waitForFunction(()=>/HTTP 429/.test(document.getElementById('netOut').innerText), null, {timeout:15000});
  await page.waitForSelector('[data-act="net-copy"]');
  lines = await page.$$eval('#netOut p.sm', e=>e.map(x=>x.innerText));
  t.ok(lines.some(x=>/^❌ Building search · HTTP 429/.test(x)), 'a busy service shows as a cross with its code'); t.eq(lines.filter(x=>/^✅/.test(x)).length, 4, 'and the others still show their tick');
  t.ok(/FAIL Building search · HTTP 429/.test(await page.$eval('#netOut', e=>e.dataset.full)) && /App: http/.test(await page.$eval('#netOut', e=>e.dataset.full)), 'the copy-able version says the same, with the app address on top');
  await page.evaluate(()=>{ state.settings.lookups.on=false; save(); show('settings'); }); await page.waitForTimeout(150);
  t.ok(!(await page.$('[data-act="net-check"]')) && /Turn on lookups above first/.test(await page.textContent('#main')), 'with lookups off there is no test button');
  t.eq(T.errors, [], 'no page errors'); t.eq(T.dialogs.length, 0, 'no native dialogs');
  await T.close(); t.done();
})().catch(e=>{ console.error(e); process.exit(1); });
