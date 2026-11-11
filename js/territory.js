'use strict';
/* IAI Field Sales Dashboard: the Territory Map. Tap a spot, say how far and what to look for,
   and the buildings come back ranked, most worth reaching first, with the reasons. */
let searchBusy=false;
const MAP_TABS=[['search','Map search'],['saved','Saved areas'],['recent','Recent searches']];
const MIN_STORIES=[0,2,3,5,8,12,20];

function leadIndex(){ const m=new Map(); state.properties.forEach(l=>{ if(l.osm) m.set(l.osm,l); }); return m; }
function rowsNow(){
  const L=state.search.last; if(!L) return [];
  const idx=leadIndex(), rows=rankCands(L.items, state.map.lens, {lat:L.lat, lon:L.lon}, L.radius);
  rows.forEach(r=>{ r.lead=idx.get(r.c.id)||null; });
  return rows;
}
function viewMap(m){
  setTop('Territory Map','Source, rank and research buildings');
  if(!state.settings.lookups.on){ m.innerHTML=consentCard(); return; }
  m.innerHTML='<div class="seg" role="tablist">'+MAP_TABS.map(([k,l])=>'<button role="tab" aria-selected="'+(state.ui.mapTab===k)+'" class="'+(state.ui.mapTab===k?'on':'')+'" data-act="map-tab" data-t="'+k+'">'+l+'</button>').join('')+'</div><div id="mapBody"></div>';
  const body=$('#mapBody',m);
  if(state.ui.mapTab==='saved') paintSaved(body); else if(state.ui.mapTab==='recent') paintRecent(body); else paintSearch(body);
}
ACT['map-tab']=el=>{ state.ui.mapTab=el.dataset.t; MSHOW=20; save(); show('map'); };
let MSHOW=20;

/* ---------- Map search ---------- */
function paintSearch(body){
  body.innerHTML='<div class="findbar"><input class="in" id="mAddr" maxlength="160" placeholder="Go to an address or place" autocomplete="off" enterkeyhint="go" aria-label="Address or place"><button class="btn" id="mGo">Go</button><button class="btn quiet" id="mRes" title="Find the building at this address and open its research">'+ic('search')+' Research</button></div>'+
    '<div class="map" id="mapHost" tabindex="0" role="application" aria-label="Map. Drag to move, pinch or scroll to zoom, tap to drop a pin. Arrow keys move, plus and minus zoom, Enter pins the middle."></div>'+
    '<section class="card" id="mapCtl"></section><div id="results"></div>';
  mapMount($('#mapHost',body)); MAP.rows=rowsNow(); MAP.onPin=()=>paintCtl(); MAP.onMark=r=>openCand(r.c,{band:r.band, why:r.why});
  if(state.map.pin && !state.map.view) mapFitTo(state.map.pin.lat, state.map.pin.lon, state.map.radius); else mapDraw();
  paintCtl(); paintResults();
  const inp=$('#mAddr',body);
  $('#mGo',body).addEventListener('click',()=>addrGo(inp.value,false));
  $('#mRes',body).addEventListener('click',()=>addrGo(inp.value,true));
  inp.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); addrGo(inp.value,false); } });
}
function paintCtl(){
  const box=$('#mapCtl'); if(!box) return; const M=state.map, c=M.crit, P=M.pin;
  if(state.search.last && state.ui.ctlOpen===false){
    box.innerHTML='<div class="line" id="ctlSum"><span id="pinTxt">'+(P?'📍 '+esc(P.label||(P.lat.toFixed(4)+', '+P.lon.toFixed(4))):'Tap the map to drop a pin')+'</span> · '+esc(radLabel(M.radius))+'</div>'+
      '<div class="btnrow2"><button class="btn" id="cGo"'+(P?'':' disabled')+'>Search again</button><button class="btn quiet" id="cEdit">Change filters</button></div>';
    $('#cEdit',box).addEventListener('click',()=>{ state.ui.ctlOpen=true; save(); paintCtl(); });
    $('#cGo',box).addEventListener('click',runSearch); return;
  }
  box.innerHTML='<div class="lab first">Where</div><div class="line" id="pinTxt">'+(P?'📍 '+(P.label?esc(P.label)+' · ':'')+P.lat.toFixed(4)+', '+P.lon.toFixed(4):'Tap the map to drop a pin where you want to look.')+'</div>'+
    '<div class="lab">Radius</div><div class="chips" id="cRad">'+RADII.map(([mm,l])=>'<button class="chip'+(M.radius===mm?' on':'')+'" data-v="'+mm+'">'+l+'</button>').join('')+'</div>'+
    '<div class="lab">Quick picks</div><div class="chips scroll" id="cPre">'+Object.keys(PRESETS).map(k=>'<button class="chip'+(c.preset===k?' on':'')+'" data-v="'+k+'">'+esc(PRESETS[k].label)+'</button>').join('')+'</div>'+
    '<div class="lab">Building type <small class="muted">(none picked means any)</small></div><div class="chips" id="cTy">'+TYPE_KEYS.map(k=>'<button class="chip'+(c.types.includes(k)?' on':'')+'" data-v="'+k+'">'+TYPES[k].icon+' '+esc(TYPES[k].label)+'</button>').join('')+'</div>'+
    '<div class="lab">Min stories</div><div class="chips" id="cLv">'+MIN_STORIES.map(v=>'<button class="chip'+(c.minLevels===v?' on':'')+'" data-v="'+v+'">'+(v?v+'+':'Any')+'</button>').join('')+'</div>'+
    '<div class="lab">Services to offer</div><div class="chips scroll" id="cSv">'+Object.keys(SERVICE_FAMILIES).map(k=>'<button class="chip'+(M.offer.includes(k)?' on':'')+'" data-v="'+k+'" aria-pressed="'+M.offer.includes(k)+'">'+esc(SERVICE_FAMILIES[k].label)+'</button>').join('')+'</div>'+
    '<div class="chips"><button class="chip wrap'+(c.unknownLevels?' on':'')+'" id="cUnk" aria-pressed="'+c.unknownLevels+'">'+(c.unknownLevels?'✓ ':'')+'Include buildings with no floor count on the map</button></div>'+
    '<p class="muted sm">'+esc(critText(c))+'</p>'+
    '<div class="chips actionbar"><button class="btn" id="cGo"'+(P?'':' disabled')+'>'+ic('search')+' Search this area</button><button class="btn quiet" id="cSave"'+(P?'':' disabled')+'>Save area</button></div>'+
    '<div class="privline">Map data © OpenStreetMap contributors. Floors and outlines are volunteer-mapped, so they are estimates to confirm on site.</div>';
  const edit=f=>{ f(); c.preset=PRESETS[c.preset] && JSON.stringify([c.minLevels,c.types.slice().sort()])===JSON.stringify([PRESETS[c.preset].minLevels,PRESETS[c.preset].types.slice().sort()]) ? c.preset : 'custom'; save(); paintCtl(); };
  $$('#cRad [data-v]',box).forEach(b=>b.addEventListener('click',()=>{ M.radius=Number(b.dataset.v); save(); if(MAP){ mapDraw(); if(P) mapFitTo(P.lat,P.lon,M.radius); } paintCtl(); }));
  $$('#cPre [data-v]',box).forEach(b=>b.addEventListener('click',()=>{ M.crit=critClean({preset:b.dataset.v}); save(); paintCtl(); }));
  $$('#cTy [data-v]',box).forEach(b=>b.addEventListener('click',()=>edit(()=>{ const k=b.dataset.v; c.types=c.types.includes(k)?c.types.filter(x=>x!==k):c.types.concat(k); })));
  $$('#cLv [data-v]',box).forEach(b=>b.addEventListener('click',()=>edit(()=>{ c.minLevels=Number(b.dataset.v); })));
  $$('#cSv [data-v]',box).forEach(b=>b.addEventListener('click',()=>{ const k=b.dataset.v; M.offer=M.offer.includes(k)?M.offer.filter(x=>x!==k):M.offer.concat(k); save(); paintCtl(); }));
  $('#cUnk',box).addEventListener('click',()=>{ c.unknownLevels=!c.unknownLevels; c.preset='custom'; save(); paintCtl(); });
  $('#cGo',box).addEventListener('click',runSearch);
  $('#cSave',box).addEventListener('click',saveAreaDlg);
}

/* ---------- Search this area: the exact request first ---------- */
async function runSearch(){
  const M=state.map, pin=M.pin; if(!pin){ toast('Tap the map to drop a pin first'); return; }
  if(searchBusy) return;
  const q=buildQuery(pin.lat, pin.lon, M.radius, M.crit);
  confirmSend({title:'🔍 Search this area?', intro:'OpenStreetMap’s building data is searched for the place and filters below. Nothing else is sent.', hosts:[HOSTS.overpass],
    lines:['📍 Center '+pin.lat.toFixed(4)+', '+pin.lon.toFixed(4), '↔ Radius '+esc(radLabel(M.radius)), '🎯 '+esc(critText(M.crit))], payload:q, ok:'Search'}, async text=>{
    searchBusy=true; const btn=$('#cGo'); if(btn){ btn.disabled=true; btn.textContent='Searching…'; }
    try{
      const j=await fetchJSON('https://overpass-api.de/api/interpreter',{method:'POST', headers:{'content-type':'application/x-www-form-urlencoded'}, body:'data='+encodeURIComponent(text)});
      const parsed=parseOverpass(j), kept=parsed.items.filter(c=>keepCand(c,M.crit));
      const top=rankCands(kept,'balanced',pin,M.radius).slice(0,400).map(r=>r.c);
      const label=pin.label || (pin.lat.toFixed(3)+', '+pin.lon.toFixed(3));
      state.search.last={ts:Date.now(), lat:pin.lat, lon:pin.lon, radius:M.radius, crit:critClean(M.crit), label, total:parsed.items.length, airports:parsed.air.slice(0,20), items:top.map(candClean).filter(Boolean)};
      state.search.runs.unshift({id:uid(), ts:Date.now(), label, lat:pin.lat, lon:pin.lon, radius:M.radius, crit:critClean(M.crit), found:parsed.items.length, kept:kept.length}); state.search.runs=state.search.runs.slice(0,30);
      state.ui.ctlOpen=kept.length===0; save(); searchBusy=false; MSHOW=20;
      toast(kept.length ? '✓ '+plural(kept.length,'building')+' match, ranked' : 'Nothing matched. Try a wider radius or looser filters.');
      if(state.ui.tab==='map' && state.ui.mapTab==='search' && MAP){ MAP.rows=rowsNow(); mapDraw(); paintCtl(); paintResults(); const r=$('#mapHost'); if(r&&kept.length) r.scrollIntoView({behavior:'smooth',block:'start'}); }
    }catch(e){
      searchBusy=false; toast('Search failed: '+netMsg(e)); const b2=$('#cGo'); if(b2){ b2.disabled=false; b2.innerHTML=ic('search')+' Search this area'; }
    }
  });
}

/* ---------- the ranked results ---------- */
function paintResults(){
  const box=$('#results'); if(!box) return; const L=state.search.last;
  if(!L){ box.innerHTML='<div class="empty">No search yet. Drop a pin, choose how far and what to look for, then search. The buildings come back here, most worth reaching first.</div>'; return; }
  const rows=rowsNow(), nb=b=>rows.filter(r=>r.band===b).length;
  box.innerHTML='<section class="card"><div class="row-between"><h3>'+plural(rows.length,'Property','Properties')+' found</h3><small class="muted">'+esc(whenLabel(L.ts))+'</small></div>'+
    '<div class="bandsum"><span class="bpill b-High">'+nb('High')+' High</span><span class="bpill b-Medium">'+nb('Medium')+' Medium</span><span class="bpill b-Lower">'+nb('Lower')+' Lower</span></div>'+
    '<p class="muted sm">'+esc(L.label)+' · '+esc(radLabel(L.radius))+' · '+plural(L.total,'building')+' on the map, '+L.items.length+' match ('+esc(critText(L.crit))+'). ✨ The order is a suggestion from what the map says. Confirm floors, size and type on site.</p>'+
    '<div class="lab">Rank by</div><div class="chips scroll" id="lens">'+Object.keys(LENS).map(k=>'<button class="chip'+(state.map.lens===k?' on':'')+'" data-v="'+k+'">'+esc(LENS[k].label)+'</button>').join('')+'</div></section>'+
    (rows.length<8 && !L.crit.unknownLevels ? '<div class="card soft" id="fewHint"><p class="sm">Only buildings with a floor count on the map are shown, and many commercial buildings have none. Tap “Change filters”, turn on “Include buildings with no floor count”, then search again to see them.</p></div>' : '')+
    '<h3 class="sect">Prospects in radius</h3>'+rows.slice(0,MSHOW).map(candCard).join('')+(rows.length>MSHOW?'<button class="btn quiet wide" data-act="more-results">Show more ('+(rows.length-MSHOW)+' left)</button>':'');
  $$('#lens [data-v]',box).forEach(b=>b.addEventListener('click',()=>{ state.map.lens=b.dataset.v; save(); if(MAP){ MAP.rows=rowsNow(); mapDraw(); } paintResults(); }));
}
ACT['more-results']=()=>{ MSHOW+=20; paintResults(); };
function candCard(r){
  const c=r.c, cat=CATS[c.cat]||CATS.mixed, info=[cat.label, c.levels?plural(c.levels,'floor'):'floors unknown', c.sqft?fmt(c.sqft)+' sq ft':''].filter(Boolean).join(' · ');
  return '<article class="rcard" data-act="cand-open" data-id="'+esc(c.id)+'" tabindex="0" role="button" aria-label="Research '+esc(c.name||c.addr||'building')+'">'+
    '<div class="rk b-'+r.band+'">'+r.rank+'</div><div class="rc-main"><h3>'+esc(c.name||c.addr||'Building at '+c.lat.toFixed(4)+', '+c.lon.toFixed(4))+'</h3><p>'+esc(c.addr||'No street address on the map')+'</p>'+
    '<div class="lc-chips"><span class="chip-s">'+esc(info)+'</span>'+bandPill(r.band)+(r.lead?'<span class="chip-s ok">'+ic('check','tiny')+' In pipeline</span>':'')+'</div>'+
    '<p class="why1">✨ '+esc(r.why.slice(0,3).join(' · '))+'</p></div>'+
    '<div class="rc-acts"><button class="btn-s" data-act="cand-open" data-id="'+esc(c.id)+'">Research property</button>'+(r.lead?'':'<button class="btn-s prim" data-act="cand-add" data-id="'+esc(c.id)+'">'+ic('plus')+'Add</button>')+'</div></article>';
}
function candRow(id){ return rowsNow().find(r=>r.c.id===id)||null; }
ACT['cand-open']=el=>{ const r=candRow(el.dataset.id); if(r) openCand(r.c,{band:r.band, why:r.why}); };
document.addEventListener('keydown',e=>{ if((e.key==='Enter'||e.key===' ') && e.target.matches && e.target.matches('.rcard')){ e.preventDefault(); const r=candRow(e.target.dataset.id); if(r) openCand(r.c,{band:r.band,why:r.why}); } });
ACT['cand-add']=el=>{
  const r=candRow(el.dataset.id); if(!r) return; if(r.lead){ toast('Already in your pipeline'); return; }
  const l=leadFromCand(r.c,{band:r.band, why:r.why, offer:state.map.offer}); state.properties.unshift(l); save();
  toast('✓ '+leadName(l)+' added to your pipeline',{undo:()=>{ deleteLead(l.id); if(MAP) MAP.rows=rowsNow(); mapDraw(); paintResults(); }});
  if(MAP){ MAP.rows=rowsNow(); mapDraw(); } paintResults();
};

/* ---------- saved areas and recent searches ---------- */
function saveAreaDlg(){
  const M=state.map; if(!M.pin) return;
  const d=openDlg('<h3>Save this area</h3><p class="muted sm">Keeps the pin, radius and filters so you can come back to it.</p><input class="in" id="saN" maxlength="80" value="'+esc(M.pin.label||'')+'" placeholder="Name this area" aria-label="Area name"><div class="actions"><button class="btn quiet" data-act="dlg-close">Cancel</button><button class="btn" id="saOk">Save</button></div>',{focus:'#saN'});
  $('#saOk',d).addEventListener('click',()=>{ const n=$('#saN',d).value.trim(); if(!n){ toast('Give it a name'); return; }
    state.search.saved.unshift({id:uid(), ts:Date.now(), name:n, lat:M.pin.lat, lon:M.pin.lon, radius:M.radius, crit:critClean(M.crit)}); state.search.saved=state.search.saved.slice(0,60); save(); closeDlg(); toast('✓ Area saved'); });
}
function useArea(a, label){
  state.map.pin={lat:a.lat, lon:a.lon, label:str(label||a.name||a.label,80)}; state.map.radius=a.radius; state.map.crit=critClean(a.crit); state.map.view=null; state.ui.mapTab='search'; save(); show('map');
}
function areaCard(a, opt){
  return '<article class="card area"><div class="row-between"><div><h3>'+esc(a.name||a.label)+'</h3><p class="muted sm">'+esc(radLabel(a.radius))+' · '+esc(critText(a.crit))+'</p>'+(opt.extra||'')+'</div></div><div class="chips"><button class="btn" data-act="'+opt.use+'" data-id="'+esc(a.id)+'">'+opt.useLabel+'</button>'+(opt.del?'<button class="btn quiet danger-t" data-act="'+opt.del+'" data-id="'+esc(a.id)+'">Delete</button>':'')+'</div></article>';
}
function paintSaved(body){
  const S=state.search.saved;
  body.innerHTML=S.length ? S.map(a=>areaCard(a,{use:'area-use', useLabel:'Use this area', del:'area-del', extra:'<p class="muted sm">Saved '+esc(whenLabel(a.ts))+'</p>'})).join('') : '<div class="empty">No saved areas yet. Drop a pin on Map search and tap “Save area” to keep it.</div>';
}
ACT['area-use']=el=>{ const a=state.search.saved.find(x=>x.id===el.dataset.id); if(a) useArea(a); };
ACT['area-del']=el=>{ const i=state.search.saved.findIndex(x=>x.id===el.dataset.id); if(i<0) return; const [a]=state.search.saved.splice(i,1); save(); show('map'); toast('Area deleted',{undo:()=>{ state.search.saved.splice(i,0,a); save(); show('map'); }}); };
function paintRecent(body){
  const R=state.search.runs;
  body.innerHTML=R.length ? R.map(r=>areaCard(r,{use:'run-use', useLabel:'Search here again', extra:'<p class="muted sm">'+esc(whenLabel(r.ts))+' · '+plural(r.found,'building')+' on the map, '+r.kept+' matched</p>'})).join('') : '<div class="empty">No searches yet. Your last 30 searches show up here.</div>';
}
ACT['run-use']=el=>{ const a=state.search.runs.find(x=>x.id===el.dataset.id); if(a) useArea(a,a.label); };

/* ---------- Go to an address, or research one ---------- */
function pointInRing(g, lat, lon){
  let ins=false;
  for(let i=0,j=g.length-1;i<g.length;j=i++){
    const a=g[i], b=g[j];
    if(((a.lat>lat)!==(b.lat>lat)) && (lon < (b.lon-a.lon)*(lat-a.lat)/(b.lat-a.lat)+a.lon)) ins=!ins;
  }
  return ins;
}
async function geocode(q){
  const j=await fetchJSON('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&q='+encodeURIComponent(q),{ms:15000, referrerPolicy:'origin'});
  return (Array.isArray(j) ? j : []).map(x=>({lat:Number(x.lat), lon:Number(x.lon), name:String(x.display_name||''), short:String(x.display_name||'').split(',').slice(0,3).join(',').trim()})).filter(x=>x.name && Number.isFinite(x.lat) && Number.isFinite(x.lon));
}
function addrGo(raw, research, o){
  const q=String(raw||'').trim(); if(q.length<3){ toast('Type an address or place first'); return; }
  if(!state.settings.lookups.on){ toast('Turn on lookups in Settings first'); return; }
  confirmSend({title: research ? '🔎 Research this address?' : '📍 Find this place?',
    intro: research ? 'The address search finds the place, then the building search looks for the building at that spot.' : 'The address search finds the place on the map.',
    hosts: research ? [HOSTS.nominatim, HOSTS.overpass] : [HOSTS.nominatim], lines:[], payload:q, editable:true, ok:'Search'}, async text=>{
    toast('Looking it up…');
    try{
      const res=await geocode(text);
      if(!res.length){ toast('No place found. Try adding the city and state.'); return; }
      const pick=r=>{ if(research) researchAt(r,o); else { if(state.ui.tab!=='map'){ state.ui.tab='map'; } mapOrPin(r); } };
      if(res.length===1) pick(res[0]);
      else{
        const d=openDlg('<h3>Which one?</h3><div id="pl"></div><div class="actions"><button class="btn quiet" data-act="dlg-close">Cancel</button></div>');
        res.forEach(r=>{ const b=document.createElement('button'); b.className='prow'; b.innerHTML='<b>'+esc(r.short||r.name)+'</b><small>'+esc(r.name)+'</small>'; b.addEventListener('click',()=>{ closeDlg(); pick(r); }); $('#pl',d).appendChild(b); });
      }
    }catch(e){ toast('The address search failed: '+netMsg(e)); }
  });
}
function mapOrPin(r){
  state.map.pin={lat:r.lat, lon:r.lon, label:str(r.short,80)}; state.map.view=null; save();
  if(MAP){ mapFitTo(r.lat, r.lon, state.map.radius); paintCtl(); } else show('map');
}
async function researchAt(pl, o){
  o=o||{}; toast('Finding the building…');
  let cand=null;
  try{
    const j=await fetchJSON('https://overpass-api.de/api/interpreter',{method:'POST', headers:{'content-type':'application/x-www-form-urlencoded'}, body:'data='+encodeURIComponent(buildQueryAt(pl.lat,pl.lon))});
    const parsed=parseOverpass(j,{keepGeom:true});
    const inside=parsed.items.filter(c=>c._g && pointInRing(c._g, pl.lat, pl.lon)).sort((a,b)=>b.sqft-a.sqft)[0];
    cand = inside || parsed.items.map(c=>({c, d:dist(c.lat,c.lon,pl.lat,pl.lon)})).filter(x=>x.d<=60).sort((a,b)=>a.d-b.d).map(x=>x.c)[0] || null;
    parsed.items.forEach(c=>{ delete c._g; });
    if(!cand && parsed.air.length){ let best=null; parsed.air.forEach(a=>{ const d=miles(dist(pl.lat,pl.lon,a.lat,a.lon)); if(!best||d<best.mi) best={mi:d,name:a.name}; }); pl.air = best && best.mi<=8 ? {mi:Math.round(best.mi*10)/10, name:best.name} : null; }
  }catch(e){ toast('The building search failed: '+netMsg(e)+' Using the address only.'); }
  if(!cand) cand={id:'a:'+pl.lat.toFixed(5)+','+pl.lon.toFixed(5), name:'', addr:pl.short, lat:pl.lat, lon:pl.lon, levels:null, height:null, sqft:0, perimFt:0, cat:'mixed', btype:'', glass:false, op:'', web:'', phone:'', email:'', approx:false, point:true, air:pl.air||undefined};
  else if(!cand.addr) cand.addr=pl.short;
  cand=candClean(cand);
  if(o.merge){
    const have=state.properties.find(l=>l.osm===cand.id); let l=have;
    if(!l){ l=leadFromCand(cand,{src:'address', offer:state.map.offer}); if(o.merge.name) l.name=o.merge.name; state.properties.unshift(l); }
    const v=o.merge; if(v.phone) l.bld.phone=v.phone; if(v.email) l.bld.email=v.email;
    if(v.phone||v.email||v.cn) l.contacts.push({id:uid(), name:v.cn, title:'', email:v.email, phone:v.phone, role:v.cn?'decision':'other', conf:'', src:'You typed it'});
    save(); toast('✓ Lead added with what the map knows'); openLead(l.id); return;
  }
  openCand(cand,{band:'', why:[]});
}
/* a street address for a building that has none (reverse lookup, shown first) */
function lookupAddress(l){
  if(l.lat==null){ toast('This building has no map position yet'); return; }
  if(!state.settings.lookups.on){ toast('Turn on lookups in Settings first'); return; }
  const at=l.lat.toFixed(5)+', '+l.lon.toFixed(5);
  confirmSend({title:'📍 Look up the street address?', intro:'The address search turns the building’s map position into a street address.', hosts:[HOSTS.nominatim], lines:['📍 '+at], payload:at, ok:'Look up'}, async()=>{
    try{
      const j=await fetchJSON('https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat='+l.lat.toFixed(5)+'&lon='+l.lon.toFixed(5),{ms:15000, referrerPolicy:'origin'});
      const a=(j && j.address) || {}, line=[[a.house_number,a.road].filter(Boolean).join(' '), a.city||a.town||a.village, [a.state,a.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', ') || (j && j.display_name) || '';
      if(!line){ toast('No address found at that spot'); return; }
      l.addr=line; save(); toast('📍 Address saved'); refresh();
    }catch(e){ toast('The address search failed: '+netMsg(e)); }
  });
}
ACT['addr-lookup']=el=>{ const l=leadOr(el.dataset.id); if(l) lookupAddress(l); };
