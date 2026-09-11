(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PigeonImageComposition=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function layout(images,options={}){
    if(!Array.isArray(images)||images.length<2||images.length>64)throw Error('Select between 2 and 64 images');
    const mode=options.layout||'horizontal';if(!['horizontal','vertical','rows','columns','mosaic'].includes(mode))throw Error('Invalid layout');
    const n=Number(options.n??4);if(!Number.isInteger(n)||n<1||n>64)throw Error('Images per row/column must be 1–64');
    function limit(value){const number=Number(value??0);if(!Number.isFinite(number)||number<0||number>16384||!Number.isInteger(number))throw Error('Maximum dimensions must be whole pixels from 0 to 16384');return number||8192;}
    const maxWidth=limit(options.maxWidth),maxHeight=limit(options.maxHeight),base=Math.max(1,...images.map(image=>mode==='horizontal'?image.height:mode==='vertical'?image.width:Math.max(image.width,image.height))),label=options.filenames?Math.max(24,Math.round(base*.05)):0,gap=Math.max(4,Math.round(base*.015));
    let seed=Number(options.seed)||1;const order=images.map((image,index)=>{if(!Number.isFinite(image.width)||!Number.isFinite(image.height)||image.width<=0||image.height<=0)throw Error('Invalid image dimensions');return index;});
    if(mode==='mosaic')for(let i=order.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[order[i],order[j]]=[order[j],order[i]];}
    const cells=[];let width=0,height=0;const ratio=i=>images[i].width/images[i].height;
    function put(index,x,y,w,h){cells.push({index,x,y,width:w,imageHeight:h,labelHeight:label,height:h+label});width=Math.max(width,x+w);height=Math.max(height,y+h+label);}
    if(mode==='horizontal'){let x=0;for(const i of order){const w=base*ratio(i);put(i,x,0,w,base);x+=w+gap;}}
    else if(mode==='vertical'){let y=0;for(const i of order){const h=base/ratio(i);put(i,0,y,base,h);y+=h+label+gap;}}
    else if(mode==='mosaic'){const columns=Math.ceil(Math.sqrt(order.length)),rowWidth=columns*base;let y=0;for(let start=0;start<order.length;start+=columns){const row=order.slice(start,start+columns),h=(rowWidth-gap*(row.length-1))/row.reduce((sum,i)=>sum+ratio(i),0);let x=0;for(const i of row){const w=h*ratio(i);put(i,x,y,w,h);x+=w+gap;}y+=h+label+gap;}}
    else for(let p=0;p<order.length;p++){const column=mode==='rows'?p%n:Math.floor(p/n),row=mode==='rows'?Math.floor(p/n):p%n;put(order[p],column*(base+gap),row*(base+label+gap),base,base);}
    const scale=Math.min(1,maxWidth/width,maxHeight/height,Math.sqrt(40000000/(width*height))),outputWidth=Math.max(1,Math.floor(width*scale)),outputHeight=Math.max(1,Math.floor(height*scale));
    const scaled=cells.map(c=>{const x=Math.floor(c.x*scale),y=Math.floor(c.y*scale),w=Math.floor((c.x+c.width)*scale)-x,imageHeight=Math.floor((c.y+c.imageHeight)*scale)-y,height=Math.floor((c.y+c.height)*scale)-y;if(w<1||imageHeight<1||(label&&height-imageHeight<1))throw Error('Maximum dimensions are too small for this layout');return{index:c.index,x,y,width:w,imageHeight,height,labelHeight:height-imageHeight};});
    return{width:outputWidth,height:outputHeight,cells:scaled};
  }
  return{layout};
});
