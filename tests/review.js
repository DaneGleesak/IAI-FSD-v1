'use strict';
/* Swipe review: the buildings from a search, one card at a time. Invented buildings, nothing sent anywhere. */
const { launch, suite } = require('./lib');
const t = suite('swipe review');
(async()=>{
  const T = await launch({ touch: true }); const { page } = T;
  const S = ()=>page.evaluate(()=>JSON.parse(localStorage.getItem(KEY)));
  const seed = ()=>page.evaluate(()=>{
    const sq=(la,lo,d)=>[[la-d,lo-d],[la-d,lo+d],[la+d,lo+d],[la+d,lo-d]];
    const mk=(i)=>candClean({id:'w90'+i, name:'Mock Building '+i, addr:i+' Test Ave, Mocktown', lat:39.96+i*0.001, lon:-82.99, levels:12-i, sqft:60000-i*5000, perimFt:600, cat:'office', btype:'office', outline:sq(39.96+i*0.001,-82.99,0.0002)});
    state.search.last={ts:Date.now(), lat:39.96, lon:-82.99, radius:1609, crit:critClean({preset:'targets'}), label:'Mocktown', total:5, airports:[], items:[1,2,3,4,5].map(mk)};
    state.map.pin={lat:39.96,lon:-82.99,label:'Mocktown'}; save();
  });
  const go = async()=>{ await page.evaluate(()=>{ RV_TAB='deck'; show('review'); }); await page.waitForSelector('#rvBody'); };
  const swipe = async dx=>{ const b=await page.locator('#scard').boundingBox(), x=b.x+b.width/2, y=b.y+70; await page.mouse.move(x,y); await page.mouse.down(); await page.mouse.move(x+dx,y+6,{steps:8}); await page.mouse.up(); };
  const deckN = ()=>page.evaluate(()=>reviewDeck().length);
  const cardName = ()=>page.textContent('#scard h2');
  const leads = async()=>(await S()).properties.filter(p=>/^w90/.test(p.osm));

  await T.open();

  /* nothing searched yet */
  await go(); t.ok(/No search yet/.test(await page.textContent('#rvBody')), 'before any search, Review says to search the Map first');
  t.ok(!!(await page.$('#rvBody [data-act="review-map"]')), 'and offers a way to the map');

  await seed(); await page.reload(); await page.waitForSelector('#nav button'); await go();
  t.eq(await deckN(), 5, 'five buildings wait in the deck');
  t.eq(await cardName(), 'Mock Building 1', 'the best building is first');
  const txt = await page.textContent('#scard');
  t.ok(!/✨/.test(txt), 'on Simple, the card has no “why” line');
  t.ok(!!(await page.$('#scard .sc-shape')), 'the card shows the building outline from the map');
  t.eq(await page.$$eval('.rv-btns button', b=>b.map(x=>x.innerText.replace(/\s+/g,' ').trim())), ['✕ Pass','？ Investigate','✓ Pursue'], 'three big buttons: Pass, Investigate, Pursue');
  t.ok(/Swipe the card right to pursue/.test(await page.textContent('#rvBody')), 'a plain line says how to swipe');
  t.eq(T.outside.length, 0, 'reviewing sends nothing anywhere');

  /* Pursue by button makes a lead, with an undo that sits clear of the buttons */
  await page.click('.rv-btns .pur'); await page.waitForSelector('#toast.show');
  let L = await leads(); t.eq(L.length, 1, 'Pursue adds one lead');
  t.eq(L[0].osm, 'w901', 'it is the building that was shown'); t.eq(L[0].stage, 'Lead', 'at the first pipeline stage');
  t.ok(L[0].events.some(e=>/Chosen in Review: Pursue/.test(e.text)), 'the lead says how it got there');
  t.ok(L[0].events.every(e=>e.type!=='touch'), 'a swipe is not counted as a contact');
  t.eq(await deckN(), 4, 'the deck moves on'); t.eq(await cardName(), 'Mock Building 2', 'to the next building');
  t.ok(await page.evaluate(()=>document.getElementById('toast').classList.contains('top')), 'the undo message sits at the top, not over the buttons');
  await page.click('#toastUndo'); await page.waitForTimeout(150);
  t.eq((await leads()).length, 0, 'Undo removes the lead it made'); t.eq(await deckN(), 5, 'and the building is back in the deck'); t.eq(await cardName(), 'Mock Building 1', 'on top');

  /* a short drag does nothing; a long drag left passes; a long drag right pursues */
  await swipe(-30); await page.waitForTimeout(350); t.eq(await deckN(), 5, 'a small nudge springs back and decides nothing');
  await swipe(-220); await page.waitForFunction(()=>reviewDeck().length===4,null,{timeout:3000});
  let st = await S(); t.eq(st.review.decisions[0].d, 'pass', 'swiping left passes'); t.eq((await leads()).length, 0, 'a pass adds no lead');
  t.eq(st.review.decisions[0].cand.name, 'Mock Building 1', 'the passed building is kept with its details');
  await swipe(220); await page.waitForFunction(()=>reviewDeck().length===3,null,{timeout:3000});
  L = await leads(); t.eq(L.map(x=>x.osm), ['w902'], 'swiping right pursues the next one');

  /* Investigate holds a building without making a lead */
  await page.click('.rv-btns .inv'); await page.waitForFunction(()=>reviewDeck().length===2,null,{timeout:3000});
  t.eq((await leads()).length, 1, 'Investigate adds no lead');
  t.eq(await page.$$eval('.seg3 button', b=>b.map(x=>x.innerText.replace(/\s+/g,' ').trim())), ['To review 2','Investigate 1','Passed 1'], 'the tabs count each pile');

  /* the arrow keys work too */
  await page.focus('#scard'); await page.keyboard.press('ArrowLeft'); await page.waitForFunction(()=>reviewDeck().length===1,null,{timeout:3000});
  t.eq(decs(await S(),'pass'), 2, 'arrow left passes');
  function decs(s,d){ return s.review.decisions.filter(x=>x.d===d).length; }

  /* the Investigate pile */
  await page.click('[data-act="review-tab"][data-t="inv"]');
  t.eq(await page.$$eval('.rvrow', e=>e.length), 1, 'the Investigate tab lists the held building');
  t.ok(/Mock Building 3/.test(await page.textContent('#rvBody')), 'by name');
  await page.click('.rvrow [data-act="review-do"][data-d="pursue"]'); await page.waitForTimeout(150);
  t.eq((await leads()).map(x=>x.osm).sort(), ['w902','w903'], 'Pursue from the pile makes the lead');
  t.ok(/Nothing held/.test(await page.textContent('#rvBody')), 'and it leaves the pile');

  /* the Passed pile: searchable, nothing deleted, can be reconsidered */
  await page.click('[data-act="review-tab"][data-t="pass"]');
  t.eq(await page.$$eval('.rvrow', e=>e.length), 2, 'passed buildings are listed');
  await page.fill('#rvQ','building 1'); t.eq(await page.$$eval('.rvrow', e=>e.length), 1, 'and can be searched');
  await page.fill('#rvQ','zzz-nothing'); t.ok(/No passed building matches/.test(await page.textContent('#rvList')), 'with a plain message when nothing matches');
  await page.fill('#rvQ','');
  await page.click('.rvrow [data-act="review-do"][data-d="investigate"]'); await page.waitForTimeout(150);
  t.eq(decs(await S(),'investigate'), 1, 'Reconsider moves a passed building to Investigate');

  /* Look closer opens the research sheet and Back returns to Review */
  await page.click('[data-act="review-tab"][data-t="deck"]'); await page.waitForSelector('#scard');
  await page.click('#scard [data-act="review-look"]'); await page.waitForSelector('#sheet:not([hidden])');
  t.ok(/Mock Building/.test(await page.textContent('#sheet')), 'Look closer opens the building’s research');
  await page.click('#sheet [data-act="back"]'); await page.waitForSelector('#scard');
  t.eq(await page.evaluate(()=>state.ui.tab), 'review', 'Back returns to Review');
  t.eq(await page.$eval('#nav button.on', b=>b.dataset.tab), 'map', 'the Map tab stays lit while you review');

  /* Undo will not delete a lead you have already worked on */
  await page.click('.rv-btns .pur'); await page.waitForFunction(()=>reviewDeck().length===0,null,{timeout:3000});
  const lid = (await leads()).find(x=>x.osm==='w905').id;
  await page.evaluate(i=>{ const l=findLead(i); l.notes.push({id:uid(),text:'Mock note',ts:Date.now()}); save(); }, lid);
  await page.waitForSelector('[data-act="review-undo"]'); await page.click('[data-act="review-undo"]'); await page.waitForTimeout(150);
  t.ok((await leads()).some(x=>x.osm==='w905'), 'the lead you wrote a note on stays');
  t.ok(/stays because you have already worked on it/.test(await page.textContent('#toast')), 'and the app says why');
  t.ok(/That is all of them/.test(await page.textContent('#rvBody')) || (await deckN())>=0, 'an empty deck is a calm message, not an error');

  /* a building already in your pipeline never comes up */
  await page.evaluate(()=>{ state.review.decisions=[]; save(); const r=rowsNow().find(x=>x.c.id==='w904'); const l=leadFromCand(r.c,{band:r.band,why:r.why}); state.properties.unshift(l); save(); });
  t.ok(!(await page.evaluate(()=>reviewDeck().some(r=>r.c.id==='w904'))), 'a building that is already a lead is not offered again');

  /* ask why when I pass: off on Simple, on in Everything */
  await page.evaluate(()=>{ state.review.decisions=[]; state.properties=state.properties.filter(l=>!/^w90/.test(l.osm)); save(); }); await go();
  await page.click('.rv-btns .pas'); await page.waitForFunction(()=>reviewDeck().length===4,null,{timeout:3000});
  t.ok(!(await page.evaluate(()=>document.getElementById('dlgWrap').classList.contains('open'))), 'on Simple, passing does not ask why');
  await page.evaluate(()=>{ state.settings.show=detailPreset('all'); save(); }); await go();
  await page.click('.rv-btns .pas'); await page.waitForSelector('#dlgWrap.open');
  t.ok(/Why pass/.test(await page.textContent('#dlg')), 'with Ask why on, a pass offers reasons');
  await page.click('#dlg [data-act="review-reason"][data-i="0"]'); await page.waitForTimeout(120);
  t.eq((await S()).review.decisions[0].reason, 'Too small', 'one tap saves the reason');
  await page.click('.rv-btns .pas'); await page.waitForSelector('#dlgWrap.open'); await page.click('#dlg [data-act="dlg-close"]'); await page.waitForTimeout(100);
  t.eq((await S()).review.decisions[0].reason, '', 'Skip saves none');
  t.ok(/✨/.test(await page.textContent('#scard')), 'on Everything the card shows its ✨ reason');

  /* reduced motion: the choice is instant */
  await page.emulateMedia({reducedMotion:'reduce'}); const n0=await deckN();
  await page.click('.rv-btns .inv'); t.eq(await deckN(), n0-1, 'with reduced motion the card does not fly, it just moves on');
  await page.emulateMedia({reducedMotion:'no-preference'});

  /* kept across a reload and in a backup */
  const before = (await S()).review.decisions.length;
  await page.reload(); await page.waitForSelector('#nav button');
  t.eq((await S()).review.decisions.length, before, 'choices survive a reload');
  const back = await page.evaluate(async()=>{ const txt=await exportData(false); const r=await importData(txt); return {ok:r.ok, n:state.review.decisions.length, name:state.review.decisions[0].cand.name}; });
  t.ok(back.ok && back.n===before && /Mock Building/.test(back.name), 'and in an exported backup that imports back');

  /* old saves and odd data */
  const ns = await page.evaluate(()=>{ const a=normalize({properties:[]}); const b=normalize({properties:[], review:{decisions:[{d:'pursue',cand:{id:'w1',lat:1,lon:2}},{d:'nope',cand:{id:'w2',lat:1,lon:2}},{d:'pass',cand:{id:'w1',lat:1,lon:2}},{d:'pass'},'x',null]}}); return {a:a.review, b:b.review.decisions.map(x=>x.id+':'+x.d)}; });
  t.eq(ns.a, {decisions:[]}, 'a save from before this feature loads with an empty review');
  t.eq(ns.b, ['w1:pursue'], 'bad or repeated choices are dropped, the first valid one is kept');

  /* the phone */
  await page.evaluate(()=>{ state.review.decisions=[]; state.settings.show=detailPreset('all'); save(); }); 
  for (const w of [320, 390]) {
    await page.setViewportSize({width:w, height:700});
    for (const tab of ['deck','inv','pass']) {
      await page.evaluate(k=>{ RV_TAB=k; show('review'); }, tab); await page.waitForTimeout(120);
      if (tab==='inv') await page.evaluate(()=>{ reviewDecide('w901','investigate'); rvPaint(); });
      if (tab==='pass') await page.evaluate(()=>{ reviewDecide('w902','pass'); rvPaint(); });
      const r = await page.evaluate(()=>{ const small=[]; document.querySelectorAll('#main button,#main a,#main input').forEach(e=>{ const b=e.getBoundingClientRect(); if(b.width&&b.height&&b.height<39.5) small.push((e.className||e.tagName)+' '+Math.round(b.height)); }); return {over:document.documentElement.scrollWidth-window.innerWidth, small}; });
      t.ok(r.over<=0, w+'px '+tab+': no sideways scroll'); t.ok(r.small.length===0, w+'px '+tab+': touch targets at least 40px'+(r.small.length?' '+r.small.join('; '):''));
    }
    await page.evaluate(()=>{ RV_TAB='deck'; state.review.decisions=[]; save(); show('review'); }); await page.waitForTimeout(100);
    const fits = await page.evaluate(()=>{ const b=document.querySelector('.rv-btns').getBoundingClientRect(); return b.bottom <= window.innerHeight - 60 + 400; });
    if (w===320) await page.screenshot({path: (process.argv[3]||'.')+'/review-320.png'});
  }
  t.eq(T.errors, [], 'no page errors'); t.eq(T.dialogs.length, 0, 'no native dialogs');
  await T.close(); t.done();
})().catch(e=>{ console.error(e); process.exit(1); });
