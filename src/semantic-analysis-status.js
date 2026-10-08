(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.PigeonSemanticAnalysisStatus=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const count=value=>Number.isFinite(Number(value))?Math.max(0,Math.floor(Number(value))):0;
  function describe(status={},starting=false){
    const resources=status.resources||{},total=count(status.total);
    const completed=Math.min(total,count(status.completed??(count(status.indexed)+count(status.limited))));
    const percent=total?Math.round(completed/total*100):0;
    let kind=status.state||'unavailable';
    if(kind!=='error'&&kind!=='setup'&&status.paused)kind='paused';
    else if(starting&&['idle','unavailable'].includes(kind))kind='starting';
    else if(['indexing','waiting'].includes(kind)){
      if(status.mode!=='manual'&&(status.waitReason==='activity'||status.activityPaused||resources.activityBlocked))kind='activity';
      else if(kind==='waiting')kind=status.waitReason?'waiting':'preparing';
    }
    let title,detail=status.detail||'',hint='';
    switch(kind){
      case 'starting':title='Starting analysis…';detail='Your request was received. Checking the local engine before analyzing this scope.';break;
      case 'setup':
        title=/download.*(?:embedding|model)/i.test(detail)?'Downloading the local embedding model…':'Preparing the local engine…';
        hint='First-time setup may download Python, dependencies and the model. It can take several minutes and needs internet access.';break;
      case 'preparing':title='Preparing analysis…';hint='Opening the local engine and checking saved work before the next batch.';break;
      case 'indexing':title='Analyzing files';hint='Working locally. Large files can take time; the file count advances when a file finishes.';break;
      case 'activity':title='Waiting for computer to be idle';hint=`Automatic analysis starts after ${count(status.idleMinutes)||10} minutes of inactivity. Choose Analyze now or Continue to start immediately within your resource cap.`;break;
      case 'waiting':title='Preparing analysis…';hint='Checking saved work before the next batch. Your resource slider caps worker usage; it is not a start requirement.';break;
      case 'paused':title='Analysis paused';hint='Completed work is saved. Choose Continue to resume.';break;
      case 'error':title='Analysis could not continue';hint='Completed work is retained. Resolve the error below, then choose Analyze now to retry.';break;
      case 'idle':
        title=total&&completed===total&&!status.changedItems?'Analysis complete':status.changedItems?'Changes waiting for analysis':'Ready to analyze';
        if(!total)hint='There are no eligible files in this portfolio.';
        break;
      default:title='Local engine not ready';hint='Choose Analyze now to check the engine and prepare missing components.';
    }
    const indeterminate=['starting','setup','preparing'].includes(kind)||kind==='indexing'&&!total;
    const names=Array.isArray(status.activeFiles)?status.activeFiles.filter(Boolean).join(' · '):'';
    const showCurrent=['indexing','preparing','activity','waiting','paused','error'].includes(kind);
    return{
      kind,title,detail,hint,completed,total,percent,indeterminate,
      busy:['starting','setup','preparing','indexing'].includes(kind),
      error:kind==='error'?String(status.error||''):'',
      current:showCurrent&&(names||status.current)?'Current: '+(names||status.current):'',
      scope:status.currentScope?'Scope: '+status.currentScope+(status.analysisPhase==='subfolders'?' (subfolders)':''):'',
      queue:Array.isArray(status.queuedScopes)&&status.queuedScopes.length?'Queued next: '+status.queuedScopes.join(' → '):'',
      barLabel:indeterminate?title:kind==='activity'||kind==='waiting'||kind==='paused'||kind==='error'?`${percent}% saved · ${title}`:`${percent}% · ${completed.toLocaleString()} / ${total.toLocaleString()} files`,
      countLabel:total?`${completed.toLocaleString()} / ${total.toLocaleString()} files analyzed${status.limited?` · ${count(status.limited).toLocaleString()} with content limits`:''}`:kind==='idle'?'No eligible files':'File count will appear when analysis starts'
    };
  }
  return{describe};
});
