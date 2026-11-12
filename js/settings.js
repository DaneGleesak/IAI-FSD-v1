'use strict';
/* IAI Field Sales Dashboard: Settings. Your details, your prices, lookups, ready-made solutions, backup. */
function viewSettings(m){
  setTop('Settings','Your details, prices and data');
  const S=state.settings, sn=S.sender, L=S.lookups, withRate=S.services.filter(s=>s.rate!=null).length;
  m.innerHTML=
    (damagedSave?'<section class="card warn"><h3>Your saved data could not be read</h3><p>A copy of it was kept on this phone and nothing was deleted. Export a backup of what you have now, and ask for help restoring the kept copy.</p></section>':'')+
    '<section class="card"><h3>How much to show</h3><p class="muted sm">Start with Simple while the taps become habit, then turn on more. Hiding something never deletes it.</p>'+detailPanel()+'</section>'+
    '<section class="card"><h3>Lookups</h3><p class="muted sm">The map, address search and building search use OpenStreetMap, outside your phone. They are off until you turn them on, and the exact request is shown before each search.</p>'+
      '<label class="switch"><input type="checkbox" id="swLook"'+(L.on?' checked':'')+'><span>Allow lookups (map pictures, building search, address search)</span></label>'+
      '<label class="switch"><input type="checkbox" id="swAuto"'+(L.autoSend?' checked':'')+'><span>Skip the “show me the request” step</span></label>'+
      '<p class="muted sm">Hosts used: '+Object.values(HOSTS).join(', ')+'. Nothing from your leads, contacts, prices or notes is ever sent.</p></section>'+
    '<section class="card"><h3>Connection check</h3><p class="muted sm">If a search fails, tap this. It sends one tiny test to each of the four services and shows what came back, so you can send it to the builder. Nothing from your leads is sent.</p>'+
      (L.on ? '<button class="btn quiet wide" data-act="net-check">Check connection</button>' : '<p class="muted sm">Turn on lookups above first.</p>')+'<div id="netOut"></div></section>'+
    '<section class="card"><h3>My details</h3><p class="muted sm">Used in the email and quote drafts you read before sending. Kept on this phone.</p>'+
      kv('Name',sn.name?esc(sn.name):'<span class="dim">not set</span>')+kv('Company',sn.company?esc(sn.company):'<span class="dim">not set</span>')+kv('Mailing address',sn.address?esc(sn.address):'<span class="dim">not set</span>')+
      '<button class="btn quiet" data-act="sender-edit">Edit my details</button></section>'+
    '<section class="card"><h3>Services & your prices</h3><p class="muted sm">No prices are built in. A quote line with no rate says “rate needed”. '+withRate+' of '+S.services.length+' services have a rate.</p>'+
      S.services.map(s=>'<div class="svset"><label class="swc"><input type="checkbox" data-act="svc-on" data-s="'+esc(s.id)+'"'+(s.on?' checked':'')+' aria-label="Offer '+esc(s.name)+'"></label><button class="sv-main" data-act="svc-edit" data-s="'+esc(s.id)+'"><b>'+esc(s.name)+'</b><small>'+esc(s.core?'Main scope':'Add-on')+' · '+(s.rate!=null?money(s.rate)+' '+esc(UNITS[s.unit]||''):'rate not set')+'</small></button></div>').join('')+
      '<div class="lab">Floor height, feet (only for prices per sq ft of facade)</div><input class="in" id="flFt" inputmode="decimal" maxlength="5" value="'+(S.floorFt||'')+'" placeholder="not set" aria-label="Floor height in feet"></section>'+
    '<section class="card"><h3>📚 Ready-made solutions</h3><p class="muted sm">Pitches, questions and answers to common objections, kept ready for each kind of building. Edit them to sound like you.</p>'+
      S.playbooks.map(p=>'<button class="prow" data-act="pb-open" data-p="'+esc(p.id)+'"><b>'+esc(p.name)+'</b><small>'+esc(p.when)+'</small></button>').join('')+'</section>'+
    '<section class="card"><h3>Demonstration data</h3><p class="muted sm">Invented example properties, always labelled DEMO DATA, for learning the app. They are separate from real leads and one tap to clear.</p>'+
      '<div class="chips">'+(hasDemo()?'<button class="btn quiet" data-act="demo-clear">Clear demo data</button>':'<button class="btn quiet" data-act="demo-load">Load demo data</button>')+'</div></section>'+
    '<section class="card"><h3>Backup</h3><p class="muted sm">Everything lives only on this phone. Export a copy now and then. Photos and files are added only if you choose.</p>'+
      '<div class="chips"><button class="btn" data-act="export" data-f="0">Export backup</button><button class="btn quiet" data-act="export" data-f="1">Export with photos</button><button class="btn quiet" data-act="import">Import backup</button></div></section>'+
    '<section class="card"><h3>About</h3>'+kv('App',esc(APP_NAME))+kv('Version',esc(APP_VER))+'<p class="muted sm">Private: no account, no tracking, no cookies. Quotes and emails are drafts you approve. The app sends no email. Building facts come from volunteer-mapped OpenStreetMap data and are estimates to confirm on site.</p>'+
      '<p class="muted sm">To install: in Safari tap Share, then Add to Home Screen.</p>'+
      '<button class="btn quiet danger-t" data-act="wipe">Erase everything on this phone</button></section>';
  $('#swLook',m).addEventListener('change',e=>{ L.on=e.target.checked; save(); toast(L.on?'🛰 Lookups are on':'Lookups are off'); });
  $('#swAuto',m).addEventListener('change',e=>{ L.autoSend=e.target.checked; save(); });
  $('#flFt',m).addEventListener('change',e=>{ const v=parseFloat(e.target.value); S.floorFt=v>0?num(v,3,60,null):null; save(); });
}
ACT['svc-on']=el=>{ const s=state.settings.services.find(x=>x.id===el.dataset.s); if(s){ s.on=el.checked; save(); } };
ACT['svc-edit']=el=>{ const s=state.settings.services.find(x=>x.id===el.dataset.s); if(s) serviceDlg(s, ()=>refresh()); };
ACT['pb-open']=el=>{
  const p=state.settings.playbooks.find(x=>x.id===el.dataset.p); if(!p) return;
  const d=openDlg('<h3>'+esc(p.name)+'</h3><p class="muted sm">'+esc(p.when)+'</p><div class="lab">The approach</div><p>'+esc(p.solution)+'</p><div class="lab">What to say</div><div class="quote">“'+esc(p.pitch)+'”</div>'+
    (p.questions.length?'<div class="lab">Questions to ask</div><ul>'+p.questions.map(q=>'<li>'+esc(q)+'</li>').join('')+'</ul>':'')+
    (p.objections.length?'<div class="lab">If they say…</div>'+p.objections.map(o=>'<p><b>'+esc(o.q)+'</b><br>'+esc(o.a)+'</p>').join(''):'')+
    '<div class="actions"><button class="btn quiet" id="pbEdit">Edit</button><button class="btn" data-act="dlg-close">Close</button></div>',{cls:'tall'});
  $('#pbEdit',d).addEventListener('click',()=>{
    const e=openDlg('<h3>Edit solution</h3><input class="in" id="pbN" maxlength="160" value="'+esc(p.name)+'" aria-label="Name"><div class="lab">When it fits</div><textarea class="ta" id="pbW" rows="2" maxlength="500">'+esc(p.when)+'</textarea><div class="lab">The approach</div><textarea class="ta" id="pbS" rows="4" maxlength="1200">'+esc(p.solution)+'</textarea><div class="lab">What to say</div><textarea class="ta" id="pbP" rows="3" maxlength="800">'+esc(p.pitch)+'</textarea><div class="actions"><button class="btn quiet" data-act="dlg-close">Cancel</button><button class="btn" id="pbOk">Save</button></div>',{cls:'tall'});
    $('#pbOk',e).addEventListener('click',()=>{ p.name=$('#pbN',e).value.trim()||p.name; p.when=$('#pbW',e).value.trim(); p.solution=$('#pbS',e).value.trim(); p.pitch=$('#pbP',e).value.trim(); save(); closeDlg(); toast('✓ Saved'); refresh(); });
  });
};
ACT['export']=async el=>{
  toast('Preparing your backup…');
  try{
    const text=await exportData(el.dataset.f==='1'), blob=new Blob([text],{type:'application/json'}), u=URL.createObjectURL(blob), a=document.createElement('a');
    a.href=u; a.download='iai-field-sales-backup-'+todayStr()+'.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(u),4000); toast('✓ Backup ready');
  }catch(e){ toast('Couldn’t make the backup'); }
};
ACT['import']=()=>{
  const inp=document.createElement('input'); inp.type='file'; inp.accept='application/json,.json'; inp.style.display='none';
  inp.addEventListener('change',async()=>{
    const f=inp.files&&inp.files[0]; inp.remove(); if(!f) return; const text=await f.text();
    askConfirm('Replace what is on this phone?','This swaps your current leads and settings for the backup. A copy of what is here now is kept first.','Import',async()=>{ const r=await importData(text); if(r.ok){ toast('✓ Imported '+plural(r.leads,'lead')); show('dash'); } else toast(r.msg); });
  });
  document.body.appendChild(inp); inp.click();
};
ACT['wipe']=()=>askConfirm('Erase everything?','Every lead, note, quote and setting on this phone is deleted. Export a backup first if you might want it back.','Erase everything',async()=>{
  try{ localStorage.removeItem(KEY); }catch(e){}
  try{ for(const f of await fileAll()) await fileDel(f.id); }catch(e){}
  state=normalize(null); state.ui.seeded=true; save(); toast('Erased'); show('dash');
},true);

/* ---------- connection check: one tiny test to each service, shown plainly ---------- */
const NET_TESTS=[
  {name:'Map pictures', host:HOSTS.tile, line:'GET https://tile.openstreetmap.org/0/0/0.png', url:'https://tile.openstreetmap.org/0/0/0.png', opt:{referrerPolicy:'no-referrer'}},
  {name:'Address search', host:HOSTS.nominatim, line:'GET https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=Cleveland%2C%20Ohio', url:'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=Cleveland%2C%20Ohio', opt:{referrerPolicy:'origin'}},
  {name:'Building search', host:HOSTS.overpass, line:'POST https://overpass-api.de/api/interpreter   data=[out:json][timeout:10];node(41.4,-81.5,41.4001,-81.4999);out count;', url:'https://overpass-api.de/api/interpreter', opt:{method:'POST', headers:{'content-type':'application/x-www-form-urlencoded'}, body:'data='+encodeURIComponent('[out:json][timeout:10];node(41.4,-81.5,41.4001,-81.4999);out count;')}},
  {name:'County records', host:HOSTS.county, line:'GET https://gis.cuyahogacounty.gov/server/rest/services/Open_Data_Parcels/MapServer/1?f=json', url:'https://gis.cuyahogacounty.gov/server/rest/services/Open_Data_Parcels/MapServer/1?f=json', opt:{}}
];
async function netTestOne(T){
  const t0=performance.now(), ctl=window.AbortController?new AbortController():null, timer=setTimeout(()=>ctl&&ctl.abort(),20000);
  const ms=()=>{ const d=performance.now()-t0; return d<1000?Math.round(d)+' ms':(d/1000).toFixed(1)+' s'; };
  try{
    const r=await fetch(T.url,Object.assign({credentials:'omit', cache:'no-store', signal:ctl?ctl.signal:undefined}, T.opt));
    let extra=''; if(!r.ok){ try{ extra=' · '+(await r.text()).replace(/\s+/g,' ').slice(0,80); }catch(_){} }
    return {ok:r.ok, text:T.name+' · HTTP '+r.status+' · '+ms()+extra};
  }catch(e){
    const m=String(e&&e.message||e), why=/abort/i.test(m)?'no answer in 20 seconds':/Failed to fetch|NetworkError|Load failed/i.test(m)?'the phone could not get through (no signal, or the service does not allow this app)':m.slice(0,60);
    return {ok:false, text:T.name+' · failed after '+ms()+' · '+why};
  }finally{ clearTimeout(timer); }
}
ACT['net-check']=()=>{
  confirmSend({title:'Check the connection?', intro:'One tiny test goes to each service below. None carries a lead, contact, price or note, and none names a building.', hosts:NET_TESTS.map(x=>x.host),
    lines:[], payload:NET_TESTS.map((x,i)=>(i+1)+'. '+x.line).join('\n'), ok:'Check'}, async()=>{
    const out=$('#netOut'); if(!out) return; const res=[];
    out.innerHTML='<p class="muted sm" role="status">Checking…</p>';
    for(const T of NET_TESTS){ out.innerHTML='<p class="muted sm" role="status">Checking '+esc(T.name.toLowerCase())+'…</p>'+res.map(r=>'<p class="sm">'+(r.ok?'✅ ':'❌ ')+esc(r.text)+'</p>').join(''); res.push(await netTestOne(T)); }
    const head='App: '+location.origin+' · '+(navigator.onLine===false?'phone says it is offline':'phone says it is online')+' · '+new Date().toLocaleString();
    const full=head+'\n'+res.map(r=>(r.ok?'OK  ':'FAIL ')+r.text).join('\n');
    out.innerHTML=res.map(r=>'<p class="sm">'+(r.ok?'✅ ':'❌ ')+esc(r.text)+'</p>').join('')+'<p class="muted sm">'+esc(head)+'</p><button class="btn quiet" data-act="net-copy">Copy these results</button>';
    out.dataset.full=full;
  });
};
ACT['net-copy']=()=>{ const o=$('#netOut'); if(o && o.dataset.full) copyText(o.dataset.full); };
