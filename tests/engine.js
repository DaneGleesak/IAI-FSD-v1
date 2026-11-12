'use strict';
/* Unit checks for the pure engine: no browser. Invented numbers only. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { suite } = require('./lib');
const t = suite('engine');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/engine.js'),'utf8')+'\nthis.E={readRequest,buildQueries,joinQueries,splitQueries,detailPreset,detailClean,detailName,DETAIL,DETAIL_KEYS,DETAIL_PRESETS,countyFor,countyQuery,parseCounty,countyRecClean,COUNTIES,quoteCalc,defaultServices,rankCands,parseOverpass,keepCand,candClean,buildQuery,critClean,ringStats,solutionsFor,defaultPlaybooks,SERVICE_FAMILIES};', ctx);
const E = ctx.E;

/* defaults: no price is invented anywhere */
const sv = E.defaultServices();
t.ok(sv.length>=8, 'a full default service list exists');
t.ok(sv.every(s=>s.rate==null && s.min==null), 'every default rate and minimum is blank (the owner types them)');
t.ok(sv.some(s=>s.core && /window/i.test(s.name)), 'window cleaning is a core service');
t.ok(sv.some(s=>/facade/i.test(s.name)) && sv.some(s=>/inspect/i.test(s.name)), 'facade cleaning and inspection are listed');
const core = sv.filter(s=>s.core).map(s=>s.id), ids = new Set(sv.map(s=>s.id));

/* quote: nothing is guessed */
let q = E.quoteCalc({stories:null, perimFt:null}, sv, new Set(core), 12);
t.ok(!q.coreAllPriced && q.coreTotal===0, 'no rate, no floors, no edge: nothing is priced');
t.ok(q.lines.every(l=>l.amount==null), 'every line is blank until it has what it needs');
t.ok(q.lines.every(l=>l.need), 'each blank line says what it needs');
const priced = sv.map(s=>Object.assign({},s,{rate:s.core?2:s.rate}));
q = E.quoteCalc({stories:5, perimFt:null}, priced, new Set(core), 12);
t.ok(q.lines.some(l=>l.need==='edge'), 'a missing building edge is named, not estimated');
q = E.quoteCalc({stories:null, perimFt:400}, priced, new Set(core), 12);
t.ok(q.lines.some(l=>l.need==='floors'), 'missing floors are named, not estimated');
q = E.quoteCalc({stories:4, perimFt:400}, priced, new Set(core), 12);
t.ok(q.coreAllPriced && q.coreTotal>0, 'with rate, floors and edge the core lines are priced');
const q2 = E.quoteCalc({stories:4, perimFt:800}, priced, new Set(core), 12);
t.ok(Math.abs(q2.coreTotal-2*q.coreTotal)<1, 'price scales with the measured edge (twice the edge, twice the price)');

/* overpass parsing + ranking */
const over = require('./lib').mockOverpass();
const parsed = E.parseOverpass(over);
t.eq(parsed.items.length, 4, 'four mock buildings parsed');
const crit = E.critClean({preset:'midrise'});
const kept = parsed.items.filter(c=>E.keepCand(c,crit));
t.ok(kept.length>=1 && kept.length<4, 'the criteria filter drops buildings that do not fit');
const rows = E.rankCands(kept,'balanced',{lat:39.96,lon:-82.99},1600);
t.ok(rows.length && rows[0].band && Array.isArray(rows[0].why) && rows[0].why.length, 'each ranked row has a band and plain reasons');
t.ok(rows.every(r=>['High','Medium','Lower'].includes(r.band)), 'bands are High / Medium / Lower, never a bare score');
t.ok(!JSON.stringify(rows.map(r=>({b:r.band,w:r.why}))).match(/\bscore\b/i), 'no raw points are shown');
for(let i=1;i<rows.length;i++) t.ok(rows[i-1].score>=rows[i].score, 'rows are sorted most to least important');

/* the request text sent to the building search holds only the place and filters */
const qry = E.buildQuery(39.96,-82.99,800,crit);
t.ok(/39\.96/.test(qry) && /around/.test(qry), 'the building search asks about a point and a radius');

/* footprint math */
const rs = E.ringStats([{lat:39.96,lon:-82.99},{lat:39.96,lon:-82.9897},{lat:39.9603,lon:-82.9897},{lat:39.9603,lon:-82.99},{lat:39.96,lon:-82.99}]);
t.ok(rs && rs.perimFt>0 && rs.sqft>0, 'ring area and perimeter are computed from the outline');

/* playbooks */
t.ok(E.defaultPlaybooks().length>=6, 'ready-made solutions exist');
t.ok(E.solutionsFor(E.defaultPlaybooks(),'hotel',9).length>=1, 'a tall hotel matches at least one ready-made solution');
/* county records: the pure parts. Invented parcel, invented owner. */
t.eq(E.countyFor(41.4577,-81.4927),'cuyahoga','a Beachwood position is in the county the app can look up');
t.eq(E.countyFor(39.96,-83.0),'','a position outside it is not');
const cq=E.countyQuery(41.4577,-81.4927);
t.ok(/geometry=-81\.492700,41\.457700/.test(cq) && /returnGeometry=false/.test(cq), 'the query asks about one point and asks for no map shapes');
t.ok(!/lead|price|note|rate/i.test(cq), 'the query carries only a position');
const recs=E.parseCounty({features:[{attributes:{PARCELPIN:'999000001', DEEDED_OWNER:'MOCK HOLDINGS LLC', MAIL_NAME:'MOCK MGMT CO', MAIL_ADDR_STREET:'1 TEST WAY', MAIL_CITY:'MOCKTOWN', MAIL_STATE:'OH', MAIL_ZIP:'44000', PAR_ADDR_ALL:'1 TEST AVE', TAX_LUC:'999', TAX_LUC_DESCRIPTION:'MOCK USE', TOTAL_COM_USE_AREA:52400, COM_LIVING_UNITS:0, TRANSFER_DATE:1700000000000, SALES_AMOUNT:0}},{attributes:{}}]});
t.eq(recs.length,1,'an empty record is dropped');
t.eq(recs[0].owner,'MOCK HOLDINGS LLC','the deeded owner is read, whatever the case of the field names');
t.ok(/MOCK MGMT CO/.test(recs[0].mailTo) && /MOCKTOWN, OH 44000/.test(recs[0].mailTo), 'the mailing address keeps the name when it differs from the owner');
t.eq(recs[0].comArea,52400,'commercial area is kept'); t.eq(recs[0].units,null,'zero units is stored as unknown, not 0'); t.eq(recs[0].saleAmt,null,'a zero sale price is not shown as a price');
t.eq(E.parseCounty({error:{code:400}}),[],'an error answer gives no records');
t.eq(E.parseCounty(null),[],'no answer gives no records');
/* how much to show */
t.eq(new Set(E.DETAIL_KEYS).size, E.DETAIL_KEYS.length, 'every switch has its own name');
const dS=E.detailPreset('simple'), dM=E.detailPreset('more'), dA=E.detailPreset('all');
t.ok(E.DETAIL_KEYS.filter(k=>dS[k]).length < E.DETAIL_KEYS.filter(k=>dM[k]).length && E.DETAIL_KEYS.filter(k=>dM[k]).length < E.DETAIL_KEYS.filter(k=>dA[k]).length, 'Simple shows less than More, and More less than Everything');
t.ok(E.DETAIL_KEYS.every(k=>!dS[k]||dA[k]), 'whatever Simple shows, Everything shows too');
t.ok(dS.addr && dS.next && dS.band && !dS.why && !dS.value && !dS.summary, 'Simple keeps the name, address, type, band and next action, and hides the rest');
t.eq(E.detailName(dS),'simple','a Simple mix is named Simple'); t.eq(E.detailName(dM),'more','More'); t.eq(E.detailName(dA),'all','Everything');
t.eq(E.detailName(Object.assign({},dS,{why:true})),'custom','any other mix is Custom');
t.eq(E.detailClean(null), dS, 'nothing saved gives Simple'); t.eq(E.detailClean({why:'yes', addr:false, junk:true}), Object.assign({},dS,{addr:false}), 'odd values are ignored, real ones kept, unknown keys dropped');
t.eq(E.detailClean([1,2]), dS, 'an array is not a setting');
/* the building search, split into small requests */
const bq = E.buildQueries(41.4577,-81.4927,4828,E.critClean({preset:'targets'}));
t.eq(bq.map(x=>x.label), ['Buildings','Airports'], 'two gentle requests: every kind of building you chose in one, then the airports');
t.ok(bq[1].optional && !bq[0].optional, 'the airport request comes last and is optional');
const bodies = bq.filter(x=>!x.optional);
t.ok(bodies.every(x=>/\(around:4828,41\.45770,-81\.49270\)/.test(x.q)), 'every part asks about the same point and radius');
t.ok(bodies.every(x=>!/"building"~"\^\(/.test(x.q)), 'building types are exact matches, not patterns, so the server can use its index');
t.ok(bq.some(x=>/\["building"="hotel"\]/.test(x.q)) && bq.some(x=>/\["tourism"="hotel"\]\["building"\]/.test(x.q)), 'hotels are found by building and by tourism tag, as before');
t.ok(bq.some(x=>/"building"="residential"\]\["building:levels"/.test(x.q)), 'tall residential buildings are still included');
t.ok(bq.every(x=>/\[out:json\]\[timeout:\d+\]/.test(x.q)), 'each part has its own server time limit');
const joined = E.joinQueries(bq), back = E.splitQueries(joined);
t.eq(back.map(x=>x.label), bq.map(x=>x.label), 'the requests read as one block of text and split back the same'); t.eq(back.map(x=>x.q), bq.map(x=>x.q), 'word for word');
t.eq(E.splitQueries('[out:json];out;').length, 1, 'plain text with no markers is one request');
const hr = E.buildQueries(41.4,-81.4,1609,E.critClean({preset:'highrise'}));
t.eq(hr.length, 2, 'the high-rise preset is also two requests'); t.ok(/building:levels/.test(hr[0].q), 'and asks for floors');
t.ok(['hotel','apartments','hospital'].every(v=>new RegExp('\\["building"="'+v+'"\\]').test(bq[0].q)), 'every chosen kind is in the one buildings request');
t.eq((bq[0].q.match(/\["building"="hotel"\]/g)||[]).length, 2, 'and each value is asked for once, as a way and as a relation');

/* a quote from the customer's request: suggestions only, each with the words it came from */
{
  const sv = E.defaultServices(), R = x=>E.readRequest(x, sv), ids = r=>r.services.map(s=>s.id);
  const a = R('We need the windows on our 6-story office cleaned quarterly, before our open house on May 3rd and again by 9/15/2027.');
  t.ok(ids(a).includes('s-ext1') && ids(a).includes('s-upper'), 'windows on a six-story building suggest the exterior lines');
  t.eq(a.stories, 6, 'the floors are read from their words'); t.eq(a.storiesWhy, '6-story', 'and the words are kept');
  t.eq(a.freq, 'quarterly', 'quarterly is read'); t.ok(ids(a).includes('s-plan'), 'a repeat frequency suggests the maintenance plan');
  t.eq(a.dates, ['May 3rd','9/15/2027'], 'the dates are copied as written'); t.ok(a.services.every(s=>s.why), 'every suggestion carries the words it came from');
  const b = R('One-story clinic, just the windows please. Once.');
  t.ok(ids(b).includes('s-ext1') && !ids(b).includes('s-upper'), 'a one-story building does not get the upper-floors line'); t.eq(b.freq, 'one time', 'one time is read');
  const c = R('Mold and algae on the brick facade and the roof looks bad. Inspect for leaks too.');
  t.ok(['s-facade','s-roof','s-insp'].every(i=>ids(c).includes(i)), 'facade, roof and inspection words each suggest their service'); t.eq(c.stories, null, 'no floors invented'); t.eq(c.freq, '', 'no frequency invented'); t.eq(c.dates, [], 'no dates invented');
  const d = R('Interior glass in the lobby only.'); t.ok(ids(d).includes('s-int1') && !ids(d).includes('s-ext1'), 'interior glass suggests the interior line, not the exterior one');
  t.eq(R('hello there').services, [], 'text with nothing recognisable suggests nothing'); t.eq(R('').stories, null, 'empty text is fine');
  t.eq(E.readRequest('windows', [{id:'s-custom', name:'Custom'}]).services, [], 'a service the owner removed is never suggested');
  t.eq(R('x'.repeat(5000)).services, [], 'a very long paste is cut down safely');
}
t.done();
