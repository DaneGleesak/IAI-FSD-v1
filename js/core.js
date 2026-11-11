'use strict';
/* IAI Field Sales Dashboard: saved data, leads, small helpers.
   Everything lives in this phone's localStorage (key below) and IndexedDB (photos and files).
   Nothing is sent anywhere unless you approve a lookup. */
const APP_NAME='IAI Field Sales Dashboard', APP_VER='1.0.0';
const KEY='iai-fsd-v1-state';
const STAGES=['Identified','Researching','Contacted','Qualified','Proposal','Negotiation','Won','Lost'];
const OPEN=STAGES.slice(0,6);
const STAGE_COL={Identified:'#A9D3EE', Researching:'#7FBDE6', Contacted:'#4BA3DD', Qualified:'#1F86D0', Proposal:'#0A5EB6', Negotiation:'#04315C', Won:'#1FB67A', Lost:'#8793A3'};
const TOUCH_HOW={call:'Call', spoke:'Spoke with someone', noanswer:'No answer', voicemail:'Left a voicemail', visit:'Visited', email:'Emailed', card:'Left a card', meeting:'Meeting'};
const BANDS=['High','Medium','Lower'];

/* ---------- small helpers ---------- */
const $=(s,r)=>(r||document).querySelector(s), $$=(s,r)=>[...(r||document).querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,8)+Date.now().toString(36).slice(-4);
const pad2=n=>String(n).padStart(2,'0');
const dayStr=d=>d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate());
const todayStr=()=>dayStr(new Date());
const parseDay=s=>new Date(String(s)+'T12:00:00');
const addDays=(s,n)=>{ const d=s?parseDay(s):new Date(); d.setDate(d.getDate()+n); return dayStr(d); };
/* whole days from today to a date string: negative = in the past */
const dayDiff=s=>{ if(!/^\d{4}-\d{2}-\d{2}$/.test(String(s||''))) return null; const a=parseDay(todayStr()), b=parseDay(s); return Math.round((b-a)/864e5); };
const daysSince=ts=>ts ? Math.floor((Date.now()-ts)/864e5) : null;
const whenLabel=ts=>{ if(!ts) return 'never'; const d=daysSince(ts); return d<=0 ? 'today' : d===1 ? 'yesterday' : d<30 ? d+' days ago' : d<60 ? 'a month ago' : Math.floor(d/30)+' months ago'; };
const shortDate=s=>{ const d=parseDay(s); return isNaN(d) ? '' : d.toLocaleDateString('en-US',{month:'short',day:'numeric'}); };
const dueLabel=s=>{ const d=dayDiff(s); if(d==null) return 'no date'; return d<0 ? 'Overdue '+(-d)+'d' : d===0 ? 'Today' : d===1 ? 'Tomorrow' : shortDate(s); };
const phoneHref=s=>{ const d=String(s||'').replace(/[^\d+]/g,''); return d.length>=7 ? 'tel:'+d : ''; };
const smsHref=s=>{ const d=String(s||'').replace(/[^\d+]/g,''); return d.length>=7 ? 'sms:'+d : ''; };
const emailOf=s=>(String(s||'').match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)||[''])[0];
const mapsHref=l=>{
  const q=l.addr || l.name;
  if(l.lat!=null && l.lon!=null) return 'https://maps.apple.com/?daddr='+l.lat.toFixed(6)+','+l.lon.toFixed(6)+'&dirflg=d'+(q?'&q='+encodeURIComponent(q):'');
  return q ? 'https://maps.apple.com/?daddr='+encodeURIComponent(q)+'&dirflg=d' : '';
};

/* ---------- the saved data ---------- */
let damagedSave=false, saveFailed=false;
function blankFact(v,st,src){ return {v:str(v||'',200), st: v ? (['estimated','verified'].includes(st)?st:'estimated') : 'unknown', src:str(src||'',120)}; }
function defaultSender(){ return {name:'', company:'', phone:'', email:'', address:'', blurb:'We clean building exteriors, windows and facades, with drones.', optOut:'If you would rather not hear from me, reply “no thanks” and I will not follow up.'}; }
function defaults(){
  return {v:1, properties:[],
    settings:{lookups:{on:false, autoSend:false}, show:detailPreset('simple'), sender:defaultSender(), floorFt:null, services:defaultServices(), playbooks:defaultPlaybooks()},
    map:{view:null, pin:null, radius:1609, crit:critClean({preset:'targets'}), lens:'balanced', offer:[]},
    search:{last:null, runs:[], saved:[]}, review:{decisions:[]},
    counters:{quote:0},
    route:{day:'', ids:[]},
    ui:{tab:'dash', seeded:false, ctlOpen:true, mapTab:'search', pipeView:'list', pipeFilter:'all', leadSort:'priority', leadStage:'all', showN:20, closed:{}}};
}
function cleanFacts(f){
  f=(f && typeof f==='object') ? f : {}; const o={};
  ['owner','mgmt','vendor','renewal'].forEach(k=>{ const x=(f[k] && typeof f[k]==='object') ? f[k] : {}; o[k]={v:str(x.v,200), st:x.v ? (['estimated','verified'].includes(x.st)?x.st:'estimated') : 'unknown', src:str(x.src,120)}; });
  return o;
}
function cleanCounty(c){
  if(!c || typeof c!=='object' || !COUNTIES[c.key]) return null;
  const recs=(Array.isArray(c.recs)?c.recs:[]).slice(0,10).map(countyRecClean).filter(Boolean), pk=Math.round(num(c.pick,-1,9,-1));
  return {key:c.key, ts:Number(c.ts)||0, recs, pick:(pk>=0 && pk<recs.length)?pk:-1};
}
/* one swipe-review choice: the building as it was, what was decided, when, and the lead it made (if any) */
const MAX_DECISIONS=2500;
function cleanDecision(x){
  if(!x || typeof x!=='object') return null; const c=candClean(x.cand); if(!c) return null;
  const d=REVIEW_CHOICES.some(r=>r[0]===x.d) ? x.d : null; if(!d) return null;
  return {id:c.id, d, ts:Number(x.ts)||0, reason:str(x.reason,60), leadId:str(x.leadId,40), cand:c};
}
function cleanLead(x){
  if(!x || typeof x!=='object' || !x.id) return null;
  const la=Number(x.lat), lo=Number(x.lon), hasPos=x.lat!=null && x.lon!=null && Math.abs(la)<=90 && Math.abs(lo)<=180;
  const b=(x.bld && typeof x.bld==='object') ? x.bld : {};
  const ops=(x.ops && typeof x.ops==='object') ? x.ops : {}, okOps=['Yes','Some','No','Not sure'];
  const l={id:str(x.id,40), name:str(x.name,160), addr:str(x.addr,200), lat:hasPos?la:null, lon:hasPos?lo:null,
    cat:CAT_KEYS.includes(x.cat)?x.cat:'mixed', osm:str(x.osm,40), src:['map','address','manual','demo'].includes(x.src)?x.src:'manual', demo:x.demo===true,
    stage:STAGES.includes(x.stage)?x.stage:'Identified', ts:Number(x.ts)||Date.now(),
    band:BANDS.includes(x.band)?x.band:'', prio:BANDS.includes(x.prio)?x.prio:'', why:(Array.isArray(x.why)?x.why:[]).slice(0,8).map(s=>str(s,120)),
    bld:{levels:b.levels==null||b.levels===''?null:Math.round(num(b.levels,1,200,1)), height:b.height==null||b.height===''?null:num(b.height,1,900,null),
      sqft:b.sqft==null||b.sqft===''?null:Math.round(num(b.sqft,0,1e7,0)), perimFt:b.perimFt==null||b.perimFt===''?null:Math.round(num(b.perimFt,0,1e6,0)),
      glass:b.glass===true, op:str(b.op,80), web:str(b.web,200), phone:str(b.phone,40), email:str(b.email,120),
      airMi:b.airMi==null||b.airMi===''?null:num(b.airMi,0,500,null), airName:str(b.airName,80), approx:b.approx===true,
      outline:Array.isArray(b.outline)?b.outline.slice(0,24).map(p=>Array.isArray(p)?[num(p[0],-90,90,0),num(p[1],-180,180,0)]:null).filter(Boolean):[],
      checked:b.checked===true, src:str(b.src,120)},
    f:cleanFacts(x.f),
    contacts:(Array.isArray(x.contacts)?x.contacts:[]).filter(c=>c && typeof c==='object').slice(0,30).map(c=>({id:str(c.id||uid(),40), name:str(c.name,100), title:str(c.title,100), email:str(c.email,160), phone:str(c.phone,40),
      role:['decision','owner','manager','other'].includes(c.role)?c.role:'other', conf:['low','medium','high','verified'].includes(c.conf)?c.conf:'', src:str(c.src,120)})),
    ops:{launch:okOps.includes(ops.launch)?ops.launch:'', water:okOps.includes(ops.water)?ops.water:'', obstructions:okOps.includes(ops.obstructions)?ops.obstructions:'', glass:okOps.includes(ops.glass)?ops.glass:''},
    services:(Array.isArray(x.services)?x.services:[]).map(s=>str(s,40)).slice(0,40),
    estValue:(x.estValue==null||x.estValue==='')?null:num(x.estValue,0,1e9,null),
    events:(Array.isArray(x.events)?x.events:[]).filter(e=>e && typeof e==='object').map(e=>({id:str(e.id||uid(),40), ts:Number(e.ts)||0, type:['stage','touch','note','quote','update'].includes(e.type)?e.type:'update',
      text:str(e.text,2000), from:e.from==null?null:str(e.from,30), to:e.to==null?null:str(e.to,30), how:Object.keys(TOUCH_HOW).includes(e.how)?e.how:'', by:str(e.by,12), init:e.init===true, ref:str(e.ref,20)})),
    tasks:(Array.isArray(x.tasks)?x.tasks:[]).filter(t=>t && typeof t==='object').map(t=>({id:str(t.id||uid(),40), text:str(t.text,300), due:/^\d{4}-\d{2}-\d{2}$/.test(String(t.due||''))?t.due:'', done:t.done===true, ts:Number(t.ts)||0, doneTs:Number(t.doneTs)||0})),
    notes:(Array.isArray(x.notes)?x.notes:[]).filter(n=>n && typeof n==='object').map(n=>({id:str(n.id||uid(),40), text:str(n.text,6000), ts:Number(n.ts)||0})),
    quotes:(Array.isArray(x.quotes)?x.quotes:[]).filter(q=>q && typeof q==='object').slice(0,60).map(q=>({id:str(q.id||uid(),40), ref:str(q.ref,20), ts:Number(q.ts)||0,
      total:q.total==null?null:num(q.total,0,1e9,null), coreTotal:q.coreTotal==null?null:num(q.coreTotal,0,1e9,null), coreAllPriced:q.coreAllPriced===true, scope:str(q.scope,300), note:str(q.note,300),
      stories:q.stories==null?null:Math.round(num(q.stories,1,200,1)), perimFt:q.perimFt==null?null:num(q.perimFt,0,1e6,0), text:str(q.text,6000),
      status:q.status==='approved'?'approved':'draft', approvedTs:q.status==='approved'?(Number(q.approvedTs)||0):0, approvedBy:q.status==='approved'?str(q.approvedBy,80):'',
      lines:(Array.isArray(q.lines)?q.lines:[]).slice(0,40).map(z=>({id:str(z&&z.id,40), name:str(z&&z.name,160), amount:(z&&z.amount!=null)?num(z.amount,0,1e9,null):null, need:str(z&&z.need,20), core:!!(z&&z.core)}))})),
    fileIds:(Array.isArray(x.fileIds)?x.fileIds:[]).map(s=>str(s,40)).slice(0,60), county:cleanCounty(x.county)};
  return l;
}
function normalize(raw){
  const d=defaults(); raw=(raw && typeof raw==='object' && !Array.isArray(raw)) ? raw : {};
  const s=(raw.settings && typeof raw.settings==='object') ? raw.settings : {}, lk=(s.lookups && typeof s.lookups==='object') ? s.lookups : {};
  d.settings.lookups={on:lk.on===true, autoSend:lk.autoSend===true};
  d.settings.show=detailClean(s.show);
  const snd=(s.sender && typeof s.sender==='object' && !Array.isArray(s.sender)) ? s.sender : {}, ds=defaultSender();
  d.settings.sender={name:str(snd.name,80), company:str(snd.company,120), phone:str(snd.phone,40), email:str(snd.email,120), address:str(snd.address,200),
    blurb: typeof snd.blurb==='string' ? str(snd.blurb,400) : ds.blurb, optOut: typeof snd.optOut==='string' ? str(snd.optOut,300) : ds.optOut};
  if(s.floorFt!=null && s.floorFt!=='' && Number(s.floorFt)>0) d.settings.floorFt=num(s.floorFt,3,60,null);
  const svc=Array.isArray(s.services) ? s.services.filter(x=>x && typeof x==='object' && x.id) : [];
  if(svc.length) d.settings.services=svc.slice(0,40).map(x=>({id:str(x.id,40), name:str(x.name||'Service',160), unit:Object.keys(UNITS).includes(x.unit)?x.unit:'flat',
    applies:SCOPE_KEYS.includes(x.applies)?x.applies:'flat', core:x.core===true, on:x.on!==false,
    rate:(x.rate==null||x.rate==='')?null:num(x.rate,0,1e7,null), min:(x.min==null||x.min==='')?null:num(x.min,0,1e7,null), pitch:str(x.pitch,300)}));
  const pb=Array.isArray(s.playbooks) ? s.playbooks.filter(x=>x && typeof x==='object' && x.id) : [];
  if(pb.length) d.settings.playbooks=pb.slice(0,40).map(x=>({id:str(x.id,40), name:str(x.name||'Solution',160), types:Array.isArray(x.types)?x.types.map(t=>str(t,20)).slice(0,12):[], minLevels:Math.round(num(x.minLevels,0,99,0)),
    when:str(x.when,500), solution:str(x.solution,1200), pitch:str(x.pitch,800),
    objections:(Array.isArray(x.objections)?x.objections:[]).filter(q=>q&&typeof q==='object').slice(0,12).map(q=>({q:str(q.q,200), a:str(q.a,500)})),
    questions:(Array.isArray(x.questions)?x.questions:[]).map(q=>str(q,200)).slice(0,12), services:(Array.isArray(x.services)?x.services:[]).map(q=>str(q,40)).slice(0,20)}));
  const m=(raw.map && typeof raw.map==='object') ? raw.map : {};
  if(m.view && typeof m.view==='object'){ const la=Number(m.view.lat), lo=Number(m.view.lon), z=Number(m.view.z); if(Math.abs(la)<=85 && Math.abs(lo)<=180 && z>=2 && z<=19) d.map.view={lat:la, lon:lo, z}; }
  if(m.pin && typeof m.pin==='object'){ const la=Number(m.pin.lat), lo=Number(m.pin.lon); if(Math.abs(la)<=90 && Math.abs(lo)<=180) d.map.pin={lat:la, lon:lo, label:str(m.pin.label,80)}; }
  d.map.radius=Math.round(num(m.radius,200,32000,1609)); d.map.crit=critClean(m.crit && typeof m.crit==='object' ? m.crit : {preset:'targets'}); d.map.lens=Object.keys(LENS).includes(m.lens)?m.lens:'balanced';
  d.map.offer=(Array.isArray(m.offer)?m.offer:[]).filter(k=>SERVICE_FAMILIES[k]);
  const se=(raw.search && typeof raw.search==='object') ? raw.search : {};
  if(se.last && typeof se.last==='object' && Array.isArray(se.last.items)){
    const items=se.last.items.slice(0,400).map(candClean).filter(Boolean), L=se.last;
    d.search.last={ts:Number(L.ts)||0, lat:num(L.lat,-90,90,0), lon:num(L.lon,-180,180,0), radius:Math.round(num(L.radius,200,32000,1609)), crit:critClean(L.crit),
      label:str(L.label,80), total:Math.round(num(L.total,0,1e6,items.length)), airports:Array.isArray(L.airports)?L.airports.slice(0,20).map(a=>({lat:num(a&&a.lat,-90,90,0), lon:num(a&&a.lon,-180,180,0), name:str(a&&a.name,80)})):[], items};
  }
  d.search.runs=(Array.isArray(se.runs)?se.runs:[]).filter(r=>r && typeof r==='object').slice(0,30).map(r=>({id:str(r.id||uid(),20), ts:Number(r.ts)||0, label:str(r.label,80), lat:num(r.lat,-90,90,0), lon:num(r.lon,-180,180,0), radius:Math.round(num(r.radius,200,32000,1609)), crit:critClean(r.crit), found:Math.round(num(r.found,0,1e6,0)), kept:Math.round(num(r.kept,0,1e6,0))}));
  d.search.saved=(Array.isArray(se.saved)?se.saved:[]).filter(r=>r && typeof r==='object').slice(0,60).map(r=>({id:str(r.id||uid(),20), ts:Number(r.ts)||0, name:str(r.name,80), lat:num(r.lat,-90,90,0), lon:num(r.lon,-180,180,0), radius:Math.round(num(r.radius,200,32000,1609)), crit:critClean(r.crit)}));
  const rv=(raw.review && typeof raw.review==='object') ? raw.review : {}, seen=new Set();
  d.review.decisions=(Array.isArray(rv.decisions)?rv.decisions:[]).map(cleanDecision).filter(x=>x && !seen.has(x.id) && seen.add(x.id)).slice(0,MAX_DECISIONS);
  d.counters.quote=Math.round(num(raw.counters && raw.counters.quote,0,1e7,0));
  d.properties=(Array.isArray(raw.properties)?raw.properties:(Array.isArray(raw.leads)?raw.leads:[])).map(cleanLead).filter(Boolean);
  const maxRef=d.properties.reduce((m,l)=>l.quotes.reduce((n,q)=>Math.max(n, parseInt(String(q.ref).replace(/\D/g,''),10)||0), m), 0);
  d.counters.quote=Math.max(d.counters.quote, maxRef);
  if(raw.route && typeof raw.route==='object') d.route={day:/^\d{4}-\d{2}-\d{2}$/.test(String(raw.route.day||''))?raw.route.day:'', ids:(Array.isArray(raw.route.ids)?raw.route.ids:[]).map(i=>str(i,40)).slice(0,40)};
  const u=(raw.ui && typeof raw.ui==='object') ? raw.ui : {};
  d.ui.seeded=u.seeded===true; d.ui.ctlOpen=u.ctlOpen!==false; d.ui.tab=['dash','map','leads','pipe','settings','review'].includes(u.tab)?u.tab:'dash'; d.ui.mapTab=['search','saved','recent'].includes(u.mapTab)?u.mapTab:'search';
  d.ui.pipeView=['list','boards','map'].includes(u.pipeView)?u.pipeView:'list'; d.ui.pipeFilter=['all','high','overdue','quiet'].includes(u.pipeFilter)?u.pipeFilter:'all';
  d.ui.leadSort=['priority','recent','value','name'].includes(u.leadSort)?u.leadSort:'priority'; d.ui.leadStage=(u.leadStage==='all'||STAGES.includes(u.leadStage))?u.leadStage:'all';
  d.ui.closed=(u.closed && typeof u.closed==='object') ? Object.fromEntries(Object.entries(u.closed).filter(([k,v])=>STAGES.includes(k)).map(([k,v])=>[k,!!v])) : {};
  return d;
}
function load(){
  let raw=null; try{ raw=localStorage.getItem(KEY); }catch(e){}
  if(!raw) return normalize(null);
  try{ return normalize(JSON.parse(raw)); }
  catch(e){
    damagedSave=true;
    try{ if(!localStorage.getItem(KEY+'-damaged')) localStorage.setItem(KEY+'-damaged', raw); }catch(_){}
    return normalize(null);
  }
}
let state=load();
/* some views (private browsing, an embedded preview) block browser storage altogether: the app then keeps
   everything in memory for the visit and says so once, instead of claiming the phone is full */
let storageBlocked=false; try{ localStorage.getItem(KEY); }catch(e){ storageBlocked=true; }
function save(){
  if(storageBlocked) return false;
  try{ localStorage.setItem(KEY, JSON.stringify(state)); saveFailed=false; return true; }
  catch(e){ if(!saveFailed){ saveFailed=true; toast('This phone has no room left to save. Export a backup now (Settings).'); } return false; }
}

/* ---------- leads ---------- */
const findLead=id=>state.properties.find(l=>l.id===id)||null;
function newLead(o){
  o=o||{}; const now=Date.now();
  const l=cleanLead(Object.assign({id:uid(), ts:now, stage:'Identified', src:'manual'}, o));
  l.events=[{id:uid(), ts:now, type:'stage', from:null, to:'Identified', by:o.by||'you', init:true}];
  return l;
}
const leadName=l=>l.name || l.addr || (l.lat!=null ? 'Building at '+l.lat.toFixed(4)+', '+l.lon.toFixed(4) : 'New lead');
function leadFromCand(c, o){
  o=o||{}; const cat=CATS[c.cat]||CATS.mixed, now=todayStr(), src='OpenStreetMap, '+now;
  const l=newLead({name:c.name || c.addr || '', addr:c.addr, lat:c.lat, lon:c.lon, cat:c.cat, osm:c.id, src:o.src||'map', band:o.band||'', why:o.why||[],
    bld:{levels:c.levels, height:c.height, sqft:c.sqft||null, perimFt:c.perimFt||null, glass:c.glass, op:c.op, web:c.web, phone:c.phone, email:c.email,
      airMi:c.air?c.air.mi:null, airName:c.air?c.air.name:'', approx:c.approx, outline:c.outline||[], src}});
  if(c.email) l.contacts.push({id:uid(), name:'', title:'', email:c.email, phone:c.phone||'', role:'other', conf:'', src});
  const offer=o.offer||[];
  l.services=defaultServiceIds(offer);
  return l;
}
function defaultServiceIds(offer){
  const on=state.settings.services.filter(s=>s.on).map(s=>s.id);
  if(!offer || !offer.length) return on;
  const set=new Set(); offer.forEach(k=>(SERVICE_FAMILIES[k]||{ids:[]}).ids.forEach(i=>set.add(i)));
  const r=on.filter(i=>set.has(i)); return r.length ? r : on;
}
function logEvent(l, e){ const ev=Object.assign({id:uid(), ts:Date.now(), type:'update', text:'', by:'you'}, e); l.events.push(ev); return ev; }
function setStage(l, to, o){
  if(!STAGES.includes(to) || l.stage===to) return;
  const from=l.stage; l.stage=to; logEvent(l,{type:'stage', from, to, by:(o&&o.by)||'you', text:(o&&o.text)||''});
}
/* a call, visit or email: logged as a touch; the first real touch moves a new lead to Contacted. Returns an undo. */
function touchLead(l, how, text){
  const snap={n:l.events.length, stage:l.stage};
  logEvent(l,{type:'touch', how, text:str(text,2000)});
  if(how!=='noanswer' && ['Identified','Researching'].includes(l.stage)) setStage(l,'Contacted');
  return ()=>{ if(l.events.length>snap.n) l.events.splice(snap.n); l.stage=snap.stage; save(); };
}
function lastTouch(l){ return l.events.reduce((m,e)=>(e.type==='touch' && !e.init && e.by!=='import' && e.ts>m) ? e.ts : m, 0); }
const openTasks=l=>l.tasks.filter(t=>!t.done).sort((a,b)=>(a.due||'9999')<(b.due||'9999')?-1:(a.due||'9999')>(b.due||'9999')?1:0);
const nextTask=l=>openTasks(l)[0]||null;
function addTask(l, text, due){ const t={id:uid(), text:str(text,300), due:due||'', done:false, ts:Date.now(), doneTs:0}; l.tasks.unshift(t); return t; }
const isOpen=l=>OPEN.includes(l.stage);
const isOverdue=l=>isOpen(l) && l.tasks.some(t=>!t.done && t.due && dayDiff(t.due)<0);
const isQuiet=l=>{ if(!isOpen(l)) return false; const t=lastTouch(l); return !!t && daysSince(t)>=14 && !l.tasks.some(x=>!x.done && x.due); };
const latestQuote=l=>l.quotes.slice().sort((a,b)=>b.ts-a.ts)[0]||null;
/* a quote may go to a customer only after you have approved it */
const approvedQuote=l=>l.quotes.filter(q=>q.status==='approved').sort((a,b)=>b.ts-a.ts)[0]||null;
/* the value of a lead: the newest quote when every main line is priced, else what you typed */
function leadValue(l){ const q=latestQuote(l); if(q && q.coreAllPriced && q.coreTotal!=null) return q.coreTotal; return l.estValue; }
const leadBand=l=>l.prio || l.band || '';
const bandRank=b=>b==='High'?0:b==='Medium'?1:b==='Lower'?2:3;
function leadPlace(l){ return l.addr || (l.lat!=null ? l.lat.toFixed(5)+', '+l.lon.toFixed(5) : ''); }
function stageSince(l){ const e=[...l.events].reverse().find(x=>x.type==='stage' && x.to===l.stage); return e ? e.ts : l.ts; }
const venueFact=(l,k)=>(l.f[k] && l.f[k].v) || '';
function decisionMaker(l){ return l.contacts.find(c=>c.role==='decision') || null; }
function deleteLead(id){
  const i=state.properties.findIndex(l=>l.id===id); if(i<0) return null;
  const [l]=state.properties.splice(i,1); state.route.ids=state.route.ids.filter(x=>x!==id); save(); return {l, i};
}
function restoreLead(o){ if(!o) return; state.properties.splice(Math.min(o.i,state.properties.length),0,o.l); save(); }

/* today's route: stops you chose for today (it starts empty each day) */
function routeIds(){
  const t=todayStr(); if(state.route.day!==t){ state.route={day:t, ids:[]}; save(); }
  state.route.ids=state.route.ids.filter(id=>findLead(id));
  return state.route.ids;
}
function routeAdd(id){ routeIds(); if(!state.route.ids.includes(id)) state.route.ids.push(id); save(); }
function routeRemove(id){ routeIds(); state.route.ids=state.route.ids.filter(x=>x!==id); save(); }

/* ---------- photos and files: IndexedDB, never localStorage ---------- */
let _db=null;
function fileDB(){
  if(_db) return Promise.resolve(_db);
  return new Promise((res,rej)=>{
    if(!window.indexedDB){ rej(new Error('no storage')); return; }
    const r=indexedDB.open('iai-fsd-files',1);
    r.onupgradeneeded=()=>{ r.result.createObjectStore('files',{keyPath:'id'}); };
    r.onsuccess=()=>{ _db=r.result; res(_db); }; r.onerror=()=>rej(r.error||new Error('storage error'));
  });
}
async function fileAdd(blob, name){
  const db=await fileDB(), id=uid(), buf=await blob.arrayBuffer();
  await new Promise((res,rej)=>{ const tx=db.transaction('files','readwrite'); tx.objectStore('files').put({id, buf, mime:blob.type||'application/octet-stream', ts:Date.now(), size:blob.size, name:str(name||'file',120)}); tx.oncomplete=res; tx.onerror=()=>rej(tx.error); });
  return id;
}
async function fileGet(id){ const db=await fileDB(); return new Promise((res,rej)=>{ const r=db.transaction('files').objectStore('files').get(id); r.onsuccess=()=>res(r.result||null); r.onerror=()=>rej(r.error); }); }
async function fileDel(id){ const db=await fileDB(); return new Promise((res,rej)=>{ const tx=db.transaction('files','readwrite'); tx.objectStore('files').delete(id); tx.oncomplete=res; tx.onerror=()=>rej(tx.error); }); }
async function fileAll(){ const db=await fileDB(); return new Promise((res,rej)=>{ const r=db.transaction('files').objectStore('files').getAll(); r.onsuccess=()=>res(r.result||[]); r.onerror=()=>rej(r.error); }); }
const b64=buf=>{ let s=''; const u=new Uint8Array(buf); for(let i=0;i<u.length;i+=0x8000) s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000)); return btoa(s); };
const unb64=s=>{ const bin=atob(s), u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i); return u.buffer; };

/* ---------- backup: everything you typed, and photos only if you choose ---------- */
async function exportData(withFiles){
  const out={app:'iai-fsd', v:1, ts:Date.now(), state};
  if(withFiles){
    try{ out.files=(await fileAll()).map(f=>({id:f.id, name:f.name, mime:f.mime, ts:f.ts, size:f.size, b64:b64(f.buf)})); }catch(e){ out.files=[]; }
  }
  return JSON.stringify(out);
}
async function importData(text){
  let obj; try{ obj=JSON.parse(text); }catch(e){ return {ok:false, msg:'That file could not be read. Pick a backup made by this app.'}; }
  const st = obj && obj.app==='iai-fsd' ? obj.state : (obj && (Array.isArray(obj.properties)||Array.isArray(obj.leads)) ? obj : null);
  if(!st || !(Array.isArray(st.properties)||Array.isArray(st.leads))) return {ok:false, msg:'That is not a Field Sales backup.'};
  try{ const cur=localStorage.getItem(KEY); if(cur) localStorage.setItem(KEY+'-before-import', cur); }catch(e){}
  state=normalize(st);
  if(!save()) return {ok:false, msg:'Not enough room to save the backup.'};
  let nf=0;
  if(obj.files && Array.isArray(obj.files)){
    for(const f of obj.files){ try{
      const db=await fileDB(), buf=unb64(f.b64||'');
      await new Promise((res,rej)=>{ const tx=db.transaction('files','readwrite'); tx.objectStore('files').put({id:str(f.id,40), buf, mime:str(f.mime,80), ts:Number(f.ts)||Date.now(), size:buf.byteLength, name:str(f.name,120)}); tx.oncomplete=res; tx.onerror=()=>rej(tx.error); }); nf++;
    }catch(e){} }
  }
  return {ok:true, leads:state.properties.length, files:nf};
}

/* ---------- demo data: invented, labelled, and removable ---------- */
function demoLeads(){
  const D=(o)=>{
    const l=newLead({name:o.name, addr:o.addr, lat:o.lat, lon:o.lon, cat:o.cat, src:'demo', demo:true, band:o.band, why:o.why||[],
      bld:{levels:o.lv, sqft:o.sf, perimFt:o.pf, glass:!!o.gl, outline:o.out||[], src:'Demo data'}, estValue:o.val||null});
    l.ts=Date.now()-(o.age||3)*864e5; l.events[0].ts=l.ts; l.services=defaultServiceIds([]);
    if(o.stage && o.stage!=='Identified'){ l.stage=o.stage; l.events.push({id:uid(), ts:l.ts+1000, type:'stage', from:'Identified', to:o.stage, by:'you', text:''}); }
    if(o.touch!=null) l.events.push({id:uid(), ts:Date.now()-o.touch*864e5, type:'touch', how:'call', text:'Demo: talked with the property manager.', by:'you'});
    if(o.task) l.tasks.push({id:uid(), text:o.task[0], due:addDays(null,o.task[1]), done:false, ts:Date.now(), doneTs:0});
    if(o.f) { l.f.owner=blankFact(o.f[0],'estimated','Demo data'); l.f.mgmt=blankFact(o.f[1],'estimated','Demo data'); }
    if(o.dm) l.contacts.push({id:uid(), name:o.dm[0], title:o.dm[1], email:'', phone:'', role:'decision', conf:o.dm[2], src:'Demo data'});
    if(o.note) l.notes.push({id:uid(), text:o.note, ts:Date.now()-864e5});
    return l;
  };
  const sq=(la,lo,w,h)=>{ const a=h/2*0.3048/110574, b=w/2*0.3048/(111320*Math.cos(la*Math.PI/180)); return [[la-a,lo-b],[la-a,lo+b],[la+a,lo+b],[la+a,lo-b]].map(p=>[+p[0].toFixed(6),+p[1].toFixed(6)]); };
  const C=[39.96, -82.99];
  return [
    D({name:'Demo Tower One', addr:'100 Example Ave, Demoville', lat:C[0]+.0030, lon:C[1], cat:'office', lv:18, sf:21000, pf:600, gl:true, band:'High', why:['18 floors, a tall one','glass tagged on the map','office'], out:sq(C[0]+.003,C[1],180,120), stage:'Proposal', touch:2, task:['Call about the draft estimate',0], val:42000, f:['Example Holdings LLC','Placeholder Property Group'], dm:['Sample Person','Property manager','medium'], age:20, note:'Demo note: asked for a test on one bay first.'}),
    D({name:'Sample Plaza Hotel', addr:'200 Sample St, Demoville', lat:C[0]+.0008, lon:C[1]+.004, cat:'hotel', lv:9, sf:30000, pf:700, gl:false, band:'High', why:['9 floors, a tall one','hotel'], out:sq(C[0]+.0008,C[1]+.004,240,125), stage:'Contacted', touch:5, task:['Follow up with the general manager',-2], val:18000, age:12}),
    D({name:'Example Medical Pavilion', addr:'300 Placeholder Rd, Demoville', lat:C[0]-.0020, lon:C[1]+.002, cat:'medical', lv:6, sf:26000, pf:620, gl:true, band:'Medium', why:['6 floors','medical','big footprint (about 26,000 sq ft)'], out:sq(C[0]-.002,C[1]+.002,190,140), stage:'Qualified', touch:1, task:['Send the vendor packet',1], val:30000, age:9}),
    D({name:'Placeholder Lofts', addr:'400 Test Blvd, Demoville', lat:C[0]-.0036, lon:C[1]-.0030, cat:'apartments', lv:7, sf:18000, pf:520, gl:false, band:'Medium', why:['7 floors','apartments'], out:sq(C[0]-.0036,C[1]-.003,150,120), stage:'Researching', age:4}),
    D({name:'Test Campus Hall', addr:'500 Demo Way, Demoville', lat:C[0]+.0044, lon:C[1]-.0040, cat:'education', lv:4, sf:34000, pf:760, gl:false, band:'Lower', why:['4 floors','school or campus'], out:sq(C[0]+.0044,C[1]-.004,260,130), stage:'Identified', age:1}),
    D({name:'Demo Office Center', addr:'600 Sample Pkwy, Demoville', lat:C[0]-.0006, lon:C[1]-.0050, cat:'office', lv:5, sf:15000, pf:500, gl:true, band:'Medium', why:['5 floors','office','glass tagged on the map'], out:sq(C[0]-.0006,C[1]-.005,170,90), stage:'Won', touch:30, val:12000, age:60})
  ];
}
function loadDemo(){ if(state.properties.some(l=>l.demo)) return 0; const d=demoLeads(); state.properties.push(...d); save(); return d.length; }
function clearDemo(){ const ids=new Set(state.properties.filter(l=>l.demo).map(l=>l.id)); state.properties=state.properties.filter(l=>!l.demo); state.route.ids=state.route.ids.filter(i=>!ids.has(i)); save(); return ids.size; }
const hasDemo=()=>state.properties.some(l=>l.demo);
