'use strict';
/* IAI Field Sales Dashboard: start-up. */
(function boot(){
  let first=false; try{ first=localStorage.getItem(KEY)===null; }catch(e){}
  const params=new URLSearchParams(location.search);
  /* the very first launch shows labelled demonstration data so the app can be seen working; it clears in one tap */
  if(storageBlocked) first=true;
  if((first && !state.ui.seeded) || params.get('demo')==='1'){ loadDemo(); state.ui.seeded=true; save(); }
  paintNav(); show(state.ui.tab || 'dash');
  if(storageBlocked) toast('This view can’t keep your data between visits, so what you change lasts until you close it. Open the app in Safari to keep it.', {ms:12000});
  else if(damagedSave) toast('Your saved data could not be read. A copy was kept and nothing was deleted.', {ms:9000});
  /* offline support is a bonus: a sandboxed or embedded view may refuse even the check, so it never gets to stop the app */
  try{ if('serviceWorker' in navigator && location.protocol!=='file:'){ window.addEventListener('load',()=>{ try{ navigator.serviceWorker.register('sw.js').catch(()=>{}); }catch(e){} }); } }catch(e){}
})();
