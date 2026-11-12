'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const files=['pigeon-overview.json','pigeon-operations.json'];
test('Pigeon Grafana dashboards use existing datasource UIDs and privacy-scoped queries',()=>{
  for(const file of files){const dashboard=JSON.parse(fs.readFileSync(path.join(__dirname,'../grafana/dashboards',file),'utf8'));assert.ok(dashboard.uid.startsWith('pigeon-'));assert.ok(dashboard.panels.length>=5);for(const panel of dashboard.panels){assert.ok(['prometheus','loki','tempo'].includes(panel.datasource.uid));for(const target of panel.targets)assert.match(target.expr||target.query,/pigeon-desktop/);}}
});
test('Tempo panel performs a service-scoped TraceQL search',()=>{const d=JSON.parse(fs.readFileSync(path.join(__dirname,'../grafana/dashboards/pigeon-operations.json'),'utf8'));const p=d.panels.find(panel=>panel.datasource.uid==='tempo');assert.equal(p.targets[0].queryType,'traceql');assert.match(p.targets[0].query,/resource\.service\.name/);});
