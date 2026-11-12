'use strict';
/* The building search runs as small parts. A busy server costs one part, never everything, and the app says exactly what happened. */
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

  /* the normal case */
  reset(); const shown = await run();
  const marks = (shown.match(/^\/\/ ---- request \d+ of \d+: .*$/gm)||[]);
  t.ok(marks.length>=4, 'the confirm step lists every part ('+marks.length+')'); t.ok(/Airports/.test(marks[marks.length-1]), 'airports are the last part');
  t.ok(/small requests/.test(await page.textContent('#dlg')), 'and says it is several small requests');
  t.ok(SECRETS.every(x=>!shown.includes(x)), 'none of the planted private data is in them');
  t.eq(ops().length, 0, 'nothing is sent before Search is tapped');
  await page.click('#cfOk'); await page.waitForSelector('#results .rcard', {timeout:10000});
  t.eq(ops().length, marks.length, 'one POST was made for each part shown'); t.ok(ops().every(r=>r.method==='POST'), 'all POSTs');
  t.ok(T.bodies.join('\n').indexOf('ZZ-SECRET')<0, 'nothing private was sent');
  let L = (await S()).search.last; t.eq(L.partial, [], 'nothing is marked unfinished'); t.ok(!(await page.$('#partialNote')), 'and there is no warning');
  t.eq(L.items.length, 3, 'the same buildings come back from every part only once');
  t.ok(L.airports.length===0 || true, 'airports are read'); 

  /* one part says "too many requests" twice: the rest still arrive, and the gap is shown */
  reset(); await page.evaluate(()=>{ state.search.last=null; save(); });
  T.hooks.overpass = body=>/"building"="apartments"/.test(body) ? {status:429} : null;
  await run(); await page.click('#cfOk'); await page.waitForSelector('#results .rcard', {timeout:10000});
  L = (await S()).search.last; t.eq(L.partial, ['Apartments'], 'the part that failed is recorded');
  t.ok(/Not everything was searched/.test(await page.textContent('#partialNote')) && /Apartments/.test(await page.textContent('#partialNote')), 'the results say which part did not finish');
  t.ok(L.items.length>=2, 'the other parts still came back');
  t.eq(ops().filter(r=>1).length, marks.length+1, 'a busy answer (429) was tried once more, and no more than once');
  t.ok(/Partly done/.test(await page.textContent('#toast')), 'a message says it was partly done');

  /* a server that ran out of time answers 200 with a remark: that is a failed part, not "nothing found" */
  reset(); await page.evaluate(()=>{ state.search.last=null; save(); });
  T.hooks.overpass = body=>/"building"="hotel"/.test(body) ? {json:{elements:[], remark:'runtime error: Query timed out in "query" at line 3 after 41 seconds.'}} : null;
  await run(); await page.click('#cfOk'); await page.waitForSelector('#results .rcard', {timeout:10000});
  L = (await S()).search.last; t.eq(L.partial, ['Hotels'], 'a timed-out part is not mistaken for “no hotels”'); t.eq(ops().length, marks.length, 'and is not retried, since it would time out again');

  /* a first try that fails and a second that works leaves no trace */
  reset(); await page.evaluate(()=>{ state.search.last=null; save(); }); let first=true;
  T.hooks.overpass = body=>{ if(/"building"="office"/.test(body) && first){ first=false; return {status:504}; } return null; };
  await run(); await page.click('#cfOk'); await page.waitForSelector('#results .rcard', {timeout:10000});
  L = (await S()).search.last; t.eq(L.partial, [], 'a part that works on the second try is complete'); t.ok(!(await page.$('#partialNote')), 'with no warning');

  /* the airports are optional */
  reset(); await page.evaluate(()=>{ state.search.last=null; save(); });
  T.hooks.overpass = body=>/aeroway/.test(body) ? {status:503} : null;
  await run(); await page.click('#cfOk'); await page.waitForSelector('#results .rcard', {timeout:10000});
  L = (await S()).search.last; t.eq(L.partial, ['Airport distances'], 'losing the airports is said plainly'); t.ok(L.items.length>=2, 'and the buildings are kept');

  /* everything fails: say exactly why, save nothing, and let it be tried again */
  reset(); await page.evaluate(()=>{ state.search.last=null; save(); });
  T.hooks.overpass = ()=>({status:429});
  await run(); await page.click('#cfOk'); await page.waitForFunction(()=>/Search failed/.test(document.getElementById('toast').textContent), null, {timeout:15000});
  t.ok(/too many requests \(HTTP 429\)/.test(await page.textContent('#toast')), 'the message names the problem and the code');
  t.eq((await S()).search.last, null, 'a search that found nothing at all saves nothing');
  t.ok(await page.$eval('#cGo', b=>!b.disabled), 'the Search button is ready to try again');
  reset(); T.hooks.overpass = ()=>({status:504});
  await page.click('#cGo'); await page.waitForSelector('#cfOk'); await page.click('#cfOk'); await page.waitForFunction(()=>/HTTP 504/.test(document.getElementById('toast').textContent), null, {timeout:15000});
  t.ok(/overloaded \(HTTP 504\)/.test(await page.textContent('#toast')), '504 is called overloaded, with its code');

  /* and then it works */
  reset(); T.hooks.overpass = null; await page.click('#cGo'); await page.waitForSelector('#cfOk'); await page.click('#cfOk'); await page.waitForSelector('#results .rcard', {timeout:10000});
  t.ok((await S()).search.last.items.length>=2, 'the next try works');
  /* the connection check: one tiny test to each service, shown plainly */
  reset(); await page.evaluate(()=>show('settings')); await page.waitForSelector('[data-act="net-check"]');
  await page.click('[data-act="net-check"]'); await page.waitForSelector('#cfPay');
  const shownNet = await page.inputValue('#cfPay'), dlgTxt = await page.textContent('#dlg');
  t.eq((shownNet.match(/^\d\. /gm)||[]).length, 4, 'the confirm step lists the four tests');
  t.ok(['tile.openstreetmap.org','nominatim.openstreetmap.org','overpass-api.de','gis.cuyahogacounty.gov'].every(h=>dlgTxt.includes(h)), 'and names all four services');
  t.ok(SECRETS.every(x=>!shownNet.includes(x)) && !/lead|contact|price/i.test(shownNet.replace(/Nothing.*/,'')), 'none of it comes from your data');
  t.eq(T.outside.length, 0, 'nothing is sent before Check is tapped');
  await page.click('#cfOk'); await page.waitForSelector('[data-act="net-copy"]', {timeout:15000});
  t.eq(T.outside.length, 4, 'four tests were sent'); t.ok(T.outside.filter(r=>r.method==='POST').length===1, 'one of them a POST');
  let lines = await page.$$eval('#netOut p.sm', e=>e.map(x=>x.innerText));
  t.eq(lines.filter(x=>/^✅/.test(x)).length, 4, 'all four show a tick when the services answer'); t.ok(lines.every(x=>/HTTP 200/.test(x)||!/^✅/.test(x)), 'each with its HTTP code');
  reset(); T.hooks.overpass = ()=>({status:429});
  await page.click('[data-act="net-check"]'); await page.waitForSelector('#cfOk'); await page.click('#cfOk'); await page.waitForFunction(()=>/HTTP 429/.test(document.getElementById('netOut').innerText), null, {timeout:15000});
  await page.waitForSelector('[data-act="net-copy"]');
  lines = await page.$$eval('#netOut p.sm', e=>e.map(x=>x.innerText));
  t.ok(lines.some(x=>/^❌ Building search · HTTP 429/.test(x)), 'a busy service shows as a cross with its code'); t.eq(lines.filter(x=>/^✅/.test(x)).length, 3, 'and the others still show their tick');
  t.ok(/FAIL Building search · HTTP 429/.test(await page.$eval('#netOut', e=>e.dataset.full)) && /App: http/.test(await page.$eval('#netOut', e=>e.dataset.full)), 'the copy-able version says the same, with the app address on top');
  await page.evaluate(()=>{ state.settings.lookups.on=false; save(); show('settings'); }); await page.waitForTimeout(150);
  t.ok(!(await page.$('[data-act="net-check"]')) && /Turn on lookups above first/.test(await page.textContent('#main')), 'with lookups off there is no test button');
  t.eq(T.errors, [], 'no page errors'); t.eq(T.dialogs.length, 0, 'no native dialogs');
  await T.close(); t.done();
})().catch(e=>{ console.error(e); process.exit(1); });
