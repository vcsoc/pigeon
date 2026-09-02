const test=require('node:test');
const assert=require('node:assert/strict');
const {create}=require('../src/asset-indexes');

test('derived indexes update search, facets, and sort keys incrementally',()=>{
  const indexes=create(),asset={id:'a',filename:'Sunset.JPG',path:'C:/Photos/Sunset.JPG',kind:'image',locationId:'l1',tags:['Travel'],rating:4,modified:20,width:640,height:480};indexes.upsert(asset);
  assert.equal(indexes.searchMatches(asset,'c:/photos/sunset'),true);assert(indexes.snapshot().byTag.get('travel').has('a'));assert.equal(indexes.sortValue(asset,'modified'),20);assert.equal(indexes.sortValue(asset,'dimensions'),307200);
  const updated={...asset,tags:['Night'],favorite:true,modified:30};indexes.upsert(updated);
  assert.equal(indexes.snapshot().byTag.has('travel'),false);assert(indexes.snapshot().favorite.has('a'));assert.equal(indexes.sortValue(updated,'modified'),30);
  indexes.remove('a');assert.equal(indexes.snapshot().size,0);
});

test('derived sidebar, tag, and duplicate statistics avoid whole-library rescans',()=>{
  const indexes=create();indexes.upsert({id:'a',tags:['Travel'],collectionIds:['c'],favorite:true,contentHash:'same'});indexes.upsert({id:'b',tags:[],collectionIds:[],sourceMissing:true,contentHash:'same'});indexes.upsert({id:'c',tags:['Hidden'],deletedAt:1,contentHash:'other'});
  const summary=indexes.summary();assert.deepEqual({...summary,collectionCounts:Object.fromEntries(summary.collectionCounts)},{visible:2,uncategorized:1,untagged:1,favorites:1,offline:1,trash:1,tagCount:1,collectionCounts:{c:1}});assert.deepEqual(indexes.allTags(),['Travel']);assert.deepEqual(indexes.tagCatalog(),[{name:'Travel',count:1}]);assert.deepEqual(indexes.duplicateGroups(),[['a','b']]);
  indexes.upsert({id:'b',tags:['Travel'],collectionIds:['c'],contentHash:'different'});assert.equal(indexes.duplicateGroups().length,0);assert.equal(indexes.summary().collectionCounts.get('c'),2);
});
