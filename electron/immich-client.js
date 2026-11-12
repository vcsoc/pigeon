'use strict';

const DEFAULT_TIMEOUT_MS=10000;
const DEFAULT_PAGE_SIZE=250;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function normalizeServerUrl(value){
  let url;try{url=new URL(String(value||'').trim());}catch{throw new Error('Enter a valid Immich server URL.');}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw new Error('Immich server URL must be HTTP or HTTPS without credentials, a query, or a fragment.');
  url.pathname=url.pathname.replace(/\/+$/,'').replace(/\/api$/i,'');return url.toString().replace(/\/$/,'');
}
function validId(value){if(!UUID.test(String(value||'')))throw new Error('Invalid Immich identifier.');return String(value);}
function createImmichClient({serverUrl,apiKey,accessToken,fetchImpl=fetch,timeoutMs=DEFAULT_TIMEOUT_MS}={}){
  const base=normalizeServerUrl(serverUrl),key=String(apiKey||accessToken||'').trim();if(!key||/[\r\n]/.test(key))throw new Error('Immich credentials are required.');const authorization=apiKey?{'x-api-key':key}:{authorization:`Bearer ${key}`};
  async function request(endpoint,{method='GET',body,binary=false,maxBytes=20*1024*1024}={}){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);timer.unref?.();
    try{
      let response;try{response=await fetchImpl(`${base}/api${endpoint}`,{method,headers:{...authorization,...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error',signal:controller.signal});}catch(error){if(error?.name==='AbortError')throw new Error('Immich request timed out.');throw new Error('Could not connect to the Immich server.');}
      if(!response.ok)throw new Error(`Immich request failed (HTTP ${response.status}).`);
      if(response.status===204&&!binary)return null;
      if(!binary){try{return await response.json();}catch{throw new Error('Immich returned an invalid response.');}}
      const declared=Number(response.headers.get('content-length'));if(declared>maxBytes)throw new Error('Immich image exceeds the preview size limit.');
      const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>maxBytes){controller.abort();throw new Error('Immich image exceeds the preview size limit.');}chunks.push(Buffer.from(chunk));}return {body:Buffer.concat(chunks),contentType:response.headers.get('content-type')||'application/octet-stream'};
    }finally{clearTimeout(timer);}
  }
  async function listImages({pageSize=DEFAULT_PAGE_SIZE,maxPages=10000}={}){
    const size=Math.max(1,Math.min(1000,Math.floor(Number(pageSize)||DEFAULT_PAGE_SIZE))),assets=[],seen=new Set();let page=1,cursor=null;
    for(let count=0;count<maxPages;count++){
      const marker=cursor===null?`page:${page}`:`cursor:${cursor}`;if(seen.has(marker))throw new Error('Immich returned a repeated page.');seen.add(marker);
      const response=await request('/search/metadata',{method:'POST',body:{type:'IMAGE',...(cursor===null?{page}:{cursor}),size,withExif:true}}),group=response?.assets;
      if(!group||!Array.isArray(group.items))throw new Error('Immich returned an invalid asset page.');
      assets.push(...group.items);if(group.nextCursor){cursor=String(group.nextCursor);continue;}if(group.nextPage===null||group.nextPage===undefined||group.nextPage==='')return assets;
      const next=Number(group.nextPage);if(!Number.isSafeInteger(next)||next<1)throw new Error('Immich returned an invalid next page.');page=next;
    }
    throw new Error('Immich asset listing exceeded its safety limit.');
  }
  async function listTags(){const tags=await request('/tags');if(!Array.isArray(tags))throw new Error('Immich returned an invalid tag list.');return tags;}
  async function upsertTags(names){const tags=[...new Set((names||[]).map(name=>String(name).trim()).filter(Boolean))];if(!tags.length)return[];const result=await request('/tags',{method:'PUT',body:{tags}});if(!Array.isArray(result)||result.some(tag=>!tag?.id||!tag?.value))throw new Error('Immich returned an invalid tag response.');return result;}
  async function addExistingTag(tagId,assetIds){const ids=[...new Set((assetIds||[]).map(validId))];if(!ids.length)return;const result=await request(`/tags/${validId(tagId)}/assets`,{method:'PUT',body:{ids}});if(!Array.isArray(result)||ids.some(id=>!result.some(item=>item.id===id&&item.success===true)))throw new Error('Immich could not apply the tag to every requested image.');}
  async function assetInfo(assetId){const asset=await request(`/assets/${validId(assetId)}`);if(!asset?.id)throw new Error('Immich returned invalid asset details.');return asset;}
  async function thumbnail(assetId){return request(`/assets/${validId(assetId)}/thumbnail?size=preview`,{binary:true});}
  async function original(assetId){return request(`/assets/${validId(assetId)}/original`,{binary:true,maxBytes:256*1024*1024});}
  const transfers=require('./immich-transfer-http').createTransferClient({base,authorization,fetchImpl});
  return Object.freeze({serverUrl:base,listImages,listTags,upsertTags,addExistingTag,assetInfo,thumbnail,original,uploadVerified:transfers.upload,downloadVerified:transfers.download});
}
async function loginImmich({serverUrl,email,password,fetchImpl=fetch,timeoutMs=DEFAULT_TIMEOUT_MS}={}){
  const base=normalizeServerUrl(serverUrl),user=String(email||'').trim(),secret=String(password||'');if(!user||!secret)throw new Error('Immich email and password are required.');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);timer.unref?.();
  try{let response;try{response=await fetchImpl(`${base}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:user,password:secret}),redirect:'error',signal:controller.signal});}catch(error){if(error?.name==='AbortError')throw new Error('Immich login timed out.');throw new Error('Could not connect to the Immich server.');}if(!response.ok)throw new Error(`Immich login failed (HTTP ${response.status}).`);let result;try{result=await response.json();}catch{throw new Error('Immich returned an invalid login response.');}if(!result?.accessToken)throw new Error('Immich returned an invalid login response.');return createImmichClient({serverUrl:base,accessToken:result.accessToken,fetchImpl,timeoutMs});}finally{clearTimeout(timer);}
}
module.exports={createImmichClient,normalizeServerUrl,loginImmich};
