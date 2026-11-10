'use strict';
/* When the browser blocks storage (private browsing, an embedded preview) the app still opens, shows the
   demonstration data, keeps changes in memory for the visit and says so honestly. */
const { launch, suite } = require('./lib');
const t = suite('blocked storage');
(async()=>{
  const T = await launch(); const { page } = T;
  await page.addInitScript(()=>{ const deny=()=>{ throw new DOMException('The operation is insecure.','SecurityError'); }; Object.defineProperty(window,'localStorage',{get:deny}); Object.defineProperty(window,'sessionStorage',{get:deny}); });
  await T.open();
  t.eq(await page.evaluate(()=>state.properties.length), 6, 'the labelled demonstration data loads in memory');
  const toast = await page.evaluate(()=>document.getElementById('toast').textContent);
  t.ok(/can’t keep your data between visits/.test(toast), 'the person is told changes will not be kept');
  t.ok(!/no room left/.test(toast), 'it does not claim the phone is full');
  await page.click('#nav [data-tab="leads"]'); await page.click('#topAct button'); await page.fill('#nlN','Memory Only Building'); await page.click('#nlOk');
  await page.waitForSelector('#sheet:not([hidden]) h2');
  t.eq(await page.textContent('#sheet h2'), 'Memory Only Building', 'adding and editing still works during the visit');
  t.eq(await page.evaluate(()=>storageBlocked), true, 'the app knows storage is blocked');
  t.eq(T.errors, [], 'no page errors'); t.eq(T.outside.length, 0, 'no outside request');
  await T.close(); t.done();
})().catch(e=>{ console.error(e); process.exit(1); });
