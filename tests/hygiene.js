'use strict';
/* Repository hygiene. The repository is public, so it must hold no real prices, phone numbers,
   email addresses, customer data or backups, and the app may only know a short list of outside web addresses. */
const fs = require('fs'), path = require('path');
const { suite } = require('./lib');
const t = suite('repository hygiene');
const root = path.resolve(__dirname,'..');
const files = []; (function walk(d){ for (const n of fs.readdirSync(d)) { if (['.git','node_modules','test-out','dist'].includes(n)) continue; const p=path.join(d,n); fs.statSync(p).isDirectory() ? walk(p) : files.push(p); } })(root);
const text = files.filter(f=>/\.(js|html|css|json|md|toml|sh|yml|yaml)$/.test(f));
const rel = f=>path.relative(root,f);
const app = text.filter(f=>/^(js\/|index\.html|sw\.js|manifest\.json)/.test(rel(f)));

/* 1. outside web addresses used by the app: a fixed allowlist, and only the four lookup hosts are ever fetched */
const ALLOWED = [/^https:\/\/tile\.openstreetmap\.org\//, /^https:\/\/overpass-api\.de\//, /^https:\/\/nominatim\.openstreetmap\.org\//, /^https:\/\/gis\.cuyahogacounty\.gov\/server\/rest\/services\//,
  /^https:\/\/maps\.apple\.com\//, /^https:\/\/forecast\.weather\.gov\//, /^https:\/\/www\.faa\.gov\/uas\/getting_started\/laanc$/,
  /^https:\/\/www\.google\.com\/search\?q=$/, /^https:\/\/businesssearch\.ohiosos\.gov\/$/];
for (const f of app) for (const m of fs.readFileSync(f,'utf8').matchAll(/https?:\/\/[A-Za-z0-9./_?=&%-]+/g))
  t.ok(ALLOWED.some(r=>r.test(m[0])), rel(f)+' only uses allowed addresses: '+m[0]);
const fetchers = app.filter(f=>/\bfetch\(/.test(fs.readFileSync(f,'utf8')) && !/sw\.js$/.test(f)).map(rel);
t.eq(fetchers, ['js/ui.js'], 'only one function (fetchJSON in ui.js) makes network requests');
const ui = fs.readFileSync(path.join(root,'js/ui.js'),'utf8');
t.ok(/credentials:\s*'omit'/.test(ui) && /cache:\s*'no-store'/.test(ui), 'lookups send no cookies and are never cached');
t.ok(!/XMLHttpRequest|sendBeacon|WebSocket|EventSource/.test(app.map(f=>fs.readFileSync(f,'utf8')).join('\n')), 'no other network mechanism is used');
t.ok(!/<script[^>]+src="https?:/.test(fs.readFileSync(path.join(root,'index.html'),'utf8')), 'no third-party scripts, fonts or analytics');
t.ok(/new URL\(req\.url\)\.origin !== self\.location\.origin\) return/.test(fs.readFileSync(path.join(root,'sw.js'),'utf8')), 'the service worker ignores every cross-origin request');

/* 2. no real contact details or prices in anything that is committed */
const PHONE = /(?<![\d.])\(?\b\d{3}\)?[-. ]\d{3}[-. ]\d{4}\b/, EMAIL = /[A-Za-z0-9._+-]+@(?!example\.(com|test)\b)(?!company\.com\b)[A-Za-z0-9-]+\.[A-Za-z]{2,}/;
for (const f of text) {
  if (/^tests\//.test(rel(f))) continue;           // tests plant obviously fake values on purpose
  const s = fs.readFileSync(f,'utf8');
  t.ok(!PHONE.test(s.replace(/555[-. ]01\d\d/g,'')), rel(f)+' holds no phone number');
  t.ok(!EMAIL.test(s), rel(f)+' holds no real email address');
}
for (const f of app.filter(f=>/^js\//.test(rel(f)))) {
  const s = fs.readFileSync(f,'utf8');
  t.ok(!/\brate\s*:\s*[1-9]/.test(s), rel(f)+' sets no built-in service rate');
}

/* 3. nothing that looks like a backup, export or lead list is committed */
t.ok(files.every(f=>!/backup.*\.json$|leads?.*\.(csv|json)$|\.xlsx?$/i.test(path.basename(f))), 'no backup, spreadsheet or lead-list file is in the repository');
t.done();
