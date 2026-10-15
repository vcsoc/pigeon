const test=require('node:test');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
const memories=require('../src/on-this-day');
const {lightweightAsset}=require('../electron/asset-transport');
const today=new Date(2026,9,15,12).getTime();
const image=(extra={})=>({kind:'image',created:new Date(2020,9,15,12).getTime(),...extra});

test('On this day matches source creation month/day in previous years, not import or edit dates',()=>{
  assert(memories.matches(image(),today));
  assert(!memories.matches(image({created:new Date(2026,9,15).getTime()}),today));
  assert(!memories.matches(image({created:new Date(2027,9,15).getTime()}),today));
  assert(!memories.matches(image({created:new Date(2020,9,14).getTime(),indexedAt:today,modified:today}),today));
  assert(!memories.matches(image({created:null,indexedAt:today,modified:today}),today));
});
test('capture date takes precedence over a copied file birth time',()=>{
  assert(memories.matches(image({created:today,exif:{Photo:{DateTimeOriginal:'2018:10:15 23:59:59'}}}),today));
  assert(!memories.matches(image({exif:{Photo:{DateTimeOriginal:'2018:10:14 12:00:00'}}}),today));
  assert.equal(memories.takenDate({exif:{DateTimeOriginal:'2017-10-15T12:00:00.000Z'}}),'2017-10-15');
  assert.equal(memories.takenDate({exif:{Photo:{DateTimeDigitized:'2016:10:15 12:00:00'}}}),'2016-10-15');
  assert.equal(memories.takenDate({exif:{Image:{DateTime:'2015:10:15 12:00:00'}}}),'2015-10-15');
});
test('only visible images are memories, never videos, documents, locked assets or Trash',()=>{
  for(const extra of [{kind:'video'},{kind:'document'},{locked:true},{deletedAt:1}])assert(!memories.matches(image(extra),today));
  assert(!memories.matches(null,today));
});
test('malformed, impossible and unknown dates do not roll over to a different day',()=>{
  for(const value of ['0000:00:00 00:00:00','2021:02:29 00:00:00','2020:13:15','2020:10:32','not a date',Infinity,NaN,0])assert.equal(memories.calendarDate(value),null,String(value));
  assert.equal(memories.calendarDate('2020:02:29 12:00:00'),'2020-02-29');
  assert(memories.matches(image({exif:{Photo:{DateTimeOriginal:'invalid'}}}),today));
  assert(!memories.matches(image({created:'invalid'}),today));
});
test('February 29 is only matched on February 29, without a non-leap-year substitute',()=>{
  const leap=image({takenDate:'2020-02-29'});
  assert(memories.matches(leap,new Date(2024,1,29,12).getTime()));
  assert(!memories.matches(leap,new Date(2025,1,28,12).getTime()));
  assert(!memories.matches(leap,new Date(2025,2,1,12).getTime()));
});
test('capture dates retain their camera-local calendar day even with an explicit timezone',()=>{
  assert.equal(memories.takenDate({exif:{Photo:{DateTimeOriginal:'2018-10-15T00:10:00+14:00'}}}),'2018-10-15');
  assert.equal(memories.takenDate({exif:{Photo:{DateTimeOriginal:new Date('2018-10-15T12:00:00Z')}}}),'2018-10-15');
});
test('source birth times use the viewing computer local day, not UTC',()=>{
  const modulePath=path.resolve(__dirname,'../src/on-this-day.js');
  const code=`const m=require(${JSON.stringify(modulePath)});console.log(m.imageDate({created:Date.parse('2020-10-16T01:00:00Z')}));`;
  const run=TZ=>execFileSync(process.execPath,['-e',code],{env:{...process.env,TZ},encoding:'utf8',timeout:5000}).trim();
  assert.equal(run('America/Los_Angeles'),'2020-10-15');
  assert.equal(run('Asia/Tokyo'),'2020-10-16');
});
test('lightweight transport preserves capture date without streaming full EXIF',()=>{
  const source=image({id:'photo',exif:{Photo:{DateTimeOriginal:'2012:10:15 08:30:00'},large:'x'.repeat(50000)}});
  const light=lightweightAsset(source);
  assert.equal(light.takenDate,'2012-10-15');
  assert.equal(Object.hasOwn(light,'exif'),false);
  assert.equal(light.detailsDeferred,true);
  assert(memories.matches(light,today));
  assert(JSON.stringify(light).length<500);
});
