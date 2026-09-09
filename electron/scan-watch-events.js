'use strict';
const {normalizedPathKey}=require('./library-deduplication');
function unchangedWatchFile(asset,filePath,stat){
  if(!asset||!stat||asset.sourceMissing||asset.sourcePending||asset.permissionDenied)return false;
  return normalizedPathKey(asset.path)===normalizedPathKey(filePath)&&Number.isFinite(stat.mtimeMs)&&Number.isFinite(stat.size)&&Number(asset.modified)===stat.mtimeMs&&Number(asset.size)===stat.size;
}
module.exports={unchangedWatchFile};
