'use strict';
/* IAI Field Sales Dashboard: start-up. */
(function boot(){
  let first=false; try{ first=localStorage.getItem(KEY)===null; }catch(e){}
  const params=new URLSearchParams(location.search);
  /* the very first launch shows labelled demonstration data so the app can be seen working; it clears in one tap */
  if((first && !state.ui.seeded) || params.get('demo')==='1'){ loadDemo(); state.ui.seeded=true; save(); }
  paintNav(); show(state.ui.tab || 'dash');
  if(damagedSave) toast('Your saved data could not be read. A copy was kept and nothing was deleted.', {ms:9000});
  if('serviceWorker' in navigator && location.protocol!=='file:'){ window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{})); }
})();
