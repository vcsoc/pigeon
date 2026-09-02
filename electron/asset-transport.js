const DEFERRED_DETAIL_FIELDS=['histogram','palette','exif','technicalMetadata'];

function lightweightAsset(asset={}){
  const {encryptedMediaPaths,encryptedThumbnailPaths,histogram,palette,exif,technicalMetadata,...publicAsset}=asset;
  return{...publicAsset,detailsDeferred:Boolean(histogram||palette||exif||technicalMetadata)};
}

function assetDetails(asset={}){
  return Object.fromEntries(DEFERRED_DETAIL_FIELDS.map((field)=>[field,asset[field]||null]));
}

module.exports={DEFERRED_DETAIL_FIELDS,lightweightAsset,assetDetails};
