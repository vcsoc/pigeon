'use strict';
const fs=require('node:fs'),path=require('node:path');
const {createSemanticHost,assetRecord}=require('./semantic-host');
function createSemanticPlugin(options,{createHost=createSemanticHost}={}){
  const file=path.join(options.userData,'semantic-plugin.json');let enabled=false,host=null,closed=false,generation=0,transition=Promise.resolve();
  try{const saved=JSON.parse(fs.readFileSync(file,'utf8'));enabled=saved.enabled===true;}catch{}
  function disabled(){return{state:'disabled',pluginEnabled:false,pluginId:'local-semantic',model:'EmbeddingGemma 2',detail:'Optional local semantic plugin is disabled. Enable Local Semantic Search in Plugin Manager to prepare private search. Existing models and analysis checkpoints are kept.',portfolioId:options.getContext()?.portfolioId,total:0,completed:0,automatic:false,paused:true,runtimeReady:false,resources:{}};}
  function enrich(status){return{...status,pluginEnabled:enabled,pluginId:'local-semantic'};}
  function getHost(){
    if(closed)throw Error('Pigeon is closing');if(!enabled)throw Error('Enable the optional local semantic plugin first.');
    if(!host){const token=++generation;host=createHost({...options,emit:status=>{if(!closed&&enabled&&token===generation)options.emit?.(enrich(status));},onTags:value=>{if(!closed&&enabled&&token===generation)options.onTags?.(value);}});}return host;
  }
  function persist(value){fs.mkdirSync(options.userData,{recursive:true});const temp=file+'.tmp';try{fs.writeFileSync(temp,JSON.stringify({version:1,enabled:value}),{mode:0o600});fs.renameSync(temp,file);}catch(error){try{fs.unlinkSync(temp);}catch{}throw error;}}
  async function changeEnabled(value){
    if(closed)throw Error('Pigeon is closing');if(typeof value!=='boolean')throw Error('Plugin enabled must be a boolean');
    persist(value);enabled=value;
    if(!value){generation++;const old=host;host=null;await old?.close();const status=disabled();options.emit?.(status);return status;}
    const current=getHost(),token=generation,result=await current.setup();if(!enabled||token!==generation)return disabled();const status=enrich(result);options.emit?.(status);return status;
  }
  function setEnabled(value){const result=transition.then(()=>changeEnabled(value));transition=result.catch(()=>{});return result;}
  function descriptor(){const status=proxy.peekStatus(),setupActive=status.state==='setup',cached=fs.existsSync(path.join(options.userData,'semantic-runtime.json'))||fs.existsSync(path.join(options.userData,'semantic-runtime')),ready=Boolean(status.runtimeValidated),progress=status.setupProgress||{};return{id:'local-semantic',name:'Local Semantic Search',version:'1.0.0',author:'Pigeon',category:'Search',kind:'semantic',description:'Optional private multimodal and similarity search using EmbeddingGemma 2. Enable to prepare the runtime and model; disable to stop analysis. Existing models and checkpoints are retained.',installed:cached||setupActive,enabled,modelReady:ready,setupActive,status:!enabled?'disabled':setupActive?'installing':status.state==='error'?'error':ready?'ready':'enabled',statusDetail:[status.detail,status.error].filter(Boolean).join(' '),model:{name:'EmbeddingGemma 2',type:'Multimodal embedding model',size:'Downloaded on demand',purpose:'Private multimodal and similarity search. Files stay on this computer; this is not a generative chatbot.',source:'google/embeddinggemma-2 on Hugging Face',license:'Gemma terms'},modelState:{ready,status:ready?'ready':cached?'cached':'missing',percent:Number.isFinite(progress.percent)?progress.percent:null,...(progress.unit==='bytes'?{partialBytes:progress.current||0,totalBytes:progress.total||0}:{})},configured:{},configSchema:[],logs:status.error?[status.error]:[],setupProgress:progress};}
  const proxy={setEnabled,descriptor,isEnabled:()=>enabled,assetRecord,
    getStatus:async()=>{if(!enabled)return disabled();const current=getHost(),token=generation,result=await current.getStatus();return !enabled||token!==generation?disabled():enrich(result);},peekStatus:()=>enabled?enrich(getHost().peekStatus()):disabled(),
    assetsChanged:assets=>{if(enabled)getHost().assetsChanged(assets);},refreshVisibility:()=>{if(enabled)getHost().refreshVisibility();},refreshContext:()=>{if(enabled)getHost().refreshContext();},
    stop:()=>host?.stop(),close:async()=>{closed=true;generation++;const old=host;host=null;await old?.close();}
  };
  for(const method of ['configure','start','pause','continueAnalysis','setup','search'])proxy[method]=async(...args)=>{const current=getHost(),token=generation,result=await current[method](...args);if(!enabled||token!==generation){if(['search','suggestTags'].includes(method))throw Error('Semantic plugin changed during the operation');return disabled();}return ['search','suggestTags'].includes(method)?result:enrich(result);};
  // No coordinator, subprocess, model checks or downloads exist while the plugin is disabled.
  if(enabled)getHost();return proxy;
}
module.exports={createSemanticPlugin};
