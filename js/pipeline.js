'use strict';
/* IAI Field Sales Dashboard: Pipeline & Opportunities. The eight stages, in a list, on boards, or on a map. */
function pipeLeads(){
  let L=state.properties.slice(); const f=state.ui.pipeFilter;
  if(f==='high') L=L.filter(l=>leadBand(l)==='High'); else if(f==='overdue') L=L.filter(isOverdue); else if(f==='quiet') L=L.filter(isQuiet);
  return L;
}
function viewPipe(m){
  const all=state.properties, open=all.filter(isOpen), won=all.filter(l=>l.stage==='Won').length, lost=all.filter(l=>l.stage==='Lost').length;
  const total=open.reduce((t,l)=>t+(leadValue(l)||0),0), active=open.filter(l=>!['Identified','Researching'].includes(l.stage)).length;
  setTop('Pipeline','From first look to a sale',{act:'lead-new', label:'Add', icon:'plus'});
  const V=state.ui.pipeView, F=state.ui.pipeFilter;
  m.innerHTML='<div class="kpis four">'+kpi('Total pipeline',total?esc(money(total)):'—','open, your estimates')+kpi('Active deals',active,'in conversation or later')+kpi('Win rate',(won+lost)?Math.round(won/(won+lost)*100)+'%':'—',(won+lost)?won+' won, '+lost+' lost':'no closed deals yet')+kpi('Overdue',all.filter(isOverdue).length,'leads with a late next action')+'</div>'+
    '<div class="seg" role="tablist">'+[['map','Map'],['list','List'],['boards','Boards']].map(([k,l])=>'<button role="tab" aria-selected="'+(V===k)+'" class="'+(V===k?'on':'')+'" data-act="pipe-view" data-v="'+k+'">'+l+'</button>').join('')+'</div>'+
    '<div class="chips scroll" id="pFilt">'+[['all','All'],['high','High priority'],['overdue','Overdue'],['quiet','Gone quiet']].map(([k,l])=>'<button class="chip'+(F===k?' on':'')+'" data-v="'+k+'">'+l+'</button>').join('')+'</div>'+
    '<div id="pBody"></div>';
  $$('#pFilt [data-v]',m).forEach(b=>b.addEventListener('click',()=>{ state.ui.pipeFilter=b.dataset.v; save(); show('pipe',{keepScroll:true}); }));
  const body=$('#pBody',m), L=pipeLeads();
  if(!all.length){ body.innerHTML=emptyStart(); return; }
  if(V==='boards') paintBoards(body,L); else if(V==='map') paintPipeMap(body,L); else paintPipeList(body,L);
}
ACT['pipe-view']=el=>{ state.ui.pipeView=el.dataset.v; save(); show('pipe'); };
function paintPipeList(body, L){
  body.innerHTML=STAGES.map(s=>{
    const items=sortLeads(L.filter(l=>l.stage===s),'priority'), val=items.reduce((t,l)=>t+(leadValue(l)||0),0), closed=state.ui.closed[s]!==undefined ? state.ui.closed[s] : (!items.length || !OPEN.includes(s));
    return '<section class="acc" id="acc-'+s.toLowerCase()+'"><button class="acc-h" data-act="acc-toggle" data-s="'+s+'" aria-expanded="'+!closed+'"><span class="dot" style="background:'+STAGE_COL[s]+'"></span><b>'+s+'</b><span class="count">'+items.length+'</span><span class="acc-v">'+(val?esc(money(val)):'')+'</span>'+ic(closed?'chev':'down','tiny')+'</button>'+
      (closed?'':'<div class="acc-b">'+(items.length?items.map(l=>leadCard(l,{actions:true})).join(''):'<p class="muted sm">Nothing at this stage.</p>')+'</div>')+'</section>';
  }).join('');
}
ACT['acc-toggle']=el=>{ const s=el.dataset.s, cur=state.ui.closed[s]!==undefined ? state.ui.closed[s] : (!state.properties.some(l=>l.stage===s) || !OPEN.includes(s)); state.ui.closed[s]=!cur; save(); show('pipe',{keepScroll:true}); };
function paintBoards(body, L){
  body.innerHTML='<p class="muted sm">Swipe sideways. Use the arrows on a card to move it to the next or previous stage.</p><div class="boards">'+STAGES.map(s=>{
    const items=sortLeads(L.filter(l=>l.stage===s),'priority'), i=OPEN.indexOf(s);
    return '<section class="col"><div class="col-h"><span class="dot" style="background:'+STAGE_COL[s]+'"></span><b>'+s+'</b><span class="count">'+items.length+'</span></div>'+
      (items.map(l=>'<article class="bcard"><button class="bc-main" data-act="lead-open" data-id="'+esc(l.id)+'"><b>'+esc(leadName(l))+'</b><small>'+esc((leadValue(l)!=null?money(leadValue(l))+' · ':'')+(leadBand(l)?leadBand(l)+' priority':'No priority set'))+'</small>'+(isOverdue(l)?'<small class="late">Next action overdue</small>':'')+'</button>'+
        '<div class="bc-acts">'+(i>0?'<button class="iconbtn sm" data-act="stage-next" data-id="'+esc(l.id)+'" data-d="-1" aria-label="Move back a stage">'+ic('back')+'</button>':'<span></span>')+
        (i>=0?'<button class="iconbtn sm" data-act="stage-next" data-id="'+esc(l.id)+'" data-d="1" aria-label="Move to the next stage">'+ic('chev')+'</button>':'<button class="chip sm" data-act="stage-set" data-id="'+esc(l.id)+'">Stage</button>')+'</div></article>').join('')||'<p class="muted sm">Empty</p>')+'</section>';
  }).join('')+'</div>';
}
/* leads placed by where they are: no map pictures, so nothing is requested from outside */
function paintPipeMap(body, L){
  const P=L.filter(l=>l.lat!=null), none=L.filter(l=>l.lat==null);
  if(!P.length){ body.innerHTML='<div class="empty">No leads have a map position yet. Leads found on the map or by address have one.</div>'; return; }
  const la=P.map(l=>l.lat), lo=P.map(l=>l.lon), lat0=(Math.min(...la)+Math.max(...la))/2, lon0=(Math.min(...lo)+Math.max(...lo))/2, kx=111320*Math.cos(lat0*Math.PI/180);
  const xs=P.map(l=>(l.lon-lon0)*kx), ys=P.map(l=>-(l.lat-lat0)*110574), span=Math.max(60,Math.max(...xs.map(Math.abs)),Math.max(...ys.map(Math.abs))), W=320, H=260, sc=(Math.min(W,H)/2-26)/span;
  body.innerHTML='<section class="card"><svg class="pmap" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Leads by location">'+P.map((l,i)=>'<g data-act="lead-open" data-id="'+esc(l.id)+'" tabindex="0" role="button" aria-label="'+esc(leadName(l))+', '+esc(l.stage)+'"><circle cx="'+(W/2+xs[i]*sc).toFixed(1)+'" cy="'+(H/2+ys[i]*sc).toFixed(1)+'" r="11" class="pm-hit"/><circle cx="'+(W/2+xs[i]*sc).toFixed(1)+'" cy="'+(H/2+ys[i]*sc).toFixed(1)+'" r="7" fill="'+STAGE_COL[l.stage]+'" class="pm-dot"/></g>').join('')+'</svg>'+
    '<div class="legend">'+STAGES.filter(s=>P.some(l=>l.stage===s)).map(s=>'<span><i style="background:'+STAGE_COL[s]+'"></i>'+s+'</span>').join('')+'</div><p class="muted sm">A plain picture of where your leads are, drawn on the phone. Tap a dot to open it. Open the Map tab for street maps.</p></section>'+
    (none.length?'<p class="muted sm">No map position: '+none.map(l=>esc(leadName(l))).join(', ')+'</p>':'');
}
