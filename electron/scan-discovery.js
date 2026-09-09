function createScanDiscovery(files,discover){
 let done=false,error=null;const waiters=new Set();
 const wake=()=>{for(const resolve of waiters)resolve();waiters.clear();};
 const finished=Promise.resolve().then(()=>discover(file=>{files.push(file);wake();})).catch(reason=>{error=reason;}).finally(()=>{done=true;wake();});
 return{get done(){return done;},async wait(index){if(error)throw error;if(files.length<=index&&!done)await new Promise(resolve=>waiters.add(resolve));if(error)throw error;},async finish(){await finished;if(error)throw error;}};
}
module.exports={createScanDiscovery};
