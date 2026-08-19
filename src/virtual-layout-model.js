(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PigeonVirtualLayout=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const clamp=(value,minimum,maximum)=>Math.max(minimum,Math.min(maximum,Number(value)||0));
  const ratio=(value)=>clamp(value||1.32,.35,3.5);
  function ratioHash(ratios){let hash=2166136261;for(const value of ratios){hash^=Math.round(ratio(value)*1000);hash=Math.imul(hash,16777619);}return(hash>>>0).toString(36);}
  function build({mode='grid',width=1,cardWidth=240,gap=4,metaHeight=28,ratios=[]}={}){
    width=Math.max(1,Number(width)||1);cardWidth=Math.max(48,Math.min(width,Number(cardWidth)||240));gap=Math.max(0,Number(gap)||0);metaHeight=Math.max(0,Number(metaHeight)||0);ratios=Array.from(ratios,ratio);
    const items=[],targetHeight=clamp(cardWidth*.58,52,320),columns=mode==='list'?1:Math.max(1,Math.floor((width+gap)/(cardWidth+gap)));
    if(mode==='list')for(let index=0;index<ratios.length;index++)items.push({index,x:0,y:index*62,width,height:59,previewHeight:49});
    else if(mode==='justified'){
      let index=0,y=0;
      while(index<ratios.length){const start=index,row=[];let sum=0;while(index<ratios.length){const next=ratios[index];row.push(next);sum+=next;index+=1;if(sum*targetHeight+gap*(row.length-1)>=width)break;}
        const final=index===ratios.length,available=Math.max(1,width-gap*(row.length-1)),rowHeight=final?targetHeight:clamp(available/sum,targetHeight*.68,targetHeight*1.24);let x=0;
        for(let offset=0;offset<row.length;offset++){const last=offset===row.length-1,itemWidth=last&&!final?Math.max(1,width-x):Math.max(1,rowHeight*row[offset]);items.push({index:start+offset,x,y,width:itemWidth,height:rowHeight+metaHeight,previewHeight:rowHeight});x+=itemWidth+gap;}
        y+=rowHeight+metaHeight+gap;
      }
    }else{
      const heights=Array(columns).fill(0);
      for(let index=0;index<ratios.length;index++){let column=0;for(let candidate=1;candidate<columns;candidate++)if(heights[candidate]<heights[column])column=candidate;const previewHeight=cardWidth/ratios[index],y=heights[column],height=previewHeight+metaHeight;items.push({index,x:column*(cardWidth+gap),y,width:cardWidth,height,previewHeight});heights[column]=y+height+gap;}
    }
    let extentPx=0,maxItemHeight=0,occupiedArea=0;for(const item of items){extentPx=Math.max(extentPx,item.y+item.height);maxItemHeight=Math.max(maxItemHeight,item.height);occupiedArea+=item.width*item.height;}const density=extentPx?occupiedArea/(width*extentPx):1,spatialItems=[...items].sort((first,second)=>first.y-second.y||first.x-second.x||first.index-second.index);
    return{mode,width,cardWidth,gap,metaHeight,columns,targetHeight,items,spatialItems,total:items.length,extentPx,maxItemHeight,density,key:[mode,Math.round(width),Math.round(cardWidth),gap,metaHeight,ratios.length,ratioHash(ratios)].join(':')};
  }
  function bounded({model,start=0,size=480}={}){const total=model?.total||0;size=Math.max(1,Number(size)||480);const maxStart=Math.max(0,total-size),next=Math.max(0,Math.min(maxStart,Number(start)||0));return{start:next,end:Math.min(total,next+size),count:Math.min(size,total-next),virtual:total>size};}
  function windowForScroll({model,scrollTop=0,viewportHeight=0,size=480,overscanPx}={}){
    if(!model?.total)return{start:0,end:0,count:0,virtual:false};scrollTop=Math.max(0,Number(scrollTop)||0);viewportHeight=Math.max(0,Number(viewportHeight)||0);size=Math.max(1,Number(size)||480);overscanPx=Math.max(viewportHeight*.75,Number(overscanPx)||0);const lower=Math.max(0,scrollTop-overscanPx-model.maxItemHeight),upper=scrollTop+viewportHeight+overscanPx,spatial=model.spatialItems||[...model.items].sort((first,second)=>first.y-second.y||first.index-second.index);
    let low=0,high=spatial.length;while(low<high){const middle=(low+high)>>1;if(spatial[middle].y<lower-model.maxItemHeight)low=middle+1;else high=middle;}const candidateStart=low;low=candidateStart;high=spatial.length;while(low<high){const middle=(low+high)>>1;if(spatial[middle].y<=upper)low=middle+1;else high=middle;}const candidateEnd=low;
    let first=model.total,last=-1;for(let position=candidateStart;position<candidateEnd;position++){const item=spatial[position];if(item.y+item.height<lower)continue;first=Math.min(first,item.index);last=Math.max(last,item.index);}if(last<first){const item=spatial[Math.max(0,Math.min(spatial.length-1,candidateStart))];first=last=item.index;}
    const needed=last-first+1,count=Math.min(model.total,Math.max(size,needed)),minimumStart=Math.max(0,last-count+1),maximumStart=Math.min(first,model.total-count),desired=first-Math.floor((count-needed)/2),start=Math.max(minimumStart,Math.min(maximumStart,desired));return{start,end:Math.min(model.total,start+count),count:Math.min(count,model.total-start),virtual:model.total>size};
  }
  function anchorForScroll(model,scrollTop=0){if(!model?.total)return{index:0,offset:0};scrollTop=Math.max(0,Number(scrollTop)||0);let best=0,bestDistance=Infinity;for(const item of model.items){const distance=item.y<=scrollTop&&item.y+item.height>scrollTop?0:Math.abs(item.y-scrollTop);if(distance<bestDistance){best=item.index;bestDistance=distance;}if(item.y>scrollTop&&distance>bestDistance)break;}const item=model.items[best];return{index:best,offset:scrollTop-item.y};}
  function scrollForAnchor(model,anchor={},viewportHeight=0){if(!model?.total)return 0;const item=model.items[Math.max(0,Math.min(model.total-1,Number(anchor.index)||0))],maximum=Math.max(0,model.extentPx-Math.max(0,Number(viewportHeight)||0));return Math.max(0,Math.min(maximum,item.y+(Number(anchor.offset)||0)));}
  function placement(model,index){return model?.items?.[index]||null;}
  return{build,bounded,windowForScroll,anchorForScroll,scrollForAnchor,placement};
});
