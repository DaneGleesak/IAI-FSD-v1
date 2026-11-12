'use strict';
/* IAI Field Sales Dashboard: My Field Day (the home screen). It only reads your records. */
function leadPhone(l){ const dm=decisionMaker(l), c=(dm&&dm.phone)?dm:l.contacts.find(x=>phoneHref(x.phone)); return (c&&c.phone) || l.bld.phone || ''; }
function dueTasks(){
  const out=[]; state.properties.filter(isOpen).forEach(l=>l.tasks.forEach(t=>{ if(!t.done && t.due && dayDiff(t.due)<=0) out.push({l,t,d:dayDiff(t.due)}); }));
  return out.sort((a,b)=>a.d-b.d);
}
function topLead(){
  const open=state.properties.filter(isOpen); if(!open.length) return null;
  const urgency=l=>{ const ds=l.tasks.filter(t=>!t.done && t.due).map(t=>dayDiff(t.due)); return ds.length ? Math.min(...ds) : 99; };
  const s=open.slice().sort((a,b)=>{ const ua=urgency(a)<=0?0:1, ub=urgency(b)<=0?0:1; return ua-ub || (ua===0 ? urgency(a)-urgency(b) : 0) || bandRank(leadBand(a))-bandRank(leadBand(b)) || (leadValue(b)||0)-(leadValue(a)||0) || b.ts-a.ts; });
  const l=s[0], u=urgency(l);
  return {l, why: u<0 ? 'Follow-up overdue' : u===0 ? 'Follow-up due today' : leadBand(l)==='High' ? 'High priority'+(lastTouch(l)?'':' · not contacted yet') : 'Next best lead'};
}
function territoryCard(){
  const L=state.search.last;
  if(!L) return '<section class="card terr"><div class="row-between"><h3>Territory map</h3></div><div class="terr-empty"><svg viewBox="0 0 320 120" aria-hidden="true"><circle cx="160" cy="60" r="48" class="t-ring dash"/><circle cx="160" cy="60" r="5" class="t-pin"/></svg><p class="muted">No territory scanned yet.</p></div></section>';
  const rows=rankCands(L.items,'balanced',{lat:L.lat,lon:L.lon},L.radius), idx=leadIndex(), R=72, cx=160, cy=82, sc=R/Math.max(L.radius,1), kx=111320*Math.cos(L.lat*Math.PI/180);
  const dots=rows.slice(0,90).map(r=>{ const x=cx+(r.c.lon-L.lon)*kx*sc, y=cy-(r.c.lat-L.lat)*110574*sc; return '<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="'+(r.band==='High'?4.5:r.band==='Medium'?3.5:2.6)+'" class="t-dot b-'+r.band+(idx.has(r.c.id)?' in':'')+'"/>'; }).join('');
  const nb=b=>rows.filter(r=>r.band===b).length;
  return '<section class="card terr"><div class="row-between"><h3>Territory map</h3><button class="linkbtn" data-act="scan">Open map</button></div>'+
    '<svg viewBox="0 0 320 164" role="img" aria-label="Scanned area: '+rows.length+' properties"><circle cx="'+cx+'" cy="'+cy+'" r="'+R+'" class="t-ring"/>'+dots+'<circle cx="'+cx+'" cy="'+cy+'" r="4" class="t-pin"/><text x="'+(cx+R-2)+'" y="'+(cy+R+14)+'" text-anchor="end" class="t-lab">'+esc(radLabel(L.radius))+' radius</text></svg>'+
    '<p class="terr-sum"><b>'+esc(L.label)+'</b> · '+plural(rows.length,'property','properties')+' · <span class="bpill b-High">'+nb('High')+' High</span> <span class="bpill b-Medium">'+nb('Medium')+' Medium</span> <span class="bpill b-Lower">'+nb('Lower')+' Lower</span></p></section>';
}
function topCard(){
  const t=topLead(); if(!t) return '';
  const l=t.l, id=esc(l.id), tel=phoneHref(leadPhone(l)), nav=mapsHref(l), cat=CATS[l.cat]||CATS.mixed, v=leadValue(l);
  return '<section class="card top" aria-label="Next up"><div class="row-between"><span class="eyebrow">Next up</span>'+bandPill(leadBand(l))+'</div>'+
    '<button class="toplead" data-act="lead-open" data-id="'+id+'"><span class="lc-ico" aria-hidden="true">'+cat.icon+'</span><span class="tl-main"><b>'+esc(leadName(l))+demoTag(l)+'</b><small>'+esc(l.addr||'No address yet')+'</small><small class="why-s">'+esc(t.why)+'</small></span>'+stagePill(l.stage)+'</button>'+
    metaRow(l)+
    '<div class="fieldbar">'+
      (tel?'<a class="fb" href="'+esc(tel)+'">'+ic('phone')+'<span>Call</span></a>':'<span class="fb off" aria-disabled="true">'+ic('phone')+'<span>No phone</span></span>')+
      (nav?'<a class="fb" href="'+esc(nav)+'" target="_blank" rel="noopener noreferrer">'+ic('nav')+'<span>Navigate</span></a>':'<span class="fb off" aria-disabled="true">'+ic('nav')+'<span>No address</span></span>')+
      '<button class="fb" data-act="upd-add" data-id="'+id+'">'+ic('note')+'<span>Note</span></button>'+
      '<button class="fb" data-act="photo-add" data-id="'+id+'">'+ic('camera')+'<span>Photo</span></button></div></section>';
}
function routeCard(){
  const ids=routeIds(), stops=ids.map(findLead).filter(Boolean);
  let rows='';
  stops.forEach((l,i)=>{
    const prev=stops[i-1], leg=(prev&&prev.lat!=null&&l.lat!=null) ? miles(dist(prev.lat,prev.lon,l.lat,l.lon)).toFixed(1)+' mi from the last stop (straight line)' : '', nav=mapsHref(l);
    rows+='<div class="stop"><span class="sn">'+(i+1)+'</span><button class="st-main" data-act="lead-open" data-id="'+esc(l.id)+'"><b>'+esc(leadName(l))+'</b><small>'+esc(l.addr||'No address yet')+'</small>'+(leg?'<small class="leg">'+esc(leg)+'</small>':'')+'</button>'+
      '<div class="st-acts">'+(nav?'<a class="iconbtn" href="'+esc(nav)+'" target="_blank" rel="noopener noreferrer" aria-label="Navigate to '+esc(leadName(l))+'">'+ic('nav')+'</a>':'')+
      (i>0?'<button class="iconbtn sm" data-act="route-move" data-id="'+esc(l.id)+'" data-d="-1" aria-label="Move up">'+ic('up')+'</button>':'')+(i<stops.length-1?'<button class="iconbtn sm" data-act="route-move" data-id="'+esc(l.id)+'" data-d="1" aria-label="Move down">'+ic('down')+'</button>':'')+
      '<button class="iconbtn sm" data-act="route-del" data-id="'+esc(l.id)+'" aria-label="Remove stop">'+ic('trash')+'</button></div></div>';
  });
  const rm=routeMiles(stops);
  return '<section class="card" id="routeCard"><div class="row-between"><h3>Today’s route</h3><button class="linkbtn" data-act="route-add">'+ic('plus','tiny')+' Add stop</button></div>'+
    (stops.length?rows:'<p class="muted">No stops planned for today.</p>')+
    (rm?'<p class="muted sm routemi">About '+rm.mi.toFixed(1)+' mi between the stops, in a straight line. Driving is longer.'+(rm.skipped?' '+plural(rm.skipped,'stop')+' without a map position '+(rm.skipped===1?'is':'are')+' left out.':'')+'</p>':'')+
    (stops.length?'':'<button class="btn quiet" data-act="route-fill">Use today’s follow-ups</button>')+'</section>';
}
ACT['route-add']=()=>pickLead('Add a stop', l=>{ routeAdd(l.id); toast('✓ Added to today’s route'); refresh(); }, {filter:l=>isOpen(l)&&!routeIds().includes(l.id)});
ACT['route-fill']=()=>{ const t=dueTasks(); if(!t.length){ toast('No follow-ups are due today'); return; } [...new Set(t.map(x=>x.l.id))].forEach(routeAdd); refresh(); };
ACT['route-del']=el=>{ routeRemove(el.dataset.id); refresh(); };
ACT['route-move']=el=>{ const ids=routeIds(), i=ids.indexOf(el.dataset.id), j=i+Number(el.dataset.d); if(i<0||j<0||j>=ids.length) return; [ids[i],ids[j]]=[ids[j],ids[i]]; save(); refresh(); };
function followCard(){
  const due=dueTasks(), rows=due.slice(0,6).map(({l,t,d})=>'<div class="fu"><div class="fu-main"><button class="fu-t" data-act="lead-open" data-id="'+esc(l.id)+'"><b>'+esc(t.text)+'</b><small>'+esc(leadName(l))+'</small></button><span class="due '+(d<0?'late':'')+'">'+esc(dueLabel(t.due))+'</span></div>'+
    '<div class="chips tight"><button class="chip sm" data-act="task-done" data-id="'+esc(l.id)+'" data-t="'+esc(t.id)+'">'+ic('check','tiny')+' Done</button><button class="chip sm" data-act="task-snooze" data-id="'+esc(l.id)+'" data-t="'+esc(t.id)+'">Tomorrow</button></div></div>').join('');
  return '<section class="card" id="followCard"><div class="row-between"><h3>Follow-ups due</h3>'+(due.length?'<span class="count">'+due.length+'</span>':'')+'</div>'+(rows||'<p class="muted">Nothing due. Add a next action on any lead and it shows up here.</p>')+(due.length>6?'<p class="muted sm">+ '+(due.length-6)+' more</p>':'')+'</section>';
}
function backupCard(){
  if(!backupDue()) return '';
  return '<section class="card nudge" id="backupCard"><b>💾 Back up your leads</b><p class="muted sm">'+(state.backup.last ? 'Your last backup was '+esc(whenLabel(state.backup.last))+', and you have added work since. ' : 'Everything is only on this phone. ')+'It takes a few seconds: Save to Files, iCloud Drive or AirDrop.</p>'+
    '<div class="chips"><button class="btn" data-act="backup-now">Save a backup</button><button class="chip" data-act="backup-later">Later</button></div></section>';
}
/* the straight-line miles between today's stops, only from stops that have a map position */
function routeMiles(stops){
  let mi=0, legs=0; stops.forEach((l,i)=>{ const p=stops[i-1]; if(p && p.lat!=null && l.lat!=null){ mi+=miles(dist(p.lat,p.lon,l.lat,l.lon)); legs++; } });
  return legs ? {mi, legs, skipped:stops.filter(l=>l.lat==null).length} : null;
}
function todayStrip(due, stops, waiting){
  const b=(n,t,a)=>'<button class="tdy" data-act="'+a+'"><b>'+n+'</b><span>'+t+'</span></button>';
  return '<div class="today" role="group" aria-label="Today at a glance">'+b(due,'follow-ups due','kpi-follow')+b(stops,stops===1?'stop planned':'stops planned','kpi-route')+b(waiting,'new to swipe',waiting?'review-open':'scan')+'</div>';
}
function viewDash(m){
  const S=state.settings.sender, V=state.settings.show, first=(S.name||'').trim().split(/\s+/)[0], L=state.properties, open=L.filter(isOpen);
  const hr=new Date().getHours(), greet=(hr<12?'Good morning':hr<17?'Good afternoon':'Good evening')+(first?', '+first:'');
  setTop('My Field Day', new Date().toLocaleDateString('en-US',{weekday:'long', month:'long', day:'numeric'}));
  if(!L.length && !state.search.last){ m.innerHTML='<p class="greet">'+esc(greet)+'</p>'+emptyStart(); return; }
  const due=dueTasks(), od=due.filter(x=>x.d<0).length, props=L.filter(l=>l.stage==='Quote'), propVal=props.reduce((t,l)=>t+(leadValue(l)||0),0);
  const pv=open.reduce((t,l)=>t+(leadValue(l)||0),0), newN=open.filter(l=>l.stage==='Lead').length, waiting=reviewDeck().length, nStops=routeIds().map(findLead).filter(Boolean).length;
  m.innerHTML=(hasDemo()?'<div class="demobar"><b>DEMO DATA</b><span>You are looking at invented example properties.</span><button class="linkbtn" data-act="demo-clear">Clear demo data</button></div>':'')+
    '<p class="greet">'+esc(greet)+'</p>'+backupCard()+
    todayStrip(due.length, nStops, waiting)+
    topCard()+routeCard()+followCard()+
    '<button class="btn cta wide" data-act="scan">'+ic('map')+' Scan for new opportunities</button>'+
    '<div class="quick">'+[['plus','Add lead','lead-new'],['quote','Create quote','dash-quote'],['mail','Send outreach','dash-mail'],['map','Map search','scan']].map(([i,t,a])=>'<button class="qa" data-act="'+a+'">'+ic(i)+'<span>'+t+'</span></button>').join('')+'</div>'+
    (V.kpis?'<div class="kpis">'+kpi('Active opportunities',open.length, newN+' new · '+(open.length-newN)+' in conversation','kpi-pipe')+kpi('Pending follow-ups',due.length, od?od+' overdue':'none overdue','kpi-follow')+kpi('Quotes out',props.length, propVal?money(propVal)+' in play':'none out','kpi-prop')+kpi('Projected revenue',pv?esc(money(pv)):'—','your estimates, not a forecast','kpi-pipe')+'</div>':'')+
    (V.terr?territoryCard():'')+
    (V.funnel?'<section class="card"><div class="row-between"><h3>Pipeline snapshot</h3><button class="linkbtn" data-act="kpi-pipe">Open pipeline</button></div>'+funnelHtml(L)+'</section>':'')+
    (V.kpis&&V.terr&&V.funnel?'':'<p class="muted sm moretip">Want more on this screen? <button class="linkbtn" data-act="detail-open">Choose what to show</button></p>');
}
ACT['kpi-route']=()=>{ const t=$('#routeCard'); if(t) t.scrollIntoView({behavior:'smooth',block:'start'}); };
ACT['kpi-pipe']=()=>{ state.ui.pipeView='list'; state.ui.pipeFilter='all'; save(); show('pipe'); };
ACT['kpi-prop']=()=>{ state.ui.pipeView='list'; state.ui.pipeFilter='all'; state.ui.closed.Quote=false; save(); show('pipe'); setTimeout(()=>{ const t=$('#acc-quote'); if(t) t.scrollIntoView(); },30); };
ACT['kpi-follow']=()=>{ const t=$('#followCard'); if(t) t.scrollIntoView({behavior:'smooth',block:'start'}); };
ACT['dash-quote']=()=>pickLead('Draft a quote for…', l=>quoteDlg(l), {filter:isOpen});
ACT['dash-mail']=()=>pickLead('Prepare outreach for…', l=>emailDlg(l,{}), {filter:isOpen});
ACT['demo-clear']=()=>askConfirm('Clear the demo data?','Removes the invented example properties. Your own leads are not touched.','Clear demo data',()=>{ const n=clearDemo(); toast('Cleared '+plural(n,'demo property','demo properties')); refresh(); });
