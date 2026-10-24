import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
const root=path.resolve(process.argv[2]),{WebR}=await import(pathToFileURL(path.join(root,'package/dist/webr.mjs'))),r=new WebR({interactive:false});await r.init();await r.FS.mkdir('/packages');await r.FS.mount('NODEFS',{root:path.join(root,'library')},'/packages');await r.evalRVoid('.libPaths(c("/packages",.libPaths()))');await r.evalRVoid(fs.readFileSync(new URL('../src/analysis-methods.R',import.meta.url),'utf8'));
const fixtures=JSON.parse(fs.readFileSync(path.join(root,'integration-results.json')));let count=0;
async function run(id,mutate,expectedError,check){const fixture=fixtures.find(q=>q.id===id),p=structuredClone(fixture.packet);mutate?.(p);await r.FS.writeFile('/tmp/edge.json',new TextEncoder().encode(JSON.stringify(p)));const out=JSON.parse(await r.evalRString('jsonlite::toJSON(gm_run(jsonlite::fromJSON("/tmp/edge.json",simplifyVector=FALSE)),auto_unbox=TRUE,null="null",na="null",digits=NA)'));if(expectedError){assert.match(out.error,expectedError,id);assert.deepEqual(out.tables,[]);assert.deepEqual(out.plots,[]);}else{assert.ok(!out.error,id+': '+out.error);check?.(out,p)}count++;console.log('PASS edge',id,expectedError?.source||'valid variation');}
try{
 await run('prop1',p=>p.data.v5.values[0]=2,/0\/1/);
 await run('prop1',p=>{p.options.inputMode='summary';Object.assign(p.options,{successes:2,trials:10,null:.5});},null,o=>assert.equal(o.analysisN,10));
 await run('fisher',p=>{p.options.inputMode='summary';p.options.table='1,9\n11,3'},null,o=>assert.ok(Math.abs(o.tables.find(t=>t.title==='Test').rows[0][2]-.0027594561852200836)<1e-10));
 await run('fisher',p=>{p.options.inputMode='summary';p.options.table='-1,2\n3,4'},/nonnegative/);
 await run('gof',p=>{p.options.inputMode='summary';p.options.counts='-1,10,20'},/nonnegative/);
 await run('mcnemar_exact',p=>{p.options.inputMode='summary';p.options.table='10,0\n0,10'},/discordant/);
 await run('repeated',p=>p.data.v10.values[0]=2,/unique subject/);
 await run('panel_fe',p=>p.data.v10.values[0]=2,/must be unique/);
 await run('pca',p=>p.data.v2.values.fill(1),/nonconstant/);
 await run('impute',p=>p.data.v2.values=p.data.v2.values.map(v=>v??1),/no missing/);
 await run('cox',p=>p.data.v13.values.fill(0),/observed event/);
 await run('cox',null,null,o=>assert.equal(o.analysisN,180));
 await run('arima',p=>p.data.v8.values[20]=20.5,/regularly spaced/);
 await run('arima',p=>p.data.v1.values[20]=null,/no missing/);
 await run('tsreg',p=>Object.assign(p.options,{seasonalDummies:true,frequency:12}),null,o=>assert.ok(o.tables.some(t=>t.title==='Forecasts and prediction intervals')));
 await run('arima',p=>Object.assign(p.options,{p:1,d:0,q:0}),null,o=>assert.ok(o.tables.some(t=>t.title==='ARIMA coefficients')));
 await run('naive',p=>Object.assign(p.options,{evaluate:true,initial:170,horizon:1}),null,o=>assert.equal(o.tables.find(t=>t.title==='Expanding-window forecast evaluation').rows[0][1],10));
 await run('survey_test',p=>p.alpha=.01,null,o=>assert.equal(o.tables.find(t=>t.title==='Confidence interval').rows[0][2],.99));
 await run('survey_desc',p=>p.data.v14.values[0]=0,/positive/);
 await run('survey_desc',p=>p.domain=p.data.v14.values.map((_,i)=>i<90),null,o=>assert.equal(o.analysisN,90));
 await run('power_t',p=>p.options.sample=50,null,o=>assert.ok(o.tables[0].rows.some(row=>row[0]==='power'&&row[1]>.6)));
 await run('merge',p=>{delete p.other.v1;p.other.v99={name:'new column',type:'numeric',values:p.data.v1.values};},null,o=>assert.equal(o.labels.v99,'new column'));
 await run('append',p=>delete p.other.v1,/matching columns/);
 console.log(count+' validation and alternate-option cases passed.');
}finally{r.close()}
