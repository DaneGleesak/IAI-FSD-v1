'use strict';
/* Shared test harness: a tiny static server, a Playwright browser, mocked outside services and a tally.
   Everything here is invented: no real company, building, person or price appears in any test. */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');

const MIME = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'};
function serve(root, port){
  const srv = http.createServer((q,s)=>{
    let p = decodeURIComponent(q.url.split('?')[0]); if(p==='/') p='/index.html';
    const f = path.join(root, p);
    if(!f.startsWith(path.resolve(root))){ s.writeHead(403); s.end(); return; }
    fs.readFile(f,(e,b)=>{ if(e){ s.writeHead(404); s.end(); return; } s.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'}); s.end(b); });
  });
  return new Promise(r=>srv.listen(port,()=>r(srv)));
}

/* invented Overpass answer: three buildings in a made-up town, no real names */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64');
function mockOverpass(){
  const sq=(lat,lon,d)=>[{lat:lat-d,lon:lon-d},{lat:lat-d,lon:lon+d},{lat:lat+d,lon:lon+d},{lat:lat+d,lon:lon-d},{lat:lat-d,lon:lon-d}];
  return { elements:[
    {type:'way',id:9001,tags:{building:'office','building:levels':'14',name:'Mock Tower A','addr:housenumber':'1','addr:street':'Test Ave','addr:city':'Mocktown'},geometry:sq(39.9600,-82.9900,0.0003)},
    {type:'way',id:9002,tags:{building:'hotel','building:levels':'8',name:'Mock Hotel B','addr:housenumber':'2','addr:street':'Test Ave','addr:city':'Mocktown'},geometry:sq(39.9610,-82.9890,0.0002)},
    {type:'way',id:9003,tags:{building:'apartments','building:levels':'5',name:'Mock Flats C'},geometry:sq(39.9590,-82.9880,0.00015)},
    {type:'way',id:9004,tags:{building:'yes'},geometry:sq(39.9620,-82.9910,0.0001)}
  ]};
}

async function launch(opts){
  opts = opts||{};
  const port = opts.port || 8200 + Math.floor(Math.random()*500);
  const srv = await serve(opts.root || path.resolve(__dirname,'..'), port);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{width:opts.w||390,height:opts.h||844}, deviceScaleFactor:1, hasTouch:!!opts.touch, isMobile:!!opts.touch, serviceWorkers:'block', permissions:['clipboard-read','clipboard-write'], acceptDownloads:true });
  const outside = [];           // every request that left the app's own origin
  const bodies = [];            // text sent in those requests
  await ctx.route(u=>!u.href.startsWith('http://localhost:'+port), async route=>{
    const r = route.request(), url = r.url();
    outside.push({url, method:r.method()}); if(r.postData()) bodies.push(r.postData()); bodies.push(url);
    if(/tile\.openstreetmap\.org/.test(url)) return route.fulfill({status:200, contentType:'image/png', body:PNG});
    if(/overpass-api\.de/.test(url)) return route.fulfill({status:200, contentType:'application/json', body:JSON.stringify(mockOverpass())});
    if(/nominatim\.openstreetmap\.org/.test(url)) return route.fulfill({status:200, contentType:'application/json', body:JSON.stringify([{display_name:'1 Test Ave, Mocktown', lat:'39.9600', lon:'-82.9900', osm_type:'way', osm_id:9001, type:'office', category:'building', address:{house_number:'1', road:'Test Ave', city:'Mocktown'}}])});
    return route.abort();
  });
  const page = await ctx.newPage();
  const errors = [], dialogs = [];
  page.on('pageerror', e=>errors.push('pageerror: '+e.message));
  page.on('console', m=>{ if(m.type()==='error' && !/Failed to load resource/.test(m.text())) errors.push('console: '+m.text()); });
  page.on('dialog', d=>{ dialogs.push(d.type()+': '+d.message()); d.dismiss().catch(()=>{}); });
  const base = 'http://localhost:'+port+'/';
  return { port, base, srv, browser, ctx, page, outside, bodies, errors, dialogs,
    async open(q){ await page.goto(base+(q||'')); await page.waitForSelector('#nav button'); },
    async close(){ await browser.close(); srv.close(); } };
}

/* tiny assertion tally */
function suite(name){
  const s = {name, pass:0, fail:0, fails:[]};
  s.ok = (cond, msg)=>{ if(cond){ s.pass++; } else { s.fail++; s.fails.push(msg); console.log('  ✗ '+msg); } };
  s.eq = (a, b, msg)=>s.ok(JSON.stringify(a)===JSON.stringify(b), msg+' (got '+JSON.stringify(a)+', wanted '+JSON.stringify(b)+')');
  s.done = ()=>{ console.log((s.fail?'FAIL ':'PASS ')+name+': '+s.pass+' passed'+(s.fail?', '+s.fail+' failed':'')); process.exit(s.fail?1:0); };
  return s;
}
module.exports = { launch, suite, mockOverpass };
