// Time series console printouts: R's coeftest() print and Stata's newey layout, with the app's estimates.
// Expected text is real R 4.3.3 output (sandwich::NeweyWest, lmtest::coeftest) for tests/data/its.csv.
import assert from 'node:assert/strict';
import fs from 'node:fs';import {gunzipSync} from 'node:zlib';
const page=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),template=JSON.parse(page.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]),manifest=JSON.parse(page.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1]);
const E=await import('data:text/javascript;base64,'+gunzipSync(Buffer.from(manifest['7f0c6180-e6c1-4faf-bd4a-6b2fddc15715'].data,'base64')).toString('base64'));
class Base {props={};setState(p,cb){this.state={...this.state,...(typeof p==='function'?p(this.state):p)};cb?.();}forceUpdate(){}}
globalThis.React={createElement:(tag,props,...children)=>({tag,props,children})};globalThis.window={innerWidth:1600};globalThis.document={documentElement:{style:{zoom:''}}};
const C=new Function('DCLogic',template.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1]+';return Component')(Base);
const c=new C();c._E=E;
const rows=fs.readFileSync(new URL('./data/its.csv',import.meta.url),'utf8').trim().split('\n').slice(1).map(l=>l.split(',').map(v=>v.replace(/"/g,'')));
const A=rows.filter(r=>r[0]==='A'),scripts={short:{stata:'newey gmts_outcome c.gmts_trend'}};
const res=E.tsAnalyze({t:A.map(r=>+r[1]),y:A.map(r=>+r[2]),unit:null,common:2005,type:'both',tname:'year'});
assert.equal(c.tsRText(res,scripts),['','t test of coefficients:','',
'             Estimate Std. Error t value  Pr(>|t|)    ',
'(Intercept) 19.562900   0.226816 86.2502 < 2.2e-16 ***',
'gmts_trend   0.394414   0.022379 17.6246 5.600e-16 ***',
'gmts_post    3.018086   0.540545  5.5834 7.259e-06 ***',
'gmts_since  -0.244214   0.069187 -3.5298  0.001573 ** ',
'---','Signif. codes:  0 ‘***’ 0.001 ‘**’ 0.01 ‘*’ 0.05 ‘.’ 0.1 ‘ ’ 1'].join('\n'));
const st=c.tsStataText(res,scripts);
assert.match(st,/F\(3, 26\)          =     251\.17/);// R: Wald F with NeweyWest covariance = 251.1688
assert.match(st,/\n  gmts_trend \|   \.3944143   \.0223787    17\.62   0\.000 /);assert.match(st,/\n       _cons \|    19\.5629   \.2268158    86\.25   0\.000 /);
// R's format.pval rules (fixed / scientific groups, "< 2.2e-16")
assert.deepEqual(c.tsRPval([0.0003681690,0.01582897,0.03414093,0.3219520]),['0.0003682','0.0158290','0.0341409','0.3219520']);
// Pooled units are numbered as egen group() / factor() number them, whatever the row order.
const P=rows.filter(r=>['C','A','B'].includes(r[0])).sort((a,b)=>a[0]==='C'?-1:b[0]==='C'?1:0),pr=E.tsAnalyze({t:P.map(r=>+r[1]),y:P.map(r=>+r[2]),unit:P.map(r=>r[0]),events:{},common:2005,type:'both'});
assert.deepEqual(pr.units,['A','B','C']);assert.ok(Math.abs(pr.coefs[0].b-19.96009)<1e-4);
const pt=c.tsRText(pr,scripts);assert.match(pt,/factor\(gmts_unit\)2 /);assert.match(pt,/\(Intercept\)         1\.9960e\+01  3\.8313e-01  5\.2097e\+01 0\.0003682 \*\*\*/);
// Stata's %9.0g: at most 8 characters for positive numbers, 9 with a minus sign
assert.deepEqual([0.022378659,-0.0060087,0.00051794,39.44028,123456789,-12345678].map(v=>c.stataG(v)),['.0223787','-.0060087','.0005179','39.44028','1.23e+08','-12345678']);
// Time step (Stata's delta): a biennial series is regular with step 2, not 7 gaps; estimates equal R's lm + NeweyWest.
{const B=A.filter(r=>+r[1]%2===0),pp=E.tsPrepare({frequency:'yearly',y:B.map(r=>+r[2]),time:B.map(r=>+r[1]),unit:B.map(r=>r[0])});
 assert.equal(pp.step,2);assert.equal(pp.gaps,0);assert.ok(!pp.error,pp.error);
 const rb=E.tsAnalyze({t:pp.t,y:pp.y,unit:null,common:2005,type:'both',step:pp.step});assert.ok(!rb.error,rb.error);
 const ref=[[19.291583333333,0.2396398129209],[0.406130952381,0.0256786470070],[3.266238095238,0.4303530248053],[-0.283059523810,0.0660596844143]];
 rb.coefs.forEach((cf,i)=>{assert.ok(Math.abs(cf.b-ref[i][0])<1e-9&&Math.abs(cf.se-ref[i][1])<1e-9,cf.term);});
 const p1=E.tsPrepare({frequency:'yearly',y:B.map(r=>+r[2]),time:B.map(r=>+r[1]),unit:B.map(r=>r[0]),step:1});assert.equal(p1.gaps,14);assert.equal(p1.missing.length,14);assert.match(p1.error,/14 missing period/);
 // Values the user enters fill missing periods (flagged); neighbours are reported for each.
 const m0=p1.missing[0];assert.deepEqual([m0.t,m0.prev.t,m0.next.t],[1991,1990,1992]);
 const fills=new Map(p1.missing.map(m=>[m.u+'|'+m.t,(m.prev.y+m.next.y)/2])),pf=E.tsPrepare({frequency:'yearly',y:B.map(r=>+r[2]),time:B.map(r=>+r[1]),unit:B.map(r=>r[0]),step:1,fills});
 assert.equal(pf.filled,14);assert.equal(pf.gaps,0);assert.ok(!pf.error);assert.equal(pf.t.length,29);}
clearTimeout(c._ghostT);console.log('Time-series: time step, missing-period fills, coeftest and newey printouts, format.pval, unit numbering and %9.0g passed.');
