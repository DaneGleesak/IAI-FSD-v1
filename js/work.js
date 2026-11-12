'use strict';
/* IAI Field Sales Dashboard: the work you do on a lead: updates, calls, tasks, stages, contacts, a quote, an email.
   Nothing here sends anything. An email opens in your mail app and you tap send. */
const chipRow=(id,opts,cur)=>'<div class="chips" id="'+id+'">'+opts.map(([v,l])=>'<button type="button" class="chip'+(String(cur)===String(v)?' on':'')+'" data-v="'+esc(v)+'">'+esc(l)+'</button>').join('')+'</div>';
function bindChips(root, id, cb){ $$('#'+id+' [data-v]',root).forEach(b=>b.addEventListener('click',()=>{ $$('#'+id+' .chip',root).forEach(x=>x.classList.toggle('on',x===b)); if(cb) cb(b.dataset.v); })); }
const FOLLOW=[['0','None'],['1','Tomorrow'],['3','3 days'],['7','Next week']];
function followDate(v){ const n=Number(v); return n>0 ? addDays(null,n) : ''; }
function leadOr(id){ const l=findLead(id); if(!l) toast('That lead is gone'); return l; }
function afterChange(){ save(); refresh(); }

/* ---------- Add update ---------- */
const UPD_TYPES=[['note','Note'],['call','Call'],['visit','Visit'],['email','Email'],['meeting','Meeting']];
ACT['upd-add']=el=>updateDlg(leadOr(el.dataset.id), 'note');
function updateDlg(l, type){
  if(!l) return; let kind=type||'note', follow='0';
  const d=openDlg('<h3>Add update · '+esc(leadName(l))+'</h3><div class="lab">What happened</div>'+chipRow('upK',UPD_TYPES,kind)+
    '<textarea class="ta" id="upT" rows="4" maxlength="2000" placeholder="What was said or done" aria-label="What happened"></textarea>'+
    '<div class="lab">Next step</div><input class="in" id="upN" maxlength="200" placeholder="Next action (optional)" aria-label="Next action">'+
    '<div class="lab sm">When</div>'+chipRow('upF',FOLLOW.slice(1).concat([['0','No date']]),'3')+
    '<div class="actions"><button class="btn quiet" data-act="dlg-close">Cancel</button><button class="btn" id="upOk">Save</button></div>');
  follow='3'; bindChips(d,'upK',v=>kind=v); bindChips(d,'upF',v=>follow=v);
  $('#upOk',d).addEventListener('click',()=>{
    const text=$('#upT',d).value.trim(), next=$('#upN',d).value.trim();
    if(!text && !next){ toast('Write what happened or the next step'); return; }
    let undo=null;
    if(kind==='note'){ if(text){ l.notes.unshift({id:uid(), text, ts:Date.now()}); logEvent(l,{type:'note', text}); } }
    else undo=touchLead(l, kind, text);
    if(next) addTask(l, next, followDate(follow));
    closeDlg(); afterChange(); toast('✓ Update saved', undo?{undo:()=>{ undo(); refresh(); }}:null);
  });
}

/* ---------- Log call ---------- */
const CALL_OUT=[['spoke','Spoke with someone'],['noanswer','No answer'],['voicemail','Left a voicemail'],['visit','Visited in person']];
ACT['call-log']=el=>callDlg(leadOr(el.dataset.id));
function callDlg(l){
  if(!l) return; let how='spoke', follow='3';
  const num=(decisionMaker(l)&&decisionMaker(l).phone) || (l.contacts.find(c=>c.phone)||{}).phone || l.bld.phone, tel=phoneHref(num);
  const d=openDlg('<h3>Log a call · '+esc(leadName(l))+'</h3>'+(tel?'<a class="btn wide" href="'+esc(tel)+'">'+ic('phone')+' Call '+esc(num)+'</a><p class="muted sm">Tap, make the call, then come back and log it.</p>':'')+
    '<div class="lab">How did it go</div>'+chipRow('clO',CALL_OUT,how)+
    '<textarea class="ta" id="clT" rows="3" maxlength="2000" placeholder="What was said (optional)" aria-label="What was said"></textarea>'+
    '<div class="lab">Follow up</div>'+chipRow('clF',FOLLOW.concat([]),follow)+
    '<div class="actions"><button class="btn quiet" data-act="dlg-close">Cancel</button><button class="btn" id="clOk">Log it</button></div>');
  bindChips(d,'clO',v=>how=v); bindChips(d,'clF',v=>follow=v);
  $('#clOk',d).addEventListener('click',()=>{
    const undo=touchLead(l, how, $('#clT',d).value.trim());
    const f=followDate(follow); if(f) addTask(l,'Follow up with '+leadName(l),f);
    closeDlg(); afterChange(); toast('✓ Logged: '+TOUCH_HOW[how].toLowerCase(), {undo:()=>{ undo(); refresh(); }});
  });
}

/* ---------- tasks ---------- */
ACT['task-add']=el=>taskDlg(leadOr(el.dataset.id));
function taskDlg(l){
  if(!l) return; let when='1';
  const d=openDlg('<h3>Next action · '+esc(leadName(l))+'</h3><input class="in" id="tkT" maxlength="300" placeholder="What needs to happen" aria-label="Next action">'+
    '<div class="lab">When</div>'+chipRow('tkW',[['0','Today'],['1','Tomorrow'],['3','3 days'],['7','Next week'],['x','Pick a date']],when)+'<input class="in" id="tkD" type="date" aria-label="Date" hidden>'+
    '<div class="actions"><button class="btn quiet" data-act="dlg-close">Cancel</button><button class="btn" id="tkOk">Add</button></div>');
  bindChips(d,'tkW',v=>{ when=v; $('#tkD',d).hidden=v!=='x'; });
  $('#tkOk',d).addEventListener('click',()=>{
    const text=$('#tkT',d).value.trim(); if(!text){ toast('Say what needs to happen'); return; }
    const due = when==='x' ? $('#tkD',d).value : addDays(null,Number(when));
    if(!due){ toast('Pick a date'); return; }
    addTask(l,text,due); closeDlg(); afterChange(); toast('✓ Added');
  });
}
ACT['task-done']=el=>{
  const l=leadOr(el.dataset.id); if(!l) return; const t=l.tasks.find(x=>x.id===el.dataset.t); if(!t) return;
  const was={done:t.done, doneTs:t.doneTs}; t.done=!t.done; t.doneTs=t.done?Date.now():0; afterChange();
  if(t.done) toast('✓ Done: '+t.text, {undo:()=>{ t.done=was.done; t.doneTs=was.doneTs; afterChange(); }});
};
ACT['task-snooze']=el=>{
  const l=leadOr(el.dataset.id); if(!l) return; const t=l.tasks.find(x=>x.id===el.dataset.t); if(!t) return;
  const was=t.due; t.due=addDays(null,1); afterChange(); toast('Moved to tomorrow', {undo:()=>{ t.due=was; afterChange(); }});
};
ACT['task-del']=el=>{
  const l=leadOr(el.dataset.id); if(!l) return; const i=l.tasks.findIndex(x=>x.id===el.dataset.t); if(i<0) return;
  const [t]=l.tasks.splice(i,1); afterChange(); toast('Removed', {undo:()=>{ l.tasks.splice(i,0,t); afterChange(); }});
};

/* ---------- stage ---------- */
ACT['stage-set']=el=>stageDlg(leadOr(el.dataset.id));
function stageDlg(l){
  if(!l) return; let to=l.stage;
  const d=openDlg('<h3>Stage · '+esc(leadName(l))+'</h3>'+chipRow('sgS',STAGES.map(s=>[s,s]),to)+
    '<textarea class="ta" id="sgT" rows="2" maxlength="300" placeholder="Why (optional), for example the reason it was lost" aria-label="Note"></textarea>'+
    '<div class="actions"><button class="btn quiet" data-act="dlg-close">Cancel</button><button class="btn" id="sgOk">Save</button></div>');
  bindChips(d,'sgS',v=>to=v);
  $('#sgOk',d).addEventListener('click',()=>{
    if(to===l.stage){ closeDlg(); return; }
    const from=l.stage; setStage(l,to,{text:$('#sgT',d).value.trim()}); closeDlg(); afterChange(); toast('Moved to '+to, {undo:()=>{ setStage(l,from,{text:'undo'}); afterChange(); }});
  });
}
function moveStage(l, dir){
  const i=FLOW.indexOf(l.stage); if(i<0) return;
  const j=i+dir; if(j<0 || j>=FLOW.length) return;
  const from=l.stage; setStage(l,FLOW[j]); afterChange(); toast('Moved to '+FLOW[j], {undo:()=>{ setStage(l,from,{text:'undo'}); afterChange(); }});
}
ACT['stage-next']=el=>{ const l=leadOr(el.dataset.id); if(l) moveStage(l, Number(el.dataset.d)||1); };

/* ---------- contacts ---------- */
const ROLE_OPTS=[['decision','Decision maker'],['owner','Owner'],['manager','Manager'],['other','Other']];
const CONF_OPTS=[['','Not sure'],['low','Low'],['medium','Medium'],['high','High'],['verified','Verified']];
ACT['contact-edit']=el=>contactDlg(leadOr(el.dataset.id), el.dataset.c||'');
function contactDlg(l, cid){
  if(!l) return; const c=l.contacts.find(x=>x.id===cid)||null; let role=c?c.role:'decision', conf=c?c.conf:'';
  const d=openDlg('<h3>'+(c?'Edit contact':'Add a contact')+'</h3>'+
    '<input class="in" id="ctN" maxlength="100" placeholder="Name" value="'+esc(c?c.name:'')+'" aria-label="Name">'+
    '<input class="in" id="ctT" maxlength="100" placeholder="Title" value="'+esc(c?c.title:'')+'" aria-label="Title">'+
    '<input class="in" id="ctE" inputmode="email" maxlength="160" placeholder="Email" value="'+esc(c?c.email:'')+'" aria-label="Email" autocomplete="off">'+
    '<input class="in" id="ctP" inputmode="tel" maxlength="40" placeholder="Phone" value="'+esc(c?c.phone:'')+'" aria-label="Phone" autocomplete="off">'+
    '<div class="lab">Role</div>'+chipRow('ctR',ROLE_OPTS,role)+
    '<div class="lab">How sure are you this is the right person?</div>'+chipRow('ctC',CONF_OPTS,conf)+
    '<div class="actions">'+(c?'<button class="btn quiet danger-t" id="ctDel">Remove</button>':'<button class="btn quiet" data-act="dlg-close">Cancel</button>')+'<button class="btn" id="ctOk">Save</button></div>');
  bindChips(d,'ctR',v=>role=v); bindChips(d,'ctC',v=>conf=v);
  $('#ctOk',d).addEventListener('click',()=>{
    const o={name:$('#ctN',d).value.trim(), title:$('#ctT',d).value.trim(), email:$('#ctE',d).value.trim(), phone:$('#ctP',d).value.trim(), role, conf};
    if(!o.name && !o.email && !o.phone){ toast('Add a name, email or phone'); return; }
    if(c) Object.assign(c,o,{src:c.src||'You typed it'}); else l.contacts.push(Object.assign({id:uid(), src:'You typed it'},o));
    closeDlg(); afterChange(); toast('✓ Saved');
  });
  const del=$('#ctDel',d); if(del) del.addEventListener('click',()=>{ const i=l.contacts.indexOf(c); l.contacts.splice(i,1); closeDlg(); afterChange(); toast('Contact removed',{undo:()=>{ l.contacts.splice(i,0,c); afterChange(); }}); });
}

/* ---------- owner, management and the other facts ---------- */
const FACT_LABEL={owner:'Owner (who holds the title)', mgmt:'Management company', vendor:'Who cleans it now', renewal:'Contract renewal or budget month'};
ACT['fact-edit']=el=>factDlg(leadOr(el.dataset.id), el.dataset.k);
function factDlg(l,k){
  if(!l || !FACT_LABEL[k]) return; const f=l.f[k]; let st=f.st==='verified'?'verified':'estimated';
  const d=openDlg('<h3>'+esc(FACT_LABEL[k])+'</h3><input class="in" id="fcV" maxlength="200" value="'+esc(f.v)+'" aria-label="'+esc(FACT_LABEL[k])+'">'+
    '<div class="lab">How sure are you</div>'+chipRow('fcS',[['estimated','Best guess'],['verified','Verified']],st)+
    '<input class="in" id="fcR" maxlength="120" placeholder="Where it came from (optional)" value="'+esc(f.src==='You typed it'?'':f.src)+'" aria-label="Source">'+
    '<div class="actions"><button class="btn quiet" data-act="dlg-close">Cancel</button><button class="btn" id="fcOk">Save</button></div>', {focus:'#fcV'});
  bindChips(d,'fcS',v=>st=v);
  $('#fcOk',d).addEventListener('click',()=>{ const v=$('#fcV',d).value.trim(); l.f[k]=blankFact(v,st,$('#fcR',d).value.trim()||'You typed it'); closeDlg(); afterChange(); toast('✓ Saved'); });
}
ACT['ops-set']=el=>{ const l=leadOr(el.dataset.id); if(!l) return; const k=el.dataset.k, v=el.dataset.v; l.ops[k]=(l.ops[k]===v?'':v); afterChange(); };
ACT['prio-set']=el=>{ const l=leadOr(el.dataset.id); if(!l) return; const v=el.dataset.v; l.prio=(l.prio===v?'':v); afterChange(); };

/* ---------- building: correct what the map got wrong ---------- */
ACT['bld-edit']=el=>bldDlg(leadOr(el.dataset.id));
function bldDlg(l){
  if(!l) return; let cat=l.cat;
  const d=openDlg('<h3>Correct the building</h3><p class="muted sm">The map is volunteer-mapped. What you enter here is marked as checked by you.</p>'+
    '<div class="two"><div><label class="lab" for="bdL">Floors</label><input class="in" id="bdL" inputmode="numeric" maxlength="3" value="'+(l.bld.levels||'')+'" placeholder="unknown"></div>'+
    '<div><label class="lab" for="bdS">Footprint, sq ft</label><input class="in" id="bdS" inputmode="numeric" maxlength="8" value="'+(l.bld.sqft||'')+'" placeholder="unknown"></div></div>'+
    '<div class="two"><div><label class="lab" for="bdP">Building edge, ft</label><input class="in" id="bdP" inputmode="numeric" maxlength="6" value="'+(l.bld.perimFt||'')+'" placeholder="unknown"></div>'+
    '<div><label class="lab" for="bdH">Height, m (optional)</label><input class="in" id="bdH" inputmode="decimal" maxlength="5" value="'+(l.bld.height||'')+'" placeholder="unknown"></div></div>'+
    '<div class="lab">Kind of building</div>'+chipRow('bdC',CAT_KEYS.map(k=>[k,CATS[k].label]),cat)+
    '<label class="check"><input type="checkbox" id="bdG"'+(l.bld.glass?' checked':'')+'> Mostly glass facade</label>'+
    '<div class="actions"><button class="btn quiet" data-act="dlg-close">Cancel</button><button class="btn" id="bdOk">Save</button></div>');
  bindChips(d,'bdC',v=>cat=v);
  $('#bdOk',d).addEventListener('click',()=>{
    const iv=id=>{ const v=parseFloat($(id,d).value); return v>0 ? v : null; };
    l.bld.levels=iv('#bdL')?Math.round(iv('#bdL')):null; l.bld.sqft=iv('#bdS')?Math.round(iv('#bdS')):null; l.bld.perimFt=iv('#bdP')?Math.round(iv('#bdP')):null; l.bld.height=iv('#bdH');
    l.bld.glass=$('#bdG',d).checked; l.cat=cat; l.bld.checked=true; l.bld.src='You typed it, '+todayStr();
    closeDlg(); afterChange(); toast('✓ Saved');
  });
}

/* ---------- estimate typed by hand ---------- */
ACT['est-edit']=el=>{
  const l=leadOr(el.dataset.id); if(!l) return;
  const d=openDlg('<h3>Estimated value</h3><p class="muted sm">A number you type. A saved quote with every main line priced replaces it.</p><input class="in" id="esV" inputmode="decimal" maxlength="12" value="'+(l.estValue||'')+'" placeholder="For example 12000" aria-label="Estimated value">'+
    '<div class="actions"><button class="btn quiet" data-act="dlg-close">Cancel</button><button class="btn" id="esOk">Save</button></div>', {focus:'#esV'});
  $('#esOk',d).addEventListener('click',()=>{ const v=parseMoney($('#esV',d).value); l.estValue=v; closeDlg(); afterChange(); });
};

/* ---------- your details, for quotes and emails ---------- */
function senderDlg(done){
  const S=state.settings.sender;
  const d=openDlg('<h3>Your details for emails and quotes</h3><p class="muted sm">They stay on this phone and go into the drafts you read before sending.</p>'+
    '<input class="in" id="sdN" maxlength="80" placeholder="Your name" value="'+esc(S.name)+'" aria-label="Your name">'+
    '<input class="in" id="sdC" maxlength="120" placeholder="Company" value="'+esc(S.company)+'" aria-label="Company">'+
    '<input class="in" id="sdP" inputmode="tel" maxlength="40" placeholder="Phone" value="'+esc(S.phone)+'" aria-label="Phone">'+
    '<input class="in" id="sdE" inputmode="email" maxlength="120" placeholder="Reply-to email" value="'+esc(S.email)+'" aria-label="Email">'+
    '<input class="in" id="sdA" maxlength="200" placeholder="Business mailing address" value="'+esc(S.address)+'" aria-label="Mailing address">'+
    '<div class="lab">What you do, in a sentence or two</div><textarea class="ta" id="sdB" rows="3" maxlength="400">'+esc(S.blurb)+'</textarea>'+
    '<div class="lab">How to say no</div><textarea class="ta" id="sdO" rows="2" maxlength="300">'+esc(S.optOut)+'</textarea>'+
    '<div class="actions"><button class="btn quiet" data-act="dlg-close">Cancel</button><button class="btn" id="sdOk">Save</button></div>', {onClose:null});
  $('#sdOk',d).addEventListener('click',()=>{
    const g=id=>$(id,d).value.trim();
    Object.assign(S,{name:g('#sdN'), company:g('#sdC'), phone:g('#sdP'), email:g('#sdE'), address:g('#sdA'), blurb:g('#sdB'), optOut:g('#sdO')});
    save(); closeDlg(); toast('✓ Saved'); if(done) done(); else refresh();
  });
}
ACT['sender-edit']=()=>senderDlg();

/* ---------- a price for one service ---------- */
function serviceDlg(svc, after){
  let unit=svc.unit;
  const d=openDlg('<h3>'+esc(svc.name)+'</h3><p class="muted sm">Your price stays on this phone. Nothing is filled in for you.</p>'+
    '<div class="lab">How it is priced</div>'+chipRow('svU',Object.keys(UNITS).map(k=>[k,UNITS[k]]),unit)+
    '<div class="two"><div><label class="lab" for="svR">Rate, $</label><input class="in" id="svR" inputmode="decimal" maxlength="9" value="'+(svc.rate==null?'':svc.rate)+'" placeholder="not set"></div>'+
    '<div><label class="lab" for="svM">Minimum, $</label><input class="in" id="svM" inputmode="decimal" maxlength="9" value="'+(svc.min==null?'':svc.min)+'" placeholder="none"></div></div>'+
    '<div class="actions"><button class="btn quiet" data-act="dlg-close">Cancel</button><button class="btn" id="svOk">Save</button></div>');
  bindChips(d,'svU',v=>unit=v);
  $('#svOk',d).addEventListener('click',()=>{
    const r=parseMoney($('#svR',d).value), m=parseMoney($('#svM',d).value);
    svc.unit=unit; svc.rate=r; svc.min=m; save(); closeDlg(); toast('✓ Saved'); if(after) after();
  });
}

/* ---------- Quote: separate lines from the map data, never a guessed number ---------- */
let Q=null;
const bldOf=l=>({name:leadName(l), addr:l.addr, stories:l.bld.levels, perimFt:l.bld.perimFt, sqft:l.bld.sqft, cat:l.cat});
function prepLine(l){
  const dm=decisionMaker(l)||l.contacts.find(c=>c.name)||{}, co=venueFact(l,'mgmt')||venueFact(l,'owner');
  return [dm.name, dm.title, co].filter(Boolean).join(', ');
}
ACT['quote-open']=el=>{ const l=leadOr(el.dataset.id); if(l) quoteDlg(l); };
function quoteDlg(l){
  const S=state.settings, on=new Set(l.services.length ? l.services : S.services.filter(s=>s.on).map(s=>s.id));
  Q={l, stories:l.bld.levels, perim:l.bld.perimFt, sel:new Set([...on].filter(id=>S.services.some(s=>s.id===id))), note:''};
  quotePaint();
}
function quoteText(l, calc, note, ref, approved){
  const S=state.settings.sender, b=bldOf(l), prep=prepLine(l), L=[];
  L.push('QUOTE'+(ref?' '+ref:'')+(approved?'':' (DRAFT)')); if(S.company) L.push(S.company);
  L.push('Date: '+new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}));
  L.push('Property: '+b.name+(b.addr&&b.addr!==b.name?', '+b.addr:'')); if(prep) L.push('Prepared for: '+prep);
  L.push('');
  calc.core.forEach(x=>L.push(lineText(x)));
  L.push('Total: '+(calc.coreAllPriced ? money(calc.coreTotal) : (calc.coreTotal ? money(calc.coreTotal)+' so far, '+(calc.core.length-calc.core.filter(x=>x.amount!=null).length)+' line(s) still to price' : 'to be priced')));
  if(calc.extra.length){ L.push(''); L.push('Optional add-ons, priced separately:'); calc.extra.forEach(x=>L.push(lineText(x))); }
  L.push(''); L.push('Notes');
  L.push(l.bld.checked ? '• Floors and the building edge were checked by us.' : '• Floors and the building outline come from OpenStreetMap ('+todayStr()+'), which volunteers map. They are not surveyed.');
  L.push('• This is an estimate. The final price follows a site walk.');
  if(l.demo) L.push('• DEMONSTRATION DATA: the building numbers are invented. Not for a customer.');
  if(note) L.push('• '+note);
  return L.join('\n');
}
function quotePaint(){
  const l=Q.l, S=state.settings, bi={stories:Q.stories, perimFt:Q.perim};
  const every=quoteCalc(bi, S.services, new Set(S.services.map(s=>s.id)), S.floorFt), calc=quoteCalc(bi, S.services, Q.sel, S.floorFt);
  const prep=prepLine(l), last=latestQuote(l);
  const row=x=>{
    const on=Q.sel.has(x.id), amt=x.amount!=null ? '<b>'+esc(money(x.amount))+'</b>' : '<button type="button" class="chip" data-rate="'+esc(x.id)+'">'+(x.need==='rate'?'Set rate':esc('Needs '+x.need))+'</button>';
    return '<div class="qline'+(on?'':' off')+'"><label><input type="checkbox" data-id="'+esc(x.id)+'"'+(on?' checked':'')+'> <span class="ql-t">'+esc(x.name)+'<small>'+esc([x.band, x.qlabel, x.rate!=null&&x.unit!=='flat'?'@ '+money(x.rate):''].filter(Boolean).join(' · '))+'</small></span></label><span class="ql-a">'+amt+'</span></div>';
  };
  const core=every.lines.filter(x=>x.core), extra=every.lines.filter(x=>!x.core);
  const d=openDlg('<h3>Draft quote · '+esc(leadName(l))+'</h3><div class="draftbar">DRAFT — REVIEW REQUIRED</div>'+
    '<p class="muted sm">✨ Built from public map data. Each line is separate, so you can drop or reprice any of them. Nothing is guessed: a line with no rate says so.</p>'+
    '<div class="line">Prepared for: '+(prep?esc(prep):'<span class="muted">not known yet</span>')+'</div>'+
    '<div class="two"><div><label class="lab" for="qSt">Floors</label><input class="in" id="qSt" inputmode="numeric" maxlength="3" value="'+(Q.stories||'')+'" placeholder="unknown"></div><div><label class="lab" for="qPe">Building edge, ft</label><input class="in" id="qPe" inputmode="numeric" maxlength="6" value="'+(Q.perim?Math.round(Q.perim):'')+'" placeholder="unknown"></div></div>'+
    (Q.stories?'':'<p class="muted sm">Floors are not on the map. Enter them to price the upper floors.</p>')+
    '<div class="lab">Scope</div>'+(core.map(row).join('')||'<div class="muted sm">No main services are switched on. Add them in Settings.</div>')+
    (extra.length?'<div class="lab">Other services (add-ons)</div>'+extra.map(row).join(''):'')+
    '<div class="qtotal"><span>Total, scope above</span><b>'+(calc.coreAllPriced ? esc(money(calc.coreTotal)) : (calc.coreTotal ? esc(money(calc.coreTotal))+' so far' : '—'))+'</b></div>'+
    (calc.missing?'<p class="muted sm">'+plural(calc.missing,'line')+' still '+(calc.missing===1?'needs':'need')+' a rate or a number. Tap it to fill it in. Your rates stay on this phone.</p>':'')+
    '<input class="in" id="qNote" maxlength="200" placeholder="A note to add to the quote (optional)" value="'+esc(Q.note)+'" aria-label="Quote note">'+
    (last?'<p class="muted sm">Last saved: '+esc(last.ref||'quote')+' · '+esc(last.coreAllPriced&&last.coreTotal!=null?money(last.coreTotal):'unpriced')+' · '+(last.status==='approved'?'approved':'draft, not approved')+'</p>':'')+
    '<p class="muted sm">A quote only goes to a customer after you read it and approve it.</p><div class="chips"><button class="btn" id="qSave">Save draft</button><button class="chip" id="qCopy">📋 Copy draft</button><button class="chip" id="qMail">✓ Approve & email</button></div>'+
    '<div class="actions"><button class="btn quiet" data-act="dlg-close">Close</button></div>', {cls:'tall'});
  const read=()=>{ const s=parseInt($('#qSt',d).value,10), p=parseFloat($('#qPe',d).value); Q.stories=s>0?s:null; Q.perim=p>0?p:null; Q.note=$('#qNote',d).value.trim(); };
  ['#qSt','#qPe'].forEach(sel=>$(sel,d).addEventListener('change',()=>{ read(); quotePaint(); }));
  $('#qNote',d).addEventListener('change',read);
  $$('[data-id]',d).forEach(cb=>cb.addEventListener('change',()=>{ read(); cb.checked ? Q.sel.add(cb.dataset.id) : Q.sel.delete(cb.dataset.id); quotePaint(); }));
  $$('[data-rate]',d).forEach(bt=>bt.addEventListener('click',()=>{ read(); const svc=S.services.find(s=>s.id===bt.dataset.rate); if(svc) serviceDlg(svc, quotePaint); }));
  $('#qCopy',d).addEventListener('click',()=>{ read(); copyText(quoteText(l, quoteCalc({stories:Q.stories, perimFt:Q.perim}, S.services, Q.sel, S.floorFt), Q.note, last&&last.ref)); });
  $('#qSave',d).addEventListener('click',()=>{ read(); const q=quoteSave(); if(q){ closeDlg(); afterChange(); toast('🧾 '+q.ref+' saved as a draft on '+leadName(l)); } });
  $('#qMail',d).addEventListener('click',()=>{ read(); const q=quoteSave(); if(q){ closeDlg(); save(); quoteApproveDlg(l,q,()=>emailDlg(l,{withQuote:true})); } });
}
/* a saved quote gets a number (Q-0001, never reused); the lead's value follows it only when every main line is priced */
function quoteSave(){
  const l=Q.l, S=state.settings, calc=quoteCalc({stories:Q.stories, perimFt:Q.perim}, S.services, Q.sel, S.floorFt);
  if(!calc.lines.length){ toast('Switch on at least one service in Settings first'); return null; }
  state.counters.quote++; const ref='Q-'+String(state.counters.quote).padStart(4,'0');
  if(Q.stories && Q.stories!==l.bld.levels){ l.bld.levels=Q.stories; l.bld.checked=true; }
  if(Q.perim && Math.round(Q.perim)!==l.bld.perimFt){ l.bld.perimFt=Math.round(Q.perim); l.bld.checked=true; }
  const q={id:uid(), ref, ts:Date.now(), total:calc.total||null, coreTotal:calc.core.length?calc.coreTotal:null, coreAllPriced:calc.coreAllPriced,
    status:'draft', approvedTs:0, approvedBy:'', scope:calc.core.map(x=>x.band||x.name).filter((v,i,a)=>a.indexOf(v)===i).join(', '), note:Q.note, stories:Q.stories, perimFt:Q.perim, text:quoteText(l,calc,Q.note,ref),
    lines:calc.lines.map(x=>({id:x.id, name:x.name, amount:x.amount, need:x.need||'', core:x.core}))};
  l.quotes.unshift(q); l.services=[...Q.sel];
  logEvent(l,{type:'quote', ref, text:calc.coreAllPriced ? money(calc.coreTotal) : 'draft, not fully priced'});
  save(); return q;
}

/* ---------- approving a quote: you read it, then you say it may go to a customer ---------- */
ACT['quote-approve']=el=>{ const l=leadOr(el.dataset.id); const q=l&&l.quotes.find(x=>x.id===el.dataset.q); if(q) quoteApproveDlg(l,q,()=>refresh()); };
function quoteApproveDlg(l, q, then){
  if(q.status==='approved'){ if(then) then(q); return; }
  if(l.demo){ toast('This is a demonstration property, so its quote can’t be approved for a customer. Add a real lead to do that.'); return; }
  const d=openDlg('<h3>Approve '+esc(q.ref)+' for the customer?</h3><div class="draftbar">DRAFT — REVIEW REQUIRED</div><p class="muted sm">Read it through. Approving does not send anything: it only lets this quote be included in an email you open and send yourself.</p>'+
    '<textarea class="ta mono" rows="14" readonly aria-label="Quote text">'+esc(q.text)+'</textarea>'+
    '<label class="check"><input type="checkbox" id="apCk"> I have read this quote and approve it for the customer</label>'+
    '<div class="actions"><button class="btn quiet" data-act="dlg-close">Not yet</button><button class="btn" id="apOk" disabled>Approve</button></div>', {cls:'tall'});
  $('#apCk',d).addEventListener('change',e=>{ $('#apOk',d).disabled=!e.target.checked; });
  $('#apOk',d).addEventListener('click',()=>{
    const by=state.settings.sender.name||'you';
    q.status='approved'; q.approvedTs=Date.now(); q.approvedBy=by; q.text=q.text.replace(/^QUOTE (\S+) \(DRAFT\)/,'QUOTE $1').replace('• This is a draft estimate.','• This is an estimate.');
    logEvent(l,{type:'quote', ref:q.ref, text:'approved by '+by}); save(); closeDlg(); toast('✓ '+q.ref+' approved'); if(then) then(q);
  });
}

/* ---------- Email: a draft you read, then send from your own mail app ---------- */
let E=null;
function emailBuild(l, o){
  const S=state.settings.sender, pb=state.settings.playbooks.find(x=>x.id===o.pb)||null, quote=o.withQuote ? approvedQuote(l) : null, b=bldOf(l);
  const dm=decisionMaker(l)||l.contacts.find(c=>c.name)||{}, first=/^[A-Za-z][A-Za-z'’-]+/.test(dm.name||'') ? dm.name.split(/\s+/)[0] : '';
  const kind=(CATS[l.cat]||CATS.mixed).label.toLowerCase(), nm=l.name || l.addr || 'your building';
  const desc=b.stories ? b.stories+'-story '+(kind==='other'?'building':kind) : (kind==='other'?'building':kind);
  const me=S.name||'[your name]', L=[first?'Hello '+first+',':'Hello,', ''];
  L.push('My name is '+me+(S.company?' with '+S.company:' with [your company]')+'. '+S.blurb);
  L.push('I came across '+nm+(l.addr && nm!==l.addr ? ' at '+l.addr : '')+', a '+desc+', while looking at buildings in the area.');
  if(pb && pb.pitch){ L.push(''); L.push(pb.pitch); }
  if(quote && quote.coreAllPriced && quote.coreTotal!=null){ L.push(''); L.push('I put together a draft price from public information about the building (its floors and outline): '+money(quote.coreTotal)+(quote.scope?' for '+quote.scope.toLowerCase():'')+'. It is an estimate until we walk the site.'); }
  else if(quote){ L.push(''); L.push('I put together a draft scope from public information about the building and can send the price after a quick look at the site.'); }
  if(o.cross){
    const ex=state.settings.services.filter(s=>s.on && !s.core);
    if(ex.length){ L.push(''); L.push('We also offer:'); ex.forEach(s=>L.push('• '+s.name+(s.pitch?': '+s.pitch:''))); }
  }
  L.push(''); L.push('Would a short call, or a walk of the site this week, work for you?'); L.push(''); L.push('Thank you,'); L.push(me);
  [S.company, S.phone, S.email, S.address].filter(Boolean).forEach(x=>L.push(x));
  if(S.optOut){ L.push(''); L.push(S.optOut); }
  return {subject: nm+': exterior window and facade cleaning', body: L.join('\n')};
}
ACT['mail-open']=el=>{ const l=leadOr(el.dataset.id); if(l) emailDlg(l,{}); };
function emailDlg(l, o){
  o=o||{}; const pbs=solutionsFor(state.settings.playbooks, l.cat, l.bld.levels), quote=approvedQuote(l);
  const dm=decisionMaker(l), em=emailOf(dm&&dm.email)||emailOf((l.contacts.find(c=>emailOf(c.email))||{}).email)||emailOf(l.bld.email);
  E={l, pb:o.playbook!==undefined ? o.playbook : ((pbs[0]&&pbs[0].id)||''), withQuote:o.withQuote!==undefined ? o.withQuote : !!quote, cross:true, to:em, opened:false, sent:null, follow:null};
  Object.assign(E, emailBuild(l, E)); emailPaint();
}
function emailPaint(){
  const l=E.l, S=state.settings.sender, quote=approvedQuote(l), draftQ=(!quote && latestQuote(l))||null, pbs=solutionsFor(state.settings.playbooks, l.cat, l.bld.levels).slice(0,4);
  const missing=[!S.name&&'your name', !S.company&&'your company', !S.address&&'your mailing address'].filter(Boolean);
  const d=openDlg('<h3>Outreach · '+esc(leadName(l))+'</h3><div class="draftbar">DRAFT — REVIEW REQUIRED</div><p class="muted sm">A draft for you to read and change. Nothing is sent from here: it opens in your mail app and you tap send.</p>'+
    '<label class="lab" for="eTo">To the decision maker</label><input class="in" id="eTo" inputmode="email" maxlength="160" placeholder="name@company.com" value="'+esc(E.to)+'" autocomplete="off">'+
    (E.to?'':'<p class="muted sm">No email on file yet. Add a contact in Contacts, or type one here.</p>')+
    (pbs.length?'<div class="lab sm">📚 Solution to lead with</div><div class="chips" id="ePb">'+pbs.map(p=>'<button type="button" class="chip'+(E.pb===p.id?' on':'')+'" data-v="'+esc(p.id)+'">'+esc(p.name)+'</button>').join('')+'<button type="button" class="chip'+(E.pb===''?' on':'')+'" data-v="">None</button></div>':'')+
    '<div class="chips"><button type="button" class="chip'+(E.withQuote?' on':'')+'" id="eQ" aria-pressed="'+E.withQuote+'"'+(quote?'':' disabled')+'>'+(E.withQuote?'✓ ':'')+'Include my quote'+(quote&&quote.coreAllPriced?' · '+esc(money(quote.coreTotal)):'')+'</button>'+
    '<button type="button" class="chip'+(E.cross?' on':'')+'" id="eX" aria-pressed="'+E.cross+'">'+(E.cross?'✓ ':'')+'Mention other services</button>'+(quote?'':(draftQ?'<button type="button" class="chip" id="eApQ">🧾 Approve '+esc(draftQ.ref)+' first</button>':'<button type="button" class="chip" id="eMkQ">🧾 Make a quote first</button>'))+'</div>'+
    '<p class="muted sm">Changing these rewrites the message below.</p>'+
    '<input class="in" id="eSub" maxlength="200" value="'+esc(E.subject)+'" aria-label="Subject"><textarea class="ta" id="eBody" rows="12" aria-label="Message">'+esc(E.body)+'</textarea>'+
    (l.demo?'<div class="warn">Demonstration property: this draft is for practice, so opening it in Mail is switched off.</div>':'')+
    (missing.length?'<div class="warn">Add '+esc(missing.join(', '))+' so the email is complete. US commercial email should carry your mailing address and a way to say no. <button type="button" class="chip" id="eSet">Add my details</button></div>':'')+
    (E.sent ? '<div class="line">✓ Logged as emailed'+(E.sent.quoted?' and moved to Quote':'')+'. <button type="button" class="chip" id="eUndo">Undo</button></div><div class="lab sm">Follow up in</div>'+chipRow('eF',FOLLOW,E.follow==null?'':E.follow)
    : E.opened ? '<div class="line">Back from Mail? Only log it if you sent it.</div><div class="chips"><button class="btn" id="eSent">✓ I sent it</button><button class="chip" id="eNot">Not sent</button></div>'
    : '<div class="chips"><button class="btn" id="eOpen"'+(E.to&&!l.demo?'':' disabled')+'>Open in Mail</button><button class="chip" id="eCopy">📋 Copy</button></div>')+
    '<div class="actions"><button class="btn quiet" data-act="dlg-close">Close</button></div>', {cls:'tall', onClose:()=>{ if(!E) return; save(); }});
  const read=()=>{ E.to=$('#eTo',d).value.trim(); E.subject=$('#eSub',d).value; E.body=$('#eBody',d).value; };
  const rebuild=()=>{ read(); Object.assign(E, emailBuild(l, E)); emailPaint(); };
  $('#eTo',d).addEventListener('change',()=>{ read(); emailPaint(); });
  $$('#ePb [data-v]',d).forEach(b=>b.addEventListener('click',()=>{ E.pb=b.dataset.v; rebuild(); }));
  const q=$('#eQ',d); if(q) q.addEventListener('click',()=>{ E.withQuote=!E.withQuote; rebuild(); });
  $('#eX',d).addEventListener('click',()=>{ E.cross=!E.cross; rebuild(); });
  const ap=$('#eApQ',d); if(ap) ap.addEventListener('click',()=>{ read(); closeDlg(); quoteApproveDlg(l,draftQ,()=>emailDlg(l,{withQuote:true})); });
  const mq=$('#eMkQ',d); if(mq) mq.addEventListener('click',()=>{ read(); closeDlg(); quoteDlg(l); });
  const st=$('#eSet',d); if(st) st.addEventListener('click',()=>{ read(); senderDlg(()=>{ Object.assign(E, emailBuild(l, E)); emailPaint(); }); });
  const op=$('#eOpen',d); if(op) op.addEventListener('click',()=>{ read(); if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(E.to)){ toast('Add a valid email address first'); return; } E.opened=true; const h='mailto:'+E.to+'?subject='+encodeURIComponent(E.subject)+'&body='+encodeURIComponent(E.body); emailPaint(); openMail(h); });
  const cp=$('#eCopy',d); if(cp) cp.addEventListener('click',()=>{ read(); copyText('Subject: '+E.subject+'\n\n'+E.body); });
  const sn=$('#eSent',d); if(sn) sn.addEventListener('click',()=>{ read(); emailLogSent(); emailPaint(); });
  const nt=$('#eNot',d); if(nt) nt.addEventListener('click',()=>{ E.opened=false; emailPaint(); });
  const ud=$('#eUndo',d); if(ud) ud.addEventListener('click',()=>{ emailUndoSent(); emailPaint(); });
  bindChips(d,'eF',v=>emailFollow(Number(v)));
}
/* the only place a mail link is followed */
function openMail(h){ window.location.href=h; }
/* a tap on "I sent it" is the only thing that logs it. A first email moves a new lead to Contacted; with a quote it moves to Quote. Undo puts it back. */
function emailLogSent(){
  const l=E.l, snap={ev:l.events.length, stage:l.stage, taskId:null};
  touchLead(l,'email',E.subject);
  const quoted=E.withQuote && !!approvedQuote(l) && ['Lead','Contacted','Meeting','Quote'].includes(l.stage);
  if(quoted && l.stage!=='Quote') setStage(l,'Quote');
  if(E.to && !l.contacts.some(c=>c.email===E.to)) l.contacts.push({id:uid(), name:'', title:'', email:E.to, phone:'', role:'decision', conf:'', src:'You typed it'});
  save(); E.sent={snap, quoted}; E.follow=null; toast('✓ Logged: emailed '+leadName(l));
}
function emailUndoSent(){
  const l=E.l, s=E.sent && E.sent.snap; if(!s) return;
  if(l.events.length>s.ev) l.events.splice(s.ev);
  l.stage=s.stage; if(s.taskId) l.tasks=l.tasks.filter(t=>t.id!==s.taskId);
  save(); E.sent=null; E.opened=false;
}
function emailFollow(days){
  const l=E.l, s=E.sent && E.sent.snap; if(!s) return;
  if(s.taskId){ l.tasks=l.tasks.filter(t=>t.id!==s.taskId); s.taskId=null; }
  E.follow=days;
  if(days>0){ const t=addTask(l,'Follow up with '+leadName(l), addDays(null,days)); s.taskId=t.id; }
  save(); emailPaint();
}
