import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {gunzipSync} from 'node:zlib';
const page=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');const manifest=JSON.parse(page.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1]);const E=await import('data:text/javascript;base64,'+gunzipSync(Buffer.from(manifest['7f0c6180-e6c1-4faf-bd4a-6b2fddc15715'].data,'base64')).toString('base64'));const t=JSON.parse(page.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);const code=t.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
class Base{props={};setState(p,cb){this.state={...this.state,...(typeof p==='function'?p(this.state):p)};cb?.();}}
globalThis.React={createElement:(tag,props,...children)=>({tag,props,children})};globalThis.window={innerWidth:1440};globalThis.document={documentElement:{style:{zoom:''}}};
const C=new Function('DCLogic',code+';return Component')(Base);
const parse=async source=>{const b=Buffer.from(source);return E.parseCSV(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),()=>{});};
const raw=await parse('before,after,group,weight\n10,9,A,1\n12,10,A,1\n11,10,A,1\n14,12,A,2\n15,12,B,1\n17,14,B,2\n16,15,B,1\n19,15,B,1\n20,18,C,1\n22,19,C,1\n21,,C,1\n24,20,C,1');
const c=new C();c._E=E;c._raw=raw;c.state={...c.state,cols:raw.names.map((_,i)=>E.profileCol(raw,i)),nRows:raw.n,screen:'work',tab:'ttest',exploreVar:'before',ttMode:'value',ttMu:'15',autoScreen:false};
const render=patch=>{c.state={...c.state,...patch};c.clearMemo();return c.renderVals();};
let out=render({});assert.ok(out.isTtest&&out.ttShow&&out.ttHasRes);assert.equal(c.descFor().t,'ttestx');assert.ok(c.descFor().r.includes('mu = 15'));assert.ok(!out.isOne);
assert.equal(E.oneSampleT([1,3],null,0).df,1);assert.equal(E.pairedT([1,4],[0,2],null).n,2);assert.match(E.pairedT([1,2],[1],null).error,/equal lengths/);assert.match(E.oneSampleT([1,1],null,0).error,/variation/);
assert.match(E.oneSampleT([1,2],null,NaN).error,/finite/);assert.match(E.oneSampleT([1,2],[1,1],0).error,/unweighted/);assert.match(E.ttDetails({mode:'groups',x:[1,1],y:[2,2]}).error,/variation/);
out=render({ttMu:'15oops'});assert.ok(out.ttHasErr&&!out.ttHasRes);assert.equal(c.descFor(),null);
out=render({ttMu:'',ttMode:'value'});assert.ok(out.ttHasErr&&!out.ttHasRes);
out=render({ttMode:'paired',ttY2:'after'});assert.ok(out.ttHasRes);assert.ok(c.descFor().r.includes('paired = TRUE'));assert.ok(c.descFor().tbl.includes('complete pairs)\t11'));
out=render({ttMode:'groups',ttG:'group',ttA:'B',ttB:'A'});assert.ok(out.ttHasRes);assert.ok(c.descFor().r.includes('var.equal = FALSE'));assert.ok(c.descFor().tbl.includes('Mean difference (first minus second)\t5'));
out=render({ttA:'A',ttB:'B'});assert.ok(c.descFor().tbl.includes('Mean difference (first minus second)\t-5'));
out=render({weightVar:'weight'});assert.ok(out.ttWeightBlock&&!out.ttShow);assert.equal(c.descFor(),null);
out=render({weightVar:'',ttMode:'value',ttMu:'15',flt:{v:'group',op:'==',val:'A',on:true,cat:true}});assert.ok(out.ttHasRes);assert.ok(c.descFor().tbl.includes('complete pairs)\t4'));
out=render({flt:null,ttMode:'paired',ttY2:'after'});const modes=out.ttModeBtns;assert.equal(modes.length,3);modes.find(b=>b.label==='TWO INDEPENDENT GROUPS').click();assert.equal(c.state.ttMode,'groups');assert.equal(c.state.tab,'ttest');
const menu=out.mfNavGroups.flatMap(g=>g.items).find(i=>i.key==='tests');assert.equal(menu.items.filter(i=>i.label==='t-tests').length,1);assert.ok(!menu.items.some(i=>/t-tests ·/.test(i.label)));menu.items.find(i=>i.label==='t-tests').click();assert.equal(c.state.tab,'ttest');
assert.ok(t.indexOf('<!-- GM26 unified t-tests begin -->')>t.indexOf('<sc-if value="{{ isOne }}"'));assert.ok(t.includes('T-test outcome'));assert.ok(t.includes('Add results to console'));
if(process.env.GM26_TTEST_R_DIR){const dir=process.env.GM26_TTEST_R_DIR,ref=await parse(fs.readFileSync(path.join(dir,'reference.csv'),'utf8'));for(let i=0;i<ref.n;i++){const row=Object.fromEntries(ref.names.map((n,j)=>[n,ref.cols[j].a[i]]));const data=await parse(fs.readFileSync(path.join(dir,row.mode+'-'+row.k+'.csv'),'utf8'));let x=Array.from(data.cols[0].a),y=Array.from(data.cols[1].a);if(row.mode==='value')while(Number.isNaN(x.at(-1)))x.pop();const r=E.ttDetails({mode:row.mode,x,y,mu:row.mu,alpha:row.alpha});assert.ok(!r.error,row.mode+'/'+row.k+': '+r.error);for(const key of ['estimate','t','df','p','lo','hi'])assert.ok(Math.abs(r[key]-row[key])<1e-8*Math.max(1,Math.abs(row[key])),`${row.mode}/${row.k}/${key}: ${r[key]} vs ${row[key]}`);}console.log('90 t-tests match R: estimates, t, df, two-sided p and 95%/99%/99.99% confidence intervals.');}
console.log('Unified menu, three designs, filters, group order, pairwise missingness, two observations, validation, weight guard and R export passed.');
c.jumpArm=()=>{};c.runStataExtra=()=>false;
for(const [command,mode]of [['t.test(df$before)','value'],['t.test(before ~ group, data = df)','groups'],['t.test(df$before, df$after, paired = TRUE)','paired'],['ttest before == 15','value'],['ttest before == after','paired'],['ttest before, by(group) unequal','groups']]){c.runCmdLine(command);assert.equal(c.state.mfCmdErr,'',command+': '+c.state.mfCmdErr);assert.equal(c.state.tab,'ttest',command);assert.equal(c.state.ttMode,mode,command);clearTimeout(c._mfOkT);}
c.runCmdLine('t.test(df$before, df$after)');assert.match(c.state.mfCmdErr,/independent samples/);c.runCmdLine('t.test(before ~ group, var.equal = TRUE)');assert.match(c.state.mfCmdErr,/Welch/);c.runCmdLine('t.test(df$before, alternative = "greater")');assert.match(c.state.mfCmdErr,/two-sided/);clearTimeout(c._mfOkT);
console.log('All three R/Stata command routes open the unified workspace; ambiguous or unsupported R designs are rejected.');

c.runCmdLine('t.test(df$before, mu = 15, conf.level = 0.99)');assert.ok(Math.abs(c.alpha()-.01)<1e-12);clearTimeout(c._mfOkT);
