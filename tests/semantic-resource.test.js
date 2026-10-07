'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {budget}=require('../electron/semantic-policy');
test('user resource limit applies equally to manual and automatic CPU and memory budgets',()=>{
 for(const mode of ['automatic','manual'])for(const percent of [5,15,25,50]){const p=budget(mode,32,100000,percent);assert.equal(p.cpu,percent/100);assert.equal(p.memoryBytes,percent*1000);assert.ok(p.threads>=1);}
});
test('resource limits are clamped and malformed values retain safe defaults',()=>{
 assert.equal(budget('manual',4,100000,100).cpu,.5);assert.equal(budget('automatic',4,100000,-5).cpu,.05);assert.equal(budget('automatic',4,100000,NaN).cpu,.12);assert.equal(budget('manual',4,100000,Infinity).cpu,.18);
});
