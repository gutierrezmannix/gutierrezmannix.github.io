import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
const page=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const template=JSON.parse(page.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
const manifest=JSON.parse(page.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1]);
const E=await import('data:text/javascript;base64,'+gunzipSync(Buffer.from(manifest['7f0c6180-e6c1-4faf-bd4a-6b2fddc15715'].data,'base64')).toString('base64'));
const code=template.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
class Base{props={};setState(p,cb){this.state={...this.state,...(typeof p==='function'?p(this.state):p)};cb?.();}forceUpdate(){}}
globalThis.React={createElement:(tag,props,...children)=>({tag,props,children})};
globalThis.window={innerWidth:1440};globalThis.document={documentElement:{style:{zoom:''}}};
const C=new Function('DCLogic',code+';return Component')(Base);
const b=Buffer.from('x,y,group\n1,2,A\n2,4,A\n3,5,B\n4,8,B\n5,9,C\n6,10,C');
const raw=await E.parseCSV(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),()=>{});
const c=new C();c._E=E;c._raw=raw;c.state={...c.state,screen:'work',tab:'one',cols:raw.names.map((_,i)=>E.profileCol(raw,i)),nRows:raw.n,autoScreen:false};
const models=c.modelGuideData(),retired=new Set(c.asRetired());assert.deepEqual(models,JSON.parse(fs.readFileSync(new URL('../src/model-guide.json',import.meta.url),'utf8')).filter(m=>!retired.has(m.route?.analysisId)));
assert.equal(models.length,87);assert.equal(new Set(models.map(m=>m.id)).size,87);assert.ok(!models.some(m=>m.route?.analysisId==='arima'));
for(const m of models){for(const k of ['what','use','data','read','caution','example'])assert.ok(typeof m[k]==='string'&&m[k].length>15,m.id+'/'+k);for(const s of m.sources)assert.match(s.url,/^https:\/\//);}
const render=patch=>{c.state={...c.state,...patch};c.clearMemo();return c.renderVals();};
let out=render({});out.mfHelp();assert.equal(c.state.mfPane,'help');assert.equal(c.state.mfDock,true);assert.equal(c.state.modelGuideId,'univariate');
out=c.renderVals();assert.equal(out.modelGuideEntries.length,87);assert.ok(out.modelGuideEntries.find(m=>m.id==='univariate').open);
out.modelGuideEntries.find(m=>m.id==='univariate').toggle();assert.equal(c.renderVals().modelGuideEntries.some(m=>m.open),false);
out.modelGuideQuerySet({target:{value:'logit'}});out=c.renderVals();assert.ok(out.modelGuideEntries.some(m=>m.id==='logistic'));assert.ok(out.modelGuideEntries.some(m=>m.id==='ordinal'));
out.modelGuideQuerySet({target:{value:'before and after'}});assert.ok(c.renderVals().modelGuideEntries.some(m=>m.id==='ttest-paired'));
out=render({modelGuideQuery:'no-such-analysis-zzzz'});assert.equal(out.modelGuideEmpty,true);assert.equal(out.modelGuideEntries.length,0);out.modelGuideReset();
out=c.renderVals();for(const category of out.modelGuideCategories){out.modelGuideCategorySet({target:{value:category.id}});const filtered=c.renderVals();assert.ok(filtered.modelGuideEntries.length>0);assert.ok(filtered.modelGuideEntries.every(m=>models.find(x=>x.id===m.id).category===category.id));assert.ok(template.includes('option value="'+category.id+'"'));}
const before=JSON.stringify(raw);
for(const m of models.filter(m=>m.route)){
  out=render({modelGuideQuery:'',modelGuideCategory:'',modelGuideId:m.id});const entry=out.modelGuideEntries.find(x=>x.id===m.id);entry.go();for(const [k,v]of Object.entries(m.route))assert.equal(c.state[k],v,m.id+' route '+k);assert.equal(c._raw,raw);
}
assert.equal(JSON.stringify(raw),before,'guide navigation must not edit data');
for(const [patch,id]of [[{tab:'ttest',ttMode:'value'},'ttest-value'],[{tab:'ttest',ttMode:'paired'},'ttest-paired'],[{tab:'reg',regModel:'logistic'},'logistic'],[{tab:'reg',regModel:'ologit'},'ordinal'],[{tab:'reg',regModel:'poisson'},'poisson'],[{tab:'ts'},'time-series'],[{tab:'ergm'},'centrality'],[{tab:'sem'},'cfa']]){Object.assign(c.state,patch);c.openModelGuide();assert.equal(c.state.modelGuideId,id);}
out=render({tab:'one'});const menu=out.mfNavGroups.flatMap(g=>g.items).find(i=>i.key==='tests');assert.ok(menu.content);const item=c.asGroups().find(g=>g[0]==='Model guide')[1][0];assert.ok(item);c.asRoute(item[1]);assert.equal(c.state.mfPane,'help');
const help=template.slice(template.indexOf('<!-- GM26 model guide begin -->'),template.indexOf('<!-- GM26 model guide end -->'));
assert.ok(help.includes('Search model guide'));assert.ok(help.includes('aria-expanded="{{ m.open }}"'));assert.ok(help.includes('Keyboard shortcuts'));assert.ok(!help.includes('Practice exercises'));assert.ok(!help.includes('Stata commands you can type'));
clearTimeout(c._ghostT);clearTimeout(c._mfOkT);
console.log('87 guide entries (13 retired time-series forecasting pages removed), search/synonyms/no-results, all topic filters, expandable definitions, all analysis routes, current-model focus and data preservation passed.');
