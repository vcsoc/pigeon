'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../src/renderer.js'),'utf8'),code=source.slice(source.indexOf('function paintExpandedHierarchyGroups('),source.indexOf('function paintFolderCollapseImmediately('));
function row(depth,{expanded=false,hidden=false,leaf=false,active=false}={}){const classes=new Set(active?['active']:[]),control={classList:{contains:name=>leaf&&name==='empty'},getAttribute:()=>String(expanded)};return{classes,control,hidden,style:{getPropertyValue:()=>String(depth)},querySelector:()=>control,classList:{toggle(name,value){value?classes.add(name):classes.delete(name);}}};}
function setup(rows){const tree={querySelectorAll:()=>rows},sandbox={document:{querySelectorAll:()=>[tree]}};vm.createContext(sandbox);vm.runInContext(code,sandbox);return{paint:()=>sandbox.paintExpandedHierarchyGroups(),tree};}
test('expanded top-level branches group their visible descendants, with clean boundaries',()=>{
 const rows=[row(0,{expanded:true}),row(1,{expanded:true}),row(2),row(1,{hidden:true}),row(0),row(1,{hidden:true}),row(0,{expanded:true}),row(1)],f=setup(rows);f.paint();
 assert(rows[0].classes.has('hierarchy-group-root'));assert(rows[1].classes.has('hierarchy-group-member'));assert(rows[2].classes.has('hierarchy-group-end'));assert(!rows[3].classes.size);assert(!rows[4].classes.size);assert(!rows[5].classes.size);assert(rows[6].classes.has('hierarchy-group-root'));assert(rows[7].classes.has('hierarchy-group-end'));
});
test('collapse clears the wash immediately without altering selection or unrelated groups',()=>{
 const rows=[row(0,{expanded:true,active:true}),row(1),row(0,{expanded:true}),row(1)],f=setup(rows);f.paint();rows[0].control.getAttribute=()=> 'false';rows[1].hidden=true;f.paint();assert.deepEqual([...rows[0].classes],['active']);assert.equal(rows[1].classes.size,0);assert(rows[2].classes.has('hierarchy-group-root'));assert(rows[3].classes.has('hierarchy-group-end'));
});
test('leaf roots do not look expandable, and expanded empty roots receive complete rounding',()=>{
 const rows=[row(0,{expanded:true,leaf:true}),row(0,{expanded:true})],f=setup(rows);f.paint();assert.equal(rows[0].classes.size,0);assert(rows[1].classes.has('hierarchy-group-root'));assert(rows[1].classes.has('hierarchy-group-end'));f.paint();assert.equal(rows[1].classes.size,2);
});
