'use strict';
const fs=require('node:fs');
const {DatabaseSync}=require('node:sqlite');
// Keep persisted semantic metadata current even if the Python process is SIGSTOPped
// mid-inference. Fingerprints, vectors, and cursors are deliberately untouched:
// the engine's serialized sync step performs safe invalidation before re-embedding.
function writeSemanticMetadata(file,records=[]){
 if(!records.length||!fs.existsSync(file))return{updated:0};let db=null;
 try{db=new DatabaseSync(file);db.exec('PRAGMA busy_timeout=250');const columns=new Set(db.prepare('PRAGMA table_info(assets)').all().map(row=>row.name));if(!columns.has('metadata')||!columns.has('metadata_dirty'))return{updated:0,deferred:true};const read=db.prepare('SELECT fingerprint,metadata,metadata_dirty FROM assets WHERE id=?'),write=db.prepare('UPDATE assets SET metadata=?,metadata_dirty=1 WHERE id=?');let updated=0;db.exec('BEGIN IMMEDIATE');for(const record of records){const row=read.get(record.asset.id);if(!row||row.fingerprint===record.fingerprint)continue;const metadata=JSON.stringify(record.asset);if(row.metadata_dirty&&row.metadata===metadata)continue;write.run(metadata,record.asset.id);updated++;}db.exec('COMMIT');return{updated};}catch(error){try{db?.exec('ROLLBACK');}catch{}return{updated:0,error:error.message};}finally{db?.close();}
}
module.exports={writeSemanticMetadata};
