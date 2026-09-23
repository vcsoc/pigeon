const test=require('node:test'),assert=require('node:assert/strict');
const {createBackgroundCpuLimiter}=require('../electron/background-cpu-limiter');

test('CPU-only comparison waits for its own measured thread usage and bounds average duty',()=>{
 let wall=0,cpu=0;const sleeps=[],checkpoint=createBackgroundCpuLimiter({dutyCycle:0.08,now:()=>wall,usage:()=>({user:cpu*1000,system:0}),sleep:ms=>{sleeps.push(ms);wall+=ms;}});
 for(let i=0;i<10;i++){cpu+=1;wall+=1;checkpoint();}
 assert.ok(wall>=cpu/0.08,`CPU ${cpu} ms in ${wall} ms wall time`);assert.ok(sleeps.every(ms=>ms>0&&ms<=100));
});
test('cancellation interrupts rest and prevents another comparison batch',()=>{
 let cpu=0,cancelled=false;const checkpoint=createBackgroundCpuLimiter({dutyCycle:0.08,now:()=>0,usage:()=>({user:cpu*1000,system:0}),sleep:()=>{cancelled=true;},cancelled:()=>cancelled});
 cpu=50;assert.throws(checkpoint,/cancelled/);assert.throws(checkpoint,/cancelled/);
});
