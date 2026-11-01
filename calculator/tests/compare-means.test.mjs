// Tests ▾ → T-tests (Compare means) and Tests ▾ → Correlation (the matrix), build .62: the page code against SciPy
// (tests/data/compare-means-reference.json, from tests/compare-means-reference.py), the page itself, and the exports.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';
const page=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');const manifest=JSON.parse(page.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1]);const E=await import('data:text/javascript;base64,'+gunzipSync(Buffer.from(manifest['7f0c6180-e6c1-4faf-bd4a-6b2fddc15715'].data,'base64')).toString('base64'));const t=JSON.parse(page.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);const code=t.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
class Base{props={};setState(p,cb){this.state={...this.state,...(typeof p==='function'?p(this.state):p)};cb?.();}}
globalThis.React={createElement:(tag,props,...children)=>({tag,props,children})};globalThis.window={innerWidth:1440};globalThis.document={documentElement:{style:{zoom:''}}};
const C=new Function('DCLogic',code+';return Component')(Base);
const REF=JSON.parse(fs.readFileSync(new URL('./data/compare-means-reference.json',import.meta.url),'utf8'));
const parse=async source=>{const b=Buffer.from(source);return E.parseCSV(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),()=>{});};
const make=async(csv,state)=>{const raw=await parse(csv);const c=new C();c._E=E;c._raw=raw;c.state={...c.state,cols:raw.names.map((_,i)=>E.profileCol(raw,i)),nRows:raw.n,screen:'work',autoScreen:false,...state};return c;};
const render=(c,patch)=>{c.state={...c.state,...patch};c.clearMemo();return c.renderVals();};
const text=n=>n==null||n===false||n===true?'':typeof n!=='object'?String(n):Array.isArray(n)?n.map(text).join(''):text(n.children);
const find=(n,pred,acc=[])=>{if(n&&typeof n==='object'){if(Array.isArray(n))n.forEach(x=>find(x,pred,acc));else{if(pred(n))acc.push(n);find(n.children,pred,acc);}}return acc;};
const close=(a,b,tol,msg)=>{if(b===null||b===Infinity||b===-Infinity){assert.ok(a===b||(!Number.isFinite(a)&&!Number.isFinite(b)),msg+': '+a+' vs '+b);return;}assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),msg+': '+a+' vs '+b);};

test('correlation matrix: r, p, n and the confidence limits match SciPy',async()=>{
  let pairs=0;
  for(const [k,R] of REF.cor.entries()){
    const c=await make(R.csv,{tab:'corr',corVars:R.vars,corMethod:R.method,corRows:R.rows,alphaSel:String(+(1-R.level/100).toFixed(2))});
    const M=c.corCompute(c.corVarsNow());
    for(const q of R.pairs){
      const cell=M.cells[q.i][q.j],tag='case '+k+' '+R.method+' '+R.rows+' '+R.vars[q.i]+'×'+R.vars[q.j];
      assert.equal(cell.n,q.n,tag+' n');
      if(q.r===null){assert.ok(!Number.isFinite(cell.r),tag+' should be empty');continue;}
      close(cell.r,q.r,1e-9,tag+' r');close(cell.p,q.p,1e-7,tag+' p');close(cell.lo,q.lo,1e-7,tag+' lo');close(cell.hi,q.hi,1e-7,tag+' hi');pairs++;
    }
  }
  assert.ok(pairs>300,'pairs checked: '+pairs);
});

test('compare means: t, df, p and the limits match SciPy (two- and one-sided; Welch and Student; from data and from summaries)',async()=>{
  for(const [k,R] of REF.tt.entries()){
    const st={tab:'ttest',exploreVar:'y',ttMode:R.mode,ttAlt:R.alt,ttEqual:R.equal,alphaSel:String(+(1-R.level/100).toFixed(2))};
    if(R.mode==='groups')Object.assign(st,{ttG:'g'});if(R.mode==='paired')st.ttY2='y2';if(R.mode==='value')st.ttMu=String(R.mu);
    const c=await make(R.csv,st),tag='case '+k+' '+R.mode+' '+R.alt+(R.equal?' student':'')+' '+R.level+'%';
    const D=c.cmData();assert.ok(!D.error,tag+': '+D.error);const r=c.cmResult(D);
    close(r.t,R.t,1e-8,tag+' t');close(r.df,R.df,1e-8,tag+' df');close(r.p,R.p,1e-7,tag+' p');const sh=R.mode==='value'?R.mu:0;/* one sample: the page shows the difference from the value */close(r.lo+sh,R.lo,1e-7,tag+' lo');close(r.hi+sh,R.hi,1e-7,tag+' hi');
    const S=R.summary,kind=R.mode==='groups'?'two':R.mode==='paired'?'paired':'one';
    render(c,{ttMode:'summary',ttSum:{kind,m1:String(S.m1),s1:String(S.s1),n1:String(S.n1),m2:String(S.m2??''),s2:String(S.s2??''),n2:String(S.n2??''),mu:R.mode==='value'?String(R.mu):'0'}});
    const D2=c.cmData();assert.ok(!D2.error,tag+' summary: '+D2.error);const r2=c.cmResult(D2);
    close(r2.t,R.tSummary,1e-8,tag+' summary t');close(r2.p,R.pSummary,1e-7,tag+' summary p');
  }
});

const DATA='y,g,y2,z,txt\n10,1,9,3,a\n12,1,10,1,b\n11,1,10,4,c\n14,1,12,2,d\n15,2,12,8,e\n17,2,14,2,f\n16,2,15,,g\n19,2,15,1,h\n20,3,18,5,i\n22,3,19,9,j\n21,3,,1,k\n24,3,20,7,l';

test('compare means page: sentence, groups, swap, settings, exports and the console entry',async()=>{
  const c=await make(DATA,{tab:'ttest',exploreVar:'y',ttMode:'groups',ttG:'g'});
  let out=render(c,{});assert.ok(out.isTtest&&out.cmEl);assert.ok(!out.ttShow||true);
  let s=text(out.cmEl);assert.match(s,/pick the two groups|first group/);
  out=render(c,{ttA:'1',ttB:'2'});s=text(out.cmEl);assert.match(s,/SIGNIFICANT · p = \.006/);assert.match(s,/1 averages 11\.75 on y and 2 averages 16\.75/);
  const D=c.cmData(),r=c.cmResult(D);assert.equal(D.gg.first,'1');assert.ok(r.estimate<0);
  out=render(c,{ttA:'2',ttB:'1'});assert.ok(c.cmResult(c.cmData()).estimate>0,'picking the groups the other way round flips the difference');
  out=render(c,{ttAlt:'gt'});let r1=c.cmResult(c.cmData());assert.equal(r1.hi,Infinity);assert.ok(Math.abs(r1.p-r1.pTwo/2)<1e-15);assert.match(c.cmApa(c.cmData(),r1),/one-sided/);
  out=render(c,{ttAlt:'two',ttEqual:true});r1=c.cmResult(c.cmData());assert.equal(r1.df,6);assert.match(text(out.cmEl),/Student/);
  const T=c.cmTable(c.cmData(),r1);assert.ok(T.head&&T.rows.length>=2);const blob=c.docxBlob([T]);assert.ok(blob&&blob.size>1000,'docx');
  assert.equal(c.descFor().t,'ttestx');
  // two levels only: the order follows the codes and the swap button reverses it
  const c2=await make('y,sex\n1,1\n2,1\n4,1\n3,2\n6,2\n8,2',{tab:'ttest',exploreVar:'y',ttMode:'groups',ttG:'sex'});
  render(c2,{});let q=c2.cmResult(c2.cmData());assert.ok(q.estimate<0);render(c2,{ttSwap:true});q=c2.cmResult(c2.cmData());assert.ok(q.estimate>0);
  // paired and one sample
  out=render(c,{ttEqual:false,ttMode:'paired',ttY2:'y2'});q=c.cmResult(c.cmData());assert.equal(q.df,10);assert.match(text(out.cmEl),/d_z/);
  out=render(c,{ttMode:'value',ttMu:'15'});q=c.cmResult(c.cmData());assert.equal(q.df,11);
  out=render(c,{ttMu:'abc'});assert.match(text(out.cmEl),/Type the value/);
  // summaries: no data needed, and the console gets ttesti
  out=render(c,{ttMode:'summary',ttSum:{kind:'two',m1:'11.75',s1:'1.708',n1:'4',m2:'16.75',s2:'1.708',n2:'4'}});
  assert.match(text(out.cmEl),/SIGNIFICANT/);assert.match(c.descFor().stata,/^ttesti 4 11\.75 1\.708 4 16\.75 1\.708/);
  out=render(c,{ttSum:{kind:'two',m1:'1'}});assert.match(text(out.cmEl),/Type the mean/);
  // weights block the test
  out=render(c,{ttMode:'groups',weightVar:'z'});assert.match(text(out.cmEl),/unweighted/);
});

test('correlation page: variables, settings, cells, the pair panel and the exports',async()=>{
  const c=await make(DATA,{tab:'corr',xVar:'y',yVar:'y2'});
  let out=render(c,{});assert.ok(out.isCorr&&out.corEl);assert.deepEqual(c.corVarsNow(),['y','y2'],'starts from the pair on the Correlation page');
  out=render(c,{corVars:['y','y2','z','txt']});assert.deepEqual(c.corVarsNow(),['y','y2','z'],'text variables are left out');
  const cells=find(out.corEl,n=>n.props&&typeof n.props.className==='string'&&/\bcr-cell\b/.test(n.props.className));assert.equal(cells.length,3,'lower triangle of 3 variables');
  assert.ok(cells.every(n=>n.props['aria-label']&&/p /.test(n.props['aria-label'])));
  const M=c.corCompute(['y','y2','z']);assert.equal(M.cells[1][0].n,11);assert.equal(M.cells[2][0].n,11);assert.equal(M.cells[2][1].n,10);
  render(c,{corRows:'listwise'});const L=c.corCompute(['y','y2','z']);assert.equal(L.cells[1][0].n,10);assert.equal(L.nAll,10);
  // plain numbers: the full square matrix as tab-separated text, and the CSV with r, p and n
  let copied='';Object.defineProperty(globalThis,'navigator',{value:{clipboard:{writeText:s=>{copied=s;return Promise.resolve();}}},configurable:true});c.flash=()=>{};
  c.corCopyMatrix(L);const lines=copied.replace(/\s+$/,'').split('\n');assert.equal(lines.length,4);assert.deepEqual(lines[0].split('\t'),['','y','y2','z']);assert.equal(lines[1].split('\t')[1],'1');
  assert.ok(Math.abs(Number(lines[2].split('\t')[1])-L.cells[1][0].r)<5e-5,'4 decimals');assert.equal(lines[2].split('\t')[1],lines[1].split('\t')[2],'symmetric');
  let saved=null;c.dlBlob=(b,name)=>{saved={b,name};};c.corCsv(L);assert.equal(saved.name,'correlation-matrix.csv');const csv=await saved.b.text();assert.match(csv,/^\uFEFF?Pearson r \(complete rows\)\n,y,y2,z\ny,1,0\.9864,/);assert.match(csv,/\n\np \(two-sided\)\n,y,y2,z\ny,,[0-9.]+e-\d+,/);assert.match(csv,/\n\nn\n,y,y2,z\ny,10,10,10\n/);
  const T=c.corTable(L);assert.match(T.title,/^Means, standard deviations, and correlations/);assert.equal(T.rows.length,3);
  c.corDocx(L);assert.equal(saved.name,'correlation-table.docx');assert.ok(saved.b.size>1000);
  // Spearman, the selected pair and the console
  out=render(c,{corRows:'pairwise',corMethod:'spearman',corSel:[2,0]});const s=text(out.corEl);assert.match(s,/SPEARMAN ρ/);assert.match(s,/y × z|z × y/);
  const d=c.corDesc();assert.equal(d.t,'cx');assert.match(d.stata,/^spearman y y2 z@IF@, stats\(rho p obs\) pw/);assert.match(d.r,/method = "spearman"/);
  render(c,{corMethod:'pearson'});assert.match(c.corDesc().stata,/^pwcorr y y2 z@IF@, sig obs/);assert.match(c.corDesc().tbl,/before|y2/);
  render(c,{corRows:'listwise'});assert.match(c.corDesc().stata,/^correlate y y2 z@IF@/);
  out=render(c,{corVars:['y']});assert.match(text(out.corEl),/two|2/);assert.equal(c.corDesc(),null);
  // the Tests menu and the method directory both open the matrix page
  const fam=c.asGroups().find(g=>g[0]==='Correlation');assert.equal(fam[1][0][1].tab,'corr');
});
