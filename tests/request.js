'use strict';
/* A quote from the customer's request: paste what they asked for, tick the ✨ suggestions that are right, and the quote follows.
   Nothing is applied without a tick, the words stay on the quote, and nothing is sent anywhere. Invented customer and building. */
const { launch, suite } = require('./lib');
const t = suite('quote from the request');
(async()=>{
  const T = await launch({ touch: true }); const { page } = T;
  const S = ()=>page.evaluate(()=>JSON.parse(localStorage.getItem(KEY)));
  await T.open();
  await page.evaluate(()=>{ state=normalize(null); const l=newLead({name:'Request Test Tower', addr:'9 Test Ave, Mocktown', cat:'office'}); l.bld.levels=3; l.bld.perimFt=400; state.properties.push(l); state.settings.services.forEach(s=>{ s.rate=null; }); state.settings.sender.name='Test Rep'; save(); window.__lid=l.id; });
  const REQ = 'We need the windows on our 6-story office cleaned quarterly, before our open house on May 3rd.';
  await page.evaluate(()=>quoteDlg(findLead(window.__lid))); await page.waitForSelector('#reqBox');
  t.ok(/Start from what they asked for/.test(await page.textContent('#reqBox summary')), 'the quote has a “start from what they asked for” box');
  t.ok(await page.$eval('#reqBox', e=>!e.open), 'closed until wanted');
  await page.click('#reqBox summary'); await page.fill('#qReq', REQ); await page.click('#qRead'); await page.waitForSelector('#qUse');
  const rows = await page.$$eval('#reqBox .qline', e=>e.map(x=>x.textContent));
  t.ok(rows.some(r=>/Window cleaning: exterior, floor 1/.test(r) && /they said “windows”/.test(r)), 'it suggests the window line, with the word it came from');
  t.ok(rows.some(r=>/Floors: 6/.test(r) && /6-story/.test(r) && /your numbers say 3/.test(r)), 'it suggests 6 floors, and says your own number is 3');
  t.ok(rows.some(r=>/quarterly/.test(r)) && rows.some(r=>/May 3rd/.test(r)), 'it offers notes for the frequency and the date they gave');
  t.eq(await page.$$eval('#reqBox [data-rq]:checked', e=>e.length), 0, 'nothing is ticked for you'); t.ok(await page.$eval('[data-id="s-roof"]', e=>e.checked), 'the scope below still starts as it was (every service on)');
  t.eq(await page.evaluate(()=>Q.stories), 3, 'and nothing changed in the quote yet'); t.ok(await page.$eval('#qSt', e=>e.value==='3'), 'floors still say 3');
  await page.click('#qUse'); await page.waitForFunction(()=>/Tick what is right/.test(document.getElementById('toast').textContent));
  t.ok(true, 'tapping Use with nothing ticked just says to tick');
  await page.check('[data-rq="floors"]'); await page.check('[data-rq="svc:s-ext1"]'); await page.check('[data-rq="freq"]'); await page.check('[data-rq="dates"]');
  await page.click('#qUse'); await page.waitForSelector('#qSt');
  t.ok(await page.$eval('#qSt', e=>e.value==='6'), 'ticked floors are used (6)'); t.ok(await page.$eval('#qNote', e=>/Requested: quarterly service\./.test(e.value) && /Timing mentioned: May 3rd\./.test(e.value)), 'ticked notes go into the quote note');
  t.ok(await page.$eval('[data-id="s-ext1"]', e=>e.checked) && await page.$eval('[data-id="s-upper"]', e=>!e.checked) && await page.$eval('[data-id="s-roof"]', e=>!e.checked), 'the ticked service becomes the scope: the others are unticked, and you can tick any back');
  t.ok(await page.$$eval('#reqBox .qline input:disabled', e=>e.length)>=3, 'applied floors and notes show as already in the quote');
  t.ok(await page.$eval('#qReq', e=>e.value)===REQ, 'the request text is still there');
  await page.click('#qSave'); await page.waitForFunction(()=>state.properties[0].quotes.length===1);
  const q = (await S()).properties[0].quotes[0];
  t.eq(q.request, REQ, 'the customer’s words are kept on the quote'); t.eq(q.stories, 6, 'with the floors used'); t.ok(!q.text.includes('open house') , 'but they are not pasted into the customer-facing text'); t.ok(/Requested: quarterly service\./.test(q.text), 'only the notes you ticked are in it');
  t.ok(q.status==='draft', 'it is still a draft');
  await page.evaluate(()=>quoteApproveDlg(findLead(window.__lid), findLead(window.__lid).quotes[0])); await page.waitForSelector('#apOk');
  t.ok(/Their request:/.test(await page.textContent('#dlg')) && /open house/.test(await page.textContent('#dlg')), 'the approval step shows their request next to the quote, so you can check scope');
  t.ok(await page.$eval('#apOk', e=>e.disabled), 'approval still needs the tick');
  /* nothing recognised */
  await page.evaluate(()=>{ closeDlg(); quoteDlg(findLead(window.__lid)); }); await page.waitForSelector('#reqBox');
  await page.click('#reqBox summary'); await page.fill('#qReq', 'Please call me back.'); await page.click('#qRead'); await page.waitForSelector('#reqBox .muted');
  t.ok(/Nothing recognised/.test(await page.textContent('#reqBox')) && !(await page.$('#qUse')), 'a request with nothing to read says so');
  /* backups keep it */
  const back = await page.evaluate(async()=>{ const txt=await exportData(false); state=normalize(null); await importData(txt); return state.properties[0].quotes[0].request; });
  t.eq(back, REQ, 'the request comes back from a backup');
  t.eq(T.outside.length, 0, 'nothing was sent anywhere'); t.eq(T.errors, [], 'no page errors'); t.eq(T.dialogs.length, 0, 'no native dialogs');
  await T.close(); t.done();
})().catch(e=>{ console.error(e); process.exit(1); });
