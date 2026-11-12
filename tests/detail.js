'use strict';
/* "How much to show": switches that start the screens simple and let more on as the taps become habit. */
const { launch, suite } = require('./lib');
const t = suite('how much to show');
(async()=>{
  const T = await launch({ touch: true }); const { page } = T;
  const S = ()=>page.evaluate(()=>JSON.parse(localStorage.getItem(KEY)));
  const txt = sel=>page.textContent(sel);
  await T.open();
  await page.evaluate(()=>{
    loadDemo();
    const l=state.properties.find(p=>p.name==='Demo Tower One'); l.why=['Mock reason for the rank']; l.f.owner=blankFact('Mock Owner Co','estimated','You typed it'); l.estValue=12345; save();
    const mk=i=>candClean({id:'w90'+i, name:'Mock Building '+i, addr:i+' Test Ave, Mocktown', lat:39.96+i*0.001, lon:-82.99, levels:12-i, sqft:60000, perimFt:600, cat:'office', btype:'office'});
    state.search.last={ts:Date.now(), lat:39.96, lon:-82.99, radius:1609, crit:critClean({preset:'targets'}), label:'Mocktown', total:3, airports:[], items:[1,2,3].map(mk)};
    state.map.pin={lat:39.96,lon:-82.99,label:'Mocktown'}; state.settings.lookups.on=true; save();
  });
  await page.reload(); await page.waitForSelector('#nav button');
  const leadsPage = async()=>{ await page.evaluate(()=>show('leads')); await page.waitForSelector('#lList .lcard'); return txt('#lList'); };

  /* a fresh install is Simple */
  t.eq((await S()).settings.show.why, false, 'a new install starts with “why it ranks” hidden');
  await page.evaluate(()=>show('settings')); await page.waitForSelector('#detailBox');
  t.ok(/How much to show/.test(await txt('#main')), 'Settings has a How much to show panel');
  t.eq(await page.$eval('#detailBox .seg .on', b=>b.textContent), 'Simple', 'set to Simple');
  t.eq(await page.$$eval('#detailBox input[type=checkbox]', e=>e.length), 15, 'fifteen switches, in four groups');
  t.eq(await page.$$eval('#detailBox .lab', e=>e.map(x=>x.textContent)), ['On My Field Day','On building cards','Map results','Swipe review'], 'grouped by where they show');

  /* Simple leads page: the essentials only */
  let L = await leadsPage();
  t.ok(/Demo Tower One/.test(L) && /100 Example Ave/.test(L), 'Simple shows the name and address');
  t.ok(/Next action/i.test(L), 'and the next action');
  t.ok(!/Last contact/i.test(L) && !/Est\. value/i.test(L) && !/Mock reason/.test(L) && !/Mock Owner Co/.test(L), 'but not last contact, value, the ✨ reason or the owner');
  t.ok(/DEMO DATA/.test(L), 'DEMO DATA is always shown, whatever the switches');

  /* More */
  await page.evaluate(()=>show('settings')); await page.click('#detailBox [data-act="detail-preset"][data-p="more"]');
  t.eq(await page.$eval('#detailBox .seg .on', b=>b.textContent), 'More', 'tapping More selects it');
  L = await leadsPage();
  t.ok(/Last contact/i.test(L) && /Est\. value/i.test(L) && /Mock reason for the rank/.test(L), 'More adds last contact, value and the ✨ reason');
  t.ok(!/Mock Owner Co/.test(L), 'but still not the owner');
  /* Everything */
  await page.evaluate(()=>{ state.settings.show=detailPreset('all'); save(); }); L = await leadsPage();
  t.ok(/Owner: Mock Owner Co/.test(L), 'Everything adds the owner');
  t.ok(await page.evaluate(()=>[...document.querySelectorAll('.lc-meta')].every(m=>m.classList.contains('m3'))), 'with all three numbers in a row');

  /* one switch at a time: the street address */
  await page.evaluate(()=>show('settings')); await page.waitForSelector('#detailBox');
  await page.click('#detailBox input[data-k="addr"]'); await page.waitForTimeout(100);
  t.eq((await S()).settings.show.addr, false, 'turning a switch off is saved');
  t.ok(/Your own mix/.test(await txt('#detailBox')) && !(await page.$('#detailBox .seg .on')), 'a hand-made mix is called out, with no preset lit');
  L = await leadsPage(); t.ok(!/100 Example Ave/.test(L) && /Demo Tower One/.test(L), 'the address leaves the cards, the name stays');
  await page.reload(); await page.waitForSelector('#nav button'); L = await leadsPage(); t.ok(!/100 Example Ave/.test(L), 'it is still off after a reload');
  t.ok(/Show: Custom/.test(await txt('#main')), 'the Show button says Custom');

  /* the Show button opens the same panel from the busy screens */
  await page.click('#main [data-act="detail-open"]'); await page.waitForSelector('#dlg #detailBox');
  t.eq(await page.$$eval('#dlg input[type=checkbox]', e=>e.length), 15, 'the Show button opens the same switches');
  await page.click('#dlg [data-act="detail-preset"][data-p="simple"]'); await page.waitForTimeout(80);
  await page.click('#dlg [data-act="dlg-close"]'); await page.waitForTimeout(150);
  L = await txt('#lList'); t.ok(/100 Example Ave/.test(L) && !/Est\. value/i.test(L), 'Done repaints the page with the new choice');
  t.ok(/Show: Simple/.test(await txt('#main')), 'and the button says Simple');

  /* the map results */
  await page.evaluate(()=>show('map')); await page.waitForSelector('#results .rcard');
  t.ok(!(await page.$('#lens')) && !(await page.$('#results .why1')), 'Simple results: no “Rank by” row, no ✨ lines');
  t.ok(/Best first, a suggestion from the map/.test(await txt('#results')), 'but one plain line still says the order is a suggestion');
  t.ok(!!(await page.$('#results [data-act="review-open"]')), 'and a Swipe through button is right there');
  await page.evaluate(()=>{ state.settings.show=detailPreset('more'); save(); show('map'); }); await page.waitForSelector('#results .rcard');
  t.ok(!!(await page.$('#lens')) && !!(await page.$('#results .why1')), 'More brings back “Rank by” and the ✨ lines');
  t.ok(/order is a suggestion from what the map says/.test(await txt('#results')), 'and the full explanation');
  await page.evaluate(()=>{ state.settings.show=Object.assign(detailPreset('more'),{band:false,facts:false,addr:false}); save(); show('map'); }); await page.waitForSelector('#results .rcard');
  const gone = await page.$eval('#results .rcard', e=>({band:!!e.querySelector('.bpill'), facts:!!e.querySelector('.lc-chips .chip-s'), addr:/Test Ave/.test(e.innerText)}));
  t.eq(gone, {band:false, facts:false, addr:false}, 'band, facts and address can each be switched off on result cards');

  /* the dashboard's top lead follows the same switches */
  await page.evaluate(()=>{ state.settings.show=detailPreset('simple'); save(); show('dash'); }); await page.waitForSelector('.card.top');
  t.eq(await page.$$eval('.card.top .lc-meta > div', e=>e.length), 1, 'Simple: the top lead shows one number, the next action');
  await page.evaluate(()=>{ state.settings.show=detailPreset('all'); save(); show('dash'); }); await page.waitForSelector('.card.top');
  t.eq(await page.$$eval('.card.top .lc-meta > div', e=>e.length), 3, 'Everything: all three');

  /* nothing is deleted by hiding */
  const before = JSON.stringify((await S()).properties.map(p=>[p.id,p.why,p.f,p.estValue]));
  await page.evaluate(()=>{ state.settings.show=detailPreset('simple'); save(); });
  t.eq(JSON.stringify((await S()).properties.map(p=>[p.id,p.why,p.f,p.estValue])), before, 'hiding a detail never touches the records');

  /* backups and old saves */
  await page.evaluate(()=>{ state.settings.show=Object.assign(detailPreset('simple'),{why:true}); save(); });
  const rt = await page.evaluate(async()=>{ const txt=await exportData(false); state.settings.show=detailPreset('all'); await importData(txt); return state.settings.show; });
  t.eq(rt.why, true, 'the switches come back from a backup'); t.eq(rt.value, false, 'exactly as they were');
  const old = await page.evaluate(()=>({a:normalize({properties:[]}).settings.show, b:normalize({properties:[], settings:{show:{why:true, value:'yes'}}}).settings.show}));
  t.eq(old.a, await page.evaluate(()=>detailPreset('simple')), 'a save from before this feature opens on Simple');
  t.ok(old.b.why===true && old.b.value===false, 'a partly-filled setting keeps what is valid and defaults the rest');
  const mig = await page.evaluate(()=>{ const f=n=>{ const p=detailPreset(n), o={}; Object.keys(p).slice(0,12).forEach(k=>o[k]=p[k]); return normalize({properties:[], settings:{show:o}}).settings.show; }; return {more:f('more'), simple:f('simple'), all:f('all')}; });
  t.ok(mig.more.kpis && mig.more.terr && mig.more.funnel, 'a save that was on More keeps the Home extras it would have had');
  t.ok(!mig.simple.kpis && !mig.simple.terr && !mig.simple.funnel, 'a save on Simple stays simple on Home'); t.ok(mig.all.kpis, 'and Everything stays everything');

  /* phone width, with everything on */
  await page.evaluate(()=>{ state.settings.show=detailPreset('all'); save(); });
  for (const w of [320, 390]) {
    await page.setViewportSize({width:w, height:700});
    for (const v of ['leads','map','dash','settings']) {
      await page.evaluate(k=>show(k), v); await page.waitForTimeout(250);
      const r = await page.evaluate(()=>{ const small=[]; document.querySelectorAll('#main button,#main a,#main input').forEach(e=>{ const lab=e.closest('label'), b=(lab||e).getBoundingClientRect(); if(b.width&&b.height&&b.height<39.5) small.push((e.className||e.tagName)+' '+Math.round(b.height)); }); return {over:document.documentElement.scrollWidth-window.innerWidth, small:[...new Set(small)].slice(0,4)}; });
      t.ok(r.over<=0, w+'px '+v+' on Everything: no sideways scroll'); t.ok(r.small.length===0, w+'px '+v+': touch targets at least 40px'+(r.small.length?' '+r.small.join('; '):''));
    }
    await page.evaluate(()=>show('leads')); await page.click('#main [data-act="detail-open"]'); await page.waitForSelector('#dlg #detailBox');
    t.ok(await page.evaluate(()=>{ const d=document.getElementById('dlg'); return d.scrollWidth<=d.clientWidth+1; }), w+'px: the panel has no sideways scroll'); await page.click('#dlg [data-act="dlg-close"]');
  }
  t.eq(T.errors, [], 'no page errors'); t.eq(T.dialogs.length, 0, 'no native dialogs'); t.ok(T.outside.every(r=>/tile\.openstreetmap\.org/.test(r.url)), 'the only outside requests are map pictures, as before');
  await T.close(); t.done();
})().catch(e=>{ console.error(e); process.exit(1); });
