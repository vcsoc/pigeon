'use strict';
window.PigeonPortfolioHost = {
  ready: window.pigeon ? Promise.resolve(window.pigeon) : new Promise((resolve,reject)=>{
    if(!window.__TAURI__){reject(new Error('Open Portfolio Manager from the Pigeon desktop app.'));return;}
    const script=document.createElement('script');script.src='tauri-bridge.js';script.onload=()=>resolve(window.pigeon);script.onerror=()=>reject(new Error('The native portfolio bridge could not be loaded.'));document.head.append(script);
  })
};
