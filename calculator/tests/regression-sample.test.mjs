import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
const page=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const template=JSON.parse(page.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
const manifest=JSON.parse(page.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1]);
const E=await import('data:text/javascript;base64,'+gunzipSync(Buffer.from(manifest['7f0c6180-e6c1-4faf-bd4a-6b2fddc15715'].data,'base64')).toString('base64'));
const ref=JSON.parse(fs.readFileSync(new URL('./regression-reference.json',import.meta.url),'utf8'));
const near=(a,b,label)=>assert.ok(Math.abs(a-b)<=1e-7*Math.max(1,Math.abs(b)),`${label}: ${a} != ${b}`);
function check(m,r){assert.ok(!m.error,m.error);assert.equal(m.n,r.n);assert.equal(m.df1,r.df1);assert.equal(m.df2,r.df2);near(m.F,r.F,'F');near(m.R2,r.R2,'R2');near(m.pModel,r.p,'model p');m.coefs.forEach((c,j)=>{near(c.b,r.b[j],'b');near(c.se,r.se[j],'se');});}
for(const test of ref.cases){
  const y=Float64Array.from(test.y,v=>v==null?NaN:v),preds=[0,1,2].map(j=>({name:'x'+j,kind:'num',a:Float64Array.from(test.x,row=>row[j]==null?NaN:row[j])}));
  const m=E.regress(y,preds,null,test.robust?{type:'robust'}:null);check(m,test.expected);assert.equal(m.dropped,240-m.n);
}
const n=1025720,y=new Float64Array(n),x=new Array(n);
for(let i=0;i<n;i++){const value=i%7<3?1:0;x[i]=String(value);y[i]=i<512799?.05+.8*value+Math.sin(i*.73)*.3:NaN;}
const large=E.regress(y,[{name:'binary',kind:'cat',a:x,levels:['0','1']}],null);
check(large,ref.large);assert.equal(large.n,512799);assert.equal(large.dropped,n-512799);near(large.F,large.coefs[1].t**2,'one-slope F = t²');assert.ok(large.F>99999);
console.log('OLS classical/HC1 b, SE, R², F, df and p match independent NumPy/SciPy references; 1,025,720 input rows correctly yield 512,799 estimation observations.');

class Base{props={};setState(p){this.state={...this.state,...(typeof p==='function'?p(this.state):p)};}forceUpdate(){}}
globalThis.React={createElement:(tag,props,...children)=>({tag,props,children})};
globalThis.window={innerWidth:1600};globalThis.document={documentElement:{style:{zoom:''}}};
const C=new Function('DCLogic',template.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1]+';return Component')(Base);
const csv=Buffer.from('y,x,group,unrelated\n1,1,A,\n2,2,A,\n4,3,A,\n4,4,A,\n7,5,A,\n,6,A,\n8,,A,\n10,8,B,\n9,9,B,\n12,10,B,\n13,11,B,\n15,12,B,\n');
const c=new C();c._E=E;c._raw=await E.parseCSV(csv.buffer.slice(csv.byteOffset,csv.byteOffset+csv.byteLength),()=>{});
c.state={...c.state,screen:'work',tab:'reg',nRows:c._raw.n,cols:c._raw.names.map((_,i)=>E.profileCol(c._raw,i)),autoScreen:false,depVar:'y',predictors:['x'],regModel:'ols',treat:{x:'numeric'}};
c.jobMemo=(key,fn)=>{const spec=fn();return E[spec.__work](...spec.args);};
c._regRan=c.regSpec();let out=c.renderVals();assert.ok(out.hasModel);assert.equal(out.regSampleUsed,10);assert.equal(out.regSampleDataset,12);assert.equal(out.regSampleExcluded,2);
assert.equal(out.sumCells.find(s=>s.k==='N USED').v,'10');assert.match(out.sgN,/10 USED IN REGRESSION/);assert.match(out.regSampleText,/10 observations used/);
// Unrelated blank columns do not delete otherwise complete estimation rows.
c.state.subg={all:[{v:'group',t:'in',vals:['A']}]};c.clearMemo();c._regRan=c.regSpec();out=c.renderVals();assert.ok(out.hasModel);assert.equal(out.regSampleUsed,5);assert.equal(out.regSampleOutside,5);assert.equal(out.regSampleExcluded,2);assert.match(out.sgN,/7 ROWS IN SCOPE/);
assert.ok(out.sumCells.find(s=>s.k==='F').tip.includes('99,999'));
assert.ok(template.includes('data-testid="regression-estimation-sample"'));
// A regular logit agrees with a separately optimized SciPy likelihood.
const lr=ref.logit, ly=Float64Array.from(lr.y,v=>v==null?NaN:v);
const lp=[0,1].map(j=>({name:'x'+j,kind:'num',a:Float64Array.from(lr.x,row=>row[j]==null?NaN:row[j])}));
const regular=E.glm(ly,lp,null,'logistic');assert.ok(!regular.error,regular.error);assert.ok(regular.converged);assert.equal(regular.n,lr.expected.n);
regular.coefs.forEach((v,j)=>{near(v.b,lr.expected.b[j],'logit b');near(v.se,lr.expected.se[j],'logit SE');});near(regular.ll,lr.expected.ll,'logit ll');near(regular.llNull,lr.expected.llNull,'logit null ll');
// Coefficient magnitude is unit-dependent and cannot diagnose separation.
const scaled=lp.map((p,j)=>j? p : {...p,a:Float64Array.from(p.a,v=>v/1000)});
const scaledFit=E.glm(ly,scaled,null,'logistic');assert.ok(!scaledFit.error,scaledFit.error);assert.ok(scaledFit.converged);assert.ok(Math.abs(scaledFit.coefs[1].b)>15);near(scaledFit.coefs[1].b,regular.coefs[1].b*1000,'rescaled coefficient');
// Stata's documented 0/1 perfect-prediction example, replicated for enough rows.
const sy=Float64Array.from([0,0,0,1,0,0,0,1]), sx=['1','1','0','0','1','1','0','0'];
let invalid=E.glm(sy,[{name:'pobreza_e',kind:'cat',a:sx,levels:['0','1']}],null,'logistic');
assert.equal(invalid.errorCode,'logit_separation');assert.equal(invalid.separation.count,4);assert.equal(invalid.separation.outcome,0);assert.equal(invalid.coefs,undefined);assert.match(invalid.error,/different estimation sample/);
invalid=E.glm(sy,[{name:'pobreza_e',kind:'num',a:Float64Array.from(sx,Number)}],null,'logistic');assert.equal(invalid.errorCode,'logit_separation');
// A pure reference category also creates quasi-complete separation.
invalid=E.glm(Float64Array.from([0,0,0,1,0,1,0,1]),[{name:'category',kind:'cat',a:['A','A','B','B','C','C','B','C'],levels:['A','B','C']}],null,'logistic');assert.equal(invalid.errorCode,'logit_separation');assert.equal(invalid.separation.level,'A');
// Multivariable separation that has no single-predictor threshold must not publish
// the arbitrary last IRLS iterate as an estimated model.
const points=[[-2,0],[0,-2],[-1,.9],[.9,-1],[2,0],[0,2],[1,-.9],[-.9,1]];
invalid=E.glm(Float64Array.from([0,0,0,0,1,1,1,1]),[0,1].map(j=>({name:'x'+j,kind:'num',a:Float64Array.from(points,p=>p[j])})),null,'logistic');assert.ok(invalid.error);assert.equal(invalid.coefs,undefined);
// The shipped UI suppresses coefficients and margins for a separated fit.
c.state={...c.state,subg:{all:[]},regModel:'logistic',depVar:'y',predictors:['x']};
c._raw={n:8,names:['y','x'],labels:['',''],vlabs:{},cols:[{k:'n',a:sy},{k:'n',a:Float64Array.from(sx,Number)}]};
c.state.cols=c._raw.names.map((_,i)=>E.profileCol(c._raw,i));c.state.nRows=8;c.state.treat={x:'categorical'};c.clearMemo();c._regRan=c.regSpec();out=c.renderVals();assert.ok(out.hasRegError);assert.equal(out.hasModel,false);assert.equal(out.mgShow,false);assert.match(out.regError,/Perfect prediction/);
clearTimeout(c._ghostT);clearTimeout(c._mfOkT);
console.log('Shipped regression UI uses estimator N, not dataset total; explicit sample breakdown distinguishes subgroup exclusions, model exclusions and unrelated missing columns.');
console.log('Regular and rescaled logit match independent likelihood estimates; categorical/base-level/numeric perfect prediction and multivariable nonconvergence cannot publish invalid inference.');
