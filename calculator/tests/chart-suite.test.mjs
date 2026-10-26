import assert from 'node:assert/strict';
import fs from 'node:fs';import {gunzipSync} from 'node:zlib';
const page=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),template=JSON.parse(page.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]),manifest=JSON.parse(page.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1]);
const E=await import('data:text/javascript;base64,'+gunzipSync(Buffer.from(manifest['7f0c6180-e6c1-4faf-bd4a-6b2fddc15715'].data,'base64')).toString('base64'));
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t,`${a} vs ${b}`);
const d=E.csSummary([1,2,3].map(y=>({y,w:1})),df=>E.ttCritical(.05,df));near(d.mean,2);near(d.sd,1);near(d.se,1/Math.sqrt(3));near(d.lo,-.484137711719546,1e-7);
const wi=E.csWilson(3,10);near(wi[0],.107791267406301,1e-12);near(wi[1],.603221852538854,1e-12);
const km=E.csSurvival([{x:1,y:1},{x:1,y:0},{x:2,y:1},{x:3,y:0}]);near(km.pts[1].y,.75);near(km.pts[2].y,.375);assert.equal(km.pts[1].risk,4);assert.equal(km.censors.length,2);
const p=E.csPrepare('pie',{x:['A','B',null,'A'],w:[1,2,3,4],mask:[1,1,1,0]});assert.equal(p.n,2);assert.equal(p.excluded,1);const pie=E.csScene('pie',p);near(pie.table.find(r=>r[0]==='B')[2],200/3);assert.equal(E.csPrepare('pie',{x:['A',null],missing:true}).n,2);
assert.throws(()=>E.csPrepare('survival',{x:[1,2],y:[0,2]}),/event status/);assert.throws(()=>E.csPrepare('proportion',{x:['A','A'],y:[0,1],w:[1,1]}),/Clear the weight/);
const complete=E.csPrepare('paired',{x:[1,2,NaN,4],y:[2,NaN,3,5]});assert.equal(complete.n,2);assert.equal(complete.excluded,2);
const bounds={rows:[{x:'<script>',y:.4,lo:.2,hi:.6,g:'M',w:1}],n:1,excluded:0};assert.ok(E.csScene('coefficient',bounds).markup.includes('&lt;script&gt;'));assert.throws(()=>E.csScene('coefficient',{...bounds,rows:[{...bounds.rows[0],lo:.5}]}),/confidence bounds/);
assert.equal(new Set(E.CS_CATALOG.flatMap(c=>c[1].map(i=>i[0]))).size,37);
const fixtures={};for(const [,charts]of E.CS_CATALOG)for(const [id,,legacy]of charts){if(legacy)continue;let x=['A','A','B','B'],y=[1,2,3,4],g=['G1','G2','G1','G2'],lo=[0,1,2,3],hi=[2,3,4,5];
 if(['density','scatterplain','smooth','hexbin','multiline','panel','paired','survival','event','prediction','interaction'].includes(id))x=[1,2,3,4];
 if(['groupbar','stackcount','likert'].includes(id))y=['No','Yes','No','Yes'];if(id==='proportion'||id==='survival')y=[0,1,0,1];
 if(id==='corrmap'||id==='geomap')continue;const data=E.csPrepare(id,{x,y,g,lo,hi});const scene=E.csScene(id,data,{neutral:'',order:id==='likert'?'No|Yes':'',critical:df=>E.ttCritical(.05,df)});assert.ok(scene.markup&&!/NaN|Infinity|undefined/.test(scene.markup),id+' renders valid coordinates');fixtures[id]=scene;}
const geo={type:'FeatureCollection',features:[{type:'Feature',properties:{id:'A'},geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,1],[0,0]]]}}]};const gs=E.csGeoScene(E.csPrepare('geomap',{x:['A','A'],y:[2,4]}),{geo,geoKey:'id'});assert.equal(gs.table[0][1],3);assert.match(gs.note,/1 matched/);assert.throws(()=>E.csGeoScene(p,{geo,geoKey:'missing'}),/missing the property/);
const huge=E.csPrepare('hexbin',{x:Float64Array.from({length:200000},(_,i)=>i),y:Float64Array.from({length:200000},(_,i)=>i%71)});const hs=E.csScene('hexbin',huge,{xmin:0,xmax:100,ymin:0,ymax:20});assert.deepEqual(hs.xr,[0,100]);assert.ok(hs.markup.includes('clip-path'));
class Base {props={};setState(p,cb){this.state={...this.state,...(typeof p==='function'?p(this.state):p)};cb?.();}forceUpdate(){}}
globalThis.React={createElement:(tag,props,...children)=>({tag,props,children})};globalThis.window={innerWidth:1600};globalThis.document={documentElement:{style:{zoom:''}}};
const C=new Function('DCLogic',template.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1]+';return Component')(Base);
const csv='category,value,binary,time,first,lower,upper,model\nA,1,0,1,0,0,2,M1\nA,2,1,2,1,1,3,M1\nB,3,0,3,2,2,4,M2\nB,4,1,4,3,3,5,M2';const buf=Buffer.from(csv),raw=await E.parseCSV(buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength),()=>{});
const c=new C();c._E=E;c._raw=raw;c.state={...c.state,screen:'work',tab:'plots',nRows:4,cols:raw.names.map((_,i)=>E.profileCol(raw,i)),autoScreen:false,plotKind:'pie',csPages:{pie:{x:'category',drawn:true}}};const out=c.renderVals();assert.equal(out.isPlotsLegacy,false);assert.equal(out.isChartSuite,true);assert.equal(out.plotEmpty,false);assert.ok(out.chartSuiteEl);assert.ok(out.mfNavGroups.flatMap(g=>g.items).find(t=>t.key==='plots').content);assert.equal(c.descFor(),null);
c.csOpen('hist');assert.equal(c.state.plotKind,'hist');assert.equal(c.state.csPages.pie.x,'category');assert.ok(c.renderVals().isPlotsLegacy);assert.ok(!template.includes('list="{{ plotKindBtns }}"'));
// Timelines: round tick values, year labels without separators, lines broken at unobserved periods, legend swatches unclipped.
assert.deepEqual(E.csPretty(2000,2009,5,true),[2000,2002,2004,2006,2008]);assert.deepEqual(E.csPretty(2000,2001,5,true),[2000,2001]);assert.deepEqual(E.csPretty(10,39),[10,15,20,25,30,35]);
{const yrs=[2000,2001,2002,2003,2006,2007,2000,2001,2002,2004,2005];const tl=E.csScene('multiline',E.csPrepare('multiline',{x:yrs,y:yrs.map((v,i)=>v-1990+i),g:yrs.map((_,i)=>i<6?'B':'C')}));
 assert.deepEqual([...tl.markup.matchAll(/<path d="([^"]*)" fill="none"/g)].map(m=>m[1].split('M').length-1),[2,2]);assert.ok(tl.markup.includes('>2002</text>')&&!/2,00\d/.test(tl.markup));assert.match(tl.markup,/<rect class="cs-key"[^>]*\/><text/);assert.ok(!tl.markup.includes('clip-path="url(#cs-clip)"><rect class="cs-key"'));}
clearTimeout(c._ghostT);console.log('37 chart pages: mean t intervals, Wilson intervals, tied-event Kaplan–Meier, weighted pie denominators, masks/missingness, complete pairs, imported CI validation, GeoJSON joins, large-data hexbin, SVG safety, dedicated navigation and legacy preservation passed.');
// Exercise every dedicated page through the shipped component, including all native field callbacks.
const flatten=n=>!n?[]:Array.isArray(n)?n.flatMap(flatten):typeof n==='object'?[n,...flatten(n.children)]:[];
for(const [category,items]of E.CS_CATALOG)for(const [id,,legacy]of items){
 if(legacy)continue;
 const numericX=['density','scatterplain','smooth','hexbin','multiline','panel','paired','survival','event','prediction','interaction'].includes(id);
 const p={x:numericX?'time':'category',y:['groupbar','stackcount','likert'].includes(id)?'model':id==='proportion'||id==='survival'?'binary':'value',group:['heatmap','panel'].includes(id)?'model':'',lo:'lower',hi:'upper',vars:['time','value'],drawn:true,geo,geoKey:'id'};
 if(id==='likert')p.order='M1|M2';if(id==='geomap')p.x='category';
 c.state={...c.state,tab:'plots',plotKind:id,csPages:{...c.state.csPages,[id]:p}};
 const v=c.renderVals(),nodes=flatten(v.chartSuiteEl),alerts=nodes.filter(n=>n.props?.role==='alert');assert.equal(alerts.length,0,id+': '+JSON.stringify(alerts));assert.ok(nodes.some(n=>n.tag==='svg'),id+' has SVG output');
 const draw=nodes.find(n=>n.tag==='button'&&n.children[0]==='Draw chart');assert.ok(draw);draw.props.onClick();assert.equal(c.state.csPages[id].drawn,true);
}
const pattern=E.csScene('pie',E.csPrepare('pie',{x:['A','B']}),{patterns:true});assert.match(pattern.markup,/<pattern/);assert.match(pattern.markup,/<rect width="12" height="12" fill="#2E7D58"/);
console.log('Every new chart page renders through the bundled UI, including correlations and uploaded geographic boundaries; draw controls and pattern exports passed.');
