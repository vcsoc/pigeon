(() => {
  const videos=[...document.querySelectorAll('video[data-busy-animation]')];
  let frame=null;
  const refresh=()=>{frame=null;for(const video of videos){video.muted=true;video.defaultMuted=true;video.volume=0;const visible=!document.hidden&&video.isConnected&&video.getClientRects().length>0&&!video.closest('.hidden');if(visible){if(video.paused)video.play().catch(()=>{});}else video.pause();}};
  const schedule=()=>{if(frame===null)frame=requestAnimationFrame(refresh);};
  const observer=new MutationObserver(schedule),ancestors=new Set();
  for(const video of videos){video.muted=true;video.defaultMuted=true;video.volume=0;video.disablePictureInPicture=true;for(let node=video;node;node=node.parentElement)ancestors.add(node);}
  for(const node of ancestors)observer.observe(node,{attributes:true,attributeFilter:['class','hidden','style']});
  document.addEventListener('visibilitychange',refresh);
  refresh();
})();
