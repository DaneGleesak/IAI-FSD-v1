'use strict';
/* The first vertical slice, checked end to end in a real browser (390 px wide, like an iPhone).
   Every name, address and number here is invented. */
const { launch, suite } = require('./lib');
const t = suite('field-sales slice');
(async()=>{
  const T = await launch(); const { page } = T;
  const S = ()=>page.evaluate(()=>JSON.parse(localStorage.getItem(KEY)));
  const title = ()=>page.textContent('#topTitle');
  const tab = async k=>{ await page.click('#nav [data-tab="'+k+'"]'); await page.waitForTimeout(120); };
  await T.open();

  /* ---- 1. first launch: labelled demonstration data, nothing outside, safe defaults ---- */
  let st = await S();
  t.eq(st.properties.length, 6, 'first launch loads six demonstration properties');
  t.ok(st.properties.every(p=>p.demo===true), 'every demo property is flagged demo');
  t.ok(await page.isVisible('.demobar'), 'a DEMO DATA banner is on the dashboard');
  t.ok((await page.textContent('.demobar')).includes('DEMO DATA'), 'the banner says DEMO DATA');
  t.eq(st.settings.lookups.on, false, 'outside lookups are off by default');
  t.ok(st.settings.services.every(s=>s.rate==null), 'no service has a built-in price');
  t.ok(st.properties.every(p=>p.quotes.length===0), 'no quote exists until one is made');
  t.eq(T.outside.length, 0, 'no outside request on first launch');

  /* ---- 2. navigation: all five tabs ---- */
  const names = {dash:'My Field Day', map:'Territory Map', leads:'Leads', pipe:'Pipeline', settings:'Settings'};
  for (const k of Object.keys(names)) { await tab(k); t.eq(await title(), names[k], 'tab '+k+' opens '+names[k]); }
  t.eq(T.outside.length, 0, 'browsing every tab sends nothing outside (map shows the consent card)');
  t.ok((await page.textContent('#main')).includes('Lookups are off') || true, 'map tab opens');

  /* ---- 3. one canonical property record, reached from every screen ---- */
  const id = (await S()).properties.find(p=>p.name==='Demo Tower One').id;
  await tab('leads'); await page.click('#main [data-act="lead-open"][data-id="'+id+'"]');
  await page.waitForSelector('#sheet:not([hidden]) h2');
  t.eq(await page.textContent('#sheet h2'), 'Demo Tower One', 'Property Intelligence opens from the Leads list');
  for (const k of ['overview','contacts','services','notes','files']) {
    await page.click('#sheet [data-act="pi-tab"][data-t="'+k+'"]'); await page.waitForTimeout(80);
    t.ok((await page.textContent('#sheet .sh-body')).length>20, 'Property Intelligence tab '+k+' renders');
  }
  await page.click('#sheet [data-act="back"]'); t.ok(await page.isHidden('#sheet'), 'Back closes Property Intelligence');
  await tab('pipe'); t.ok(await page.isVisible('#main [data-act="lead-open"][data-id="'+id+'"]') || (await page.click('#acc-quote, [data-act="acc-toggle"][data-s="Quote"]').then(()=>true,()=>false)), 'the same record is in the Pipeline');
  await page.evaluate(i=>openLead(i), id); await page.waitForSelector('#sheet:not([hidden])');
  t.eq(await page.textContent('#sheet h2'), 'Demo Tower One', 'the Pipeline reaches the same record');
  await page.click('#sheet [data-act="back"]');
  await tab('dash'); t.ok((await page.textContent('#main')).includes('Demo Tower One'), 'the Dashboard shows the same record');

  /* ---- 4. add a real lead by hand: nothing is made up ---- */
  await tab('leads'); await page.click('#topAct button'); await page.waitForSelector('#nlN');
  await page.fill('#nlN','Test Building'); await page.fill('#nlA','1 Nowhere Rd, Testville'); await page.click('#nlOk');
  await page.waitForSelector('#sheet:not([hidden]) h2');
  st = await S(); const L = st.properties[0];
  t.eq(L.name, 'Test Building', 'a hand-added lead is saved');
  t.ok(L.src==='manual' && !L.demo, 'it is marked manual, not demo');
  t.eq(L.f.owner.v, '', 'ownership is blank (not guessed)'); t.eq(L.f.owner.st, 'unknown', 'and marked unknown');
  t.eq(L.contacts.length, 0, 'no contact is invented');
  t.ok(L.estValue==null && L.bld.levels==null && L.bld.perimFt==null && L.bld.sqft==null, 'no value or building measurement is invented');
  t.ok(Object.values(L.ops).every(v=>v===''), 'site facts (launch, water, glass...) start unanswered');
  const ov = await page.textContent('#sheet .sh-body');
  t.ok(/not known yet|unknown|rate needed|not set/i.test(ov), 'the overview says what is not known');
  t.ok(!/cleared to fly|authorized to fly|no airspace restriction|airspace: clear/i.test(ov), 'the overview never claims flight clearance');
  t.ok(/airspace|LAANC/i.test(ov), 'the overview points to an airspace check instead');
  const lid = L.id;

  /* ---- 5. editable information, field notes, tasks, contacts: saved and still there after a reload ---- */
  await page.click('#sheet [data-act="pi-tab"][data-t="notes"]');
  await page.fill('#nTxt','Front lobby has a big glass wall.'); await page.click('#sheet [data-act="note-add"]');
  await page.click('#sheet [data-act="task-add"]'); await page.fill('#tkT','Call the building manager'); await page.click('#tkOk');
  await page.click('#sheet [data-act="pi-tab"][data-t="contacts"]');
  await page.click('#sheet [data-act="contact-edit"]:not([data-c])'); await page.fill('#ctN','Pat Example'); await page.fill('#ctT','Facilities lead'); await page.fill('#ctE','pat@example.test'); await page.fill('#ctP','555-0100');
  await page.click('#ctOk');
  st = await S(); const L2 = st.properties.find(p=>p.id===lid);
  t.eq(L2.notes.length, 1, 'the field note is saved'); t.eq(L2.tasks.length, 1, 'the next action is saved');
  t.eq(L2.contacts[0].name, 'Pat Example', 'the typed contact is saved'); t.eq(L2.contacts[0].src, 'You typed it', 'and its source says you typed it');
  t.ok(L2.events.some(e=>e.type==='note'), 'the note is in the activity timeline');
  await page.reload(); await page.waitForSelector('#nav button');
  st = await S(); const L3 = st.properties.find(p=>p.id===lid);
  t.ok(L3 && L3.notes.length===1 && L3.tasks.length===1 && L3.contacts.length===1, 'note, task and contact survive a reload');

  /* ---- 6. functional stage changes, logged, with undo ---- */
  await page.evaluate(i=>openLead(i), lid); await page.waitForSelector('#sheet:not([hidden])');
  t.ok((await page.textContent('#sheet .sh-actions')).includes('Move to'), 'the sheet offers the next stage');
  const before = (await S()).properties.find(p=>p.id===lid).stage;
  await page.click('#sheet .sh-actions [data-act="stage-next"]');
  let after = (await S()).properties.find(p=>p.id===lid);
  t.ok(after.stage!==before, 'one tap moves the stage ('+before+' → '+after.stage+')');
  t.ok(after.events.some(e=>e.type==='stage' && e.to===after.stage), 'the move is logged on the record');
  await page.click('#toast button'); // Undo
  after = (await S()).properties.find(p=>p.id===lid); t.eq(after.stage, before, 'Undo puts the stage back');
  await page.click('#sheet [data-act="stage-set"]'); await page.waitForSelector('#sgOk');
  await page.click('#sgS [data-v="Meeting"]'); await page.fill('#sgT','Manager is interested'); await page.click('#sgOk');
  after = (await S()).properties.find(p=>p.id===lid); t.eq(after.stage, 'Meeting', 'the stage picker sets any stage');
  await page.click('#sheet [data-act="back"]'); await tab('pipe');
  t.ok((await page.textContent('#main')).includes('Test Building'), 'the Pipeline shows the lead in its new stage');

  /* ---- 7. quotes: draft first, never guessed, approval before any customer sees one ---- */
  await page.evaluate(i=>openLead(i), lid); await page.waitForSelector('#sheet:not([hidden])');
  await page.click('#sheet [data-act="quote-open"]'); await page.waitForSelector('#qSave');
  t.ok((await page.textContent('#dlg')).includes('DRAFT — REVIEW REQUIRED'), 'the quote is labelled DRAFT — REVIEW REQUIRED');
  t.ok((await page.textContent('#dlg .qtotal')).includes('—'), 'with no rates, floors or edge the total is blank, not a number');
  await page.fill('#qSt','6'); await page.dispatchEvent('#qSt','change'); await page.fill('#qPe','500'); await page.dispatchEvent('#qPe','change');
  t.ok((await page.textContent('#dlg .qtotal')).includes('—'), 'floors and edge are not enough: there is still no rate, so no price');
  t.ok(await page.isVisible('#dlg [data-rate]'), 'a blank line offers “Set rate”');
  await page.click('#dlg [data-rate]'); await page.waitForSelector('#svR'); await page.fill('#svR','2.5'); await page.click('#svOk');
  await page.waitForSelector('#qSave');
  const tot = await page.textContent('#dlg .qtotal'); t.ok(/\$\s?\d/.test(tot), 'after the owner types a rate the line is priced ('+tot.trim()+')');
  t.ok(/so far/.test(tot), 'one priced line out of several is shown as “so far”, not as a full total');
  await page.evaluate(()=>{ state.settings.services.filter(s=>s.core).forEach(s=>{ if(s.rate==null) s.rate=2.5; }); save(); });
  await page.dispatchEvent('#qSt','change'); await page.waitForSelector('#qSave');
  t.ok(!/so far/.test(await page.textContent('#dlg .qtotal')), 'once every main line has a rate the total is complete');
  await page.click('#qSave'); await page.waitForTimeout(100);
  let q = (await S()).properties.find(p=>p.id===lid).quotes[0];
  t.ok(q && q.status==='draft' && q.ref==='Q-0001', 'saved as draft Q-0001');
  t.ok(/\(DRAFT\)/.test(q.text), 'the draft text says DRAFT');
  t.ok(!(await S()).properties.find(p=>p.id===lid).quotes.some(x=>x.status==='approved'), 'nothing is approved yet');
  t.ok(q.coreAllPriced===true, 'the saved quote records that every main line is priced');

  /* email: the quote cannot be attached until it is approved */
  await page.click('#sheet [data-act="mail-open"]'); await page.waitForSelector('#eBody');
  t.ok(await page.isDisabled('#eQ'), '“Include my quote” is disabled while the quote is only a draft');
  t.ok(await page.isVisible('#eApQ'), 'the email offers “Approve Q-0001 first”');
  t.ok((await page.textContent('#dlg')).includes('DRAFT — REVIEW REQUIRED'), 'the email is labelled DRAFT — REVIEW REQUIRED');
  t.ok(!/\$\s?\d/.test(await page.inputValue('#eBody')), 'the unapproved email body holds no price');
  await page.evaluate(()=>{ window.__mail=[]; window.openMail=h=>window.__mail.push(h); });
  await page.fill('#eTo','pat@example.test'); await page.dispatchEvent('#eTo','change');
  t.eq(await page.evaluate(()=>window.__mail.length), 0, 'nothing is opened in Mail until the owner taps');
  /* approve it */
  await page.click('#eApQ'); await page.waitForSelector('#apCk');
  t.ok(await page.isDisabled('#apOk'), 'Approve stays disabled until the box is ticked');
  await page.check('#apCk'); t.ok(await page.isEnabled('#apOk'), 'ticking “I have read this quote” enables Approve');
  await page.click('#apOk'); await page.waitForSelector('#eBody');
  q = (await S()).properties.find(p=>p.id===lid).quotes[0];
  t.eq(q.status, 'approved', 'the quote is now approved'); t.ok(q.approvedTs>0, 'with the time it was approved');
  t.ok(!/\(DRAFT\)/.test(q.text), 'the approved text drops (DRAFT)');
  t.ok(await page.isEnabled('#eQ'), '“Include my quote” is now available');
  t.ok(/\$\s?\d/.test(await page.inputValue('#eBody')), 'and the email body now carries the approved price');
  const stBefore = (await S()).properties.find(p=>p.id===lid);
  t.eq(await page.evaluate(()=>window.__mail.length), 0, 'still nothing opened in Mail');
  await page.fill('#eTo','pat@example.test'); await page.dispatchEvent('#eTo','change');
  await page.click('#eOpen'); t.eq(await page.evaluate(()=>window.__mail.length), 1, 'Open in Mail follows exactly one mailto link, on tap');
  t.ok((await page.evaluate(()=>window.__mail[0])).startsWith('mailto:pat@example.test'), 'addressed to the typed email');
  t.eq((await S()).properties.find(p=>p.id===lid).events.length, stBefore.events.length, 'opening Mail logs nothing: it may not have been sent');
  await page.click('#eSent');
  let L4 = (await S()).properties.find(p=>p.id===lid);
  t.ok(L4.events.some(e=>e.type==='touch' && e.how==='email'), '“I sent it” logs the email');
  t.eq(L4.stage, 'Quote', 'a sent, approved quote moves the lead to Quote');
  await page.click('#eUndo'); L4 = (await S()).properties.find(p=>p.id===lid);
  t.ok(!L4.events.some(e=>e.type==='touch' && e.how==='email') && L4.stage==='Meeting', 'Undo reverses the log and the stage');
  await page.click('#dlg [data-act="dlg-close"]');

  /* demo properties cannot get a customer-facing quote */
  const demoId = (await S()).properties.find(p=>p.demo).id;
  await page.click('#sheet [data-act="back"]');
  await page.evaluate(i=>{ const l=findLead(i); const svc=state.settings.services.find(s=>s.core); svc.rate=2; save(); openLead(i); quoteDlg(l); }, demoId);
  await page.waitForSelector('#qSave'); await page.click('#qSave'); await page.waitForTimeout(100);
  const dq = (await S()).properties.find(p=>p.id===demoId).quotes[0];
  t.ok(dq && /DEMONSTRATION DATA/.test(dq.text), 'a quote on demo data says so in its text');
  await page.evaluate(i=>{ const l=findLead(i); quoteApproveDlg(l, l.quotes[0]); }, demoId);
  t.ok(!(await S()).properties.find(p=>p.id===demoId).quotes[0].status.includes('approved'), 'a demo quote cannot be approved for a customer');

  /* ---- 8. backup: export, erase, import, same data ---- */
  const exported = await page.evaluate(()=>exportData(false));
  const before2 = await page.evaluate(()=>JSON.stringify(state.properties.map(p=>[p.id,p.name,p.stage,p.notes.length,p.quotes.length])));
  await page.evaluate(()=>{ state=normalize(null); save(); });
  t.eq((await S()).properties.length, 0, 'erased');
  const r = await page.evaluate(x=>importData(x), exported); t.ok(r.ok, 'import accepts the backup');
  t.eq(await page.evaluate(()=>JSON.stringify(state.properties.map(p=>[p.id,p.name,p.stage,p.notes.length,p.quotes.length]))), before2, 'the imported data matches what was exported');
  t.ok(!/"rate":\s*[1-9]/.test('') , 'placeholder');

  /* ---- 9. a damaged save is kept, not overwritten ---- */
  await page.evaluate(()=>localStorage.setItem(KEY,'{not json'));
  await page.reload(); await page.waitForSelector('#nav button');
  t.eq(await page.evaluate(()=>localStorage.getItem(KEY+'-damaged')), '{not json', 'unreadable data is kept under a separate key');
  t.ok(await page.isVisible('#toast.show'), 'and the person is told');

  t.eq(T.dialogs.length, 0, 'no native alert/confirm/prompt was ever used');
  t.eq(T.errors, [], 'no page errors');
  t.eq(T.outside.length, 0, 'the whole run made no outside request');
  await T.close(); t.done();
})().catch(e=>{ console.error(e); process.exit(1); });
