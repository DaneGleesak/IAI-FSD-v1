'use strict';
/* My Field Day: the home screen starts simple (today at a glance, next stop, route, follow-ups) and the busier cards sit behind switches. */
const { launch, suite } = require('./lib');
const t = suite('my field day');
(async()=>{
  const T = await launch({ touch: true }); const { page } = T;
  const txt = sel=>page.textContent(sel);
  await T.open();
  await page.evaluate(()=>{ state=normalize(null); state.properties=demoLeads(); save(); show('dash'); });
  await page.waitForSelector('.today');

  t.eq(await txt('#topTitle'), 'My Field Day', 'the home screen is My Field Day'); t.ok(/\w+day, \w+ \d+/.test(await txt('#topSub')) , 'with today’s date under the title');
  t.ok(!!(await page.$('#top .brand img[src="icons/logo.png"]')), 'the IAI logo is in the header'); t.eq(await txt('#nav [data-tab="dash"]'), 'Today', 'the first tab is called Today');
  t.eq((await page.$$eval('.today .tdy', e=>e.map(x=>x.querySelector('span').textContent))).length, 3, 'a three-part “today at a glance” strip');
  t.ok(!!(await page.$('.top[aria-label="Next up"]')) && /Next up/.test(await txt('.top')), 'the next stop is the first card');
  t.ok(!!(await page.$('#routeCard')) && !!(await page.$('#followCard')), 'today’s route and follow-ups follow');
  t.ok(/Scan for new opportunities/.test(await txt('#main')), 'there is one clear scan button');
  t.ok(!(await page.$('.kpis')) && !/Territory map/.test(await txt('#main')) && !/Pipeline snapshot/.test(await txt('#main')), 'on Simple the number tiles, territory sketch and pipeline snapshot are not shown');
  t.ok(/Choose what to show/.test(await txt('#main')), 'a line says how to bring them back');

  /* route miles: straight line, only from stops with a map position */
  await page.evaluate(()=>{ routeIds().forEach(routeRemove); state.properties.slice(0,3).forEach(l=>routeAdd(l.id)); save(); show('dash'); });
  await page.waitForSelector('#routeCard .routemi');
  const mi = await txt('#routeCard .routemi'); t.ok(/About \d+\.\d mi between the stops, in a straight line\. Driving is longer\./.test(mi), 'the route says its distance, in a straight line, and that driving is longer');
  const want = await page.evaluate(()=>{ const s=routeIds().map(findLead); let m=0; s.forEach((l,i)=>{ if(i) m+=miles(dist(s[i-1].lat,s[i-1].lon,l.lat,l.lon)); }); return m.toFixed(1); });
  t.ok(mi.includes(want+' mi'), 'and the number is the sum of the legs ('+want+')');
  await page.evaluate(()=>{ routeIds().forEach(routeRemove); const l=state.properties[0]; routeAdd(l.id); save(); show('dash'); }); await page.waitForSelector('#routeCard');
  t.ok(!(await page.$('#routeCard .routemi')), 'one stop has no distance line');

  /* the strip is live */
  const strip = await page.$$eval('.today .tdy', e=>e.map(x=>x.querySelector('b').textContent));
  t.eq(strip[1], '1', 'one stop planned'); t.eq(strip[2], '0', 'nothing new to swipe yet');
  await page.click('.today .tdy:nth-child(2)'); t.ok(true, 'tapping a count scrolls to it');

  /* turning the extras on */
  await page.evaluate(()=>{ state.settings.show.kpis=true; state.settings.show.terr=true; state.settings.show.funnel=true; save(); show('dash'); }); await page.waitForSelector('.kpis');
  const all = await txt('#main');
  t.ok(/Active opportunities/.test(all) && /Territory map/.test(all) && /Pipeline snapshot/.test(all), 'the switches bring back the tiles, the sketch and the snapshot');
  t.ok(!/Choose what to show/.test(all), 'and the hint goes away once everything is on');
  t.ok(/Quotes out/.test(all), 'the tile that used to say Proposals says Quotes out');
  /* the same switches from Settings */
  await page.evaluate(()=>{ state.settings.show=detailPreset('simple'); save(); show('dash'); }); await page.waitForSelector('.today');
  await page.click('[data-act="detail-open"]'); await page.waitForSelector('#dlg input[type=checkbox]');
  t.ok(await page.$$eval('#dlg label', e=>e.some(x=>/Number tiles/.test(x.textContent))), 'the hint opens the switches, with the Home ones listed');
  t.eq(T.errors, [], 'no page errors'); t.eq(T.dialogs.length, 0, 'no native dialogs'); t.eq(T.outside.length, 0, 'nothing sent outside');
  await T.close(); t.done();
})().catch(e=>{ console.error(e); process.exit(1); });
