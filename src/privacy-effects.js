(function(root){
  'use strict';
  const modes=Object.freeze(['blur','pixelate','spoiler','glitch','hidden']);
  function normalize(requested,value){
    const mode=modes.includes(requested)?requested:'blur',pixelate=mode==='pixelate';
    const minimum=pixelate?6:8,maximum=pixelate?120:80,fallback=35;
    const number=Number(value),strength=Math.max(minimum,Math.min(maximum,Number.isFinite(number)&&number>0?number:fallback));
    return{mode,minimum,maximum,strength};
  }
  function spoilerStyle(value){const strength=normalize('spoiler',value).strength;return{columns:Math.round(64-(strength-8)*56/72),contourOpacity:Math.max(.025,.25-strength*.0028)};}
  function next(mode){return modes[(modes.indexOf(mode)+1)%modes.length];}
  function glitchScale(strength){return (28+normalize('glitch',strength).strength)/80;}
  function drawGlitch(context,media,strength){
    const {width,height}=context.canvas,scale=glitchScale(strength);
    // Channel canvases avoid reading protected/custom-protocol image pixels back into JS.
    const layers=context.canvas._glitchLayers||(context.canvas._glitchLayers=['#ff0000','#00ff00','#0000ff'].map(color=>{const canvas=context.canvas.ownerDocument.createElement('canvas');return{canvas,color,context:canvas.getContext('2d',{alpha:false})};}));
    for(const layer of layers){
      if(layer.canvas.width!==width)layer.canvas.width=width;if(layer.canvas.height!==height)layer.canvas.height=height;
      const c=layer.context;c.globalCompositeOperation='source-over';c.fillStyle='#000';c.fillRect(0,0,width,height);c.drawImage(media,0,0,width,height);c.globalCompositeOperation='multiply';c.fillStyle=layer.color;c.fillRect(0,0,width,height);
    }
    context.globalCompositeOperation='source-over';context.globalAlpha=1;context.fillStyle='#000';context.fillRect(0,0,width,height);context.globalCompositeOperation='screen';
    for(let y=0;y<height;y+=4){
      const seed=Math.imul(y/4+1,2654435761)>>>0,shift=Math.round(((seed%1024)/1023-.5)*width*scale),band=Math.min(3,height-y);
      context.globalAlpha=(seed>>>14)%7===0?.12:.58;
      for(let channel=0;channel<3;channel++){
        const x=((shift+(1-channel)*3)%width+width)%width;
        context.drawImage(layers[channel].canvas,0,y,width,band,x,y,width,band);context.drawImage(layers[channel].canvas,0,y,width,band,x-width,y,width,band);
      }
    }
    context.globalAlpha=1;context.globalCompositeOperation='source-over';
  }
  function fitPreview(width,height,rotation,areaWidth,areaHeight){const positive=(value,fallback)=>Number.isFinite(Number(value))&&Number(value)>0?Number(value):fallback,w=positive(width,1),h=positive(height,1),quarter=Boolean((Number(rotation)||0)%180),scale=Math.min(positive(areaWidth,0)/(quarter?h:w),positive(areaHeight,0)/(quarter?w:h)),fittedWidth=(quarter?h:w)*scale,fittedHeight=(quarter?w:h)*scale;return{width:fittedWidth,height:fittedHeight,imageWidth:quarter?fittedHeight:fittedWidth,imageHeight:quarter?fittedWidth:fittedHeight};}
  function releaseGlitch(context){const layers=context.canvas._glitchLayers;if(!layers)return;for(const layer of layers){layer.canvas.width=0;layer.canvas.height=0;}delete context.canvas._glitchLayers;}
  const api=Object.freeze({modes,normalize,next,glitchScale,drawGlitch,releaseGlitch,spoilerStyle,fitPreview,defaultStrength:35});
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.PigeonPrivacyEffects=api;
})(typeof window==='object'?window:globalThis);
