(()=>{
  function apply(){
    let preferences={};try{preferences=JSON.parse(localStorage.getItem('pigeon.preferences')||'{}');}catch{}
    const root=document.documentElement;
    root.dataset.theme=['graphite','midnight'].includes(preferences.theme)?preferences.theme:'dark';
    const family=String(preferences.appFontFamily||'').trim();if(family&&!/[;{}]/.test(family))root.style.setProperty('--app-font-family',family);
    const size=Math.max(8,Math.min(24,Number(preferences.appFontSize)||13));root.style.setProperty('--app-font-size',`${size}px`);root.style.setProperty('--app-font-scale',String(size/12));
  }
  apply();window.addEventListener('storage',event=>{if(event.key==='pigeon.preferences')apply();});
})();
