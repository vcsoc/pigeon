(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PigeonOnThisDay=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function calendarDate(value){
    if(value instanceof Date){if(!Number.isFinite(value.getTime()))return null;value=value.toISOString();}
    if(typeof value==='number'){if(!Number.isFinite(value)||!value)return null;const date=new Date(Math.abs(value)<1e11?value*1000:value);if(!Number.isFinite(date.getTime()))return null;value=date.toISOString();}
    if(typeof value!=='string')return null;
    // EXIF dates are camera-local calendar dates. Do not shift their day by
    // converting a timestamp/offset to the viewing computer's timezone.
    const match=value.trim().match(/^(\d{4})[:-](\d{2})[:-](\d{2})(?:$|[T\s])/);
    if(!match)return null;
    const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
    const check=new Date(0);check.setUTCFullYear(year,month-1,day);check.setUTCHours(0,0,0,0);
    return year>0&&check.getUTCFullYear()===year&&check.getUTCMonth()===month-1&&check.getUTCDate()===day?`${match[1]}-${match[2]}-${match[3]}`:null;
  }
  function takenDate(asset={}){
    const exif=asset.exif||{},photo=exif.Photo||exif.Exif||{},image=exif.Image||{};
    for(const value of [photo.DateTimeOriginal,exif.DateTimeOriginal,photo.DateTimeDigitized,exif.DateTimeDigitized,image.DateTime,asset.takenDate]){const date=calendarDate(value);if(date)return date;}
    return null;
  }
  function dayKey(now=Date.now()){
    const date=new Date(now);
    return Number.isFinite(date.getTime())?`${String(date.getFullYear()).padStart(4,'0')}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`:null;
  }
  function imageDate(asset={}){
    const taken=takenDate(asset);if(taken)return taken;
    // "created" is the source file's birth time, never its import or edit time.
    if(asset.created===null||asset.created===undefined||asset.created===''||asset.created===0)return null;
    return dayKey(asset.created);
  }
  function matches(asset,now=Date.now()){
    if(!asset||asset.kind!=='image'||asset.deletedAt||asset.locked)return false;
    const today=dayKey(now),date=imageDate(asset);
    return Boolean(today&&date&&date.slice(5)===today.slice(5)&&Number(date.slice(0,4))<Number(today.slice(0,4)));
  }
  return{calendarDate,takenDate,dayKey,imageDate,matches};
});
