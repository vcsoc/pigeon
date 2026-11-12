'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{calendarForImages}=require('../electron/immich-calendar');
test('image years have all twelve months and use Immich local date',()=>{
  const years=calendarForImages([{id:'a',type:'IMAGE',localDateTime:'2025-01-31T23:30:00',fileCreatedAt:'2025-02-01T04:30:00Z'},{id:'b',type:'IMAGE',localDateTime:'2024-12-05T10:00:00'},{id:'video',type:'VIDEO',localDateTime:'2023-01-01T00:00:00'},{id:'bad',type:'IMAGE',localDateTime:'2024-02-31T00:00:00'}]);
  assert.deepEqual(years.map(y=>y.year),[2025,2024]);assert.equal(years[0].months.length,12);assert.deepEqual(years[0].months[0].assetIds,['a']);assert.equal(years[0].months[1].name,'February');assert.deepEqual(years[1].months[11].assetIds,['b']);
});
test('missing local date can fall back to file creation date',()=>{const years=calendarForImages([{id:'x',type:'IMAGE',fileCreatedAt:'2022-07-09T12:00:00Z'}]);assert.equal(years[0].months[6].name,'July');assert.deepEqual(years[0].months[6].assetIds,['x']);});
