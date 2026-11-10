'use strict';
/* IAI Field Sales Dashboard: the map.
   A small slippy map in plain JavaScript, no library. Map pictures come from OpenStreetMap only after
   lookups are switched on and only while the Map tab is open. Pan with a finger or mouse, pinch or
   scroll to zoom, tap to drop a pin. Arrow keys move, + and - zoom, Enter pins the middle.
   The pin, circle and numbers are all drawn here: nothing from your leads is ever sent. */
let MAP=null;
function mapDrop(){ if(MAP){ clearTimeout(MAP.saveT); } MAP=null; }
function mapStartView(){
  const M=state.map;
  if(M.view) return M.view;
  if(M.pin) return {lat:M.pin.lat, lon:M.pin.lon, z:12};
  if(state.search.last) return {lat:state.search.last.lat, lon:state.search.last.lon, z:12};
  return {lat:39.5, lon:-98.35, z:4};   // the middle of the US until you choose a place
}
function mapMount(host){
  const v=mapStartView();
  MAP={host, W:320, H:280, lat:v.lat, lon:v.lon, z:v.z, tiles:new Map(), ptrs:new Map(), g:null, ok:0, errs:0, rows:[], saveT:null, onPin:null, onMark:null};
  host.innerHTML='<div class="m-tiles"></div><svg class="m-ov" aria-hidden="true"></svg><div class="m-marks"></div>'+
    '<div class="m-zoom"><button type="button" data-z="1" aria-label="Zoom in">＋</button><button type="button" data-z="-1" aria-label="Zoom out">－</button><button type="button" data-here="1" aria-label="Go to where I am">◎</button></div>'+
    '<div class="m-note" hidden>Map pictures did not load. Check your connection. Searching still works without them.</div><div class="m-attr">© OpenStreetMap contributors</div>';
  MAP.tilesEl=host.querySelector('.m-tiles'); MAP.svg=host.querySelector('.m-ov'); MAP.marksEl=host.querySelector('.m-marks'); MAP.note=host.querySelector('.m-note');
  const rel=e=>{ const r=host.getBoundingClientRect(); return {x:e.clientX-r.left, y:e.clientY-r.top}; };
  const at=(x,y)=>{ const z=MAP.z; return {lat:latAt(mercY(MAP.lat,z)+(y-MAP.H/2), z), lon:lonAt(mercX(MAP.lon,z)+(x-MAP.W/2), z)}; };
  const startPan=(x,y)=>{ MAP.g={mode:'pan', sx:x, sy:y, lat:MAP.lat, lon:MAP.lon, moved:false, t:Date.now()}; };
  const startPinch=()=>{
    const [a,b]=[...MAP.ptrs.values()], mx=(a.x+b.x)/2, my=(a.y+b.y)/2, an=at(mx,my);
    MAP.g={mode:'pinch', d0:Math.max(10,Math.hypot(a.x-b.x,a.y-b.y)), z0:MAP.z, aLat:an.lat, aLon:an.lon, moved:true};
  };
  host.addEventListener('pointerdown',e=>{
    if(e.target.closest('.m-mark,.m-zoom')) return;
    try{ host.setPointerCapture(e.pointerId); }catch(_){}
    const p=rel(e); MAP.ptrs.set(e.pointerId,p);
    if(MAP.ptrs.size===1) startPan(p.x,p.y); else if(MAP.ptrs.size===2) startPinch();
  });
  host.addEventListener('pointermove',e=>{
    if(!MAP.ptrs.has(e.pointerId) || !MAP.g) return;
    const p=rel(e); MAP.ptrs.set(e.pointerId,p); const g=MAP.g;
    if(g.mode==='pan'){
      const dx=p.x-g.sx, dy=p.y-g.sy; if(Math.hypot(dx,dy)>6) g.moved=true;
      if(!g.moved) return;
      const z=MAP.z; MAP.lon=lonAt(mercX(g.lon,z)-dx, z); MAP.lat=Math.max(-82,Math.min(82,latAt(mercY(g.lat,z)-dy, z)));
    }else if(g.mode==='pinch' && MAP.ptrs.size>=2){
      const [a,b]=[...MAP.ptrs.values()], mx=(a.x+b.x)/2, my=(a.y+b.y)/2, d=Math.max(10,Math.hypot(a.x-b.x,a.y-b.y));
      const z=Math.max(2,Math.min(19,g.z0+Math.log2(d/g.d0))); MAP.z=z;
      MAP.lon=lonAt(mercX(g.aLon,z)-(mx-MAP.W/2), z); MAP.lat=Math.max(-82,Math.min(82,latAt(mercY(g.aLat,z)-(my-MAP.H/2), z)));
    }
    mapDraw();
  });
  const end=e=>{
    if(!MAP.ptrs.has(e.pointerId)) return;
    const g=MAP.g, p=MAP.ptrs.get(e.pointerId); MAP.ptrs.delete(e.pointerId);
    if(MAP.ptrs.size===0){
      if(g && g.mode==='pan' && !g.moved && e.type==='pointerup' && Date.now()-g.t<700) mapTap(p.x,p.y);
      MAP.g=null; mapKeepView();
    }else if(MAP.ptrs.size===1){ const q=[...MAP.ptrs.values()][0]; startPan(q.x,q.y); MAP.g.moved=true; }
  };
  host.addEventListener('pointerup',end); host.addEventListener('pointercancel',end);
  host.addEventListener('wheel',e=>{
    e.preventDefault(); const p=rel(e), an=at(p.x,p.y), z=Math.max(2,Math.min(19,MAP.z-e.deltaY*0.0022)); MAP.z=z;
    MAP.lon=lonAt(mercX(an.lon,z)-(p.x-MAP.W/2), z); MAP.lat=Math.max(-82,Math.min(82,latAt(mercY(an.lat,z)-(p.y-MAP.H/2), z))); mapDraw(); mapKeepView();
  },{passive:false});
  host.addEventListener('keydown',e=>{
    const k=e.key, step=80, z=MAP.z; let used=true;
    if(k==='ArrowLeft') MAP.lon=lonAt(mercX(MAP.lon,z)-step,z);
    else if(k==='ArrowRight') MAP.lon=lonAt(mercX(MAP.lon,z)+step,z);
    else if(k==='ArrowUp') MAP.lat=latAt(mercY(MAP.lat,z)-step,z);
    else if(k==='ArrowDown') MAP.lat=latAt(mercY(MAP.lat,z)+step,z);
    else if(k==='+' || k==='=') MAP.z=Math.min(19,Math.round(z)+1);
    else if(k==='-' || k==='_') MAP.z=Math.max(2,Math.round(z)-1);
    else if(k==='Enter'){ mapSetPin(MAP.lat, MAP.lon, ''); }
    else used=false;
    if(used){ e.preventDefault(); mapDraw(); mapKeepView(); }
  });
  host.querySelectorAll('.m-zoom [data-z]').forEach(b=>b.addEventListener('click',()=>{ MAP.z=Math.max(2,Math.min(19,Math.round(MAP.z)+Number(b.dataset.z))); mapDraw(); mapKeepView(); }));
  host.querySelector('[data-here]').addEventListener('click',mapHere);
  mapDraw();
}
function mapTap(x,y){
  const z=MAP.z, lat=latAt(mercY(MAP.lat,z)+(y-MAP.H/2), z), lon=lonAt(mercX(MAP.lon,z)+(x-MAP.W/2), z);
  mapSetPin(lat, lon, '');
}
function mapSetPin(lat, lon, label){
  state.map.pin={lat, lon, label:str(label,80)}; save(); mapDraw();
  if(MAP && MAP.onPin) MAP.onPin();
}
function mapKeepView(){
  if(!MAP) return; clearTimeout(MAP.saveT);
  MAP.saveT=setTimeout(()=>{ if(!MAP) return; state.map.view={lat:MAP.lat, lon:MAP.lon, z:Math.round(MAP.z*100)/100}; save(); }, 450);
}
function mapHere(){
  if(!navigator.geolocation){ toast('This phone can’t share its location here'); return; }
  toast('Asking your phone where you are…');
  navigator.geolocation.getCurrentPosition(pos=>{
    const lat=pos.coords.latitude, lon=pos.coords.longitude;
    if(MAP){ MAP.lat=lat; MAP.lon=lon; MAP.z=Math.max(MAP.z,13); }
    mapSetPin(lat, lon, 'Where I am'); mapKeepView();
  }, ()=>toast('Couldn’t get your location. You can still search an address or tap the map.'), {timeout:9000, maximumAge:60000});
}
/* move the map so a circle of this radius fits comfortably */
function mapFitTo(lat, lon, radius){
  if(!MAP) return;
  const px=Math.max(80, Math.min(MAP.W,MAP.H)*0.42), z=Math.log2(px*156543.03392*Math.cos(lat*Math.PI/180)/Math.max(radius,50));
  MAP.lat=lat; MAP.lon=lon; MAP.z=Math.max(3,Math.min(18,z)); mapDraw(); mapKeepView();
}
function mapDraw(){
  if(!MAP || !MAP.host.isConnected) return;
  const host=MAP.host, W=MAP.W=host.clientWidth||320, H=MAP.H=host.clientHeight||280, z=MAP.z;
  const zt=Math.max(2,Math.min(19,Math.round(z))), s=Math.pow(2,z-zt), n=Math.pow(2,zt);
  const cx=mercX(MAP.lon,zt), cy=mercY(MAP.lat,zt);
  const x0=Math.floor((cx-W/2/s)/256), x1=Math.floor((cx+W/2/s)/256), y0=Math.max(0,Math.floor((cy-H/2/s)/256)), y1=Math.min(n-1,Math.floor((cy+H/2/s)/256));
  const want=new Set();
  for(let ty=y0; ty<=y1; ty++) for(let tx=x0; tx<=x1; tx++){
    const wx=((tx%n)+n)%n, key=zt+'/'+tx+'/'+ty; want.add(key);
    let img=MAP.tiles.get(key);
    if(!img){
      img=new Image(); img.alt=''; img.decoding='async'; img.draggable=false;
      img.addEventListener('load',()=>{ MAP.ok++; img.style.opacity='1'; MAP.note.hidden=true; });
      img.addEventListener('error',()=>{ MAP.errs++; if(MAP.errs>=3 && !MAP.ok) MAP.note.hidden=false; });
      img.style.opacity='0'; img.src='https://tile.openstreetmap.org/'+zt+'/'+wx+'/'+ty+'.png';
      MAP.tilesEl.appendChild(img); MAP.tiles.set(key,img);
    }
    const size=(256*s+0.6)+'px'; img.style.width=size; img.style.height=size;
    img.style.left=(W/2+(tx*256-cx)*s)+'px'; img.style.top=(H/2+(ty*256-cy)*s)+'px';
  }
  MAP.tiles.forEach((img,key)=>{ if(!want.has(key)){ img.remove(); MAP.tiles.delete(key); } });
  const wx0=mercX(MAP.lon,z), wy0=mercY(MAP.lat,z), sx=lon=>W/2+mercX(lon,z)-wx0, sy=lat=>H/2+mercY(lat,z)-wy0, M=state.map;
  MAP.svg.setAttribute('viewBox','0 0 '+W+' '+H);
  let svg='';
  if(M.pin){
    const px=sx(M.pin.lon), py=sy(M.pin.lat), r=M.radius/metersPerPx(M.pin.lat,z);
    svg+='<circle class="m-circ" cx="'+px.toFixed(1)+'" cy="'+py.toFixed(1)+'" r="'+r.toFixed(1)+'"/>'+
         '<circle class="m-pinring" cx="'+px.toFixed(1)+'" cy="'+py.toFixed(1)+'" r="10"/><circle class="m-pin" cx="'+px.toFixed(1)+'" cy="'+py.toFixed(1)+'" r="4.5"/>';
  }
  MAP.svg.innerHTML=svg;
  MAP.marksEl.innerHTML='';
  (MAP.rows||[]).slice(0,60).forEach(r=>{
    const x=sx(r.c.lon), y=sy(r.c.lat); if(x<-20 || y<-20 || x>W+20 || y>H+20) return;
    const b=document.createElement('button'); b.type='button'; b.className='m-mark b-'+r.band+(r.lead?' in':''); b.style.left=x.toFixed(1)+'px'; b.style.top=y.toFixed(1)+'px';
    b.innerHTML='<span>'+r.rank+'</span>'; b.setAttribute('aria-label','Number '+r.rank+': '+(r.c.name||r.c.addr||'building'));
    b.addEventListener('click',ev=>{ ev.stopPropagation(); if(MAP.onMark) MAP.onMark(r); });
    MAP.marksEl.appendChild(b);
  });
}
window.addEventListener('resize',()=>{ if(MAP) mapDraw(); });
