'use strict';
/* IAI Field Sales Dashboard: the engine.
   Pure logic only (no page, no saved data). Everything here is computed on the phone.
   Map data comes from OpenStreetMap; nothing is guessed: a missing number is reported as missing. */

/* ---------- plain helpers ---------- */
const num=(v,min,max,def)=>{ v=Number(v); return Number.isFinite(v) ? Math.min(max,Math.max(min,v)) : def; };
const str=(v,n)=>String(v==null?'':v).slice(0,n);
const plural=(n,one,many)=>n+' '+(n===1?one:(many||one+'s'));
const money=n=>(n==null||!Number.isFinite(n)) ? '' : '$'+n.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:2});
const fmt=n=>Number(n).toLocaleString('en-US',{maximumFractionDigits:0});
/* the first number in a typed amount ("$12,400"; "about 9k" is not read) */
const parseMoney=s=>{ const m=String(s||'').replace(/,/g,'').match(/\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : null; };

/* ---------- what the app knows about building kinds ---------- */
const RADII=[[402,'¼ mi'],[805,'½ mi'],[1609,'1 mi'],[3219,'2 mi'],[4828,'3 mi'],[8047,'5 mi'],[16093,'10 mi']];
const TYPES={
  apartments:{label:'Apartments', icon:'🏢', b:['apartments'], tall:['residential','dormitory']},
  hotel:{label:'Hotels', icon:'🏨', b:['hotel','motel'], t:['hotel','motel']},
  office:{label:'Offices', icon:'🏙️', b:['office','commercial']},
  retail:{label:'Retail', icon:'🛍️', b:['retail','supermarket']},
  medical:{label:'Medical', icon:'🏥', b:['hospital','clinic'], a:['hospital','clinic']},
  education:{label:'Schools & campuses', icon:'🎓', b:['school','university','college']},
  civic:{label:'Civic', icon:'🏛️', b:['civic','government','public']}
};
const CATS={
  apartments:{label:'Apartments', icon:'🏢', fit:14, role:'property manager, or the regional manager at the management company'},
  hotel:{label:'Hotel', icon:'🏨', fit:15, role:'general manager or director of engineering'},
  office:{label:'Office', icon:'🏙️', fit:14, role:'property manager or facilities director'},
  retail:{label:'Retail', icon:'🛍️', fit:9, role:'center manager or property manager'},
  medical:{label:'Medical', icon:'🏥', fit:13, role:'facilities or plant operations director'},
  education:{label:'School or campus', icon:'🎓', fit:10, role:'director of facilities'},
  civic:{label:'Civic', icon:'🏛️', fit:8, role:'facilities manager (public buildings often have bid rules)'},
  industrial:{label:'Industrial', icon:'🏭', fit:4, role:'plant or facilities manager'},
  mixed:{label:'Other', icon:'🏗️', fit:8, role:'property manager'}
};
const CAT_KEYS=Object.keys(CATS), TYPE_KEYS=Object.keys(TYPES);
const PRESETS={
  targets:{label:'Hotels, apts, offices, medical', minLevels:3, types:['hotel','apartments','office','medical'], minSqft:5000, unknownLevels:true},
  highrise:{label:'Tall buildings (5+ floors)', minLevels:5, types:[], minSqft:5000, unknownLevels:false},
  apartments:{label:'Apartments', minLevels:3, types:['apartments'], minSqft:5000, unknownLevels:true},
  hotels:{label:'Hotels', minLevels:2, types:['hotel'], minSqft:5000, unknownLevels:true},
  offices:{label:'Offices', minLevels:3, types:['office'], minSqft:5000, unknownLevels:true},
  medical:{label:'Medical', minLevels:2, types:['medical'], minSqft:5000, unknownLevels:true},
  commercial:{label:'All commercial', minLevels:2, types:['office','retail','hotel','apartments','medical','education','civic'], minSqft:10000, unknownLevels:true}
};
const LENS={
  balanced:{label:'Balanced', w:{height:1, size:1, type:1, glass:1, near:1, known:1}},
  biggest:{label:'Biggest jobs', w:{height:1.4, size:1.4, type:.6, glass:1, near:.4, known:.5}},
  fit:{label:'Best fit', w:{height:.8, size:.6, type:1.6, glass:1.5, near:.6, known:1.2}},
  nearest:{label:'Nearest first', w:{height:.6, size:.6, type:.6, glass:.6, near:3.5, known:.6}}
};
const UNITS={
  perimft_floor:'per foot of building edge, per floor',
  floor:'per floor',
  flat:'one flat price',
  sqft:'per sq ft of facade (needs a floor height)'
};
const SCOPE_KEYS=['ext1','int1','upper','all','flat'];
/* which services the "Services" filter on the map switches on for a lead */
const SERVICE_FAMILIES={
  window:{label:'Window cleaning', ids:['s-ext1','s-int1','s-upper']},
  facade:{label:'Facade cleaning', ids:['s-facade','s-upper']},
  inspect:{label:'Inspection', ids:['s-insp']},
  roof:{label:'Roof', ids:['s-roof']},
  mapping:{label:'3D mapping', ids:['s-map']}
};

function defaultServices(){
  /* IAI's commercial drone work comes first: window cleaning, facade cleaning, inspection. No prices are built in: every rate starts empty. */
  const S=(id,name,unit,applies,core,pitch)=>({id, name, unit, applies, core, on:true, rate:null, min:null, pitch:pitch||''});
  return [
    S('s-ext1','Window cleaning: exterior, floor 1','perimft_floor','ext1',true),
    S('s-int1','Window cleaning: interior, floor 1','perimft_floor','int1',true),
    S('s-upper','Window cleaning: floors 2 and up (by drone)','perimft_floor','upper',true),
    S('s-facade','Facade cleaning: mold, algae and grime (by drone)','perimft_floor','all',false,'Restores the look of the building without lifts, scaffolding or rope access.'),
    S('s-insp','Inspection: roof and building envelope, thermal (by drone)','flat','flat',false,'Finds heat loss and trapped moisture early, with a dated photo record.'),
    S('s-roof','Roof cleaning & soft washing','flat','flat',false,'A clean roof lasts longer and looks better from every angle.'),
    S('s-wash','Pressure washing: storefronts, sidewalks, parking, masonry','flat','flat',false,'Entrances and walkways are the first thing visitors see.'),
    S('s-map','3D mapping & site documentation','flat','flat',false,'Accurate models and measurements for planning and facility records.'),
    S('s-solar','Solar panel cleaning (by drone)','flat','flat',false,'Clean panels produce more.'),
    S('s-mkt','Aerial photo & video for marketing','flat','flat',false,'Aerial photos and video of the property for leasing and your website.'),
    S('s-plan','Annual maintenance plan','flat','flat',false,'A set schedule, so the building stays clean without anyone having to remember.')
  ];
}
function defaultPlaybooks(){
  const O=(q,a)=>({q,a});
  return [
    {id:'p-glass', name:'Glass-heavy tower: drone exterior clean', types:['office','hotel','apartments','mixed'], minLevels:5,
      when:'Five or more floors with a lot of glass, where a lift, swing stage or rope crew is the usual way it gets done.',
      solution:'Clean the exterior glass and facade by drone, priced in separate lines: floor 1 outside, floor 1 inside, and floors 2 and up. Walk the site first and agree access, water, a launch area and airspace authorization.',
      pitch:'We clean building exteriors with drones, so there is no lift, scaffold or crew on the facade to schedule around.',
      objections:[O('Is it safe, and are you insured?','Lead with your FAA Part 107 pilot license and your insurance certificate. [add yours]'),O('Will it clean as well as a crew?','Offer a test: one bay or one floor, photographed before and after.'),O('We already have a vendor.','Ask when the contract renews and offer to quote the floors that are hardest to reach.')],
      questions:['Who signs off on exterior cleaning: the owner or the management company?','How often is the glass cleaned now, and by whom?','Are there sides or floors that are hard to reach?','When is the next budget cycle?'],
      services:['s-ext1','s-int1','s-upper','s-facade']},
    {id:'p-apt', name:'Apartment community: one building at a time', types:['apartments'], minLevels:0,
      when:'A community with several buildings or a long exterior to keep up.',
      solution:'Price per building and clean one building per visit, so residents see steady progress and the community can spread the cost over months.',
      pitch:'We can take your community one building at a time, with a price for each, so you can spread the work across the season.',
      objections:[O('The budget is tight.','Quote per building and let them start with the most visible one.'),O('Residents will complain about the noise or disruption.','Share the schedule ahead of time and keep each visit short.'),O('Corporate decides this.','Ask who at the management company approves spend and offer a one-page summary to pass along.')],
      questions:['How many buildings, and how many floors are they?','Is this decided on site or by a regional manager?','When do you want it looking its best, such as leasing season?'],
      services:['s-ext1','s-upper','s-wash']},
    {id:'p-hotel', name:'Hotel: guest-friendly schedule', types:['hotel'], minLevels:0,
      when:'A hotel where guests, events and the pool deck decide when work can happen.',
      solution:'Plan each face of the building around occupancy and events, start with the entrance and street side, and finish before check-in rush.',
      pitch:'We can schedule around your guests and events, starting with the faces people see first.',
      objections:[O('We cannot disrupt guests.','Offer early-morning work on the faces away from the pool and patios.'),O('Brand standards decide our vendors.','Ask for the vendor approval steps and who owns them.')],
      questions:['Who handles exterior vendors: the general manager or engineering?','Are there events or peak weeks to avoid?','Does the brand require approved vendors?'],
      services:['s-ext1','s-upper','s-mkt']},
    {id:'p-medical', name:'Medical campus: low disruption, documented', types:['medical'], minLevels:0,
      when:'Hospitals, clinics and medical offices that need a documented, scheduled process.',
      solution:'Provide a written plan covering schedule, flight areas and safety, and keep the work away from entrances and intake air.',
      pitch:'We can give you a written plan and schedule, and keep the work away from entrances and patient areas.',
      objections:[O('We need vendor credentialing.','Ask for the packet and who reviews it, then send your documents.'),O('Infection control rules.','Ask for their rules in writing and plan around them.')],
      questions:['Who handles vendor credentialing?','Which areas must be avoided, and at what hours?'],
      services:['s-ext1','s-upper','s-insp','s-plan']},
    {id:'p-retail', name:'Storefronts & plazas: recurring first floor', types:['retail','office'], minLevels:0,
      when:'Low-rise retail or office where the first floor is what customers see.',
      solution:'A recurring first-floor outside (and inside, if wanted) clean on a monthly or quarterly schedule, priced as separate lines.',
      pitch:'A recurring clean of the storefront glass keeps the first impression sharp, and you only pay for the floors you choose.',
      objections:[O('Tenants handle their own glass.','Ask who owns the exterior glass and what the lease says.'),O('We only need it now and then.','Offer a one-time price and a recurring price side by side.')],
      questions:['Does the landlord or each tenant pay for glass?','How often is it cleaned now?'],
      services:['s-ext1','s-int1','s-wash','s-plan']},
    {id:'p-campus', name:'Campus or institution: planned around the calendar', types:['education','civic'], minLevels:0,
      when:'Schools, universities and public buildings where breaks, events and bid rules decide timing.',
      solution:'Plan by building around the academic or event calendar, do the work in breaks, and give a written scope and schedule that can go in a bid packet.',
      pitch:'We can plan the work around your calendar, one building at a time, and give you a written scope and schedule for your approval process.',
      objections:[O('Public buildings need bids.','Ask for the bid rules and thresholds, and whether a small first job falls below them.'),O('We cannot disrupt classes.','Offer breaks, weekends and early mornings, and keep the work away from entrances.')],
      questions:['Who handles exterior vendors, and is there a bid threshold?','When are breaks or low-use weeks?','How many buildings are in the campus?'],
      services:['s-ext1','s-upper','s-wash','s-plan']},
    {id:'p-warm', name:'Has a vendor already: keep it warm', types:[], minLevels:0,
      when:'They are happy enough, or locked into a contract.',
      solution:'Do not push. Learn the renewal date, offer a trial on one bay, and follow up on a calm schedule.',
      pitch:'No need to change anything today. I would just like to know when your contract comes up, and I can send a trial price for the hardest-to-reach glass.',
      objections:[O('Not interested.','Thank them, ask when to check back, and put the date on a task.')],
      questions:['When does the current contract renew?','What would make you switch?'],
      services:['s-upper']},
    {id:'p-quote', name:'Sent a quote: close the loop', types:[], minLevels:0,
      when:'A quote is out and nothing has been said for a few days.',
      solution:'Follow up in two days, then a week. Ask who else needs to approve it and offer a site walk.',
      pitch:'I wanted to make sure the quote reached you and see if you have questions. I can walk the site with you if that helps.',
      objections:[O('We are still reviewing.','Ask what they are comparing and when they expect to decide.'),O('The price is high.','Remove lines you can separate, such as interior glass, and requote.')],
      questions:['Who else has to approve this?','When do you plan to decide?'],
      services:[]}
  ];
}

/* ---------- search criteria ---------- */
function critClean(c){
  c=(c && typeof c==='object' && !Array.isArray(c)) ? c : {};
  const base=PRESETS[c.preset] ? PRESETS[c.preset] : PRESETS.highrise;
  return {preset: PRESETS[c.preset] ? c.preset : (c.preset==='custom'?'custom':'highrise'),
    minLevels: Math.round(num(c.minLevels, 0, 99, base.minLevels)),
    types: Array.isArray(c.types) ? [...new Set(c.types.filter(t=>TYPE_KEYS.includes(t)))] : base.types.slice(),
    minSqft: Math.round(num(c.minSqft, 0, 5e6, base.minSqft)),
    unknownLevels: typeof c.unknownLevels==='boolean' ? c.unknownLevels : base.unknownLevels};
}
function critText(crit){
  crit=critClean(crit);
  const bits=[]; bits.push(crit.minLevels>1 ? crit.minLevels+'+ floors' : 'any height');
  bits.push(crit.types.length ? crit.types.map(k=>TYPES[k].label).join(', ') : 'any type');
  if(crit.minSqft) bits.push('footprint '+fmt(crit.minSqft)+'+ sq ft');
  bits.push(crit.unknownLevels ? 'floor count unknown is OK' : 'floor count must be known');
  return bits.join(' · ');
}

/* ---------- geometry ---------- */
const mercX=(lon,z)=>(lon+180)/360*256*Math.pow(2,z);
const mercY=(lat,z)=>{ const s=Math.sin(Math.max(-85,Math.min(85,lat))*Math.PI/180); return (0.5-Math.log((1+s)/(1-s))/(4*Math.PI))*256*Math.pow(2,z); };
const lonAt=(x,z)=>x/(256*Math.pow(2,z))*360-180;
const latAt=(y,z)=>{ const n=Math.PI-2*Math.PI*y/(256*Math.pow(2,z)); return 180/Math.PI*Math.atan(0.5*(Math.exp(n)-Math.exp(-n))); };
const metersPerPx=(lat,z)=>156543.03392*Math.cos(lat*Math.PI/180)/Math.pow(2,z);
function dist(la1,lo1,la2,lo2){   // metres
  const R=6371000, r=Math.PI/180, dLa=(la2-la1)*r, dLo=(lo2-lo1)*r;
  const a=Math.sin(dLa/2)**2+Math.cos(la1*r)*Math.cos(la2*r)*Math.sin(dLo/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(a)));
}
const miles=m=>m/1609.344;
const radLabel=m=>{ const r=RADII.find(x=>x[0]===Math.round(m)); return r ? r[1] : (m/1609.34).toFixed(1)+' mi'; };
/* area (sq ft), edge length (ft) and centre of a building outline */
function ringStats(g){
  g=g.slice(); if(g.length>2 && g[0].lat===g[g.length-1].lat && g[0].lon===g[g.length-1].lon) g.pop();
  if(g.length<3) return null;
  const lat0=g[0].lat, lon0=g[0].lon, kx=111320*Math.cos(lat0*Math.PI/180), ky=110574;
  const P=g.map(p=>[(p.lon-lon0)*kx,(p.lat-lat0)*ky]);
  let a=0, per=0, cx=0, cy=0;
  for(let i=0;i<P.length;i++){ const [x1,y1]=P[i], [x2,y2]=P[(i+1)%P.length], cr=x1*y2-x2*y1; a+=cr; cx+=(x1+x2)*cr; cy+=(y1+y2)*cr; per+=Math.hypot(x2-x1,y2-y1); }
  a/=2;
  let mx, my;
  if(Math.abs(a)>1e-6){ mx=cx/(6*a); my=cy/(6*a); } else { mx=P.reduce((s,p)=>s+p[0],0)/P.length; my=P.reduce((s,p)=>s+p[1],0)/P.length; }
  return {sqft:Math.abs(a)*10.7639, perimFt:per*3.28084, lat:lat0+my/ky, lon:lon0+mx/kx};
}
/* a building outline cut down to at most `max` corners (Douglas–Peucker), as [lat, lon] pairs */
function simplifyRing(g, max){
  max=max||18;
  let pts=g.map(p=>[p.lat,p.lon]);
  if(pts.length>2 && pts[0][0]===pts[pts.length-1][0] && pts[0][1]===pts[pts.length-1][1]) pts.pop();
  if(pts.length<=max) return pts.map(p=>[+p[0].toFixed(6), +p[1].toFixed(6)]);
  const lat0=pts[0][0], kx=111320*Math.cos(lat0*Math.PI/180), ky=110574, Q=pts.map(p=>[p[1]*kx,p[0]*ky]);
  const segd=(p,a,b)=>{ const dx=b[0]-a[0], dy=b[1]-a[1], l=dx*dx+dy*dy; if(!l) return Math.hypot(p[0]-a[0],p[1]-a[1]); const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l)); return Math.hypot(p[0]-(a[0]+t*dx), p[1]-(a[1]+t*dy)); };
  const dp=(lo,hi,tol,keep)=>{ let m=0, idx=-1; for(let i=lo+1;i<hi;i++){ const d=segd(Q[i],Q[lo],Q[hi]); if(d>m){ m=d; idx=i; } } if(m>tol && idx>0){ keep.add(idx); dp(lo,idx,tol,keep); dp(idx,hi,tol,keep); } };
  let tol=0.5, keep;
  for(let k=0;k<14;k++){ keep=new Set([0,Q.length-1]); dp(0,Q.length-1,tol,keep); if(keep.size<=max) break; tol*=1.7; }
  return [...keep].sort((a,b)=>a-b).map(i=>[+pts[i][0].toFixed(6), +pts[i][1].toFixed(6)]);
}
/* the outline drawn as a small picture: returns {d (svg path), w, h, ft} */
function outlinePath(outline, W, H, pad){
  if(!Array.isArray(outline) || outline.length<3) return null;
  pad=pad==null?14:pad;
  const lat0=outline[0][0], kx=111320*Math.cos(lat0*Math.PI/180), ky=110574, P=outline.map(p=>[p[1]*kx,-p[0]*ky]);
  const xs=P.map(p=>p[0]), ys=P.map(p=>p[1]), x0=Math.min(...xs), x1=Math.max(...xs), y0=Math.min(...ys), y1=Math.max(...ys), w=Math.max(1,x1-x0), h=Math.max(1,y1-y0);
  const s=Math.min((W-2*pad)/w,(H-2*pad)/h), ox=(W-w*s)/2-x0*s, oy=(H-h*s)/2-y0*s;
  return {d:'M'+P.map(p=>(p[0]*s+ox).toFixed(1)+' '+(p[1]*s+oy).toFixed(1)).join('L')+'Z', ft:Math.round(w*3.28084), scale:s};
}

/* ---------- the building search: what is asked, and what comes back ---------- */
/* floors >= s, as a pattern Overpass can match against the tag text (digits only, no escapes) */
function levelsRe(s){
  s=Math.max(1,Math.min(99,Math.floor(s)));
  if(s<=9) return '^('+(s===9?'9':'['+s+'-9]')+'|[1-9][0-9]+)([.][0-9]+)?$';
  const t=Math.floor(s/10), u=s%10, alt=[];
  if(t<9) alt.push('['+(t+1)+'-9][0-9]');
  alt.push(u===0 ? t+'[0-9]' : t+'['+u+'-9]');
  alt.push('[1-9][0-9]{2,}');
  return '^('+alt.join('|')+')([.][0-9]+)?$';
}
function buildQuery(lat, lon, r, crit){
  crit=critClean(crit);
  const A='(around:'+Math.round(r)+','+lat.toFixed(5)+','+lon.toFixed(5)+')';
  const types=crit.types.length ? crit.types : TYPE_KEYS, plain=new Set(), tall=new Set(), tour=new Set(), amen=new Set();
  types.forEach(k=>{ const d=TYPES[k]; if(!d) return; d.b.forEach(v=>plain.add(v)); (d.tall||[]).forEach(v=>tall.add(v)); (d.t||[]).forEach(v=>tour.add(v)); (d.a||[]).forEach(v=>amen.add(v)); });
  const lv=levelsRe(Math.max(2,crit.minLevels||2)), lv3=levelsRe(3), P=[];
  const both=sel=>{ P.push('way'+sel+A+';'); P.push('relation'+sel+A+';'); };
  if(plain.size) both('["building"~"^('+[...plain].join('|')+')$"]');
  if(tall.size) both('["building"~"^('+[...tall].join('|')+')$"]["building:levels"~"'+lv3+'"]');
  if(tour.size) P.push('way["tourism"~"^('+[...tour].join('|')+')$"]["building"]'+A+';');
  if(amen.size) P.push('way["amenity"~"^('+[...amen].join('|')+')$"]["building"]'+A+';');
  if(!crit.types.length || crit.minLevels>=5) P.push('way["building"]["building:levels"~"'+lv+'"]'+A+';');
  return '[out:json][timeout:25];\n(\n  '+P.join('\n  ')+'\n)->.b;\n.b out geom;\nnwr["aeroway"~"^(aerodrome|heliport)$"](around:'+Math.round(r+16000)+','+lat.toFixed(5)+','+lon.toFixed(5)+');\nout center tags;';
}
/* The same search as buildQuery, as TWO polite requests: one for the buildings (every wanted kind in one query,
   exact tag values so the server can use its index) and one small one for airports. Fewer, lighter requests is
   what the public server asks for; losing the airport request only loses the airport distance. */
function buildQueries(lat, lon, r, crit){
  crit=critClean(crit);
  const A='(around:'+Math.round(r)+','+lat.toFixed(5)+','+lon.toFixed(5)+')', types=crit.types.length ? crit.types : TYPE_KEYS, lv3=levelsRe(3);
  const ex=(k,v)=>'["'+k+'"="'+v+'"]', plain=new Set(), tall=new Set(), tour=new Set(), amen=new Set(), P=[];
  types.forEach(k=>{ const d=TYPES[k]; if(!d) return; d.b.forEach(v=>plain.add(v)); (d.tall||[]).forEach(v=>tall.add(v)); (d.t||[]).forEach(v=>tour.add(v)); (d.a||[]).forEach(v=>amen.add(v)); });
  plain.forEach(v=>{ P.push('way'+ex('building',v)+A+';'); P.push('relation'+ex('building',v)+A+';'); });
  tall.forEach(v=>{ ['way','relation'].forEach(w=>P.push(w+ex('building',v)+'["building:levels"~"'+lv3+'"]'+A+';')); });
  tour.forEach(v=>P.push('way'+ex('tourism',v)+'["building"]'+A+';'));
  amen.forEach(v=>P.push('way'+ex('amenity',v)+'["building"]'+A+';'));
  if(!crit.types.length || crit.minLevels>=5) P.push('way["building"]["building:levels"~"'+levelsRe(Math.max(2,crit.minLevels||2))+'"]'+A+';');
  return [
    {label:'Buildings', q:'[out:json][timeout:45];\n(\n  '+P.join('\n  ')+'\n)->.b;\n.b out geom;'},
    {label:'Airports', optional:true, q:'[out:json][timeout:25];\nnwr["aeroway"~"^(aerodrome|heliport)$"](around:'+Math.round(r+16000)+','+lat.toFixed(5)+','+lon.toFixed(5)+');\nout center tags;'}
  ];
}
/* the requests as one block of text (what the owner reads first), and back into requests */
function joinQueries(parts){ return parts.map((x,i)=>'// ---- request '+(i+1)+' of '+parts.length+': '+x.label+' ----\n'+x.q).join('\n\n'); }
function splitQueries(text){
  const bits=String(text).split(/^\/\/ ---- request \d+ of \d+: (.*?) ----$/m), out=[];
  if(bits.length<3) return [{label:'Buildings', q:String(text).trim()}];
  for(let i=1;i<bits.length;i+=2){ const q=(bits[i+1]||'').trim(); if(q) out.push({label:bits[i], optional:bits[i]==='Airports', q}); }
  return out;
}
/* the one-building query used when you research an address */
function buildQueryAt(lat, lon){
  return '[out:json][timeout:20];\n(\n  way["building"](around:45,'+lat.toFixed(5)+','+lon.toFixed(5)+');\n  relation["building"](around:45,'+lat.toFixed(5)+','+lon.toFixed(5)+');\n)->.b;\n.b out geom;\nnwr["aeroway"~"^(aerodrome|heliport)$"](around:16000,'+lat.toFixed(5)+','+lon.toFixed(5)+');\nout center tags;';
}
function categoryOf(t, levels){
  const b=String(t.building||'').toLowerCase();
  if(b==='apartments') return 'apartments';
  if((b==='residential'||b==='dormitory')) return (levels!=null && levels>=3) ? 'apartments' : 'mixed';
  if(['hotel','motel'].includes(b) || ['hotel','motel'].includes(t.tourism)) return 'hotel';
  if(['hospital','clinic'].includes(b) || ['hospital','clinic'].includes(t.amenity) || t.healthcare) return 'medical';
  if(['school','university','college','kindergarten'].includes(b) || ['school','university','college'].includes(t.amenity)) return 'education';
  if(['civic','government','public','townhall'].includes(b)) return 'civic';
  if(['retail','supermarket','kiosk'].includes(b) || t.shop==='mall') return 'retail';
  if(['office','commercial'].includes(b) || t.office) return 'office';
  if(['industrial','warehouse','factory'].includes(b)) return 'industrial';
  return 'mixed';
}
function addrOf(t){
  const street=[t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' '), city=t['addr:city'], rest=[t['addr:state'], t['addr:postcode']].filter(Boolean).join(' ');
  return [street, city, rest].filter(Boolean).join(', ');
}
/* an OpenStreetMap answer becomes candidates. Everything here is read from the map data. */
function parseOverpass(json, opt){
  const els=(json && Array.isArray(json.elements)) ? json.elements : [], items=[], air=[];
  els.slice(0,6000).forEach(el=>{
    const t=el.tags||{};
    if(t.aeroway){ const c=el.center||(el.lat!=null?{lat:el.lat,lon:el.lon}:null); if(c) air.push({lat:c.lat, lon:c.lon, name:t.name||t.aeroway}); return; }
    if(!t.building || t.building==='no') return;
    let g=null;
    if(el.type==='way' && Array.isArray(el.geometry)) g=el.geometry;
    else if(el.type==='relation' && Array.isArray(el.members)){ const o=el.members.filter(m=>m.type==='way' && m.role!=='inner' && Array.isArray(m.geometry)).sort((a,b)=>b.geometry.length-a.geometry.length)[0]; g=o?o.geometry:null; }
    const ring=g && g.length>=3 ? ringStats(g) : null; if(!ring) return;
    const lv=parseFloat(t['building:levels']), levels=(Number.isFinite(lv) && lv>=1 && lv<=200) ? Math.floor(lv) : null;
    const h=parseFloat(t.height), height=(Number.isFinite(h) && h>0 && h<900) ? h : null;
    const gl=[t['building:facade:material'], t['building:cladding'], t['building:material'], t['building:facade'], t['building:structure']].join(' ').toLowerCase();
    const it={id:(el.type==='relation'?'r':'w')+el.id, name:str(t.name||t.brand||'',120), addr:addrOf(t), lat:ring.lat, lon:ring.lon, levels, height, sqft:Math.round(ring.sqft), perimFt:Math.round(ring.perimFt),
      cat:categoryOf(t, levels), btype:str(t.building,40), glass:/glass|curtain/.test(gl), op:str(t.operator||'',80), web:str(t.website||t['contact:website']||'',200),
      phone:str(t.phone||t['contact:phone']||'',40), email:str(t.email||t['contact:email']||'',120), approx:el.type==='relation', outline:simplifyRing(g,18)};
    if(opt && opt.keepGeom) it._g=g;
    items.push(it);
  });
  items.forEach(c=>{
    let best=null; air.forEach(a=>{ const d=miles(dist(c.lat,c.lon,a.lat,a.lon)); if(!best || d<best.mi) best={mi:d, name:a.name}; });
    if(best && best.mi<=8) c.air={mi:Math.round(best.mi*10)/10, name:str(best.name,80)};
  });
  return {items, air};
}
/* a candidate as it is kept in the save: every field checked */
function candClean(x){
  if(!x || typeof x!=='object' || !x.id) return null;
  const la=Number(x.lat), lo=Number(x.lon); if(!(Math.abs(la)<=90 && Math.abs(lo)<=180)) return null;
  const o={id:str(x.id,40), name:str(x.name,120), addr:str(x.addr,200), lat:la, lon:lo,
    levels: x.levels==null ? null : Math.round(num(x.levels,1,200,1)), height: x.height==null ? null : num(x.height,1,900,null),
    sqft: Math.round(num(x.sqft,0,1e7,0)), perimFt: Math.round(num(x.perimFt,0,1e6,0)), cat: CAT_KEYS.includes(x.cat)?x.cat:'mixed', btype:str(x.btype,40),
    glass: x.glass===true, op:str(x.op,80), web:str(x.web,200), phone:str(x.phone,40), email:str(x.email,120), approx:x.approx===true, point:x.point===true};
  if(Array.isArray(x.outline)) o.outline=x.outline.slice(0,24).map(p=>Array.isArray(p)?[num(p[0],-90,90,0),num(p[1],-180,180,0)]:null).filter(Boolean);
  if(x.air && typeof x.air==='object' && Number.isFinite(Number(x.air.mi))) o.air={mi:Math.round(Number(x.air.mi)*10)/10, name:str(x.air.name,80)};
  return o;
}
/* what you asked for, applied to what came back */
function keepCand(c, crit){
  crit=critClean(crit);
  if(crit.minLevels>1 && (c.levels!=null ? c.levels<crit.minLevels : !crit.unknownLevels)) return false;
  if(crit.types.length && !crit.types.includes(c.cat)) return false;
  if(c.sqft<crit.minSqft && !(c.levels!=null && c.levels>=5)) return false;
  return true;
}

/* ---------- who to reach first: a reading order with reasons, not points ---------- */
function scoreCand(c, lens, pin, radius){
  const w=(LENS[lens]||LENS.balanced).w, comp={}, why=[], lv=c.levels;
  comp.height = lv!=null ? (lv>=20?40: lv>=12?34: lv>=8?28: lv>=5?20: lv>=3?10:3) : (c.sqft>=100000?14: c.sqft>=40000?10:6);
  comp.size = c.sqft>=150000?15: c.sqft>=60000?12: c.sqft>=25000?9: c.sqft>=10000?6: c.sqft>=4000?3:0;
  comp.type = (CATS[c.cat]||CATS.mixed).fit;
  comp.glass = c.glass ? 10 : 0;
  const d = pin ? dist(pin.lat,pin.lon,c.lat,c.lon) : null;
  comp.near = d==null ? 0 : Math.round(10*Math.max(0, 1-d/Math.max(radius,1)));
  comp.known = (c.name?3:0)+(c.addr?2:0);
  let score=0; Object.keys(comp).forEach(k=>{ score+=comp[k]*(w[k]||1); });
  if(lv!=null) why.push(plural(lv,'floor')+(lv>=8?', a tall one':'')); else why.push('floor count not on the map: check it');
  if(c.sqft>=25000) why.push('big footprint (about '+fmt(Math.round(c.sqft/1000)*1000)+' sq ft)');
  if(c.cat!=='mixed') why.push((CATS[c.cat]||{}).label.toLowerCase());
  if(c.glass) why.push('glass tagged on the map');
  if(d!=null && d<=radius*0.35) why.push(miles(d).toFixed(1)+' mi from your pin');
  if(c.air && c.air.mi<=5) why.push('airport '+c.air.mi+' mi away: check airspace');
  return {score, comp, why, dist:d};
}
function rankCands(items, lens, pin, radius){
  const rows=items.map(c=>{ const s=scoreCand(c, lens, pin, radius); return {c, score:s.score, why:s.why, dist:s.dist}; });
  rows.sort((a,b)=>b.score-a.score || (b.c.sqft-a.c.sqft) || (a.c.id<b.c.id?-1:1));
  const n=rows.length;
  rows.forEach((r,i)=>{ r.rank=i+1; r.band = i < Math.max(1,Math.ceil(n*0.2)) ? 'High' : i < Math.ceil(n*0.6) ? 'Medium' : 'Lower'; });
  return rows;
}

/* ---------- a quote from what the map says: separate lines, nothing guessed ---------- */
function scopeBand(applies, L){
  if(applies==='ext1' || applies==='int1') return {floors:1, label:'Floor 1'};
  if(applies==='upper') return L==null ? {floors:null, label:'Floors 2 and up'} : (L>=2 ? {floors:L-1, label: L===2?'Floor 2':'Floors 2–'+L} : null);
  if(applies==='all') return {floors:L, label: L==null?'All floors':'All '+L+' floors'};
  return {floors:null, label:''};
}
/* b = {stories, perimFt}; services = the owner's list; sel = Set of service ids */
function quoteCalc(b, services, sel, floorFt){
  const L=(b.stories!=null && b.stories>0) ? Math.floor(b.stories) : null, perim=(b.perimFt>0) ? b.perimFt : null, lines=[];
  services.forEach(s=>{
    if(!sel.has(s.id)) return;
    const band=scopeBand(s.applies, L); if(!band) return;
    const unit=s.applies==='flat' ? 'flat' : s.unit, fl=band.floors;
    let qty=null, qlabel='', need=null;
    if(unit==='flat'){ qty=1; qlabel='one price'; }
    else if(unit==='floor'){ if(fl!=null){ qty=fl; qlabel=plural(fl,'floor'); } else need='floors'; }
    else if(unit==='perimft_floor'){ if(fl!=null && perim!=null){ qty=Math.round(perim*fl); qlabel=fmt(perim)+' ft of edge × '+plural(fl,'floor'); } else need = fl==null ? 'floors' : 'edge'; }
    else if(unit==='sqft'){ if(fl!=null && perim!=null && floorFt){ qty=Math.round(perim*fl*floorFt); qlabel=fmt(perim)+' ft × '+plural(fl,'floor')+' × '+floorFt+' ft'; } else need = !floorFt ? 'floor height' : (fl==null ? 'floors' : 'edge'); }
    let amount=null;
    if(qty!=null && s.rate!=null) amount=Math.round(Math.max(s.min||0, qty*s.rate)*100)/100;
    else if(qty!=null && s.rate==null && !need) need='rate';
    lines.push({id:s.id, name:s.name, core:!!s.core, band:band.label, scope:s.applies, unit, qty, qlabel, rate:s.rate, min:s.min, amount, need, pitch:s.pitch||''});
  });
  const sum=a=>a.reduce((t,l)=>t+(l.amount||0),0);
  const core=lines.filter(l=>l.core), extra=lines.filter(l=>!l.core);
  return {lines, core, extra, coreTotal:sum(core), extraTotal:sum(extra), total:sum(lines), missing:lines.filter(l=>l.amount==null).length, priced:lines.filter(l=>l.amount!=null).length,
    coreAllPriced: core.length>0 && core.every(l=>l.amount!=null), allPriced: lines.length>0 && lines.every(l=>l.amount!=null)};
}
/* ---------- a quote from the customer's request: ✨ suggestions read from their own words, nothing applied until ticked ----------
   Runs on the phone with plain rules. Nothing is sent anywhere, nothing is guessed: every suggestion carries the words it came from. */
const REQ_WORDS=[
  ['s-ext1', /\b(windows?|glass|glazing|curtain ?wall)\b/i],
  ['s-upper', /\b(windows?|glass|glazing|curtain ?wall|high[- ]rise|tall|upper floors?)\b/i],
  ['s-int1', /\b(interior|inside)\b[^.]{0,40}\b(windows?|glass)\b|\b(windows?|glass)\b[^.]{0,40}\b(interior|inside)\b/i],
  ['s-facade', /\b(fa[cç]ade|mold|mould|algae|grime|stains?|staining|brick|stucco|siding|exterior walls?|building wash)\b/i],
  ['s-insp', /\b(inspect\w*|thermal|infrared|leaks?|moisture|heat loss|envelope)\b/i],
  ['s-roof', /\broof\w*\b/i],
  ['s-wash', /\b(pressure[- ]?wash\w*|power[- ]?wash\w*|soft[- ]?wash\w*|sidewalks?|walkways?|parking (?:lot|garage|deck)|entrances?|storefronts?|masonry|dumpster pad)\b/i],
  ['s-map', /\b(3d|mapping|site model|documentation|progress photos?|survey|measurements?)\b/i],
  ['s-solar', /\bsolar\b|\bpanels?\b/i],
  ['s-mkt', /\b(marketing|promo\w*|aerial (?:photos?|video)|drone (?:photos?|video)|leasing photos?)\b/i],
  ['s-plan', /\b(maintenance (?:plan|program|contract)|recurring|contract|monthly|quarterly|annual\w*|yearly|twice a year|semi-?annual\w*|every (?:\d+ )?(?:weeks?|months?|quarters?|years?)|each (?:month|quarter|year))\b/i]
];
const REQ_FREQ=[['weekly',/\bweekly\b|\bevery week\b/i],['monthly',/\bmonthly\b|\bevery month\b|\beach month\b/i],['quarterly',/\bquarterly\b|\bevery quarter\b|\bevery 3 months\b|\beach quarter\b/i],
  ['twice a year',/\btwice a year\b|\bsemi-?annual\w*\b|\bevery 6 months\b|\bevery six months\b/i],['once a year',/\bannual(?:ly)?\b|\byearly\b|\bonce a year\b|\bevery year\b|\beach year\b/i],['one time',/\bone[- ]time\b|\bonce\b|\bjust once\b/i]];
const REQ_MONTHS='jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
function readRequest(text, services){
  text=String(text||'').replace(/\s+/g,' ').trim().slice(0,2000); const out={services:[], stories:null, storiesWhy:'', freq:'', freqWhy:'', dates:[]};
  if(!text) return out;
  const W={single:1,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12}, m=text.match(/\b(\d{1,2}|single|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)[\s-]*(?:stor(?:y|ies)|floors?|levels?)\b/i);
  if(m){ const n=/^\d/.test(m[1]) ? parseInt(m[1],10) : W[m[1].toLowerCase()]; if(n>=1 && n<=99){ out.stories=n; out.storiesWhy=m[0]; } }
  const ids=new Set((services||[]).map(s=>s.id)), nameOf=id=>((services||[]).find(s=>s.id===id)||{}).name||id, hit={};
  REQ_WORDS.forEach(([id,re])=>{ const x=text.match(re); if(x && ids.has(id)) hit[id]=x[0]; });
  /* "windows" asks for the exterior lines; the upper-floor line only when the building has floors above the first (or the floors are not known) */
  if(hit['s-upper'] && out.stories!=null && out.stories<2 && !/\b(high[- ]rise|tall|upper floors?)\b/i.test(text)) delete hit['s-upper'];
  if(hit['s-int1'] && hit['s-ext1'] && !/\b(exterior|outside|outer)\b/i.test(text)) delete hit['s-ext1'];
  if(hit['s-solar'] && !/\bsolar\b/i.test(text)) delete hit['s-solar'];
  Object.keys(hit).forEach(id=>out.services.push({id, name:nameOf(id), why:hit[id]}));
  for(const [f,re] of REQ_FREQ){ const x=text.match(re); if(x){ out.freq=f; out.freqWhy=x[0]; break; } }
  const seen=new Set(), add=s=>{ const k=s.toLowerCase(); if(!seen.has(k) && out.dates.length<6){ seen.add(k); out.dates.push(s); } };
  (text.match(new RegExp('\\b(?:'+REQ_MONTHS+')\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s*\\d{4})?','gi'))||[]).forEach(add);
  (text.match(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g)||[]).forEach(add);
  (text.match(/\b(?:before|by|after|until|during|in)\s+(?:the\s+)?(?:spring|summer|fall|autumn|winter|grand opening|holidays?|event|conference|season)\b/gi)||[]).forEach(add);
  return out;
}
function lineText(l){
  if(l.amount==null) return '• '+l.name+(l.band?' ('+l.band+')':'')+': '+(l.need==='rate' ? 'rate needed' : l.need ? l.need+' needed' : 'to be priced');
  return '• '+l.name+(l.band?' ('+l.band+')':'')+': '+(l.unit==='flat' ? money(l.amount) : l.qlabel+' @ '+money(l.rate)+' = '+money(l.amount));
}

/* ---------- solutions: which ready-made answers fit this building ---------- */
function solutionsFor(playbooks, cat, levels){
  const out=[];
  playbooks.forEach(p=>{
    let s=0;
    if(p.types.length){
      if(!p.types.includes(cat)) return;
      if(p.minLevels && levels!=null && levels<p.minLevels) return;
      s=2-(p.minLevels && levels==null ? 1 : 0);
    }
    out.push({p, s});
  });
  out.sort((a,b)=>b.s-a.s);
  return out.map(x=>x.p);
}

/* ---------- county parcel records: free public records a county publishes (Cuyahoga first) ----------
   Only the building's map position is sent. What comes back is labelled "county record" and is never
   put in the owner fact until the person taps "Use as owner". */
const COUNTIES={
  cuyahoga:{name:'Cuyahoga County', host:'gis.cuyahogacounty.gov', box:[41.10,-82.00,41.65,-81.25],
    layers:[['https://gis.cuyahogacounty.gov/server/rest/services/Open_Data_Parcels/MapServer/1','parcels outside Cleveland'],
            ['https://gis.cuyahogacounty.gov/server/rest/services/Open_Data_Parcels/MapServer/0','parcels inside Cleveland']]}
};
function countyFor(lat, lon){
  lat=Number(lat); lon=Number(lon); if(!Number.isFinite(lat) || !Number.isFinite(lon)) return '';
  return Object.keys(COUNTIES).find(k=>{ const b=COUNTIES[k].box; return lat>=b[0] && lat<=b[2] && lon>=b[1] && lon<=b[3]; }) || '';
}
function countyQuery(lat, lon){
  return 'f=json&geometry='+Number(lon).toFixed(6)+','+Number(lat).toFixed(6)+'&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=false&resultRecordCount=10';
}
function countyRecClean(r){
  if(!r || typeof r!=='object') return null;
  const n=v=>{ v=Number(v); return Number.isFinite(v) && v>0 ? Math.round(v) : null; };
  const o={pin:str(r.pin,20), owner:str(r.owner,120), mailTo:str(r.mailTo,200), site:str(r.site,120), luc:str(r.luc,6), lucText:str(r.lucText,40), zoning:str(r.zoning,8),
    comBldgs:n(r.comBldgs), comArea:n(r.comArea), units:n(r.units), resArea:n(r.resArea), saleTs:n(r.saleTs), saleAmt:n(r.saleAmt), taxYear:n(r.taxYear)};
  return (o.pin || o.owner) ? o : null;
}
function parseCounty(json){
  const fs=(json && Array.isArray(json.features)) ? json.features : [];
  return fs.slice(0,10).map(f=>{
    const a={}, src=(f && f.attributes && typeof f.attributes==='object') ? f.attributes : {}; Object.keys(src).forEach(k=>{ a[k.toLowerCase()]=src[k]; });
    const owner=str(a.deeded_owner,120).trim(), mname=str(a.mail_name,109).trim();
    const street=[a.mail_addr_street,a.mail_unit].map(x=>str(x,50).trim()).filter(Boolean).join(' '), city=[a.mail_city,a.mail_state].map(x=>str(x,30).trim()).filter(Boolean).join(', ');
    const mail=[mname && mname.toLowerCase()!==owner.toLowerCase() ? mname : '', street, (city+' '+str(a.mail_zip,10).trim()).trim()].filter(Boolean).join(' · ');
    return countyRecClean({pin:a.parcelpin||a.parcel_id, owner, mailTo:mail, site:a.par_addr_all, luc:a.tax_luc, lucText:a.tax_luc_description, zoning:a.zoning_code,
      comBldgs:a.com_bldg_count, comArea:a.total_com_use_area, units:a.com_living_units, resArea:a.total_res_liv_area, saleTs:a.transfer_date, saleAmt:a.sales_amount, taxYear:a.tax_year});
  }).filter(Boolean);
}

/* ---------- how much to show: switches that make the screens simpler or fuller ----------
   [key, group, label, hint, simple, more, everything]. Simple is where a fresh install starts. */
const DETAIL=[
  ['addr','cards','Street address','Under each building name',1,1,1],
  ['facts','cards','Type, floors and size','Hotel · 6 floors · 52,000 sq ft',1,1,1],
  ['band','cards','High, Medium or Lower','How worth reaching the map says a building is',1,1,1],
  ['stage','cards','Stage tag','Where a lead is in your pipeline',1,1,1],
  ['next','cards','Next action','The next thing to do on a lead',1,1,1],
  ['last','cards','Last contact','When you last spoke or visited',0,1,1],
  ['value','cards','Estimated value','Only from a quote, or what you typed',0,1,1],
  ['why','cards','✨ Why it ranks there','One short reason from the map',0,1,1],
  ['owner','cards','Owner','When you typed one, or took it from the county record',0,0,1],
  ['summary','results','Search explanation','The counts, the paragraph and “Rank by” under the map',0,1,1],
  ['outline','review','Building outline','The shape of the building, from the map',1,1,1],
  ['askWhy','review','Ask why when I pass','One tap to say why. You can skip it',0,0,1],
  ['kpis','home','Number tiles','Active opportunities, follow-ups, quotes out, projected revenue',0,1,1],
  ['terr','home','Territory sketch','The dots picture of your last search',0,1,1],
  ['funnel','home','Pipeline snapshot','Your stages as bars',0,1,1]];
const DETAIL_KEYS=DETAIL.map(d=>d[0]);
const DETAIL_GROUPS=[['home','On My Field Day'],['cards','On building cards'],['results','Map results'],['review','Swipe review']];
const DETAIL_PRESETS=[['simple','Simple',4],['more','More',5],['all','Everything',6]];
function detailPreset(name){ const p=DETAIL_PRESETS.find(x=>x[0]===name)||DETAIL_PRESETS[0], o={}; DETAIL.forEach(d=>{ o[d[0]]=d[p[2]]===1; }); return o; }
/* whatever was saved, made safe: a missing or odd switch falls back to Simple */
function detailClean(x){
  x=(x && typeof x==='object' && !Array.isArray(x))?x:{}; const o={}, old=DETAIL_KEYS.slice(0,12);
  /* a save from before the Home switches existed has the first twelve: the new ones follow the preset those twelve match, else Simple */
  let base=detailPreset('simple'); if(old.every(k=>typeof x[k]==='boolean')){ for(const p of DETAIL_PRESETS){ const q=detailPreset(p[0]); if(old.every(k=>q[k]===x[k])){ base=q; break; } } }
  DETAIL_KEYS.forEach(k=>{ o[k]=typeof x[k]==='boolean'?x[k]:base[k]; }); return o;
}
function detailName(s){ s=detailClean(s); for(const p of DETAIL_PRESETS){ const q=detailPreset(p[0]); if(DETAIL_KEYS.every(k=>q[k]===s[k])) return p[0]; } return 'custom'; }

/* ---------- swipe review: the three choices, and a building's outline as a small picture ---------- */
const REVIEW_CHOICES=[['pursue','Pursue'],['investigate','Investigate'],['pass','Pass']];
const PASS_REASONS=['Too small','Wrong type','Not a fit for drone work','Already a client','Too far','Something else'];
