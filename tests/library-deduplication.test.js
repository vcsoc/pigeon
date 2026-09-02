'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {findLocationOverlap,visibleLocations,owningLocation,deduplicateAssetsByPath}=require('../electron/library-deduplication');

const locations=[
  {id:'parent',name:'.pigeon',path:'C:\\.vcsoc\\pigeon',type:'folder',addedAt:1},
  {id:'child',name:'darkroom',path:'C:\\.vcsoc\\pigeon\\darkroom',type:'folder',addedAt:2}
];

test('overlapping folders are detected in both directions before indexing',()=>{
  assert.equal(findLocationOverlap([locations[0]],locations[1].path,'folder').relation,'covered');
  assert.equal(findLocationOverlap([locations[1]],locations[0].path,'folder').relation,'contains');
  assert.equal(findLocationOverlap(locations,locations[1].path.toUpperCase(),'folder').relation,'exact');
});

test('exact duplicate locations have one visible representative',()=>{
  const duplicate={...locations[1],id:'duplicate',path:'c:\\.VCSOC\\pigeon\\darkroom\\'};
  assert.deepEqual(visibleLocations([...locations,duplicate]).map((location)=>location.id),['parent','child']);
});

test('the most-specific indexed root owns every physical file',()=>{
  assert.equal(owningLocation(locations,'C:\\.vcsoc\\pigeon\\darkroom\\cvp\\photo.png').id,'child');
  assert.equal(owningLocation(locations,'C:\\.vcsoc\\pigeon\\other\\photo.png').id,'parent');
});

test('duplicate asset paths collapse without losing user metadata or deleting source files',()=>{
  const library={locations:structuredClone(locations),assets:[
    {id:'parent-copy',locationId:'parent',path:'C:\\.vcsoc\\pigeon\\darkroom\\cvp\\photo.png',tags:['parent'],collectionIds:['one'],note:'Parent note',rating:2,thumbnailPath:'thumb.jpg'},
    {id:'child-copy',locationId:'child',path:'c:\\.VCSOC\\pigeon\\darkroom\\cvp\\photo.png',tags:['child'],collectionIds:['two'],note:'Child note',rating:5,favorite:true}
  ]};
  const result=deduplicateAssetsByPath(library);
  assert.equal(result.duplicatesRemoved,1);assert.equal(library.assets.length,1);assert.equal(library.assets[0].id,'child-copy');assert.equal(library.assets[0].locationId,'child');assert.deepEqual(new Set(library.assets[0].tags),new Set(['parent','child']));assert.deepEqual(new Set(library.assets[0].collectionIds),new Set(['one','two']));assert.match(library.assets[0].note,/Parent note/);assert.match(library.assets[0].note,/Child note/);assert.equal(library.assets[0].rating,5);assert.equal(library.assets[0].favorite,true);assert.equal(library.assets[0].thumbnailPath,'thumb.jpg');assert.equal(library.locations.find((location)=>location.id==='parent').assetCount,0);assert.equal(library.locations.find((location)=>location.id==='child').assetCount,1);
});
