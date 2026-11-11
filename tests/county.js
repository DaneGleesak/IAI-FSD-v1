'use strict';
/* County records: a tap asks the county's own public parcel records about one building's position.
   The county is mocked here and every name is invented. */
const { launch, suite } = require('./lib');
const t = suite('county records');
const SECRETS = ['ZZ-SECRET-NOTE','secret.person@example.test','555-0199','ZZ-SECRET-CO'];
(async()=>{
  const T = await launch({ touch: true }); const { page } = T;
  const S = ()=>page.evaluate(()=>JSON.parse(localStorage.getItem(KEY)));
  const county = ()=>T.outside.filter(r=>/gis\.cuyahogacounty\.gov/.test(r.url));
  await T.open();
  await page.evaluate(()=>{
    const a=newLead({name:'ZZ-SECRET-CO Hotel', addr:'1 Test Ave, Mocktown', lat:41.4577, lon:-81.4927, src:'manual'});
    a.notes.push({id:uid(), text:'ZZ-SECRET-NOTE', ts:Date.now()});
    a.contacts.push({id:uid(), name:'Secret Person', title:'', email:'secret.person@example.test', phone:'555-0199', role:'decision', conf:'', src:'You typed it'});
    const b=newLead({name:'Mock Downtown Tower', lat:41.4993, lon:-81.6944, src:'manual'});
    const c=newLead({name:'Mock Far Building', lat:39.96, lon:-83.0, src:'manual'});
    const d=newLead({name:'Mock Error Building', lat:41.40, lon:-81.30, src:'manual'});
    const e=newLead({name:'Mock Demo In County', lat:41.4577, lon:-81.4927, src:'demo', demo:true});
    state.properties.unshift(a,b,c,d,e); state.settings.sender.company='ZZ-SECRET-CO'; save();
  });
  await page.reload(); await page.waitForSelector('#nav button');
  const ids = await page.evaluate(()=>Object.fromEntries(state.properties.filter(p=>/^Mock|ZZ-SECRET/.test(p.name)).map(p=>[p.name.replace(/^ZZ-SECRET-CO /,'').replace(/^Mock /,'').split(' ')[0], p.id])));
  const openC = async id=>{ await page.evaluate(i=>openLead(i,'contacts'), id); await page.waitForSelector('#sheet:not([hidden]) .sh-body'); };

  /* lookups off: the card explains, nothing is sent */
  await openC(ids.Hotel);
  t.ok(await page.isVisible('#countyCard'), 'a building in Cuyahoga County shows a County record card');
  t.ok(/Lookups are off/.test(await page.textContent('#countyCard')) && !(await page.$('[data-act="county-look"]')), 'with lookups off there is no lookup button, and it says why');
  t.eq(county().length, 0, 'nothing sent to the county while lookups are off');
  await page.evaluate(()=>{ state.settings.lookups.on=true; save(); }); await openC(ids.Hotel);

  /* the exact request is shown first */
  await page.tap('#countyCard [data-act="county-look"]'); await page.waitForSelector('#cfPay');
  t.ok((await page.textContent('#dlg')).includes('gis.cuyahogacounty.gov'), 'the lookup names the county host');
  const pay = await page.inputValue('#cfPay');
  t.ok(pay.includes('geometry=-81.492700,41.457700'), 'and shows the exact request: one map position');
  t.ok(SECRETS.every(x=>!pay.includes(x)), 'it holds none of the planted private data');
  t.eq(county().length, 0, 'nothing is sent until “Look up” is tapped');
  await page.tap('[data-act="dlg-close"]'); await page.waitForTimeout(100);
  t.eq(county().length, 0, 'Cancel sends nothing');
  await page.tap('#countyCard [data-act="county-look"]'); await page.waitForSelector('#cfOk'); await page.tap('#cfOk');
  await page.waitForSelector('#countyCard .crec');
  t.eq(county().length, 1, 'tapping Look up sends exactly one request');
  t.eq(county()[0].method, 'GET', 'it is a GET with no body');
  t.ok(/MapServer\/1\/query\?/.test(county()[0].url), 'to the parcels outside Cleveland first');
  const card = await page.textContent('#countyCard');
  t.ok(/MOCK HOLDINGS LLC/.test(card) && /MOCK MGMT CO/.test(card) && /52,400 sq ft/.test(card) && /MOCK HOTEL/.test(card), 'the owner, mailing address, building area and land use show');
  t.ok(/120/.test(card), 'the living-unit count shows');
  t.ok(/public parcel records/.test(card) && /check it is the right one/.test(card), 'it is labelled as the county’s record and says to check the match');
  let st = await S(); let A = st.properties.find(p=>/Hotel/.test(p.name));
  t.eq(A.f.owner.v, '', 'the owner fact is not filled by the lookup');
  t.eq(A.county.recs.length, 1, 'but the record is kept on the property');
  const all = T.bodies.join('\n'); t.ok(SECRETS.every(x=>!all.includes(x) && !all.includes(encodeURIComponent(x))), 'no planted private value was ever sent');

  /* using it is a tap */
  await page.tap('#countyCard [data-act="county-use"]'); await page.waitForTimeout(150);
  A = (await S()).properties.find(p=>/Hotel/.test(p.name));
  t.eq(A.f.owner.v, 'MOCK HOLDINGS LLC', 'tapping “Use as owner” fills the owner');
  t.eq(A.f.owner.st, 'estimated', 'as estimated, never verified');
  t.ok(/Cuyahoga County parcel record/.test(A.f.owner.src), 'with the county named as the source');
  await page.reload(); await page.waitForSelector('#nav button'); await openC(ids.Hotel);
  t.ok(/Used as the owner/.test(await page.textContent('#countyCard')), 'the record and the choice survive a reload');

  /* a typed owner is never silently replaced */
  await page.evaluate(i=>{ const l=findLead(i); l.f.owner=blankFact('Typed Owner Co','verified','You typed it'); save(); openLead(i,'contacts'); }, ids.Hotel);
  await page.waitForSelector('#countyCard [data-act="county-use"]'); await page.tap('#countyCard [data-act="county-use"]');
  await page.waitForSelector('#cfOk'); t.ok(/Typed Owner Co/.test(await page.textContent('#dlg')), 'replacing a typed owner asks first and names it');
  await page.tap('[data-act="dlg-close"]'); await page.waitForTimeout(100);
  t.eq((await S()).properties.find(p=>/Hotel/.test(p.name)).f.owner.v, 'Typed Owner Co', 'Cancel keeps what you typed');

  /* the Cleveland layer is asked when the first has nothing */
  const n0 = county().length; await openC(ids.Downtown);
  await page.tap('#countyCard [data-act="county-look"]'); await page.waitForSelector('#cfOk'); await page.tap('#cfOk'); await page.waitForSelector('#countyCard .crec');
  const q = county().slice(n0).map(r=>(/MapServer\/(\d)/.exec(r.url)||[])[1]);
  t.eq(q, ['1','0'], 'inside Cleveland, the first layer is empty so the second is asked');
  t.ok(/MOCK CITY HOLDINGS LLC/.test(await page.textContent('#countyCard')), 'and its record shows');

  /* a failure is plain and saves nothing */
  await openC(ids.Error); await page.tap('#countyCard [data-act="county-look"]'); await page.waitForSelector('#cfOk'); await page.tap('#cfOk');
  await page.waitForSelector('#toast.show'); await page.waitForTimeout(200);
  t.ok(/County lookup failed/.test(await page.textContent('#toast')), 'a county error is shown plainly');
  t.eq((await S()).properties.find(p=>/Error/.test(p.name)).county, null, 'and nothing is saved');

  /* where it does not apply */
  await openC(ids.Far); t.ok(!(await page.$('#countyCard')), 'a building outside the county has no card');
  await openC(ids.Demo); t.ok(!(await page.$('#countyCard')), 'demonstration data never goes to the county');

  /* a building from the map, before it is a lead */
  const before = (await S()).properties.length;
  await page.evaluate(()=>openCand(candClean({id:'w999', name:'Mock Candidate', lat:41.4590, lon:-81.4930, levels:6, sqft:20000, perimFt:600, cat:'office', btype:'office'}), {tab:'contacts'}));
  await page.waitForSelector('#countyCard [data-act="county-look"]'); await page.tap('#countyCard [data-act="county-look"]'); await page.waitForSelector('#cfOk'); await page.tap('#cfOk');
  await page.waitForSelector('#countyCard .crec');
  t.eq((await S()).properties.length, before, 'looking up a building from the map adds no lead');

  /* phone width */
  await page.setViewportSize({ width: 320, height: 700 }); await page.waitForTimeout(150);
  t.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= 320 && document.getElementById('sheet').scrollWidth <= 320), 'the record fits a 320 px screen with no sideways scroll');
  t.eq(T.errors, [], 'no page errors');
  await T.close(); t.done();
})().catch(e=>{ console.error(e); process.exit(1); });
