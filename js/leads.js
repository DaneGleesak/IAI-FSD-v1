'use strict';
/* IAI Field Sales Dashboard: the Leads tab and Property Intelligence (one building, in depth). */
let LQ='';
const ACT_NEW='lead-new';

/* ---------- Leads tab ---------- */
function sortLeads(list, how){
  const val=l=>leadValue(l)||0, act=l=>Math.max(lastTouch(l), l.ts), closed=l=>isOpen(l)?0:1;
  const by={
    priority:(a,b)=>closed(a)-closed(b) || bandRank(leadBand(a))-bandRank(leadBand(b)) || (isOverdue(b)-isOverdue(a)) || val(b)-val(a) || act(b)-act(a),
    recent:(a,b)=>act(b)-act(a), value:(a,b)=>val(b)-val(a) || act(b)-act(a),
    name:(a,b)=>leadName(a).localeCompare(leadName(b))};
  return list.slice().sort(by[how]||by.priority);
}
function viewLeads(m){
  const n=state.properties.length;
  setTop('Leads', n?plural(n,'lead')+' · '+state.properties.filter(isOpen).length+' open':'Nothing here yet', {act:ACT_NEW, label:'Add', icon:'plus'});
  if(!n){ m.innerHTML=emptyStart(); return; }
  const counts={all:n}; STAGES.forEach(s=>counts[s]=state.properties.filter(l=>l.stage===s).length);
  m.innerHTML='<div class="searchbar">'+ic('search')+'<input class="in" id="lSearch" type="search" placeholder="Search name or address" aria-label="Search leads" value="'+esc(LQ)+'" autocomplete="off"></div>'+
    '<div class="chips scroll" id="lStage">'+[['all','All']].concat(STAGES.filter(s=>counts[s]).map(s=>[s,s])).map(([k,l])=>'<button class="chip'+(state.ui.leadStage===k?' on':'')+'" data-v="'+esc(k)+'">'+esc(l)+' <small>'+counts[k]+'</small></button>').join('')+'</div>'+
    '<div class="chips scroll sm" id="lSort"><span class="muted sm">Sort</span>'+[['priority','Priority'],['recent','Recent'],['value','Value'],['name','Name']].map(([k,l])=>'<button class="chip'+(state.ui.leadSort===k?' on':'')+'" data-v="'+k+'">'+l+'</button>').join('')+'</div>'+
    '<div class="chips tight">'+detailChip()+'</div>'+
    '<div id="lList"></div>';
  const paint=()=>{
    const q=LQ.trim().toLowerCase();
    let L=state.properties.filter(l=>(state.ui.leadStage==='all'||l.stage===state.ui.leadStage) && (!q || (leadName(l)+' '+l.addr+' '+venueFact(l,'owner')+' '+venueFact(l,'mgmt')).toLowerCase().includes(q)));
    L=sortLeads(L, state.ui.leadSort);
    $('#lList',m).innerHTML=L.length ? L.map(l=>leadCard(l,{why:true})).join('') : '<div class="empty">No lead matches.</div>';
  };
  paint();
  $('#lSearch',m).addEventListener('input',e=>{ LQ=e.target.value; paint(); });
  $$('#lStage [data-v]',m).forEach(b=>b.addEventListener('click',()=>{ state.ui.leadStage=b.dataset.v; save(); show('leads',{keepScroll:true}); }));
  $$('#lSort [data-v]',m).forEach(b=>b.addEventListener('click',()=>{ state.ui.leadSort=b.dataset.v; save(); show('leads',{keepScroll:true}); }));
}
function emptyStart(){
  return '<section class="card welcome"><div class="w-ico">'+ic('drone')+'</div><h3>Let’s find your first building</h3><p class="muted">Scan a territory on the map to source and rank buildings, or add a lead you already know about.</p>'+
    '<div class="stack"><button class="btn wide" data-act="scan">'+ic('map')+' Scan a Territory</button><button class="btn quiet wide" data-act="lead-new">'+ic('plus')+' Add a lead</button><button class="btn quiet wide" data-act="demo-load">Load demo data</button></div>'+
    '<p class="muted sm">Demo data is invented, clearly labelled, and one tap to clear. It never mixes with your real leads.</p></section>';
}
ACT['scan']=()=>show('map');
ACT['demo-load']=()=>{ const n=loadDemo(); toast(n?'Demo data loaded. Clear it any time in Settings.':'Demo data is already loaded'); refresh(); };
ACT[ACT_NEW]=()=>leadNewDlg();

/* ---------- Add a lead: ten seconds ---------- */
function leadNewDlg(o){
  o=o||{}; const lookups=state.settings.lookups.on;
  const d=openDlg('<h3>Add a lead</h3>'+
    '<input class="in" id="nlN" maxlength="160" placeholder="Property or company name" aria-label="Property name" value="'+esc(o.name||'')+'">'+
    '<input class="in" id="nlA" maxlength="200" placeholder="Street address" aria-label="Address" autocomplete="street-address" value="'+esc(o.addr||'')+'">'+
    '<div class="two"><input class="in" id="nlP" inputmode="tel" maxlength="40" placeholder="Phone" aria-label="Phone"><input class="in" id="nlE" inputmode="email" maxlength="120" placeholder="Email" aria-label="Email"></div>'+
    '<input class="in" id="nlC" maxlength="100" placeholder="Contact name (optional)" aria-label="Contact name">'+
    '<div class="actions wrap"><button class="btn quiet" data-act="dlg-close">Cancel</button>'+(lookups?'<button class="btn quiet" id="nlF" title="Find the building at this address and fill in what the map knows">🔎 Add & research</button>':'')+'<button class="btn" id="nlOk">Add lead</button></div>'+
    (lookups?'':'<p class="muted sm">Turn on lookups in Settings and this can also fill in floors and size from the map.</p>'), {focus:'#nlN'});
  const make=()=>{
    const name=$('#nlN',d).value.trim(), addr=$('#nlA',d).value.trim(), phone=$('#nlP',d).value.trim(), email=$('#nlE',d).value.trim(), cn=$('#nlC',d).value.trim();
    if(!name && !addr){ toast('Add a name or an address'); return null; }
    return {name, addr, phone, email, cn};
  };
  const merge=(l,v)=>{ if(v.phone) l.bld.phone=v.phone; if(v.email) l.bld.email=v.email; if(v.phone||v.email||v.cn) l.contacts.push({id:uid(), name:v.cn, title:'', email:v.email, phone:v.phone, role:v.cn?'decision':'other', conf:'', src:'You typed it'}); };
  $('#nlOk',d).addEventListener('click',()=>{
    const v=make(); if(!v) return;
    const l=newLead({name:v.name, addr:v.addr, src:'manual', services:defaultServiceIds([])}); merge(l,v);
    state.properties.unshift(l); save(); closeDlg(); toast('✓ Lead added'); openLead(l.id);
  });
  const f=$('#nlF',d); if(f) f.addEventListener('click',()=>{
    const v=make(); if(!v) return; if(!v.addr){ toast('Add a street address to research'); return; }
    closeDlg(); addrGo((v.addr+' '+(v.name&&!/\d/.test(v.addr)?'':'')).trim(), true, {merge:v, name:v.name});
  });
}

/* ---------- Property Intelligence ---------- */
let PI_URLS=[];
const PI_TABS=[['overview','Overview'],['contacts','Contacts'],['services','Services'],['notes','Notes'],['files','Files']];
function openLead(id, tab){
  const l=findLead(id); if(!l){ toast('That lead is gone'); return; }
  SHEET={kind:'lead', id, tab:tab||'overview'}; paintSheet(); $('#sheet').hidden=false; $('#sheet').scrollTop=0;
}
/* a building from the results, before it is a lead: read-only until you add it */
function openCand(c, o){
  o=o||{}; const have=state.properties.find(l=>l.osm && l.osm===c.id);
  if(have){ openLead(have.id, o.tab); return; }
  SHEET={kind:'cand', cand:c, band:o.band||'', why:o.why||[], tab:o.tab||'overview'}; paintSheet(); $('#sheet').hidden=false; $('#sheet').scrollTop=0;
}
function subjectLead(){
  if(!SHEET) return null;
  if(SHEET.kind==='lead') return findLead(SHEET.id);
  if(!SHEET.temp){ SHEET.temp=leadFromCand(SHEET.cand,{band:SHEET.band, why:SHEET.why, offer:state.map.offer}); SHEET.temp._temp=true; }
  return SHEET.temp;
}
/* add the building you are looking at to the pipeline (a tap, never automatic) */
function commitTemp(){
  if(!SHEET || SHEET.kind!=='cand') return findLead(SHEET&&SHEET.id);
  const dup=state.properties.find(l=>l.osm && l.osm===SHEET.cand.id); if(dup){ SHEET={kind:'lead', id:dup.id, tab:SHEET.tab}; return dup; }
  const l=SHEET.temp||subjectLead(); delete l._temp; state.properties.unshift(l); save();
  SHEET={kind:'lead', id:l.id, tab:SHEET.tab}; return l;
}
function paintSheet(){
  const l=subjectLead(); const s=$('#sheet');
  if(!l){ closeSheet(); return; }
  PI_URLS.forEach(u=>URL.revokeObjectURL(u)); PI_URLS=[];
  const prev=!!l._temp, tab=SHEET.tab, cat=CATS[l.cat]||CATS.mixed;
  const op=outlinePath(l.bld.outline, 320, 150, 18);
  const hero='<div class="hero" id="piHero">'+(op ? '<svg viewBox="0 0 320 150" role="img" aria-label="Building outline from the map"><rect width="320" height="150" fill="none"/><path d="'+op.d+'" class="fp"/></svg><div class="hero-cap">'+(op.ft?'≈ '+fmt(op.ft)+' ft across · ':'')+(l.bld.levels?plural(l.bld.levels,'floor'):'floors unknown')+'</div>'
      : '<div class="hero-ph"><span>'+cat.icon+'</span><small>No outline on the map yet</small></div>')+'</div>';
  const verified=verifLabel(l);
  let body='';
  if(tab==='overview') body=piOverview(l,prev); else if(tab==='contacts') body=piContacts(l,prev); else if(tab==='services') body=piServices(l,prev); else if(tab==='notes') body=piNotes(l,prev); else body=piFiles(l,prev);
  const nextI=FLOW.indexOf(l.stage), nextS=nextI>=0 && nextI<FLOW.length-1 ? FLOW[nextI+1] : '';
  const actions = prev ? '<button class="btn quiet" data-act="pi-outreach">'+ic('mail')+'Prepare outreach</button><button class="btn quiet" data-act="pi-quote">'+ic('quote')+'Draft quote</button><button class="btn" data-act="pi-add">'+ic('plus')+'Add to pipeline</button>'
    : '<button class="btn quiet" data-act="mail-open" data-id="'+esc(l.id)+'">'+ic('mail')+'Prepare outreach</button><button class="btn quiet" data-act="quote-open" data-id="'+esc(l.id)+'">'+ic('quote')+'Draft quote</button>'+
      (nextS ? '<button class="btn" data-act="stage-next" data-id="'+esc(l.id)+'" data-d="1">'+(nextS==='Completed'?'Mark completed':'Move to '+esc(nextS))+'</button>' : '<button class="btn" data-act="stage-set" data-id="'+esc(l.id)+'">Reopen</button>');
  s.innerHTML='<div class="sh-bar"><button class="iconbtn" data-act="back" aria-label="Back">'+ic('back')+'</button><div class="sh-t"><small>Property Intelligence</small></div>'+(prev?'':'<button class="iconbtn" data-act="pi-menu" aria-label="More">'+ic('dots')+'</button>')+'</div>'+
    hero+
    '<div class="sh-id"><h2>'+esc(leadName(l))+'</h2><p>'+esc(l.addr||'No street address yet')+'</p><div class="chips">'+
      '<span class="chip-s">'+esc(cat.icon+' '+cat.label)+'</span>'+(l.bld.levels?'<span class="chip-s">'+plural(l.bld.levels,'story','stories')+'</span>':'')+(l.bld.sqft?'<span class="chip-s">'+fmt(l.bld.sqft)+' sq ft</span>':'')+
      (prev?'':'<button class="spillbtn" data-act="stage-set" data-id="'+esc(l.id)+'" aria-label="Change stage">'+stagePill(l.stage)+ic('down','tiny')+'</button>')+bandPill(leadBand(l))+demoTag(l)+'</div>'+
      '<p class="verif">'+esc(verified)+'</p></div>'+
    (prev?'<div class="banner">Preview from the public map. Nothing is saved until you add it to your pipeline.</div>':'')+
    '<div class="tabs" role="tablist">'+PI_TABS.map(([k,t])=>'<button role="tab" aria-selected="'+(tab===k)+'" class="'+(tab===k?'on':'')+'" data-act="pi-tab" data-t="'+k+'">'+t+'</button>').join('')+'</div>'+
    '<div class="sh-body">'+body+'</div><div class="sh-actions">'+actions+'</div>';
  loadHeroPhoto(l);
  if(tab==='files') loadThumbs(l);
}
ACT['pi-tab']=el=>{ SHEET.tab=el.dataset.t; paintSheet(); $('#sheet').scrollTop=0; };
ACT['pi-add']=()=>{ const l=commitTemp(); toast('✓ Added to your pipeline', {undo:()=>{ const r=deleteLead(l.id); closeSheet(); refresh(); }}); paintSheet(); };
ACT['pi-outreach']=()=>{ const l=commitTemp(); toast('Added to your pipeline'); paintSheet(); emailDlg(l,{}); };
ACT['pi-quote']=()=>{ const l=commitTemp(); toast('Added to your pipeline'); paintSheet(); quoteDlg(l); };
function verifLabel(l){
  if(l.demo) return 'Demo data: invented, for practice only';
  if(l.bld.checked) return 'Building details checked by you'+(l.bld.src?' · '+l.bld.src.replace(/^You typed it, /,''):'');
  if(l.bld.src && /OpenStreetMap/.test(l.bld.src)) return 'Estimated from '+l.bld.src+'. Volunteer-mapped: confirm on site.';
  if(l.src==='manual') return 'Entered by you. Not verified yet.';
  return 'Not verified yet';
}
const kv=(k,v,extra)=>'<div class="kvrow"><span>'+esc(k)+'</span><b>'+v+'</b>'+(extra||'')+'</div>';
function statusPill(st){ return st==='verified' ? '<span class="vpill ok">Verified</span>' : st==='estimated' ? '<span class="vpill est">Best guess</span>' : '<span class="vpill unk">Unknown</span>'; }

function estimateBlock(l, prev){
  const S=state.settings, sel=new Set(l.services.length?l.services:S.services.filter(s=>s.on).map(s=>s.id)), c=quoteCalc({stories:l.bld.levels, perimFt:l.bld.perimFt}, S.services, sel, S.floorFt);
  let est='';
  if(c.coreAllPriced){
    const hi=c.core.concat(c.extra.filter(x=>x.amount!=null)).reduce((t,x)=>t+(x.amount||0),0);
    est=c.extra.some(x=>x.amount!=null) ? '<b class="big">'+esc(money(c.coreTotal))+' – '+esc(money(hi))+'</b><small>main scope, up to with add-ons · from your rates, a draft until a site walk</small>' : '<b class="big">'+esc(money(c.coreTotal))+'</b><small>main scope · from your rates, a draft until a site walk</small>';
  } else {
    const why = !S.services.some(s=>s.rate!=null) ? 'Set your rates in Settings and this fills itself in.' : (l.bld.levels==null?'Floors are not on the map: correct them to price the upper floors.':(!l.bld.perimFt?'The building edge is missing.':'Some main lines still need a rate.'));
    est='<b class="big dim">—</b><small>'+esc(why)+'</small>';
  }
  const typed=l.estValue!=null ? '<div class="kvrow"><span>Your own estimate</span><b>'+esc(money(l.estValue))+'</b>'+(prev?'':'<button class="linkbtn" data-act="est-edit" data-id="'+esc(l.id)+'">Change</button>')+'</div>' : (prev?'':'<button class="linkbtn" data-act="est-edit" data-id="'+esc(l.id)+'">Type your own estimate</button>');
  return '<div class="est">'+est+'</div>'+typed;
}
function piOverview(l, prev){
  const cat=CATS[l.cat]||CATS.mixed, id=esc(l.id);
  const ops=[['launch','Launch or landing area on site?'],['water','Water on site?'],['obstructions','Trees, wires or nearby buildings in the way?']];
  const opRow=o=>'<div class="oprow"><span>'+esc(o[1])+'</span><div class="chips tight">'+['Yes','Some','No','Not sure'].map(v=>'<button type="button" class="chip sm'+(l.ops[o[0]]===v?' on':'')+'"'+(prev?' disabled':' data-act="ops-set" data-id="'+id+'" data-k="'+o[0]+'" data-v="'+v+'"')+'>'+v+'</button>').join('')+'</div></div>';
  const near=state.properties.filter(x=>x.id!==l.id && l.lat!=null && x.lat!=null).map(x=>({x, mi:miles(dist(l.lat,l.lon,x.lat,x.lon))})).filter(o=>o.mi<=0.5).sort((a,b)=>a.mi-b.mi).slice(0,4);
  const sameCo=state.properties.filter(x=>x.id!==l.id && ['mgmt','owner'].some(k=>venueFact(l,k) && venueFact(x,k).toLowerCase()===venueFact(l,k).toLowerCase())).slice(0,6);
  const rel=[...new Map(sameCo.concat(near.map(o=>o.x)).map(x=>[x.id,x])).values()];
  const air=l.bld.airMi!=null;
  return '<section class="card"><div class="row-between"><h3>Opportunity</h3>'+bandPill(leadBand(l))+'</div>'+
      (l.why.length?'<ul class="why">'+l.why.map(w=>'<li>✨ '+esc(w)+'</li>').join('')+'</ul><p class="muted sm">✨ A suggestion from what the map says, not a fact about the building.</p>':'')+
      estimateBlock(l,prev)+
      (prev?'':'<div class="lab">Set the priority yourself</div><div class="chips">'+BANDS.map(b=>'<button class="chip'+(l.prio===b?' on':'')+'" data-act="prio-set" data-id="'+id+'" data-v="'+b+'">'+b+'</button>').join('')+'</div>')+
    '</section>'+
    '<section class="card"><div class="row-between"><h3>Building characteristics</h3>'+(prev?'':'<button class="linkbtn" data-act="bld-edit" data-id="'+id+'">Correct</button>')+'</div>'+
      (!prev && !l.addr && l.lat!=null && state.settings.lookups.on ? '<button class="linkbtn" data-act="addr-lookup" data-id="'+id+'">📍 Look up the street address</button>' : '')+kv('Type', esc(cat.icon+' '+cat.label))+kv('Stories', l.bld.levels?String(l.bld.levels):'<span class="dim">not on the map</span>')+(l.bld.height?kv('Tagged height', esc(l.bld.height+' m')):'')+
      kv('Footprint', l.bld.sqft?'≈ '+fmt(l.bld.sqft)+' sq ft':'<span class="dim">unknown</span>')+kv('Distance around', l.bld.perimFt?'≈ '+fmt(l.bld.perimFt)+' ft':'<span class="dim">unknown</span>')+
      kv('Glass facade', l.bld.glass?'Yes (tagged on the map)':(l.ops.glass||'<span class="dim">not tagged</span>'))+(l.bld.op?kv('Operator', esc(l.bld.op)):'')+(l.bld.web?kv('Website','<a href="'+esc(/^https?:/i.test(l.bld.web)?l.bld.web:'https://'+l.bld.web)+'" target="_blank" rel="noopener noreferrer">'+esc(l.bld.web.replace(/^https?:\/\//,'').slice(0,32))+'</a>'):'')+
      '<p class="muted sm">Floors and size are volunteer-mapped, so they are estimates to confirm on site.</p></section>'+
    '<section class="card"><h3>Operational considerations</h3>'+ops.map(opRow).join('')+
      '<div class="oprow"><span>Airspace</span><div>'+(air?'<div class="warn tight">✈️ '+esc(l.bld.airName||'Airport')+' is about '+l.bld.airMi+' mi away. Check airspace and LAANC authorization before planning a flight.</div>':'<p class="muted sm">No airport found within 8 mi on the map. Still check airspace before every flight.</p>')+
        '<a class="linkbtn" href="'+AIRSPACE_URL+'" target="_blank" rel="noopener noreferrer">Check airspace (LAANC)</a></div></div>'+
      (l.lat!=null?'<div class="oprow"><span>Weather</span><a class="linkbtn" href="https://forecast.weather.gov/MapClick.php?lat='+l.lat.toFixed(4)+'&lon='+l.lon.toFixed(4)+'" target="_blank" rel="noopener noreferrer">Open the forecast for this spot</a></div>':'')+
    '</section>'+
    '<section class="card"><h3>Related properties</h3>'+(rel.length?rel.map(x=>'<button class="prow" data-act="lead-open" data-id="'+esc(x.id)+'"><b>'+esc(leadName(x))+'</b><small>'+esc(x.stage)+(l.lat!=null&&x.lat!=null?' · '+miles(dist(l.lat,l.lon,x.lat,x.lon)).toFixed(1)+' mi away':'')+(sameCo.includes(x)?' · same owner or manager':'')+'</small></button>').join(''):'<p class="muted sm">None yet. Leads with the same owner or manager, or within half a mile, show up here.</p>')+'</section>';
}
const AIRSPACE_URL='https://www.faa.gov/uas/getting_started/laanc';
function lookupLinks(l){
  const q=s=>'https://www.google.com/search?q='+encodeURIComponent(s), cat=CATS[l.cat]||CATS.mixed, role=cat.role.split(' or ')[0], place=l.addr||l.name, nm=l.name&&l.name!==l.addr?l.name:place, ohio=/\b(OH|Ohio)\b/i.test(l.addr);
  return [
    l.lat!=null && ['🗺 See it on the map','https://maps.apple.com/?ll='+l.lat+','+l.lon+'&q='+encodeURIComponent(nm||'Building')],
    place && ['🔎 Who owns it', q('"'+place+'" owner property records')],
    place && ['🏛 County parcel record', q(place+' county auditor parcel owner')],
    place && ['🏢 Management company', q(nm+' property management company')],
    place && ['👤 Find the '+role, q('site:linkedin.com/in "'+nm+'" '+role)],
    place && ['📄 Business registration', ohio ? 'https://businesssearch.ohiosos.gov/' : q('secretary of state business entity search '+place.split(',').slice(-2).join(' '))]
  ].filter(Boolean);
}
function piContacts(l, prev){
  const id=esc(l.id), cat=CATS[l.cat]||CATS.mixed, dm=decisionMaker(l);
  const conf=c=>c.conf?'<span class="vpill '+(c.conf==='verified'?'ok':'est')+'">'+(c.conf==='verified'?'Verified':c.conf[0].toUpperCase()+c.conf.slice(1)+' confidence')+'</span>':'<span class="vpill unk">Not sure yet</span>';
  const person=c=>'<div class="person"><div class="p-main"><b>'+esc(c.name||c.email||c.phone||'Contact')+'</b><small>'+esc([c.title, (ROLE_OPTS.find(r=>r[0]===c.role)||[])[1]].filter(Boolean).join(' · '))+'</small>'+conf(c)+'</div>'+
    '<div class="p-acts">'+(phoneHref(c.phone)?'<a class="iconbtn" href="'+esc(phoneHref(c.phone))+'" aria-label="Call '+esc(c.name||'')+'">'+ic('phone')+'</a><a class="iconbtn" href="'+esc(smsHref(c.phone))+'" aria-label="Text">'+ic('sms')+'</a>':'')+(emailOf(c.email)?'<a class="iconbtn" href="mailto:'+esc(emailOf(c.email))+'" aria-label="Email">'+ic('mail')+'</a>':'')+(prev?'':'<button class="iconbtn" data-act="contact-edit" data-id="'+id+'" data-c="'+esc(c.id)+'" aria-label="Edit contact">'+ic('dots')+'</button>')+'</div></div>';
  const facts=Object.keys(FACT_LABEL).map(k=>{ const f=l.f[k]; return '<div class="kvrow"><span>'+esc(FACT_LABEL[k])+'</span><b>'+(f.v?esc(f.v):'<span class="dim">not known yet</span>')+'</b>'+statusPill(f.st)+(prev?'':'<button class="linkbtn" data-act="fact-edit" data-id="'+id+'" data-k="'+k+'">'+(f.v?'Edit':'Add')+'</button>')+'</div>'; }).join('');
  const others=l.contacts.filter(c=>c!==dm);
  const tl=l.events.slice().sort((a,b)=>b.ts-a.ts).filter(e=>!e.init).slice(0,12);
  return (prev?'<div class="card soft"><p class="muted">Add this building to your pipeline to record who owns it, who decides, and what happens next.</p></div>':'')+
    '<section class="card"><h3>Suspected decision maker</h3>'+(dm?person(dm):'<p class="muted">No one named yet.</p><p class="muted sm">✨ For a '+esc(cat.label.toLowerCase())+', that is usually the '+esc(cat.role)+'.</p>'+(prev?'':'<button class="btn quiet" data-act="contact-edit" data-id="'+id+'">'+ic('plus')+' Add the decision maker</button>'))+'</section>'+
    countyCard(l,prev)+'<section class="card"><h3>Owner & management</h3>'+facts+'</section>'+
    (others.length||!prev?'<section class="card"><div class="row-between"><h3>Other contacts</h3>'+(prev?'':'<button class="linkbtn" data-act="contact-edit" data-id="'+id+'">Add</button>')+'</div>'+(others.length?others.map(person).join(''):'<p class="muted sm">None yet.</p>')+'</section>':'')+
    '<section class="card"><h3>Where to look it up</h3><p class="muted sm">These open a web search or map when you tap. The app sends nothing.</p><div class="chips">'+lookupLinks(l).map(x=>'<a class="chip" href="'+esc(x[1])+'" target="_blank" rel="noopener noreferrer">'+esc(x[0])+'</a>').join('')+'</div></section>'+
    '<section class="card"><div class="row-between"><h3>Outreach & communication</h3></div>'+
      (prev?'':'<div class="chips"><button class="chip" data-act="call-log" data-id="'+id+'">'+ic('phone','tiny')+' Log call</button><button class="chip" data-act="mail-open" data-id="'+id+'">'+ic('mail','tiny')+' Send email</button><button class="chip" data-act="upd-add" data-id="'+id+'">'+ic('plus','tiny')+' Add update</button></div>')+
      '<div class="kvrow"><span>Last contact</span><b>'+(lastTouch(l)?esc(whenLabel(lastTouch(l))):'Not yet')+'</b></div><div class="kvrow"><span>Next action</span><b>'+nextLine(l)+'</b></div>'+
      (tl.length?'<ol class="tl">'+tl.map(e=>'<li><i style="background:'+(e.type==='stage'?(STAGE_COL[e.to]||'#0A5EB6'):'#19DDFA')+'"></i><div><b>'+esc(e.type==='stage'?'Moved to '+e.to:e.type==='touch'?(TOUCH_HOW[e.how]||'Contact'):e.type==='quote'?'Quote '+(e.ref||''):'Note')+'</b>'+(e.text?'<p>'+esc(e.text.slice(0,160))+'</p>':'')+'<small>'+esc(whenLabel(e.ts))+'</small></div></li>').join('')+'</ol>':'<p class="muted sm">Nothing logged yet.</p>')+
    '</section>';
}
/* the county's own public parcel record: owner, mailing address, land use, commercial area, units */
function countyCard(l, prev){
  const key=l.demo ? '' : countyFor(l.lat,l.lon); if(!key) return '';
  const C=COUNTIES[key], c=(l.county && l.county.key===key) ? l.county : null;
  const rec=(r,i)=>'<div class="crec"><b>'+esc(r.owner||'No owner listed')+'</b>'+
    kv('Parcel',esc(r.pin||'not listed'))+(r.site?kv('Address on record',esc(r.site)):'')+(r.mailTo?kv('Owner’s mailing address',esc(r.mailTo)):'')+
    ((r.lucText||r.luc)?kv('Land use',esc([r.lucText, r.luc?'('+r.luc+')':''].filter(Boolean).join(' '))):'')+
    (r.comArea?kv('Commercial building area',fmt(r.comArea)+' sq ft'):'')+(r.units?kv('Living units',fmt(r.units)):'')+(r.resArea?kv('Residential area',fmt(r.resArea)+' sq ft'):'')+
    (r.saleTs?kv('Last transfer',esc(shortDate(dayStr(new Date(r.saleTs))))+(r.saleAmt?' · $'+fmt(r.saleAmt):'')):'')+
    (r.owner?'<button class="btn quiet" data-act="county-use" data-i="'+i+'">'+(c.pick===i?'✓ Used as the owner':'Use as owner')+'</button>':'')+'</div>';
  const look='<button class="btn quiet" data-act="county-look">'+ic('search')+' '+(c?'Look up again':'Look up county record')+'</button>';
  return '<section class="card" id="countyCard"><h3>County record</h3>'+
    (c ? (c.recs.length ? '<p class="muted sm">From '+esc(C.name)+' public parcel records, looked up '+esc(whenLabel(c.ts))+'. ✨ The parcel is matched by the building’s map position, so check it is the right one. The owner on a deed is often a holding company, not who runs the building.</p>'+c.recs.map(rec).join('')
        : '<p class="muted sm">No parcel was found at this building’s map position.</p>')
      : '<p class="muted sm">'+esc(C.name)+' publishes its parcel records: owner, mailing address, land use, building area and unit counts. Looking one up sends only this building’s map position, and you see the exact request first.</p>')+
    (state.settings.lookups.on ? look : '<p class="muted sm">Lookups are off. Turn them on in Settings to look this up.</p>')+'</section>';
}
ACT['county-look']=()=>{
  const l=subjectLead(); if(!l || l.demo) return; const key=countyFor(l.lat,l.lon);
  if(!key){ toast('That spot isn’t in a county the app can look up yet'); return; }
  if(!state.settings.lookups.on){ toast('Turn on lookups in Settings first'); return; }
  const C=COUNTIES[key], q=countyQuery(l.lat,l.lon);
  confirmSend({title:'🏛 Look up the county record?', intro:'The county’s public parcel records are asked which parcel sits at this building’s map position. If nothing is found, the same question goes to the layer for the other part of the county.',
    hosts:[C.host], lines:['📍 '+l.lat.toFixed(5)+', '+l.lon.toFixed(5), '🏛 '+esc(C.name)+' open parcel data'], payload:q, ok:'Look up'}, async text=>{
    const b=$('#countyCard [data-act="county-look"]'); if(b){ b.disabled=true; b.textContent='Looking…'; }
    try{
      let recs=[];
      for(let i=0;i<C.layers.length && !recs.length;i++){
        const j=await fetchJSON(C.layers[i][0]+'/query?'+text, {method:'GET'});
        if(j && j.error) throw new Error('HTTP '+(j.error.code||'error'));
        recs=parseCounty(j);
      }
      const L=subjectLead(); if(!L) return;
      L.county={key, ts:Date.now(), recs, pick:-1}; if(!L._temp) save();
      toast(recs.length ? '✓ County record found' : 'No county record at this spot'); paintSheet();
    }catch(e){ toast('County lookup failed: '+netMsg(e)); paintSheet(); }
  });
};
ACT['county-use']=el=>{
  const l=subjectLead(), i=Number(el.dataset.i), r=l && l.county && l.county.recs[i]; if(!r || !r.owner) return;
  const go=()=>{ l.county.pick=i; l.f.owner=blankFact(r.owner,'estimated',(COUNTIES[l.county.key]||{}).name+' parcel record, '+shortDate(dayStr(new Date(l.county.ts))));
    if(!l._temp) save(); toast('✓ Owner set from the county record. Confirm it before you rely on it.'); paintSheet(); };
  if(l.f.owner.v && l.f.owner.v!==r.owner) askConfirm('Replace the owner you have?','The owner now reads <b>'+esc(l.f.owner.v)+'</b>. The county record says <b>'+esc(r.owner)+'</b>.','Replace',go); else go();
};
function piServices(l, prev){
  const S=state.settings, id=esc(l.id), pbs=solutionsFor(S.playbooks, l.cat, l.bld.levels), pb=pbs[0]||null, sel=new Set(l.services);
  const svc=S.services.filter(s=>s.on || sel.has(s.id));
  return '<section class="card"><h3>Recommended services</h3><p class="muted sm">Tick what you would offer here. The estimate and the quote follow your ticks.</p>'+
      svc.map(s=>'<label class="svcrow"><input type="checkbox" data-act="svc-toggle" data-id="'+id+'" data-s="'+esc(s.id)+'"'+(sel.has(s.id)?' checked':'')+(prev?' disabled':'')+'><span>'+esc(s.name)+'<small>'+esc(s.core?'Main scope':'Add-on')+(s.rate==null?' · no rate set':'')+'</small></span></label>').join('')+
    '</section>'+
    '<section class="card"><h3>Opportunity & estimate</h3>'+estimateBlock(l,prev)+(prev?'':'<button class="btn wide" data-act="quote-open" data-id="'+id+'">'+ic('quote')+' Draft a quote</button>')+
      (l.quotes.length?'<div class="lab">Saved quotes</div>'+l.quotes.map(q=>'<div class="kvrow"><span>'+esc(q.ref)+' · '+esc(shortDate(dayStr(new Date(q.ts))))+'</span><b>'+(q.coreAllPriced&&q.coreTotal!=null?esc(money(q.coreTotal)):'unpriced')+'</b>'+(q.status==='approved'?'<span class="vpill ok">Approved</span>':'<span class="vpill unk">Draft</span>')+(prev?'':(q.status==='approved'?'':'<button class="linkbtn" data-act="quote-approve" data-id="'+id+'" data-q="'+esc(q.id)+'">Review & approve</button>')+'<button class="linkbtn" data-act="quote-copy" data-id="'+id+'" data-q="'+esc(q.id)+'">Copy</button>')+'</div>').join(''):'')+'</section>'+
    (pb?'<section class="card"><h3>📚 Ready-made solution</h3><b>'+esc(pb.name)+'</b><p class="muted sm">'+esc(pb.when)+'</p><p>'+esc(pb.solution)+'</p><div class="quote">“'+esc(pb.pitch)+'”</div>'+
      (pb.questions.length?'<details><summary>Questions to ask</summary><ul>'+pb.questions.map(q=>'<li>'+esc(q)+'</li>').join('')+'</ul></details>':'')+
      (pb.objections.length?'<details><summary>If they say…</summary>'+pb.objections.map(o=>'<p><b>'+esc(o.q)+'</b><br>'+esc(o.a)+'</p>').join('')+'</details>':'')+
      (prev?'':'<button class="btn quiet" data-act="mail-pb" data-id="'+id+'" data-p="'+esc(pb.id)+'">'+ic('mail')+' Use this pitch in an email</button>')+(pbs.length>1?'<p class="muted sm">More that fit: '+pbs.slice(1,4).map(p=>esc(p.name)).join(' · ')+'</p>':'')+'</section>':'');
}
ACT['svc-toggle']=el=>{ const l=leadOr(el.dataset.id); if(!l) return; const s=el.dataset.s, i=l.services.indexOf(s); if(i>=0) l.services.splice(i,1); else l.services.push(s); save(); paintSheet(); };
ACT['quote-copy']=el=>{ const l=leadOr(el.dataset.id); const q=l&&l.quotes.find(x=>x.id===el.dataset.q); if(q) copyText(q.text||'Quote '+q.ref); };
ACT['mail-pb']=el=>{ const l=leadOr(el.dataset.id); if(l) emailDlg(l,{playbook:el.dataset.p}); };
function piNotes(l, prev){
  const id=esc(l.id), tasks=l.tasks.slice().sort((a,b)=>(a.done-b.done)||((a.due||'9999')<(b.due||'9999')?-1:1));
  return (prev?'<div class="card soft"><p class="muted">Add this building to your pipeline to keep notes and next actions.</p></div>':
    '<section class="card"><h3>Next actions</h3>'+(tasks.length?tasks.map(t=>'<div class="task'+(t.done?' done':'')+'"><button class="check-b" data-act="task-done" data-id="'+id+'" data-t="'+esc(t.id)+'" aria-label="'+(t.done?'Mark not done':'Mark done')+'">'+(t.done?ic('check'):'')+'</button><div class="t-main"><span>'+esc(t.text)+'</span><small class="'+(!t.done&&t.due&&dayDiff(t.due)<0?'late':'')+'">'+esc(t.due?dueLabel(t.due):'No date')+'</small></div><button class="iconbtn sm" data-act="task-del" data-id="'+id+'" data-t="'+esc(t.id)+'" aria-label="Remove">'+ic('trash')+'</button></div>').join(''):'<p class="muted sm">Nothing planned.</p>')+
      '<button class="btn quiet" data-act="task-add" data-id="'+id+'">'+ic('plus')+' Add a next action</button></section>'+
    '<section class="card"><h3>Notes</h3><textarea class="ta" id="nTxt" rows="3" maxlength="6000" placeholder="Write a note" aria-label="New note"></textarea><button class="btn" data-act="note-add" data-id="'+id+'">Save note</button>'+
      (l.notes.length?l.notes.slice().sort((a,b)=>b.ts-a.ts).map(n=>'<div class="note"><p>'+esc(n.text).replace(/\n/g,'<br>')+'</p><small>'+esc(whenLabel(n.ts))+' · <button class="linkbtn" data-act="note-del" data-id="'+id+'" data-n="'+esc(n.id)+'">Delete</button></small></div>').join(''):'')+'</section>');
}
ACT['note-add']=()=>{
  const l=subjectLead(); const t=$('#nTxt'); if(!l||!t) return; const text=t.value.trim(); if(!text){ toast('Write a note first'); return; }
  l.notes.unshift({id:uid(), text, ts:Date.now()}); logEvent(l,{type:'note', text}); save(); paintSheet(); toast('✓ Note saved');
};
ACT['note-del']=el=>{ const l=leadOr(el.dataset.id); if(!l) return; const i=l.notes.findIndex(n=>n.id===el.dataset.n); if(i<0) return; const [n]=l.notes.splice(i,1); save(); paintSheet(); toast('Note deleted',{undo:()=>{ l.notes.splice(i,0,n); save(); paintSheet(); }}); };

/* ---------- photos and files ---------- */
async function shrinkImage(file, maxPx){
  try{
    const bmp=await createImageBitmap(file), k=Math.min(1, maxPx/Math.max(bmp.width,bmp.height)), c=document.createElement('canvas'); c.width=Math.round(bmp.width*k); c.height=Math.round(bmp.height*k);
    c.getContext('2d').drawImage(bmp,0,0,c.width,c.height); if(bmp.close) bmp.close();
    const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',0.82)); return blob && blob.size<file.size ? blob : file;
  }catch(e){ return file; }
}
function pickFile(leadId, kind){
  const inp=document.createElement('input'); inp.type='file'; inp.style.display='none';
  if(kind==='photo'){ inp.accept='image/*'; inp.setAttribute('capture','environment'); } else if(kind==='image'){ inp.accept='image/*'; }
  inp.addEventListener('change',async()=>{
    const f=inp.files&&inp.files[0]; inp.remove(); if(!f) return; const l=findLead(leadId); if(!l) return;
    if(f.size>25*1024*1024){ toast('That file is over 25 MB'); return; }
    try{
      const blob=f.type.startsWith('image/') ? await shrinkImage(f,1600) : f, name=f.name||('photo-'+todayStr()+'.jpg');
      const fid=await fileAdd(blob, name); l.fileIds.push(fid); logEvent(l,{type:'note', text:(f.type.startsWith('image/')?'Photo added: ':'File added: ')+name}); save(); toast('✓ Saved on '+leadName(l)); refresh();
    }catch(e){ toast('Couldn’t save that file here.'); }
  });
  document.body.appendChild(inp); inp.click();
}
ACT['photo-add']=el=>pickFile(el.dataset.id,'photo');
ACT['file-add']=el=>pickFile(el.dataset.id,'file');
function piFiles(l, prev){
  const id=esc(l.id);
  return prev ? '<div class="card soft"><p class="muted">Add this building to your pipeline to keep photos and files.</p></div>' :
    '<section class="card"><h3>Photos & files</h3><div class="chips"><button class="btn" data-act="photo-add" data-id="'+id+'">'+ic('camera')+' Take or choose a photo</button><button class="btn quiet" data-act="file-add" data-id="'+id+'">'+ic('plus')+' Add a file</button></div>'+
    '<p class="muted sm">Kept on this phone only. Photos are shrunk to a sensible size. They are in a backup only if you choose to include them.</p><div class="thumbs" id="thumbs">'+(l.fileIds.length?'':'<p class="muted sm">Nothing attached yet.</p>')+'</div></section>';
}
async function loadThumbs(l){
  const box=$('#thumbs'); if(!box) return;
  for(const fid of l.fileIds){
    try{
      const f=await fileGet(fid); if(!f) continue; const cell=document.createElement('div'); cell.className='thumb';
      if(/^image\//.test(f.mime)){ const u=URL.createObjectURL(new Blob([f.buf],{type:f.mime})); PI_URLS.push(u); cell.innerHTML='<button class="timg" data-act="file-view" data-f="'+esc(fid)+'" aria-label="View '+esc(f.name)+'"><img alt="" src="'+u+'"></button>'; }
      else cell.innerHTML='<button class="timg doc" data-act="file-view" data-f="'+esc(fid)+'"><span>'+ic('note')+'</span><small>'+esc(f.name.slice(0,22))+'</small></button>';
      box.appendChild(cell);
    }catch(e){}
  }
}
async function loadHeroPhoto(l){
  if(!l.fileIds.length) return;
  try{
    for(const fid of l.fileIds){ const f=await fileGet(fid); if(f && /^image\//.test(f.mime)){ const u=URL.createObjectURL(new Blob([f.buf],{type:f.mime})); PI_URLS.push(u); const h=$('#piHero'); if(h) h.innerHTML='<img class="hero-img" alt="Photo of the property" src="'+u+'">'; break; } }
  }catch(e){}
}
ACT['file-view']=async el=>{
  const fid=el.dataset.f; const f=await fileGet(fid).catch(()=>null); if(!f){ toast('That file is missing'); return; }
  const u=URL.createObjectURL(new Blob([f.buf],{type:f.mime})); PI_URLS.push(u);
  const d=openDlg('<h3>'+esc(f.name)+'</h3>'+(/^image\//.test(f.mime)?'<img class="bigimg" alt="" src="'+u+'">':'<p class="muted">'+esc(f.mime)+' · '+Math.round(f.size/1024)+' KB</p>')+
    '<div class="actions wrap"><button class="btn quiet danger-t" id="fvDel">Delete</button><a class="btn quiet" href="'+u+'" download="'+esc(f.name)+'">Save a copy</a><button class="btn" data-act="dlg-close">Close</button></div>',{cls:'tall'});
  $('#fvDel',d).addEventListener('click',()=>askConfirm('Delete this file?','It is removed from this phone. This cannot be undone.','Delete',async()=>{
    const l=state.properties.find(x=>x.fileIds.includes(fid)); if(l) l.fileIds=l.fileIds.filter(x=>x!==fid); await fileDel(fid).catch(()=>{}); save(); refresh(); toast('Deleted');
  },true));
};

/* ---------- the ⋯ menu on a lead ---------- */
ACT['pi-menu']=()=>{
  const l=subjectLead(); if(!l) return; const on=routeIds().includes(l.id), id=esc(l.id);
  const d=openDlg('<h3>'+esc(leadName(l))+'</h3><div class="stack">'+
    '<button class="btn quiet wide" id="pmRoute">'+ic('route')+' '+(on?'Remove from today’s route':'Add to today’s route')+'</button>'+
    '<button class="btn quiet wide" id="pmName">Edit name & address</button>'+
    '<button class="btn quiet wide" data-act="stage-set" data-id="'+id+'">Change stage</button>'+
    (l.stage!=='Lost'?'<button class="btn quiet wide" id="pmLost">Mark as lost</button>':'')+
    '<button class="btn quiet wide danger-t" id="pmDel">'+ic('trash')+' Delete this lead</button></div><div class="actions"><button class="btn quiet" data-act="dlg-close">Close</button></div>');
  $('#pmRoute',d).addEventListener('click',()=>{ on?routeRemove(l.id):routeAdd(l.id); closeDlg(); toast(on?'Removed from today’s route':'✓ Added to today’s route'); });
  $('#pmName',d).addEventListener('click',()=>nameDlg(l));
  const lost=$('#pmLost',d); if(lost) lost.addEventListener('click',()=>{ closeDlg(); const from=l.stage; setStage(l,'Lost'); afterChange(); toast('Marked as lost',{undo:()=>{ setStage(l,from,{text:'undo'}); afterChange(); }}); });
  $('#pmDel',d).addEventListener('click',()=>askConfirm('Delete this lead?','“'+esc(leadName(l))+'” and its notes, contacts and quotes are removed from this phone.','Delete',()=>{ const r=deleteLead(l.id); closeSheet(); show(state.ui.tab); toast('Lead deleted',{undo:()=>{ restoreLead(r); refresh(); }}); },true));
};
function nameDlg(l){
  const d=openDlg('<h3>Name & address</h3><input class="in" id="nmN" maxlength="160" value="'+esc(l.name)+'" aria-label="Name" placeholder="Name"><input class="in" id="nmA" maxlength="200" value="'+esc(l.addr)+'" aria-label="Address" placeholder="Street address"><div class="actions"><button class="btn quiet" data-act="dlg-close">Cancel</button><button class="btn" id="nmOk">Save</button></div>');
  $('#nmOk',d).addEventListener('click',()=>{ l.name=$('#nmN',d).value.trim(); l.addr=$('#nmA',d).value.trim(); closeDlg(); afterChange(); });
}
