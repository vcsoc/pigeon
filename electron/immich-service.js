'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {loginImmich,normalizeServerUrl}=require('./immich-client');
const systemKeyring=require('./immich-keyring');
function createImmichService({safeStorage,userData,login=loginImmich,keyring=systemKeyring}){
  const file=path.join(userData,'immich.json');let config=null,client=null;
  function publicConfig(){return config?{enabled:Boolean(config.enabled),serverUrl:config.serverUrl,email:config.email,hasPassword:Boolean(config.encryptedPassword||config.secretId)}:{enabled:false,serverUrl:'',email:'',hasPassword:false};}
  function encryptionAvailable(){return safeStorage.isEncryptionAvailable()&&(process.platform!=='linux'||safeStorage.getSelectedStorageBackend?.()!=='basic_text');}
  async function load(){try{const data=JSON.parse(await fs.readFile(file,'utf8'));config={enabled:Boolean(data.enabled),serverUrl:normalizeServerUrl(data.serverUrl),email:String(data.email||''),encryptedPassword:String(data.encryptedPassword||''),secretId:String(data.secretId||'')};}catch(error){if(error.code!=='ENOENT')throw new Error('Could not load Immich settings.');config=null;}client=null;return publicConfig();}
  async function save(next){await fs.mkdir(userData,{recursive:true});const tmp=`${file}.${process.pid}.tmp`;try{await fs.writeFile(tmp,JSON.stringify(next),{mode:0o600});await fs.rename(tmp,file);}catch(error){await fs.rm(tmp,{force:true}).catch(()=>{});throw new Error('Could not save Immich settings.');}}
  async function configure({enabled,serverUrl,email,password}={}){
    if(!enabled){if(config){const next={...config,enabled:false};await save(next);config=next;}client=null;return publicConfig();}
    const url=normalizeServerUrl(serverUrl),user=String(email||'').trim();let secret=String(password||'');if(!secret&&config&&config.serverUrl===url&&config.email===user)secret=await readSecret(config);
    const connection=await login({serverUrl:url,email:user,password:secret});let encryptedPassword='',secretId='';if(encryptionAvailable())encryptedPassword=safeStorage.encryptString(secret).toString('base64');else if(process.platform==='linux'){secretId=crypto.createHash('sha256').update(`${url}\0${user.toLowerCase()}`).digest('hex');await keyring.store(secretId,secret);}else throw new Error('Secure credential storage is unavailable.');const next={enabled:true,serverUrl:url,email:user,encryptedPassword,secretId};await save(next);config=next;client=connection;return publicConfig();
  }
  async function readSecret(settings){if(settings.secretId)return keyring.lookup(settings.secretId);if(!settings.encryptedPassword||!encryptionAvailable())throw new Error('Secure credential storage is unavailable.');try{return safeStorage.decryptString(Buffer.from(settings.encryptedPassword,'base64'));}catch{throw new Error('Could not unlock saved Immich credentials.');}}
  async function connection(){if(!config?.enabled)throw new Error('Immich is not enabled.');if(!client){const password=await readSecret(config);client=await login({serverUrl:config.serverUrl,email:config.email,password});}return client;}
  function accountKey(){return config?.enabled?crypto.createHash('sha256').update(`${config.serverUrl}\0${config.email.toLowerCase()}`).digest('hex'):null;}
  async function withConnection(operation){const current=await connection();try{return await operation(current);}catch(error){if(!/HTTP 401\b/.test(error.message))throw error;if(client===current)client=null;return operation(await connection());}}
  async function snapshot(){const key=accountKey();return withConnection(async c=>{const [items,tags]=await Promise.all([c.listImages(),c.listTags()]),assets=new Array(items.length);let index=0;await Promise.all(Array.from({length:Math.min(4,items.length)},async()=>{while(index<items.length){const i=index++;assets[i]=await c.assetInfo(items[i].id);}}));if(key!==accountKey())throw new Error('Immich settings changed during synchronization.');return{accountKey:key,assets,tags};});}
  async function pushTags(asset,tags){if(!asset.immichAccountKey||asset.immichAccountKey!==accountKey())throw new Error('The image belongs to a different Immich account.');return withConnection(async c=>{if(asset.immichAccountKey!==accountKey())throw new Error('Immich settings changed during synchronization.');const upserted=await c.upsertTags(tags);if(upserted.length!==new Set(tags).size)throw new Error('Immich did not create every requested tag.');for(const tag of upserted){if(asset.immichAccountKey!==accountKey())throw new Error('Immich settings changed during synchronization.');await c.addExistingTag(tag.id,[asset.immichRemoteId]);}return upserted.map(tag=>tag.value);});}
  async function image(asset,original=false){if(!asset.immichAccountKey||asset.immichAccountKey!==accountKey())throw new Error('The image belongs to a different Immich account.');return withConnection(c=>{if(asset.immichAccountKey!==accountKey())throw new Error('Immich settings changed during synchronization.');return original?c.original(asset.immichRemoteId):c.thumbnail(asset.immichRemoteId);});}
  return{load,configure,publicConfig,accountKey,snapshot,pushTags,image};
}
module.exports={createImmichService};
