'use strict';
/* Photos and files: stored on the phone (IndexedDB), shown on the property, left out of a backup
   unless the owner chooses to include them, and restored from one that does. */
const { launch, suite } = require('./lib');
const t = suite('photos and files');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64');
(async()=>{
  const T = await launch(); const { page } = T; await T.open();
  const id = await page.evaluate(()=>{ const l=newLead({name:'Photo Test Building', addr:'2 Nowhere Rd', src:'manual'}); state.properties.unshift(l); save(); openLead(l.id); return l.id; });
  await page.waitForSelector('#sheet:not([hidden])'); await page.click('#sheet [data-act="pi-tab"][data-t="files"]');
  const count = ()=>page.evaluate(async()=>(await fileAll()).length);
  t.eq(await count(), 0, 'no file exists yet');

  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sheet [data-act="photo-add"]')]);
  await fc.setFiles({name:'site.png', mimeType:'image/png', buffer:PNG});
  await page.waitForFunction(i=>findLead(i).fileIds.length===1, id);
  t.eq(await count(), 1, 'the photo is stored in IndexedDB, not localStorage');
  t.ok(!(await page.evaluate(()=>localStorage.getItem(KEY))).includes('iVBOR'), 'no image data is in the localStorage record');
  await page.waitForSelector('#thumbs img'); t.ok(true, 'the photo appears as a thumbnail');
  t.ok(await page.evaluate(i=>findLead(i).events.some(e=>/Photo added/.test(e.text)), id), 'adding it is noted on the activity timeline');

  const [fc2] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sheet [data-act="file-add"]')]);
  await fc2.setFiles({name:'notes.txt', mimeType:'text/plain', buffer:Buffer.from('site walk notes')});
  await page.waitForFunction(i=>findLead(i).fileIds.length===2, id);
  t.eq(await count(), 2, 'a non-image file is stored too');

  await page.reload(); await page.waitForSelector('#nav button');
  await page.evaluate(i=>openLead(i), id); await page.waitForSelector('#sheet:not([hidden])'); await page.click('#sheet [data-act="pi-tab"][data-t="files"]');
  await page.waitForSelector('#thumbs .timg'); t.eq((await page.$$('#thumbs .timg')).length, 2, 'both files are still there after a reload');

  const plain = JSON.parse(await page.evaluate(()=>exportData(false)));
  t.ok(!plain.files || plain.files.length===0, 'a normal backup leaves photos and files out');
  const withF = JSON.parse(await page.evaluate(()=>exportData(true)));
  t.eq(withF.files.length, 2, 'a backup that includes photos carries both files');
  t.ok(withF.files.every(f=>f.name && f.mime && f.b64), 'each with its name, type and data');

  /* lose the files, restore from the backup that included them */
  await page.evaluate(async()=>{ for (const f of await fileAll()) await fileDel(f.id); });
  t.eq(await count(), 0, 'files removed');
  const r = await page.evaluate(x=>importData(x), JSON.stringify(withF)); t.ok(r.ok, 'the backup imports');
  t.eq(await count(), 2, 'both files are back in IndexedDB');
  t.ok(await page.evaluate(()=>{ const l=state.properties.find(p=>p.name==='Photo Test Building'); return l.fileIds.length===2; }), 'and still attached to the same property');

  t.eq(T.errors, [], 'no page errors'); t.eq(T.dialogs.length, 0, 'no native dialogs'); t.eq(T.outside.length, 0, 'no outside request');
  await T.close(); t.done();
})().catch(e=>{ console.error(e); process.exit(1); });
