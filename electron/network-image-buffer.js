const fs=require('node:fs/promises');
async function readNetworkImageOnce(source,maxBytes=32*1024*1024){
 const handle=await fs.open(source,'r');try{const stat=await handle.stat();if(!stat.isFile()||stat.size<=0||stat.size>maxBytes)return null;const buffer=Buffer.alloc(stat.size);let position=0;while(position<buffer.length){const {bytesRead}=await handle.read(buffer,position,buffer.length-position,position);if(!bytesRead)break;position+=bytesRead;}return buffer.subarray(0,position);}finally{await handle.close();}
}
module.exports={readNetworkImageOnce};
