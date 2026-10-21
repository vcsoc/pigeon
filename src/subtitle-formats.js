(function(root){
  'use strict';
  const textExtensions=Object.freeze(['SRT','VTT','ASS','SSA','SBV','SMI','SAMI','TTML','DFXP','LRC','SCC','SUB','IDX']);
  const extensions=Object.freeze([...textExtensions.map(extension=>'.'+extension.toLowerCase()),'.sup']);
  const api=Object.freeze({extensions,textExtensions});
  if(typeof module==='object'&&module.exports)module.exports=api;else root.PigeonSubtitleFormats=api;
})(typeof window==='object'?window:globalThis);
