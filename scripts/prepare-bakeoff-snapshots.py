"""Copy only existing outputs; never generate, rank, resolve, or call APIs."""
import json,pathlib
root=pathlib.Path(__file__).resolve().parents[1]
out={}
prepared=json.load(open(root/'client/src/data/prepared-similar-media.json'))
for row in prepared:
 s=row['source']
 if s['type'] not in ['movie','tv']:continue
 key=s['type']+':'+s['external_id']
 out.setdefault(key,{})['production']={'provenance':'Bundled consumer fallback snapshot (not a live shared-cache read); client/src/data/prepared-similar-media.json','capturedAt':None,
  'items':[dict(rank=i+1,title=x['title'],type=x['type'],id=x['type']+':'+x['external_source']+':'+x['external_id'],poster=x.get('poster_url','')) for i,x in enumerate(row['recommendations'])]}
audit=json.load(open(root/'.local/outputs/recommendation-audit-evidence.json'))
saved=audit['saved_consumer_output']
out.setdefault('tv:250923',{})['production']={'provenance':'Previously captured actual shared consumer cache, recommendation-audit-evidence.json; historical snapshot, not a new production execution',
 'capturedAt':saved['refreshed_at'],'items':[dict(rank=i+1,title=x['title'],type=x['type'],id=x['id']) for i,x in enumerate(saved['rows'])]}
cases=json.load(open(root/'.local/outputs/bounded-rerank-evaluation/cases.json'))['cases']
for p in cases:
 if p['version']!='same' or p['source']['type'] not in ['movie','tv']:continue
 r=json.load(open(root/'.local/outputs/bounded-rerank-evaluation'/ (p['id']+'-r1.result.json')))
 if not r['valid']:raise ValueError('Cannot import failed experimental output')
 byid={c['id']:c for c in p['candidates']}
 sid=p['source']['id'].split(':')[-1]
 out.setdefault(p['source']['type']+':'+sid,{})['experimental']={
 'provenance':'Frozen GPT-4.1 same-media primary run 1; bounded-rerank-evaluation. No new call or selection.',
 'capturedAt':json.load(open(root/'.local/outputs/bounded-rerank-evaluation/manifest.json'))['frozen_at'],
 'items':[dict(rank=d['rank'],title=byid[d['candidate_id']]['title'],type=byid[d['candidate_id']]['type'],id=d['candidate_id']) for d in r['decisions'] if d['recommend']]}
target=root/'server/data/recommendation-bakeoff-snapshots.json'
target.parent.mkdir(exist_ok=True)
target.write_text(json.dumps(out,ensure_ascii=False,indent=2))
print('Copied existing snapshots:',len(out),'sources')
