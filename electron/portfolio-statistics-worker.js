'use strict';
const {parentPort,workerData}=require('node:worker_threads');
const {DatabaseSync}=require('node:sqlite');
const {matchingFolderLockRules}=require('./folder-locks');
const S=require('../src/portfolio-statistics');
let database;
try{
  database=new DatabaseSync(workerData.database,{readOnly:true});database.exec('PRAGMA busy_timeout=3000; BEGIN');
  const row=database.prepare("SELECT value FROM library_metadata WHERE key='library'").get();const metadata=row?JSON.parse(row.value):{};
  const locations=[...database.prepare('SELECT payload FROM locations').iterate()].map(row=>JSON.parse(row.payload));
  const collections=[...database.prepare('SELECT payload FROM collections').iterate()].map(row=>JSON.parse(row.payload));
  const locks=Object.values(metadata.settings?.folderLocks||{}),blocked=new Set(collections.filter(c=>c.lock).map(c=>c.id));
  let changed=true;while(changed){changed=false;for(const c of collections)if(blocked.has(c.parentId)&&!blocked.has(c.id)){blocked.add(c.id);changed=true;}}
  const stats=S.empty();stats.locations=locations.length;stats.collections=collections.filter(c=>!blocked.has(c.id)).length;stats.protected=locks.length>0||blocked.size>0;
  for(const row of database.prepare('SELECT payload FROM assets').iterate()){
    const asset=JSON.parse(row.payload);
    const encrypted=['encryptedMediaPaths','encryptedThumbnailPaths'].some(key=>asset[key]!=null&&(typeof asset[key]!=='object'||Array.isArray(asset[key])||Object.keys(asset[key]).length>0));
    if(encrypted||(asset.collectionIds||[]).some(id=>blocked.has(id))||matchingFolderLockRules(asset,locks,locations).length){stats.protected=true;continue;}
    S.add(stats,asset);
  }
  parentPort.postMessage({value:S.finish(stats)});
}catch{parentPort.postMessage({error:'Cannot read portfolio statistics. The database may be busy or incompatible.'});}
finally{database?.close();}
