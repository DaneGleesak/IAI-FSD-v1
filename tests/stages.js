'use strict';
/* The owner's own funnel (Lead → Contacted → Meeting → Quote → Scheduled → Completed, Lost) and the backup reminder.
   Old saves and backups with the earlier eight stage names must still load, renamed, with nothing lost. Invented data only. */
const { launch, suite } = require('./lib');
const t = suite('stages and backup');
(async()=>{
  const T = await launch({ touch: true }); const { page } = T;
  const S = ()=>page.evaluate(()=>JSON.parse(localStorage.getItem(KEY)));
  await T.open();

  /* the stages */
  t.eq(await page.evaluate(()=>STAGES), ['Lead','Contacted','Meeting','Quote','Scheduled','Completed','Lost'], 'the app uses the owner’s own funnel');
  t.eq(await page.evaluate(()=>newLead({name:'Fresh'}).stage), 'Lead', 'a new lead starts at Lead');

  /* an older save: every old name is renamed, events and screen memory too, and nothing is dropped */
  const old = await page.evaluate(()=>{
    const mk=(id,stage,evs)=>({id, name:'Old '+stage, stage, ts:1700000000000, events:evs||[], notes:[{id:'n'+id,text:'a note kept',ts:1700000001000}]});
    const raw={v:1, properties:[mk('a','Identified'), mk('b','Researching'), mk('c','Contacted'), mk('d','Qualified'), mk('e','Proposal',[{id:'e1',type:'stage',from:'Qualified',to:'Proposal',ts:1,text:'sent it'}]), mk('f','Negotiation'), mk('g','Won'), mk('h','Lost')],
      ui:{leadStage:'Proposal', closed:{Negotiation:false, Won:true}}};
    const s=normalize(raw);
    return {stages:s.properties.map(p=>p.stage), ev:s.properties[4].events.map(e=>[e.from,e.to,e.text]), notes:s.properties.every(p=>p.notes.length===1&&p.notes[0].text==='a note kept'), leadStage:s.ui.leadStage, closed:s.ui.closed};
  });
  t.eq(old.stages, ['Lead','Lead','Contacted','Meeting','Quote','Quote','Scheduled','Lost'], 'old stage names are renamed to the new funnel');
  t.eq(old.ev, [['Meeting','Quote','sent it']], 'the history of a lead is renamed the same way and its words are kept'); t.ok(old.notes, 'notes are untouched');
  t.eq(old.leadStage, 'Quote', 'the stage filter you left on is carried over'); t.eq(old.closed, {Quote:false, Scheduled:true}, 'open and closed sections are carried over');

  /* an old backup file imports */
  const imp = await page.evaluate(async()=>{ const r=await importData(JSON.stringify({app:'iai-fsd', v:1, ts:1700000000000, state:{v:1, properties:[{id:'z', name:'From a backup', stage:'Negotiation', ts:1700000000000}]}})); return {r, stage:state.properties[0].stage, last:state.backup.last}; });
  t.ok(imp.r.ok && imp.stage==='Quote', 'an old backup imports with its stage renamed'); t.eq(imp.last, 1700000000000, 'and the backup date is the file’s own date');

  /* the flow: one tap moves a lead along, to Completed, and no further */
  await page.evaluate(()=>{ state=normalize(null); const l=newLead({name:'Flow Test'}); state.properties.push(l); window.__id=l.id; save(); });
  await page.reload(); await page.waitForSelector('#nav button');
  const id = await page.evaluate(()=>state.properties[0].id), seen=[];
  for(let i=0;i<5;i++){ await page.evaluate(i=>openLead(state.properties[0].id), 0); await page.waitForSelector('#sheet .sh-actions [data-act="stage-next"]'); seen.push(await page.textContent('#sheet .sh-actions [data-act="stage-next"]')); await page.click('#sheet .sh-actions [data-act="stage-next"]'); await page.waitForTimeout(80); await page.evaluate(()=>closeSheet && closeSheet()).catch(()=>{}); }
  t.eq(seen.map(x=>x.trim()), ['Move to Contacted','Move to Meeting','Move to Quote','Move to Scheduled','Mark completed'], 'each tap offers the next stage, ending in “Mark completed”');
  t.eq(await page.evaluate(()=>state.properties[0].stage), 'Completed', 'five taps reach Completed');
  await page.evaluate(()=>openLead(state.properties[0].id)); await page.waitForSelector('#sheet .sh-actions');
  t.ok(!/Move to|Mark completed/.test(await page.textContent('#sheet .sh-actions')) && /Reopen/.test(await page.textContent('#sheet .sh-actions')), 'a completed lead offers Reopen, not another move');

  /* win rate counts booked and finished jobs against lost ones */
  await page.evaluate(()=>{ state=normalize(null); ['Scheduled','Completed','Lost','Quote'].forEach((s,i)=>{ const l=newLead({name:'W'+i}); l.stage=s; state.properties.push(l); }); save(); show('pipe'); });
  await page.waitForSelector('.kpis');
  t.ok(/67%/.test(await page.textContent('#main')) && /2 won, 1 lost/.test(await page.textContent('#main')), 'win rate: scheduled and completed are wins (2 of 3 closed)');
  await page.evaluate(()=>{ state.ui.pipeView='boards'; save(); show('pipe'); }); await page.waitForSelector('.boards');
  t.eq(await page.$$eval('.boards .col-h b', e=>e.map(x=>x.textContent)), ['Lead','Contacted','Meeting','Quote','Scheduled','Completed','Lost'], 'the boards show the new funnel in order');

  /* the backup reminder: only for real work that is newer than the last backup */
  const due = ()=>page.evaluate(()=>backupDue());
  await page.evaluate(()=>{ state=normalize(null); save(); });
  t.eq(await due(), false, 'nothing to back up: no reminder');
  await page.evaluate(()=>{ const l=newLead({name:'Real One'}); l.demo=false; state.properties.push(l); save(); });
  t.eq(await due(), false, 'a lead made just now does not nag');
  await page.evaluate(()=>{ state.properties[0].ts=Date.now()-3*864e5; state.properties[0].events[0].ts=state.properties[0].ts; save(); });
  t.eq(await due(), true, 'a few days of real work and no backup: it is due');
  await page.evaluate(()=>show('dash')); await page.waitForSelector('#backupCard');
  t.ok(/Back up your leads/.test(await page.textContent('#backupCard')), 'Home shows a calm one-card reminder');
  await page.click('#backupCard [data-act="backup-later"]'); await page.waitForTimeout(100);
  t.ok(!(await page.$('#backupCard')) && !(await due()), '“Later” hides it for a few days');
  t.ok((await S()).backup.snooze > Date.now()+2*864e5, 'and the snooze is saved');
  await page.evaluate(()=>{ state.backup.snooze=0; save(); show('dash'); }); await page.waitForSelector('#backupCard');
  /* saving a backup: the share sheet when the phone has one */
  await page.evaluate(()=>{ window.__shared=null; navigator.canShare=()=>true; navigator.share=async d=>{ window.__shared={n:d.files[0].name, type:d.files[0].type, txt:await d.files[0].text()}; }; });
  await page.click('#backupCard [data-act="backup-now"]'); await page.waitForFunction(()=>window.__shared);
  const sh = await page.evaluate(()=>window.__shared);
  t.ok(/^iai-field-sales-backup-\d{4}-\d{2}-\d{2}\.json$/.test(sh.n) && sh.type==='application/json', 'the share sheet gets a dated JSON backup file');
  t.ok(JSON.parse(sh.txt).state.properties.some(p=>p.name==='Real One') && JSON.parse(sh.txt).state.backup.last>0, 'it holds the leads and its own backup date');
  t.ok(Date.now()-(await S()).backup.last < 20000, 'the last-backup date moved');
  await page.waitForTimeout(150); t.ok(!(await page.$('#backupCard')) && !(await due()), 'and the reminder is gone');
  /* cancelling the share sheet is not a backup */
  const before = (await S()).backup.last;
  await page.evaluate(()=>{ state.backup.last=1; save(); navigator.share=async()=>{ const e=new Error('cancelled'); e.name='AbortError'; throw e; }; });
  await page.evaluate(()=>saveBackup(false)); t.eq((await S()).backup.last, 1, 'cancelling the share sheet does not count as a backup');
  /* no share sheet: a normal download */
  await page.evaluate(()=>{ navigator.canShare=undefined; });
  const dl = page.waitForEvent('download'); await page.evaluate(()=>saveBackup(false)); const d = await dl;
  t.ok(/iai-field-sales-backup-/.test(d.suggestedFilename()), 'without a share sheet it downloads the file'); t.ok((await S()).backup.last > 1, 'and counts as a backup');
  await page.evaluate(()=>show('settings')); await page.waitForSelector('#lastBackup');
  t.ok(/Last backup:\s*today/.test(await page.textContent('#lastBackup')), 'Settings says when the last backup was');
  t.eq(T.errors, [], 'no page errors'); t.eq(T.dialogs.length, 0, 'no native dialogs');
  await T.close(); t.done();
})().catch(e=>{ console.error(e); process.exit(1); });
