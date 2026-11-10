'use strict';
/* Phone-size checks: no sideways scroll at 320 and 390 px, comfortable touch targets, safe areas.
   Pass an output folder as the 2nd argument to also save screenshots to look at. */
const fs = require('fs'), path = require('path');
const { launch, suite } = require('./lib');
const t = suite('phone layout');
const out = process.argv[3] ? path.resolve(process.argv[3]) : null; if (out) fs.mkdirSync(out,{recursive:true});
(async()=>{
  for (const w of [320, 390]) {
    const T = await launch({w, h:760}); const { page } = T;
    await T.open();
    const shot = async n=>{ if(out) await page.screenshot({path:path.join(out, n+'-'+w+'.png')}); };
    const check = async what=>{
      const r = await page.evaluate(()=>{
        const root=document.getElementById('sheet').hidden?document.documentElement:document.getElementById('sheet');
        const over = document.documentElement.scrollWidth - window.innerWidth;
        const sheetOver = !document.getElementById('sheet').hidden ? document.getElementById('sheet').scrollWidth - document.getElementById('sheet').clientWidth : 0;
        const small=[]; 
        document.querySelectorAll('button,a.btn,a.chip,a.fb,input[type=checkbox],input[type=text],input[type=search],textarea').forEach(e=>{
          const b=e.getBoundingClientRect(); if(!b.width||!b.height) return;
          const cs=getComputedStyle(e); if(cs.visibility==='hidden'||cs.display==='none') return;
          const wrapper = e.closest('label'); const bb = wrapper? wrapper.getBoundingClientRect():b;
          if(Math.max(b.height,bb.height)<39.5) small.push((e.className||e.tagName)+' '+Math.round(b.height)+'px "'+(e.innerText||e.getAttribute('aria-label')||'').slice(0,20)+'"');
        });
        return {over, sheetOver, small:[...new Set(small)].slice(0,6)};
      });
      t.ok(r.over<=0, w+'px '+what+': no sideways page scroll (overflow '+r.over+'px)');
      t.ok(r.sheetOver<=0, w+'px '+what+': no sideways sheet scroll');
      t.ok(r.small.length===0, w+'px '+what+': touch targets are at least 40px high'+(r.small.length?' — too small: '+r.small.join('; '):''));
    };
    for (const k of ['dash','map','leads','pipe','settings']) { await page.click('#nav [data-tab="'+k+'"]'); await page.waitForTimeout(150); await check('tab '+k); await shot('tab-'+k); }
    /* turn on lookups so the working map screen is checked too */
    await page.evaluate(()=>{ state.settings.lookups.on=true; state.settings.lookups.autoSend=true; state.map.pin={lat:39.96,lon:-82.99,label:'Mocktown'}; save(); show('map'); });
    await page.waitForSelector('#mapHost'); await page.waitForTimeout(300); await check('map search'); await shot('map-search');
    await page.click('#cGo'); await page.waitForSelector('#results .rcard',{timeout:8000}); await check('map results'); 
    await page.evaluate(()=>{ document.querySelector('#results').scrollIntoView(); }); await shot('map-results');
    /* pipeline views */
    await page.click('#nav [data-tab="pipe"]');
    for (const v of ['map','boards','list']) { await page.click('#main [data-act="pipe-view"][data-v="'+v+'"]'); await page.waitForTimeout(120); await check('pipeline '+v); await shot('pipe-'+v); }
    /* property intelligence, every tab */
    const id = await page.evaluate(()=>state.properties.find(p=>p.name==='Demo Tower One').id);
    await page.evaluate(i=>openLead(i), id); await page.waitForSelector('#sheet:not([hidden])');
    for (const k of ['overview','contacts','services','notes','files']) { await page.click('#sheet [data-act="pi-tab"][data-t="'+k+'"]'); await page.waitForTimeout(120); await check('property '+k); await shot('pi-'+k); }
    /* dialogs */
    await page.click('#sheet [data-act="quote-open"]'); await page.waitForSelector('#qSave'); await check('quote dialog'); await shot('dlg-quote'); await page.click('#dlg [data-act="dlg-close"]');
    await page.click('#sheet [data-act="mail-open"]'); await page.waitForSelector('#eBody'); await check('email dialog'); await shot('dlg-email'); await page.click('#dlg [data-act="dlg-close"]');
    await page.click('#sheet [data-act="back"]');
    t.eq(T.errors, [], w+'px: no page errors'); t.eq(T.dialogs.length, 0, w+'px: no native dialogs');
    await T.close();
  }
  t.done();
})().catch(e=>{ console.error(e); process.exit(1); });
