import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import path from 'node:path';
const h=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const manifest=JSON.parse(h.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1]);
const E=await import('data:text/javascript;base64,'+gunzipSync(Buffer.from(manifest['7f0c6180-e6c1-4faf-bd4a-6b2fddc15715'].data,'base64')).toString('base64'));
const template=JSON.parse(h.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
const code=template.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
class Base {props={};setState(p,cb){this.state={...this.state,...(typeof p==='function'?p(this.state):p)};cb?.();}}
globalThis.React={createElement:(tag,props,...children)=>({tag,props,children})};globalThis.window={innerWidth:1440};globalThis.document={documentElement:{style:{zoom:''}}};
const C=new Function('DCLogic',code+';return Component;')(Base);
const raw=(names,rows)=>({names,n:rows.length,cols:names.map((_,i)=>({k:rows.every(r=>typeof r[i]==='number')?'n':'s',a:rows.map(r=>r[i])}))});
const prep=(edges,nodes,dir=true)=>E.netPrepare(raw(['from','to'],edges),nodes?raw(['id','group','value'],nodes):null,{from:'from',to:'to',id:'id',directed:dir});
let p=prep([['a','b'],['a','b'],['b','a'],['a','a'],['missing','b'],['','a']],[['a','x',1],['b','x',2],['isolate','y',3]]);
assert.deepEqual(p.info,{miss:1,loops:1,unknown:1,dups:1});assert.equal(p.net.n,3);assert.equal(E.netSummary(p.net).edges,2);
assert.deepEqual(E.netCentrality(p.net).degree,[2,2,0]);assert.deepEqual(E.netCentrality(p.net).closeness,[0,0,0]);assert.deepEqual(E.netCentrality(p.net).harmonic,[.5,.5,0]);
assert.match(prep([['a','b']],[['a','x',1],['a','y',2]]).error,/Duplicate node ID/);
assert.match(prep([['a','b']],[['','x',1],['b','y',2]]).error,/Blank node ID/);
assert.equal(prep([['a','a'],['b','b']]).net.n,2,'self-loop-only vertices are retained');
assert.equal(E.netSummary(prep([['a','b'],['b','a']],null,false).net).edges,1);
assert.equal(E.netKey(123456789.123456),String(123456789.123456),'IDs must never use rounded display labels');
const star=prep([['a','b'],['a','c'],['a','d']],null,false).net;
assert.ok(Math.abs(E.netCentrality(star).eigenvector[1]-1/Math.sqrt(3))<1e-9,'bipartite power iteration must converge');
const empty=prep([['a','a'],['b','b']]).net;assert.ok(E.netCentrality(empty).eigenvector.every(Number.isNaN));
let bad=prep([['a','b']],[['a','x',1],['b','y',NaN],['c','x',3]]).net;
assert.match(E.ergmFit(bad,[{t:'nodecov',a:'value'}]).error,/Missing values/);assert.ok(Number.isNaN(bad.attrs.value.x[1]));
const script=E.netRScript(p.net,[{t:'nodematch',a:'group'}]);assert.ok(script.includes('network.initialize(3'));assert.ok(script.includes('"isolate"'));assert.ok(script.includes('gm_attr_1'));assert.ok(!script.includes('read.csv'));
const plot=E.netPlot(React,p.net,E.netLayoutCircle(p.net.n),{size:[NaN,1,0]});assert.ok(JSON.stringify(plot).includes('gm-net-arrow'));assert.ok(!JSON.stringify(plot).includes('"r":null'));
// The real component must keep valid graph descriptives when MPLE is undefined.
const c=new C();c._E=E;c._netE=raw(['from','to'],[['a','a'],['b','b']]);c.state={...c.state,ngFrom:'from',ngTo:'to',ngDir:true,ngMutual:false};c.pushLog=()=>{};c.runErgm();await new Promise(r=>setTimeout(r,60));assert.equal(c.state.ngFit.nodes,2);assert.equal(c.state.ngFit.edges,0);assert.ok(c._ngLay);assert.match(c.state.ngErr,/no ties/);
const parse=async file=>{const b=fs.readFileSync(file);return E.parseCSV(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),()=>{});};
const close=(actual,expected,tolerance,label)=>{assert.equal(actual.length,expected.length,label);for(let i=0;i<actual.length;i++)assert.ok(Math.abs(actual[i]-expected[i])<=tolerance,`${label}[${i}] ${actual[i]} vs ${expected[i]}`);};
let checks=0;
if(process.env.GM26_NETWORK_R_DIR){
 const dir=process.env.GM26_NETWORK_R_DIR;
 for(const directed of [true,false])for(let k=1;k<=10;k++){
  const stem=`sim-${String(directed).toUpperCase()}-${k}`,a=fs.readFileSync(path.join(dir,stem+'.csv'),'utf8').trim().split('\n').map(s=>s.split(',').map(Number));
  const edges=a.flatMap((row,i)=>row.flatMap((v,j)=>v?[[String(i),String(j)]]:[]));const nodes=a.map((_,i)=>[String(i),String((i+1)%3),Math.sin(i+1)]);const net=prep(edges,nodes,directed).net,centrality=E.netCentrality(net),ref=await parse(path.join(dir,stem+'-ref.csv'));
  for(const m of ['degree','betweenness','closeness','harmonic','eigenvector','pagerank']){close(centrality[m],ref.cols[ref.names.indexOf(m)].a,1e-7,stem+'/'+m);checks++;}
  const models={edges:[],attributes:[{t:'nodematch',a:'group'},{t:'nodecov',a:'value'},{t:'absdiff',a:'value'}],triangle:[{t:'triangle'}],...(directed?{mutual:[{t:'mutual'}],all:[{t:'mutual'},{t:'triangle'},{t:'nodematch',a:'group'},{t:'nodecov',a:'value'},{t:'absdiff',a:'value'}]}:{})};
  for(const [name,terms]of Object.entries(models)){const fit=E.ergmFit(net,terms);assert.ok(!fit.error,stem+'/'+name+': '+fit.error);const f=await parse(path.join(dir,stem+'-'+name+'-fit.csv'));close(fit.coefs.map(c=>c.b),f.cols[0].a,1e-7,stem+'/'+name+'/coefficients');close(fit.coefs.map(c=>c.se),f.cols[1].a,1e-6,stem+'/'+name+'/SE');checks++;}
 }
 console.log(`R comparison: ${checks} centrality/model checks across 20 R-simulated networks passed.`);
}
if(process.env.GM26_NETWORK_EDGES&&process.env.GM26_NETWORK_NODES){
 const er=await parse(process.env.GM26_NETWORK_EDGES),nr=await parse(process.env.GM26_NETWORK_NODES),p=E.netPrepare(er,nr,{from:'Vertex 1',to:'Vertex 2',id:'Vertex',directed:true});
 assert.ok(!p.error);assert.equal(p.net.n,nr.n);
 if(process.env.GM26_NETWORK_R_DIR){const ref=await parse(path.join(process.env.GM26_NETWORK_R_DIR,'media-ref.csv')),ce=E.netCentrality(p.net);for(const m of ['degree','indegree','outdegree','betweenness','closeness','harmonic','eigenvector','pagerank'])close(ce[m],ref.cols[ref.names.indexOf(m)].a,1e-7,'local fixture/'+m);const f=E.ergmFit(p.net,[{t:'mutual'}]),fitRef=await parse(path.join(process.env.GM26_NETWORK_R_DIR,'media-mutual-fit.csv'));assert.ok(!f.error);close(f.coefs.map(c=>c.b),fitRef.cols[0].a,1e-7,'local fixture/MPLE');}
 console.log('Locally supplied fixtures agree with R; no fixture values are embedded in this test.');
}
console.log('Network preparation, IDs, missing attributes, isolates, eigenvectors, directed plot and component error recovery passed.');
// Adding and overwriting centralities is one undoable dataset operation, aligned by ID.
const ac=new C();ac._E=E;ac._raw=raw(['id','group','value'],[['isolate','y',3],['b','x',2],['a','x',1]]);ac._raw.labels=['','',''];ac._netN=ac._raw;ac.state={...ac.state,ngId:'id',ngN:{name:'nodes.csv'},cols:ac._raw.names.map((_,i)=>E.profileCol(ac._raw,i))};ac.pushLog=()=>{};
ac.addNetCentralities([['degree'],['harmonic']],p.net,E.netCentrality(p.net));assert.deepEqual(Array.from(ac._raw.cols[3].a),[0,2,2]);assert.equal(ac._undo.length,1);ac.undo();assert.deepEqual(ac._raw.names,['id','group','value']);clearTimeout(ac._umT);
ac.addNetCentralities([['degree']],p.net,E.netCentrality(p.net));ac._raw.cols[3].a[1]=999;ac.addNetCentralities([['degree']],p.net,E.netCentrality(p.net));assert.equal(ac._raw.cols[3].a[1],2);ac.undo();assert.equal(ac._raw.cols[3].a[1],999);clearTimeout(ac._umT);
console.log('Centrality dataset alignment and atomic undo passed.');

const guess = new C().netGuess('e',{names:['Vertex 1','Vertex 2',...Array.from({length:38},(_,i)=>'meta'+i),'Source']});
assert.deepEqual(guess,{ngFrom:'Vertex 1',ngTo:'Vertex 2'},'NodeXL Source is application metadata, not an endpoint');
assert.deepEqual(new C().netGuess('e',{names:['junk','target','source']}),{ngFrom:'source',ngTo:'target'});
console.log('NodeXL endpoint detection passed.');

ac.state={...ac.state,screen:'work',tab:'ergm',fileName:'nodes.csv',nRows:3};
assert.match(ac.renderVals().ngNodesInfo,/3 rows × 4 columns/,'network file metadata follows the live dataset after Undo');
const vtx=new C();vtx._E=E;vtx._raw=ac._raw;vtx._netE=raw(['Vertex 1','Vertex 2','Source'],[['a','b','Twitter'],['b','a','Twitter']]);vtx._netN=raw(['Vertex','id'],[['a',1],['b',2],['c',3]]);vtx.state={...vtx.state,screen:'work',tab:'ergm',cols:[],nRows:3,ngE:vtx.netMeta(vtx._netE,'e.csv'),ngN:vtx.netMeta(vtx._netN,'n.csv'),ngFrom:'Vertex 1',ngTo:'Vertex 2',ngId:'Vertex',ngFit:null};
let controls=vtx.renderVals();vtx.state.ngFit={};controls.ngFromBtns.find(b=>b.label==='Vertex 2').click();assert.equal(vtx.state.ngFrom,'Vertex 2');assert.equal(vtx.state.ngFit,null);vtx.runErgm();assert.match(vtx.state.ngErr,/different columns/);controls=vtx.renderVals();controls.ngToBtns.find(b=>b.label==='Vertex 1').click();assert.equal(vtx.state.ngTo,'Vertex 1');controls=vtx.renderVals();controls.ngIdBtns.find(b=>b.label==='id').click();assert.equal(vtx.state.ngId,'id');assert.deepEqual(vtx.state.ngAttr,{});
console.log('Vertex selector callbacks, stale-result clearing, same-column validation and live metadata passed.');
