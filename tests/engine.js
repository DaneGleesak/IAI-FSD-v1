'use strict';
/* Unit checks for the pure engine: no browser. Invented numbers only. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { suite } = require('./lib');
const t = suite('engine');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/engine.js'),'utf8')+'\nthis.E={quoteCalc,defaultServices,rankCands,parseOverpass,keepCand,candClean,buildQuery,critClean,ringStats,solutionsFor,defaultPlaybooks,SERVICE_FAMILIES};', ctx);
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
t.done();
