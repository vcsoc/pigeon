const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const python=process.env.PIGEON_SEMANTIC_PYTHON||path.resolve('.semantic-runtime/bin/python');
test('semantic engine persists incremental vectors, rejects stale/locked scope, and resumes after restart',{skip:!fs.existsSync(python),timeout:15000},()=>{
const script=String.raw`
import sys,runpy,tempfile,io,os,json,numpy as np
root=tempfile.mkdtemp();db=os.path.join(root,'semantic.sqlite3');sys.argv=['engine',db];sys.stdin=io.StringIO('');original=sys.stdout;sys.stdout=io.StringIO()
e=runpy.run_path('electron/semantic-engine.py');sys.stdout=original
v=np.zeros(768,dtype='<f4');v[0]=1
real_vector_batch=e['index_step'].__globals__['vector_batch']
e['index_step'].__globals__['vector']=lambda value:v
e['index_step'].__globals__['vector_batch']=lambda values,memory_limit=0:np.stack([v for _ in values])
def asset(name,text):
 p=os.path.join(root,name);open(p,'w').write(text);st=os.stat(p);return {'id':name,'path':p,'kind':'document','name':name,'size':st.st_size,'modified':st.st_mtime*1000}
a=asset('bird.txt','a bird flying over rooftops\n'*110);b=asset('cat.txt','a cat')
h=e['handle'];h({'action':'prune','assets':{'bird.txt':'fp1','cat.txt':'fp2'}})
assert set(h({'action':'plan'})['pending'])=={'bird.txt','cat.txt'}
first=h({'action':'index','asset':a,'fingerprint':'fp1'});assert not first['done'] and first['part']==0
second=h({'action':'index','asset':a,'fingerprint':'fp1'});assert second['part']==1
while not h({'action':'index','asset':a,'fingerprint':'fp1'})['done']:pass
while not h({'action':'index','asset':b,'fingerprint':'fp2'})['done']:pass
# One model handles all embeddings; low memory and visual inputs keep microbatches at one.
encode_calls=[];original_load=e['index_step'].__globals__['load_model']
class SharedModel:
 def encode(self,values,**kwargs):encode_calls.append((len(values),kwargs['batch_size']));return np.stack([v for _ in values])
e['index_step'].__globals__['load_model']=lambda:SharedModel()
assert real_vector_batch(['one','two'],10**15).shape==(2,768)
assert real_vector_batch(['one','two'],0).shape==(2,768)
assert real_vector_batch([{'image':'placeholder'}],10**15).shape==(1,768)
assert encode_calls==[(2,2),(2,1),(1,1)]
e['index_step'].__globals__['load_model']=original_load
# Prove concurrent extraction and single-thread SQLite commits, rather than merely counting jobs.
import threading
original_prepare=e['index_step'].__globals__['prepare_content'];barrier=threading.Barrier(2);seen={}
def concurrent_prepare(asset,part):
 seen.setdefault(part,set()).add(threading.get_ident());barrier.wait(timeout=2);return original_prepare(asset,part)
e['index_step'].__globals__['prepare_content']=concurrent_prepare
c=asset('batch-one.txt','one bird');d=asset('batch-two.txt','two birds')
batch=h({'action':'index_batch','jobs':[{'asset':c,'fingerprint':'c'},{'asset':d,'fingerprint':'d'}],'workers':2,'steps':2})
assert all(len(seen[part])==2 for part in (0,1)) and len(batch['results'])==2 and all(r['done'] for r in batch['results'])
e['index_step'].__globals__['prepare_content']=original_prepare
# A failed shared inference leaves every cursor retryable and preserves prior vectors.
e['index_step'].__globals__['vector_batch']=lambda *args:(_ for _ in ()).throw(RuntimeError('inference failed'))
f=asset('retry.txt','retry me')
try:h({'action':'index_batch','jobs':[{'asset':f,'fingerprint':'f'}]})
except RuntimeError:pass
else:raise AssertionError('inference failure should propagate')
assert e['DB'].execute('select cursor,complete from assets where id=?',(f['id'],)).fetchone()==(0,0)
e['index_step'].__globals__['vector_batch']=lambda values,memory_limit=0:np.stack([v for _ in values])
h({'action':'prune','assets':{'bird.txt':'fp1','cat.txt':'fp2'}})
assert h({'action':'plan'})['pending']==[]
assert h({'action':'info'})['indexed']==2
q={'action':'search','query':'bird','minimum':.5,'limit':10,'assets':{'bird.txt':'fp1'}}
assert [r['id'] for r in h(q)['results']]==['bird.txt']
assert h({**q,'assets':{'bird.txt':'changed'}})['results']==[]
page={**q,'assets':{'bird.txt':'fp1','cat.txt':'fp2'},'limit':1}
assert h(page)['totalMatches']==2
assert h(page)['results'][0]['id']!=h({**page,'offset':1})['results'][0]['id']
assert len(h({**page,'all':True,'offset':1})['results'])==2
# All-results mode is not subject to the legacy 1,000-result page cap.
bulk={f'bulk-{i}':'bulk-fp' for i in range(1005)}
for identity in bulk:
 e['DB'].execute('INSERT INTO assets(id,fingerprint,version,complete) VALUES(?,?,?,1)',(identity,'bulk-fp',e['MODEL_VERSION']))
 e['DB'].execute('INSERT INTO vectors(asset_id,part,vector,detail) VALUES(?,0,?,?)',(identity,v.tobytes(),json.dumps({'label':'Bulk match'})))
e['DB'].commit()
all_matches=h({**q,'assets':bulk,'all':True,'limit':1,'offset':1000})
assert len(all_matches['results'])==all_matches['totalMatches']==1005
assert all(all_matches['results'][i]['score']>=all_matches['results'][i+1]['score'] for i in range(1004))
assert len(h({**q,'assets':bulk,'limit':2000})['results'])==1000
e['DB'].execute("DELETE FROM vectors WHERE asset_id LIKE 'bulk-%'");e['DB'].execute("DELETE FROM assets WHERE id LIKE 'bulk-%'");e['DB'].commit()
# Tag changes replace only metadata vectors, preserve source cursors, and persist immediately.
before=e['DB'].execute('SELECT part,vector FROM vectors WHERE asset_id=? AND part>0',(a['id'],)).fetchall()
position=e['DB'].execute('SELECT cursor,complete FROM assets WHERE id=?',(a['id'],)).fetchone()
e['DB'].execute('UPDATE assets SET content_fingerprint=? WHERE id=?',('content-1',a['id']));e['DB'].commit()
a['tags']=['scarlet bird'];h({'action':'sync-assets','records':[{'asset':a,'fingerprint':'tagged','contentFingerprint':'content-1'}]})
assert json.loads(e['DB'].execute('SELECT metadata FROM assets WHERE id=?',(a['id'],)).fetchone()[0])['tags']==['scarlet bird']
assert a['id'] in h({'action':'plan'})['pending']
assert e['DB'].execute('SELECT part,vector FROM vectors WHERE asset_id=? AND part>0',(a['id'],)).fetchall()==before
captured=[]
def capture(values,memory_limit=0):captured.extend(values);return np.stack([v for _ in values])
e['index_step'].__globals__['vector_batch']=capture
updated=h({'action':'index_batch','jobs':[{'asset':a,'fingerprint':'tagged'}],'steps':2})
assert updated['results'][0]['done'] and len(captured)==1 and 'scarlet bird' in captured[0]
assert e['DB'].execute('SELECT cursor,complete FROM assets WHERE id=?',(a['id'],)).fetchone()==position
assert e['DB'].execute('SELECT part,vector FROM vectors WHERE asset_id=? AND part>0',(a['id'],)).fetchall()==before
# Existing 0.3.14 fingerprints migrate without unnecessarily discarding content or metadata.
legacy=asset('legacy.txt','a legacy document');legacy['tags']=[]
legacy_fp=json.dumps([legacy['path'],legacy['size'],legacy['modified'],'',legacy['name'],'',[],'',''],separators=(',',':'))
while not h({'action':'index','asset':legacy,'fingerprint':legacy_fp})['done']:pass
legacy_vectors=e['DB'].execute('SELECT part,vector FROM vectors WHERE asset_id=?',(legacy['id'],)).fetchall()
cp=json.dumps([legacy['path'],legacy['size'],legacy['modified'],'','',0,'','',''],separators=(',',':'))
fp=json.dumps([cp,legacy['name'],'',[]],separators=(',',':'))
h({'action':'sync-assets','records':[{'asset':legacy,'fingerprint':fp,'contentFingerprint':cp}]})
assert e['DB'].execute('SELECT part,vector FROM vectors WHERE asset_id=?',(legacy['id'],)).fetchall()==legacy_vectors
assert e['DB'].execute('SELECT complete,metadata_dirty FROM assets WHERE id=?',(legacy['id'],)).fetchone()==(1,0)
# Saved image edits use the edited image, and a changed content fingerprint clears old vectors.
from PIL import Image
image_path=os.path.join(root,'original.png');edited_path=os.path.join(root,'edited.png')
Image.new('RGB',(8,8),(255,0,0)).save(image_path);Image.new('RGB',(8,8),(0,0,255)).save(edited_path)
st=os.stat(image_path);image={'id':'image','path':image_path,'imagePath':image_path,'kind':'image','name':'image','size':st.st_size,'modified':st.st_mtime*1000,'tags':[]}
h({'action':'sync-assets','records':[{'asset':image,'fingerprint':'original','contentFingerprint':'original-content'}]})
while not h({'action':'index','asset':image,'fingerprint':'original'})['done']:pass
image['imagePath']=edited_path;h({'action':'sync-assets','records':[{'asset':image,'fingerprint':'edited','contentFingerprint':'edited-content'}]})
assert e['DB'].execute('SELECT count(*) FROM vectors WHERE asset_id=?',('image',)).fetchone()[0]==0
captured.clear()
while not h({'action':'index','asset':image,'fingerprint':'edited'})['done']:pass
assert any(isinstance(value,dict) and value.get('image').getpixel((0,0))==(0,0,255) for value in captured if isinstance(value,dict))
h({'action':'sync-assets','removedIds':['image']});assert e['DB'].execute('SELECT count(*) FROM vectors WHERE asset_id=?',('image',)).fetchone()[0]==0
h({'action':'prune','assets':{'bird.txt':'changed'}})
assert h({'action':'info'})['vectors']==0
assert h({'action':'plan'})['pending']==['bird.txt']
e['DB'].close();sys.argv=['engine',db];sys.stdout=io.StringIO();e2=runpy.run_path('electron/semantic-engine.py');sys.stdout=original
assert e2['handle']({'action':'plan'})['pending']==['bird.txt']
e2['DB'].close()
print('engine persistence and scope checks passed')
`;
const output=execFileSync(python,['-c',script],{timeout:12000,encoding:'utf8'});assert.match(output,/checks passed/);
});
