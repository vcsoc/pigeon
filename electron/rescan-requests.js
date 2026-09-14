function createRescanRequests(){
  const requests=new WeakMap();
  return {
    add(location,options={}){const queue=requests.get(location)||[],scope=options.subfolder||'',existing=queue.find(item=>item.subfolder===scope);if(existing){existing.rebuildPreviews=Boolean(existing.rebuildPreviews||options.rebuildPreviews);existing.notify=existing.notify!==false||options.notify!==false;}else{if(queue.length>=256)throw Error('Too many queued folder rescans; wait for the current scan to finish');queue.push({...options,subfolder:scope,resume:false});}requests.set(location,queue);},
    take(location){const queue=requests.get(location),next=queue?.shift();if(!queue?.length)requests.delete(location);return next;},
    has:location=>Boolean(requests.get(location)?.length)
  };
}
function commonScope(first,second){if(first===undefined)return second;const a=String(first).split('/').filter(Boolean),b=String(second).split('/').filter(Boolean);let i=0;while(i<a.length&&i<b.length&&a[i]===b[i])i++;return a.slice(0,i).join('/');}
module.exports={createRescanRequests,commonScope};
