'use strict';
/* IAI Field Sales Dashboard: the shell. Tabs, the sheet, dialogs, toasts, and the small pieces every screen shares. */

/* ---------- icons ---------- */
const IC={
  dash:'<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  map:'<path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  leads:'<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><path d="M16 5.5a3 3 0 0 1 0 5.8M18 14.3c2 .7 3 2.6 3 5.2"/>',
  pipe:'<path d="M3 4h18l-7 8.5V20l-4-2v-5.5z"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1"/>',
  phone:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  nav:'<path d="M3 11l18-8-8 18-2-8z"/>',
  note:'<path d="M5 3h10l4 4v14H5z"/><path d="M9 12h6M9 16h6"/>',
  camera:'<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  back:'<path d="M15 5l-7 7 7 7"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  quote:'<circle cx="12" cy="12" r="9"/><path d="M14.5 9.2c-.6-.8-1.5-1.2-2.5-1.2-1.4 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-2-.4-2.5-1.2M12 6.5V8M12 16v1.5"/>',
  search:'<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>',
  route:'<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  drone:'<circle cx="5" cy="6" r="2.5"/><circle cx="19" cy="6" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M7 7.5l3 3M17 7.5l-3 3M7 16.5l3-3M17 16.5l-3-3"/><rect x="9.5" y="9.5" width="5" height="5" rx="1.5"/>',
  chev:'<path d="M9 5l7 7-7 7"/>',
  down:'<path d="M5 9l7 7 7-7"/>',
  dots:'<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  book:'<path d="M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2z"/><path d="M4 20a2 2 0 0 0 2 2h13v-4"/>',
  pin:'<path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5" fill="currentColor"/>',
  up:'<path d="M5 15l7-7 7 7"/>',
  trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  sms:'<path d="M4 5h16v11H9l-5 4z"/>',
  flag:'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'
};
const ic=(n,c)=>'<svg class="ic'+(c?' '+c:'')+'" viewBox="0 0 24 24" aria-hidden="true">'+(IC[n]||'')+'</svg>';

/* ---------- click handling: every button names its action ---------- */
const ACT={};
document.addEventListener('click',e=>{
  const el=e.target.closest('[data-act]'); if(!el || el.disabled || el.getAttribute('aria-disabled')==='true') return;
  const f=ACT[el.dataset.act]; if(f) f(el,e);
});

/* ---------- toasts ---------- */
let toastT=null;
function toast(msg, o){
  const t=$('#toast'); if(!t) return; o=o||{};
  t.innerHTML='<span>'+esc(msg)+'</span>'+(o.undo?'<button type="button" id="toastUndo">Undo</button>':'');
  t.classList.toggle('top',!!o.top); t.classList.add('show'); clearTimeout(toastT);
  const u=$('#toastUndo'); if(u) u.addEventListener('click',()=>{ t.classList.remove('show'); o.undo(); });
  toastT=setTimeout(()=>t.classList.remove('show'), o.ms||(o.undo?6500:3200));
}

/* ---------- dialogs: one at a time, never the browser's own ---------- */
let dlgOnClose=null;
function openDlg(html, o){
  const w=$('#dlgWrap'), d=$('#dlg'); o=o||{};
  d.innerHTML=html; d.className=o.cls||''; w.classList.add('open'); dlgOnClose=o.onClose||null; d.scrollTop=0;
  if(o.focus){ const f=d.querySelector(o.focus); if(f) setTimeout(()=>f.focus(),60); }
  return d;
}
function closeDlg(){
  const w=$('#dlgWrap'); if(!w.classList.contains('open')) return;
  w.classList.remove('open'); $('#dlg').innerHTML=''; const f=dlgOnClose; dlgOnClose=null; if(f) f();
}
ACT['dlg-close']=()=>closeDlg();
document.addEventListener('keydown',e=>{ if(e.key==='Escape' && $('#dlgWrap').classList.contains('open')) closeDlg(); });
document.addEventListener('click',e=>{ if(e.target && e.target.id==='dlgWrap') closeDlg(); });
function askConfirm(title, body, okLabel, cb, danger){
  const d=openDlg('<h3>'+esc(title)+'</h3><p class="muted">'+body+'</p><div class="actions"><button class="btn quiet" data-act="dlg-close">Cancel</button><button class="btn'+(danger?' danger':'')+'" id="cfOk">'+esc(okLabel||'OK')+'</button></div>');
  $('#cfOk',d).addEventListener('click',()=>{ closeDlg(); cb(); });
}
/* choose one of your leads */
function pickLead(title, cb, opt){
  opt=opt||{}; const list=state.properties.filter(opt.filter||(()=>true));
  const d=openDlg('<h3>'+esc(title)+'</h3>'+(list.length>6?'<input class="in" id="plQ" placeholder="Search leads" aria-label="Search leads" autocomplete="off">':'')+'<div id="plList" class="plist"></div><div class="actions"><button class="btn quiet" data-act="dlg-close">Cancel</button></div>');
  const paint=()=>{
    const q=($('#plQ',d)||{value:''}).value.trim().toLowerCase();
    const rows=list.filter(l=>!q || (leadName(l)+' '+l.addr).toLowerCase().includes(q)).slice(0,60);
    $('#plList',d).innerHTML=rows.length ? rows.map(l=>'<button class="prow" data-id="'+esc(l.id)+'"><b>'+esc(leadName(l))+'</b><small>'+esc(l.addr||'')+' · '+esc(l.stage)+'</small></button>').join('') : '<div class="empty">'+(list.length?'No lead matches.':'No leads yet.')+'</div>';
    $$('#plList .prow',d).forEach(b=>b.addEventListener('click',()=>{ closeDlg(); cb(findLead(b.dataset.id)); }));
  };
  paint(); const q=$('#plQ',d); if(q) q.addEventListener('input',paint);
}

/* ---------- shared pieces ---------- */
const stagePill=s=>'<span class="spill" style="--sc:'+STAGE_COL[s]+'"><i></i>'+esc(s)+'</span>';
const bandPill=b=>b ? '<span class="bpill b-'+b+'">'+(b==='Lower'?'Lower':b)+' priority</span>' : '';
const demoTag=l=>l && l.demo ? '<span class="demotag">DEMO DATA</span>' : '';
function kpi(label, value, sub, act, id){
  return '<button class="kpi" '+(act?'data-act="'+act+'"':'')+(id?' id="'+id+'"':'')+'><span class="k-l">'+esc(label)+'</span><b class="k-v">'+value+'</b><small>'+esc(sub||'')+'</small></button>';
}
function nextLine(l){
  const t=nextTask(l); if(!t) return '<span class="muted">No next action</span>';
  const od=t.due && dayDiff(t.due)<0;
  return '<span class="'+(od?'late':'')+'">'+esc(t.text)+(t.due?' · '+esc(dueLabel(t.due)):'')+'</span>';
}
/* Last contact, Next action, Est. value: only the ones switched on in "How much to show" */
function metaRow(l){
  const S=state.settings.show, v=leadValue(l), lt=lastTouch(l), cells=[];
  if(S.last) cells.push('<div><small>Last contact</small><b>'+(lt?esc(whenLabel(lt)):'Not yet')+'</b></div>');
  if(S.next) cells.push('<div><small>Next action</small><b>'+nextLine(l)+'</b></div>');
  if(S.value) cells.push('<div><small>Est. value</small><b>'+(v!=null?esc(money(v)):'—')+'</b></div>');
  return cells.length ? '<div class="lc-meta m'+cells.length+'">'+cells.join('')+'</div>' : '';
}
function leadCard(l, o){
  o=o||{}; const S=state.settings.show, cat=CATS[l.cat]||CATS.mixed, own=venueFact(l,'owner');
  const info=[cat.label, l.bld.levels?plural(l.bld.levels,'floor'):'', l.bld.sqft?fmt(l.bld.sqft)+' sq ft':''].filter(Boolean).join(' · ');
  return '<article class="lcard'+(isOverdue(l)?' od':'')+'" data-act="lead-open" data-id="'+esc(l.id)+'" tabindex="0" role="button" aria-label="Open '+esc(leadName(l))+'">'+
    '<div class="lc-top"><span class="lc-ico" aria-hidden="true">'+cat.icon+'</span><div class="lc-main"><h3>'+esc(leadName(l))+'</h3>'+(S.addr?'<p>'+esc(l.addr||'No address yet')+'</p>':'')+'</div>'+(S.stage?stagePill(l.stage):'')+'</div>'+
    '<div class="lc-chips">'+(S.facts?'<span class="chip-s">'+esc(info)+'</span>':'')+(S.band?bandPill(leadBand(l)):'')+demoTag(l)+(S.owner&&own?'<span class="chip-s">Owner: '+esc(own)+'</span>':'')+(o.why&&S.why&&l.why[0]?'<span class="chip-s soft">✨ '+esc(l.why[0])+'</span>':'')+'</div>'+
    metaRow(l)+
    (o.actions?'<div class="lc-acts">'+
      '<button class="btn-s" data-act="upd-add" data-id="'+esc(l.id)+'">'+ic('plus')+'Add update</button>'+
      '<button class="btn-s" data-act="call-log" data-id="'+esc(l.id)+'">'+ic('phone')+'Log call</button>'+
      '<button class="btn-s" data-act="mail-open" data-id="'+esc(l.id)+'">'+ic('mail')+'Send email</button>'+
      '<button class="btn-s" data-act="quote-open" data-id="'+esc(l.id)+'">'+ic('quote')+'Create quote</button></div>':'')+
  '</article>';
}
ACT['lead-open']=el=>openLead(el.dataset.id);
document.addEventListener('keydown',e=>{ if((e.key==='Enter'||e.key===' ') && e.target.matches && e.target.matches('.lcard')){ e.preventDefault(); openLead(e.target.dataset.id); } });
/* the eight stages as bars: counts, dollars from the lead's value, nothing invented */
function funnelHtml(leads, o){
  o=o||{}; const rows=STAGES.map(s=>{ const L=leads.filter(l=>l.stage===s); return {s, n:L.length, val:L.reduce((t,l)=>t+(leadValue(l)||0),0)}; });
  const max=Math.max(1,...rows.map(r=>r.n));
  return '<div class="funnel">'+rows.map(r=>'<button class="fn-row" data-act="pipe-stage" data-s="'+esc(r.s)+'" aria-label="'+esc(r.s)+': '+r.n+'"><span class="fn-n">'+esc(r.s)+'</span><span class="fn-bar"><i style="width:'+(r.n?Math.max(6,r.n/max*100):0)+'%;background:'+STAGE_COL[r.s]+'"></i></span><span class="fn-c">'+r.n+'</span><span class="fn-v">'+(r.val?esc(money(r.val)):'')+'</span></button>').join('')+'</div>';
}
ACT['pipe-stage']=el=>{ state.ui.pipeView='list'; state.ui.pipeFilter='all'; state.ui.closed[el.dataset.s]=false; save(); show('pipe'); setTimeout(()=>{ const t=$('#acc-'+el.dataset.s.toLowerCase()); if(t) t.scrollIntoView({block:'start'}); },30); };

/* ---------- the shell: top bar, tabs, sheet ---------- */
const TABS=[['dash','Dashboard'],['map','Map'],['leads','Leads'],['pipe','Pipeline'],['settings','Settings']];
function paintNav(){
  const cur=state.ui.tab==='review'?'map':state.ui.tab;
  $('#nav').innerHTML=TABS.map(([k,l])=>'<button type="button" data-act="tab" data-tab="'+k+'" aria-label="'+l+'"'+(cur===k?' class="on" aria-current="page"':'')+'>'+ic(k)+'<span>'+l+'</span></button>').join('');
}
ACT['tab']=el=>show(el.dataset.tab);
function setTop(title, sub, action){
  $('#topTitle').textContent=title; $('#topSub').textContent=sub||'';
  $('#topAct').innerHTML=action ? '<button class="topbtn" data-act="'+action.act+'">'+(action.icon?ic(action.icon):'')+'<span>'+esc(action.label)+'</span></button>' : '';
}
const VIEWS={dash:()=>viewDash, map:()=>viewMap, leads:()=>viewLeads, pipe:()=>viewPipe, settings:()=>viewSettings, review:()=>viewReview};
function show(tab, o){
  if(!VIEWS[tab]) tab='dash';
  closeSheet(); closeDlg(); mapDrop();
  state.ui.tab=tab; save(); paintNav();
  const m=$('#main'); m.innerHTML=''; m.className='v-'+tab;
  VIEWS[tab]()(m);
  if(!(o&&o.keepScroll)) window.scrollTo(0,0);
}
let SHEET=null;
function closeSheet(){ SHEET=null; const s=$('#sheet'); s.hidden=true; s.innerHTML=''; document.body.classList.remove('sheet-open'); }
function refresh(){
  if(SHEET){ const s=$('#sheet'), y=s.scrollTop; paintSheet(); s.scrollTop=y; }
  else { const y=window.scrollY; show(state.ui.tab,{keepScroll:true}); window.scrollTo(0,y); }
}
function back(){ if(!SHEET) return; closeSheet(); const y=window.scrollY; show(state.ui.tab,{keepScroll:true}); window.scrollTo(0,y); }
ACT['back']=()=>back();

/* ---------- how much to show: one panel, in Settings and from a "Show" button on the busy screens ---------- */
const DETAIL_LABEL={simple:'Simple', more:'More', all:'Everything', custom:'Custom'};
function detailPanel(){
  const S=state.settings.show, cur=detailName(S);
  return '<div id="detailBox"><div class="seg" role="group" aria-label="How much to show">'+DETAIL_PRESETS.map(([k,l])=>'<button class="'+(cur===k?'on':'')+'" aria-pressed="'+(cur===k)+'" data-act="detail-preset" data-p="'+k+'">'+l+'</button>').join('')+'</div>'+
    (cur==='custom'?'<p class="muted sm">Your own mix. Tap Simple, More or Everything to start over.</p>':'')+
    DETAIL_GROUPS.map(([g,gl])=>'<div class="lab">'+esc(gl)+'</div>'+DETAIL.filter(d=>d[1]===g).map(d=>'<label class="switch two"><input type="checkbox" data-act="detail-sw" data-k="'+d[0]+'"'+(S[d[0]]?' checked':'')+'><span><b>'+esc(d[2])+'</b><small>'+esc(d[3])+'</small></span></label>').join('')).join('')+'</div>';
}
const detailChip=()=>'<button class="chip sm" data-act="detail-open" aria-label="How much to show: '+DETAIL_LABEL[detailName(state.settings.show)]+'">⚙ Show: '+DETAIL_LABEL[detailName(state.settings.show)]+'</button>';
ACT['detail-open']=()=>{ openDlg('<h3>How much to show</h3><p class="muted sm">Start simple, then turn on more as the taps become habit. Nothing is deleted when something is hidden.</p>'+detailPanel()+'<div class="actions"><button class="btn" data-act="dlg-close">Done</button></div>',{cls:'tall', onClose:()=>refresh()}); };
ACT['detail-preset']=el=>{ state.settings.show=detailPreset(el.dataset.p); save(); const b=$('#detailBox'); if(b) b.outerHTML=detailPanel(); };
ACT['detail-sw']=el=>{ if(DETAIL_KEYS.includes(el.dataset.k)){ state.settings.show[el.dataset.k]=el.checked; save(); const b=$('#detailBox'); if(b){ const y=($('#dlg')||{}).scrollTop; b.outerHTML=detailPanel(); const d=$('#dlg'); if(d && y) d.scrollTop=y; } } };

/* ---------- lookups: described first, the exact request shown, nothing from your leads attached ---------- */
const HOSTS={tile:'tile.openstreetmap.org', overpass:'overpass-api.de', nominatim:'nominatim.openstreetmap.org', county:'gis.cuyahogacounty.gov'};
async function fetchJSON(url, opt){
  const ctl=window.AbortController ? new AbortController() : null, ms=(opt && opt.ms) || 30000, t=setTimeout(()=>ctl && ctl.abort(), ms);
  try{
    const o=Object.assign({credentials:'omit', cache:'no-store', referrerPolicy:'no-referrer', signal:ctl?ctl.signal:undefined}, opt||{}); delete o.ms;
    const r=await fetch(url, o);
    if(!r.ok) throw new Error('HTTP '+r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}
function netMsg(e){
  const m=String(e && e.message || e), code=(m.match(/HTTP (\d{3})/)||[])[1];
  if(code==='429') return 'The service says too many requests (HTTP 429). Wait a minute, then try again.';
  if(code==='502'||code==='503'||code==='504') return 'The service is overloaded (HTTP '+code+'). Try again in a minute.';
  if(/SERVER-TIMEOUT/.test(m)) return 'The server ran out of time on this part. Try a smaller radius.';
  if(/abort/i.test(m)) return 'No answer after a minute. Try again, or a smaller radius.';
  if(/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'No connection to the service.';
  return m.slice(0,80);
}
/* o = {title, intro, hosts[], lines[], payload, editable, ok}. Unless you chose "don't show again", you see exactly what is sent. */
function confirmSend(o, go){
  if(state.settings.lookups.autoSend){ go(o.payload); return; }
  const d=openDlg('<h3>'+esc(o.title)+'</h3><p class="muted">'+o.intro+'</p>'+
    '<label class="lab">Sent to</label><div class="chips">'+o.hosts.map(h=>'<span class="tagpill">'+esc(h)+'</span>').join('')+'</div>'+
    (o.lines||[]).map(l=>'<div class="line">'+l+'</div>').join('')+
    '<label class="lab" for="cfPay">'+(o.editable?'Exact words to send':'The exact request')+'</label>'+
    (o.editable ? '<input class="in" id="cfPay" maxlength="200" value="'+esc(o.payload)+'">' : '<textarea class="ta mono" id="cfPay" rows="7" readonly>'+esc(o.payload)+'</textarea>')+
    '<div class="privline">🔒 Nothing from your leads, contacts, prices or notes is attached. Sent without cookies.</div>'+
    '<label class="check"><input type="checkbox" id="cfAuto"> Don’t show this again for lookups</label>'+
    '<div class="actions"><button class="btn quiet" data-act="dlg-close">Cancel</button><button class="btn" id="cfOk">'+esc(o.ok||'Send')+'</button></div>');
  $('#cfOk',d).addEventListener('click',()=>{
    const v=$('#cfPay',d).value.trim(); if(!v){ toast('Nothing to send'); return; }
    if($('#cfAuto',d).checked){ state.settings.lookups.autoSend=true; save(); }
    closeDlg(); go(v);
  });
}
function consentCard(){
  return '<section class="card consent"><h3>🛰 Lookups are off</h3><p class="muted">The map and building search use OpenStreetMap, outside your phone. Nothing is sent until you turn this on, and these are the only outside requests the app ever makes:</p>'+
    '<div class="line">🗺 <b>Map pictures</b> from '+HOSTS.tile+' as you move the map. OpenStreetMap sees the area you look at.</div>'+
    '<div class="line">🏢 <b>Building search</b> at '+HOSTS.overpass+': a center point, a radius and the filters you choose.</div>'+
    '<div class="line">📍 <b>Address search</b> at '+HOSTS.nominatim+': the address you type.</div>'+
    '<div class="line">🏛 <b>County records</b> at '+HOSTS.county+' (Cuyahoga County): one building’s map position, only when you tap “Look up county record”.</div>'+
    '<p class="muted sm">Nothing from your leads, contacts, prices or notes is ever sent, and there are no cookies. You see the exact request before each search (you can switch that off). OpenStreetMap’s rules ask for this app’s web address on map and address requests; that is the only other thing sent. Email is never sent from here: a draft opens in your mail app and you tap send.</p>'+
    '<div class="actions"><button class="btn" data-act="lookups-on">Turn on lookups</button></div></section>';
}
ACT['lookups-on']=()=>{ state.settings.lookups.on=true; save(); toast('🛰 Lookups are on. You can switch them off in Settings.'); refresh(); };

/* ---------- copy to the clipboard ---------- */
async function copyText(t){
  try{ await navigator.clipboard.writeText(t); toast('📋 Copied'); }
  catch(e){
    const d=openDlg('<h3>Copy</h3><textarea class="ta" id="cpT" rows="10" readonly>'+esc(t)+'</textarea><div class="actions"><button class="btn" data-act="dlg-close">Done</button></div>'); const a=$('#cpT',d); a.focus(); a.select();
  }
}
