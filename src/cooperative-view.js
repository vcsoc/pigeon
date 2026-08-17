(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PigeonCooperativeView=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function build({source,predicate,compare,previewLimit=480,filterChunk=512,runSize=2048,mergeChunk=1024,schedule=(callback)=>setTimeout(callback,0),onPreview=()=>{},onProgress=()=>{},onDone=()=>{}}){
    let cancelled=false,cursor=0,buffer=[],runs=[],matched=0,previewSent=false,queue=[],nextQueue=[],left=null,right=null,leftIndex=0,rightIndex=0,output=null;
    const order=(first,second)=>compare(source[first],source[second]);
    const later=(callback)=>{if(!cancelled)schedule(()=>{if(!cancelled)callback();});};
    const flush=()=>{if(!buffer.length)return;buffer.sort(order);runs.push(buffer);buffer=[];};
    const filter=()=>{let count=0;while(cursor<source.length&&count<filterChunk){const index=cursor++,asset=source[index];if(predicate(asset,index)){buffer.push(index);matched+=1;}count+=1;if(buffer.length>=runSize)flush();}
      if(!previewSent&&matched>=previewLimit){previewSent=true;const candidates=runs.length?[...runs[0],...buffer]:[...buffer];candidates.sort(order);onPreview(candidates.slice(0,previewLimit),{scanned:cursor,matched});}
      onProgress({phase:'filter',scanned:cursor,total:source.length,matched});if(cursor<source.length){later(filter);return;}flush();if(!previewSent){previewSent=true;const candidates=runs.flat();candidates.sort(order);onPreview(candidates.slice(0,previewLimit),{scanned:cursor,matched});}queue=runs;if(!queue.length){onDone([]);return;}later(beginMergePass);};
    const beginMergePass=()=>{if(queue.length===1&&!nextQueue.length){onDone(queue[0]);return;}if(queue.length===1)nextQueue.push(queue.shift());if(queue.length<2){queue=nextQueue;nextQueue=[];later(beginMergePass);return;}left=queue.shift();right=queue.shift();leftIndex=0;rightIndex=0;output=[];later(merge);};
    const merge=()=>{let count=0;while(count<mergeChunk&&leftIndex<left.length&&rightIndex<right.length){if(order(left[leftIndex],right[rightIndex])<=0)output.push(left[leftIndex++]);else output.push(right[rightIndex++]);count+=1;}while(count<mergeChunk&&leftIndex<left.length){output.push(left[leftIndex++]);count+=1;}while(count<mergeChunk&&rightIndex<right.length){output.push(right[rightIndex++]);count+=1;}onProgress({phase:'merge',matched,remainingRuns:queue.length+nextQueue.length+1});if(leftIndex<left.length||rightIndex<right.length){later(merge);return;}nextQueue.push(output);left=right=output=null;later(beginMergePass);};
    later(filter);return{cancel(){cancelled=true;buffer=[];runs=[];queue=[];nextQueue=[];left=right=output=null;},get cancelled(){return cancelled;}};
  }
  return{build};
});
