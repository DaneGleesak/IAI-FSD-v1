'use strict';
/* Installable and offline: manifest and icons are valid, the service worker caches every app file,
   and the app still opens with no connection. */
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright');
const { suite } = require('./lib');
const t = suite('install and offline');
const root = path.resolve(__dirname,'..');
const man = JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
t.eq(man.display, 'standalone', 'the manifest opens the app full screen');
t.ok(man.icons.some(i=>i.sizes==='192x192') && man.icons.some(i=>i.sizes==='512x512') && man.icons.some(i=>i.purpose==='maskable'), 'icons: 192, 512 and a maskable one are declared');
const png = f=>{ const b=fs.readFileSync(path.join(root,f)); return b.readUInt32BE(16)+'x'+b.readUInt32BE(20); };
for (const i of man.icons) t.eq(png(i.src), i.sizes, i.src+' is really '+i.sizes);
t.eq(png('icons/apple-touch-icon.png'), '180x180', 'the iPhone home-screen icon is 180x180');
const idx = fs.readFileSync(path.join(root,'index.html'),'utf8');
t.ok(/apple-mobile-web-app-capable/.test(idx) && /viewport-fit=cover/.test(idx) && /apple-touch-icon/.test(idx), 'index.html carries the iPhone home-screen tags and safe-area viewport');
const sw = fs.readFileSync(path.join(root,'sw.js'),'utf8');
const assets = [...sw.match(/const ASSETS = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]).filter(a=>a!=='./');
for (const a of assets) t.ok(fs.existsSync(path.join(root,a)), 'sw.js lists '+a+' and it exists');
const loaded = [...idx.matchAll(/(?:src|href)="((?:js\/|styles|icons\/)[^"]+)"/g)].map(m=>m[1]);
for (const a of loaded) t.ok(assets.includes(a), 'index.html loads '+a+' and sw.js caches it');

(async()=>{
  const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'};
  const srv = http.createServer((q,s)=>{ let p=q.url.split('?')[0]; if(p==='/')p='/index.html'; fs.readFile(path.join(root,p),(e,b)=>{ if(e){s.writeHead(404);s.end();return;} s.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'}); s.end(b); }); });
  await new Promise(r=>srv.listen(8791,r));
  const browser = await chromium.launch(); const ctx = await browser.newContext({viewport:{width:390,height:800}});
  const page = await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto('http://localhost:8791/'); await page.waitForSelector('#nav button');
  await page.evaluate(()=>navigator.serviceWorker.ready); await page.waitForTimeout(600);
  const cached = await page.evaluate(async()=>{ const k=await caches.keys(); const c=await caches.open(k[0]); return (await c.keys()).map(r=>new URL(r.url).pathname); });
  for (const a of assets) t.ok(cached.includes('/'+a), 'the service worker cached '+a);
  /* offline: reload with the network off */
  await ctx.setOffline(true); await page.reload(); await page.waitForSelector('#nav button',{timeout:8000});
  t.ok(await page.isVisible('#main'), 'the app opens with no connection');
  t.ok((await page.textContent('#topTitle')).length>0, 'and shows its screen');
  /* saved data is not touched by the cache */
  t.ok(await page.evaluate(()=>!!localStorage.getItem(KEY)), 'saved data is still there offline');
  t.eq(errs, [], 'no page errors');
  await browser.close(); srv.close(); t.done();
})().catch(e=>{ console.error(e); process.exit(1); });
