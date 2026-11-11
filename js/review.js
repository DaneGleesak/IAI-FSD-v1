'use strict';
/* IAI Field Sales Dashboard: swipe review. The buildings from your latest area search, one card at a time.
   Swipe right (or tap Pursue) to take it on, left (or Pass) to drop it, or tap Investigate to hold it for a closer look.
   Only Pursue adds a lead to your pipeline. Nothing here is sent anywhere. */
let RV_TAB='deck', RV_Q='', RV_BUSY=false;

const decisionOf=id=>state.review.decisions.find(x=>x.id===id)||null;
const decList=d=>state.review.decisions.filter(x=>x.d===d);
const choiceLabel=d=>(REVIEW_CHOICES.find(x=>x[0]===d)||['',''])[1];
/* what is still waiting: from the latest search, not already a lead, not decided before. Best first. */
function reviewDeck(){
  const done=new Set(state.review.decisions.map(x=>x.id));
  return rowsNow().filter(r=>!r.lead && !done.has(r.c.id));
}
const candName=c=>c.name||c.addr||('Building at '+c.lat.toFixed(4)+', '+c.lon.toFixed(4));
const reducedMotion=()=>!!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
/* a lead made by a swipe can be taken back only while nothing has been done to it */
function leadFresh(l){
  return !!l && l.stage==='Identified' && !l.notes.length && !l.tasks.length && !l.quotes.length && !l.fileIds.length && l.estValue==null && l.contacts.length<=1 && l.events.length<=2;
}

function reviewDecide(id, d){
  const row=rowsNow().find(x=>x.c.id===id), prior=decisionOf(id), c=row?row.c:(prior?prior.cand:null);
  if(!c || !REVIEW_CHOICES.some(x=>x[0]===d)) return null;
  const rec={id:c.id, d, ts:Date.now(), reason:'', leadId:'', cand:c};
  if(d==='pursue'){
    let l=leadIndex().get(c.id)||null;
    if(!l){
      l=leadFromCand(c,{band:row?row.band:'', why:row?row.why:[], offer:state.map.offer});
      logEvent(l,{type:'update', text:'Chosen in Review: Pursue'});
      state.properties.unshift(l); rec.leadId=l.id;
    }
  }
  state.review.decisions=[rec].concat(state.review.decisions.filter(x=>x.id!==id)).slice(0,MAX_DECISIONS);
  save(); return rec;
}
/* put things back as they were before a decision; returns what to tell the rep */
function reviewUndo(rec, prior){
  const cur=decisionOf(rec.id); if(!cur || cur.ts!==rec.ts) return 'Already changed';
  state.review.decisions=state.review.decisions.filter(x=>x.id!==rec.id);
  if(prior) state.review.decisions=state.review.decisions.concat([prior]).sort((a,b)=>b.ts-a.ts);
  let msg='Undone';
  if(rec.leadId){
    const l=findLead(rec.leadId);
    if(l && leadFresh(l)) deleteLead(rec.leadId);
    else if(l) msg='Undone. The lead stays because you have already worked on it';
  }
  save(); return msg;
}

/* ---------- the screen ---------- */
function viewReview(m){
  setTop('Review','Swipe right to pursue, left to pass', {act:'review-map', label:'Map', icon:'map'});
  const nDeck=reviewDeck().length, nInv=decList('investigate').length, nPass=decList('pass').length, nPur=decList('pursue').length;
  m.innerHTML='<div class="seg seg3" role="tablist">'+[['deck','To review',nDeck],['inv','Investigate',nInv],['pass','Passed',nPass]].map(([k,l,n])=>
      '<button role="tab" aria-selected="'+(RV_TAB===k)+'" class="'+(RV_TAB===k?'on':'')+'" data-act="review-tab" data-t="'+k+'">'+l+'<small>'+n+'</small></button>').join('')+'</div>'+
    '<div class="chips tight">'+detailChip()+(nPur?'<span class="muted sm">'+plural(nPur,'building')+' pursued, in Leads</span>':'')+'</div><div id="rvBody"></div>';
  const body=$('#rvBody',m);
  if(RV_TAB==='inv') paintInvestigate(body); else if(RV_TAB==='pass') paintPassed(body); else paintDeck(body);
}
function rvPaint(){ const m=$('#main'); if(state.ui.tab!=='review' || !m) return; m.innerHTML=''; viewReview(m); }

function cardPic(c){
  const S=state.settings.show, op=S.outline ? outlinePath(c.outline,260,150,10) : null, p=op?op.d:'';
  return '<div class="sc-pic" aria-hidden="true">'+(p ? '<svg viewBox="0 0 260 150" preserveAspectRatio="xMidYMid meet"><path d="'+p+'" class="sc-shape"/></svg>' : '<span class="big">'+(CATS[c.cat]||CATS.mixed).icon+'</span>')+'</div>';
}
function paintDeck(body){
  const L=state.search.last;
  if(!L){ body.innerHTML='<div class="empty">No search yet. Search an area on the Map first. The buildings it finds come here to swipe through.</div><button class="btn wide" data-act="review-map">'+ic('map')+' Go to the map</button>'; return; }
  const deck=reviewDeck();
  if(!deck.length){
    const nInv=decList('investigate').length;
    body.innerHTML='<section class="card"><h3>That is all of them</h3><p class="muted">Every building from this search has an answer. '+(nInv?plural(nInv,'building')+' to look at more closely are under Investigate. ':'')+'Search a new area, or widen this one, to find more.</p>'+
      '<div class="btnrow2"><button class="btn" data-act="review-map">'+ic('map')+' Back to the map</button>'+(nInv?'<button class="btn quiet" data-act="review-tab" data-t="inv">Investigate ('+nInv+')</button>':'')+'</div></section>'+undoRow(); return;
  }
  const r=deck[0], c=r.c, S=state.settings.show, info=[(CATS[c.cat]||CATS.mixed).label, c.levels?plural(c.levels,'floor'):'floors unknown', c.sqft?fmt(c.sqft)+' sq ft':''].filter(Boolean).join(' · ');
  body.innerHTML='<p class="rv-count">'+deck.length+' left · best first</p>'+
    '<div class="rv-stage"><article class="scard" id="scard" data-id="'+esc(c.id)+'" tabindex="0" role="group" aria-label="'+esc(candName(c))+'. Arrow right to pursue, arrow left to pass, arrow up to investigate.">'+
      '<span class="sw-lab pur" aria-hidden="true">PURSUE</span><span class="sw-lab pas" aria-hidden="true">PASS</span>'+
      cardPic(c)+
      '<div class="sc-head"><div class="rk b-'+r.band+'" aria-label="Rank '+r.rank+'">'+r.rank+'</div><h2>'+esc(candName(c))+'</h2></div>'+
      (S.addr?'<p class="muted">'+esc(c.addr||'No street address on the map')+'</p>':'')+
      '<div class="lc-chips">'+(S.facts?'<span class="chip-s">'+esc(info)+'</span>':'')+(S.band?bandPill(r.band):'')+'</div>'+
      (S.why?'<p class="why1">✨ '+esc(r.why.slice(0,3).join(' · '))+'</p>':'')+
      '<button class="btn-s" data-act="review-look" data-id="'+esc(c.id)+'">Look closer</button></article></div>'+
    '<div class="rv-btns"><button class="pas" data-act="review-do" data-d="pass" data-id="'+esc(c.id)+'"><span aria-hidden="true">✕</span>Pass</button>'+
      '<button class="inv" data-act="review-do" data-d="investigate" data-id="'+esc(c.id)+'"><span aria-hidden="true">？</span>Investigate</button>'+
      '<button class="pur" data-act="review-do" data-d="pursue" data-id="'+esc(c.id)+'"><span aria-hidden="true">✓</span>Pursue</button></div>'+
    '<p class="muted sm center">Swipe the card right to pursue or left to pass, or tap a button. Pursue adds it to your pipeline. Pass and Investigate add nothing.</p>'+undoRow();
  rvBind($('#scard',body));
}
function undoRow(){
  const last=state.review.decisions.slice().sort((a,b)=>b.ts-a.ts)[0]; if(!last) return '';
  return '<button class="btn quiet wide" data-act="review-undo">↩ Undo: '+esc(choiceLabel(last.d))+' · '+esc(candName(last.cand).slice(0,40))+'</button>';
}

function rvRow(rec, kind){
  const c=rec.cand, S=state.settings.show, lead=leadIndex().get(c.id), info=[(CATS[c.cat]||CATS.mixed).label, c.levels?plural(c.levels,'floor'):'', c.sqft?fmt(c.sqft)+' sq ft':''].filter(Boolean).join(' · ');
  return '<article class="rvrow"><h3>'+esc(candName(c))+'</h3>'+(S.addr&&c.addr?'<p class="muted sm">'+esc(c.addr)+'</p>':'')+
    '<div class="lc-chips">'+(S.facts?'<span class="chip-s">'+esc(info)+'</span>':'')+(lead?'<span class="chip-s ok">'+ic('check','tiny')+' In pipeline</span>':'')+(rec.reason?'<span class="chip-s soft">'+esc(rec.reason)+'</span>':'')+'</div>'+
    '<div class="rv-acts"><button class="btn-s" data-act="review-look" data-id="'+esc(c.id)+'">Look closer</button>'+
    (kind==='inv' ? (lead?'':'<button class="btn-s prim" data-act="review-do" data-d="pursue" data-id="'+esc(c.id)+'">Pursue</button>')+'<button class="btn-s" data-act="review-do" data-d="pass" data-id="'+esc(c.id)+'">Pass</button>'
                  : '<button class="btn-s prim" data-act="review-do" data-d="investigate" data-id="'+esc(c.id)+'">Reconsider</button>'+(rec.reason?'':'<button class="btn-s" data-act="review-why" data-id="'+esc(c.id)+'">Add a reason</button>'))+
    '</div></article>';
}
function paintInvestigate(body){
  const L=decList('investigate');
  body.innerHTML=L.length ? '<p class="muted sm">Buildings you want to look at more closely. Nothing here is in your pipeline until you tap Pursue.</p>'+L.map(r=>rvRow(r,'inv')).join('') : '<div class="empty">Nothing held. Tap Investigate on a card when you want to come back to a building.</div>';
}
function paintPassed(body){
  body.innerHTML='<div class="searchbar">'+ic('search')+'<input class="in" id="rvQ" type="search" placeholder="Search passed buildings" aria-label="Search passed buildings" value="'+esc(RV_Q)+'" autocomplete="off"></div><p class="muted sm">Nothing is deleted. Reconsider any building to move it to Investigate.</p><div id="rvList"></div>';
  const paint=()=>{
    const q=RV_Q.trim().toLowerCase(), L=decList('pass').filter(r=>!q || (candName(r.cand)+' '+r.cand.addr+' '+r.reason).toLowerCase().includes(q));
    $('#rvList',body).innerHTML=L.length ? L.map(r=>rvRow(r,'pass')).join('') : '<div class="empty">'+(q?'No passed building matches.':'Nothing passed yet.')+'</div>';
  };
  paint(); $('#rvQ',body).addEventListener('input',e=>{ RV_Q=e.target.value; paint(); });
}

/* ---------- swipe: drag the card, or use the buttons or the arrow keys ---------- */
function rvBind(card){
  if(!card) return;
  let x0=0, dx=0, drag=false;
  const clear=()=>{ card.classList.remove('drag','go-pur','go-pas'); };
  card.addEventListener('pointerdown',e=>{
    if((e.button||0)>0 || e.target.closest('button,a,input') || RV_BUSY) return;
    drag=true; x0=e.clientX; dx=0; card.classList.add('drag'); card.style.transition='none';
    try{ card.setPointerCapture(e.pointerId); }catch(_){}
  });
  card.addEventListener('pointermove',e=>{
    if(!drag) return; dx=e.clientX-x0; card.style.transform='translateX('+dx+'px) rotate('+(dx/26).toFixed(1)+'deg)';
    card.classList.toggle('go-pur',dx>40); card.classList.toggle('go-pas',dx<-40);
  });
  card.addEventListener('pointerup',()=>{
    if(!drag) return; drag=false; const need=Math.min(110, card.offsetWidth*0.3);
    if(Math.abs(dx)>=need) rvGo(card.dataset.id, dx>0?'pursue':'pass', true);
    else { clear(); card.style.transition='transform .18s'; card.style.transform=''; }
  });
  card.addEventListener('pointercancel',()=>{ drag=false; clear(); card.style.transition='transform .18s'; card.style.transform=''; });
  card.addEventListener('keydown',e=>{
    const d={ArrowRight:'pursue', ArrowLeft:'pass', ArrowUp:'investigate'}[e.key]; if(!d) return;
    e.preventDefault(); rvGo(card.dataset.id, d);
  });
}
/* fly the card off, then record the choice */
function rvGo(id, d, fromDrag){
  if(RV_BUSY) return; RV_BUSY=true;
  const card=$('#scard'), go=()=>{ RV_BUSY=false; rvCommit(id,d); };
  if(!card || reducedMotion()){ go(); return; }
  card.style.transition='transform .2s ease-in, opacity .2s';
  card.style.transform = d==='pursue' ? 'translateX(130%) rotate(10deg)' : d==='pass' ? 'translateX(-130%) rotate(-10deg)' : 'translateY(-30px) scale(.95)';
  card.style.opacity='0'; setTimeout(go,210);
}
function rvCommit(id, d){
  const prior=decisionOf(id), rec=reviewDecide(id,d); if(!rec){ rvPaint(); return; }
  rvPaint();
  toast(choiceLabel(d)+': '+candName(rec.cand).slice(0,40), {top:true, undo:()=>{ toast(reviewUndo(rec,prior),{top:true}); rvPaint(); }});
  if(d==='pass' && state.settings.show.askWhy) reasonDlg(id);
}
function reasonDlg(id){
  const rec=decisionOf(id); if(!rec) return;
  openDlg('<h3>Why pass?</h3><p class="muted sm">'+esc(candName(rec.cand))+'. One tap, or skip. It only helps you remember.</p><div class="chips">'+PASS_REASONS.map((r,i)=>'<button class="chip" data-act="review-reason" data-id="'+esc(id)+'" data-i="'+i+'">'+esc(r)+'</button>').join('')+'</div><div class="actions"><button class="btn quiet" data-act="dlg-close">Skip</button></div>');
}

ACT['review-open']=()=>{ RV_TAB='deck'; show('review'); };
ACT['review-map']=()=>show('map');
ACT['review-tab']=el=>{ RV_TAB=el.dataset.t; rvPaint(); };
ACT['review-do']=el=>{ if(el.dataset.d==='pursue' || el.dataset.d==='investigate' || el.dataset.d==='pass'){ if(RV_TAB==='deck') rvGo(el.dataset.id, el.dataset.d); else rvCommit(el.dataset.id, el.dataset.d); } };
ACT['review-undo']=()=>{
  const sorted=state.review.decisions.slice().sort((a,b)=>b.ts-a.ts), last=sorted[0]; if(!last) return;
  toast(reviewUndo(last,null),{top:true}); rvPaint();
};
ACT['review-look']=el=>{
  const row=rowsNow().find(x=>x.c.id===el.dataset.id), rec=decisionOf(el.dataset.id), c=row?row.c:(rec?rec.cand:null); if(!c) return;
  openCand(c,{band:row?row.band:'', why:row?row.why:[]});
};
ACT['review-why']=el=>reasonDlg(el.dataset.id);
ACT['review-reason']=el=>{
  const rec=decisionOf(el.dataset.id), r=PASS_REASONS[Number(el.dataset.i)]; if(!rec || !r) return;
  rec.reason=r; save(); closeDlg(); rvPaint();
};
