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
