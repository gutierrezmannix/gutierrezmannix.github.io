import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';

// Exercise the shipped component and chart engine, not copies of the fixes.
const page=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const manifest=JSON.parse(page.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1]);
const engine=gunzipSync(Buffer.from(manifest['7f0c6180-e6c1-4faf-bd4a-6b2fddc15715'].data,'base64'));
const E=await import('data:text/javascript;base64,'+engine.toString('base64'));
const template=JSON.parse(page.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
const code=template.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
class Base { props={}; setState(p,cb){this.state={...this.state,...(typeof p==='function'?p(this.state):p)};cb?.();} forceUpdate(){} }
const R=globalThis.React={createElement:(tag,props,...children)=>({tag,props,children})};
let printed=0;
globalThis.window={innerWidth:1440,print(){printed++;}};
globalThis.document={documentElement:{style:{zoom:''}}};
const C=new Function('DCLogic',code+';return Component')(Base);
const parse=async text=>{const b=Buffer.from(text);return E.parseCSV(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),()=>{});};
let seed=7619;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296-.5);
const lines=['x,y,group,i1,i2,i3,i4'];
for(let i=0;i<100;i++){const f=3*random(),x=random();lines.push([x,2*x+random(),i%2?'B':'A',...[0,1,2,3].map(()=>f+.6*random())].join(','));}
const fixture=lines.join('\n');
async function make(patch={}) {
  const c=new C();c._E=E;c._raw=await parse(fixture);c._engineP=Promise.resolve(E);
  c.state={...c.state,screen:'work',fileName:'synthetic.csv',cols:c._raw.names.map((_,i)=>E.profileCol(c._raw,i)),nRows:c._raw.n,autoScreen:false,...patch};
  c.pushLog=d=>c.setState(s=>({conLog:[...(s.conLog||[]),d]}));
  c.flash=t=>{c.message=t;};return c;
}
const pause=()=>new Promise(resolve=>setTimeout(resolve,50));
const values=[1.58225,Number.MIN_VALUE,Number.MAX_VALUE,-1.2345678901234567,1e-100,9007199254740991,-0,NaN];
const c=await make();c._raw={n:values.length,names:['precise','text'],labels:['',''],vlabs:{},cols:[{k:'n',a:Float64Array.from(values)},{k:'s',a:['comma,quote"','line\rbreak','line\nbreak','','a','b','c','d']}]};
c.state={...c.state,cols:c._raw.names.map((_,i)=>E.profileCol(c._raw,i)),nRows:values.length};
c.retypeCol('precise',true);c.retypeCol('precise',false);
values.forEach((v,i)=>assert.ok(Object.is(v,c._raw.cols[0].a[i]),'type conversion loses value '+i));
// Inserting text into a numeric cell uses the same lossless conversion.
c.commitCell(0,0,'a string');
assert.equal(c._raw.cols[0].a[3],String(values[3]));
c._raw.cols[0]={k:'n',a:Float64Array.from(values)};
let csvBlob;const nativeURL=globalThis.URL;
globalThis.URL={createObjectURL(blob){csvBlob=blob;return 'blob:test';},revokeObjectURL(){}};
document.createElement=()=>({click(){}});
c.saveCsv();const csv=await csvBlob.text(),saved=await parse(csv);
values.forEach((v,i)=>assert.ok(Object.is(v,saved.cols[0].a[i]),'CSV loses value '+i));
assert.deepEqual(saved.cols[1].a,c._raw.cols[1].a);
globalThis.URL=nativeURL;
console.log('Lossless numeric/text, numeric cell promotion, CSV values, missingness and CSV quoting passed.');

const report=await make({reportMode:true,conLog:[{t:'sum',x:'x',res:'Synthetic result',tbl:'N\t100'}]});
let out=report.renderVals();assert.ok(out.showReport&&!out.showWork);assert.match(out.repDataset,/synthetic.csv/);assert.equal(out.repRows.length,1);assert.match(out.repRows[0].cmd,/summarize x/);assert.equal(out.repRows[0].tbl,'N\t100');out.repPrint();assert.equal(printed,1);out.repBack();assert.equal(report.state.reportMode,false);
report.state.reportMode=true;report.state.dialect='r';assert.match(report.renderVals().repRows[0].cmd,/^> /);
console.log('Lab report content, dialect prompt, Print and Back callbacks passed.');

const plots=await make({tab:'plots',plotKind:'matrix',mxItems:[]});
plots._plots=[{id:'old',name:'old',title:'Old plot',xml:'<svg/>',w:100,h:100,at:0}];
out=plots.renderVals();assert.ok(out.plotEmpty);assert.match(out.plotEmptyText,/ADD 3/);assert.equal(out.plotHistoryEmpty,false);assert.equal(out.plotReady,false);
plots.state.plotKind='scatter';plots.state.pX='x';plots.state.pY='y';plots.state.chartColor='#B22222';plots.clearMemo();
out=plots.renderVals();assert.ok(out.plotReady);assert.equal(out.plotEmpty,false);
const encoded=JSON.stringify(out.plotChartEl);assert.ok(encoded.includes('#B22222'));assert.ok(!encoded.includes('NaN'));
for(const kind of ['gbox','stack']){plots.state={...plots.state,plotKind:kind,pX:'group',pY:kind==='gbox'?'y':'group'};plots.clearMemo();out=plots.renderVals();assert.ok(out.plotChartEl);assert.ok(JSON.stringify(out.plotChartEl).includes('#B22222'));}
assert.ok(template.includes('value="{{ plotReady }}"'));assert.ok(template.includes('value="{{ plotHistoryEmpty }}"'));
console.log('Current-chart validation/history separation, export availability and scatter/grouped/stacked colors passed.');

for(const [mode,extra]of [['value',{ttMu:'0'}],['paired',{ttY2:'y'}],['groups',{ttG:'group',ttA:'A',ttB:'B'}]]){
  const tt=await make({tab:'ttest',exploreVar:'x',ttMode:mode,...extra});out=tt.renderVals();assert.ok(out.ttHasRes&&out.ttChartEl,mode+' needs a chart');assert.ok(!JSON.stringify(out.ttChartEl).includes('NaN'));
  const captures=[],original=tt.svgRef;tt.svgRef=key=>{captures.push(key);return original.call(tt,key);};tt.renderVals();assert.ok(captures.includes('tt'));
}
console.log('All three t-test designs create valid, export-connected charts.');

const model=()=>[{name:'Factor',items:['i1','i2','i3','i4']}];
const sem=await make({tab:'sem',semF:model()});sem.runSem();await pause();out=sem.renderVals();assert.ok(out.semHasFit,sem.state.semErr);
out.semFactors[0].items[1].setMarker();assert.equal(sem.state.semFit,null);assert.match(sem.state.semErr,/Run SEM again/);assert.equal(sem.renderVals().semHasFit,false);
sem.runSem();await pause();out=sem.renderVals();assert.ok(out.semHasFit);assert.match(out.semCmdPreview,/i2@1/);
sem.state.missingCodes='999';sem.clearMemo();out=sem.renderVals();assert.equal(out.semHasFit,false);assert.match(out.semErr,/changed/);
sem.state.missingCodes='';sem.runSem();sem.renderVals().semFactors[0].items[0].remove();await pause();assert.equal(sem.state.semFit,null);assert.equal(sem.state.semBusy,false);
sem.state.semF=model();sem.runSem();sem._dataRev=(sem._dataRev||0)+1;await pause();assert.equal(sem.state.semFit,null);assert.match(sem.state.semErr,/changed/);
sem.runSem();await pause();out=sem.renderVals();assert.ok(out.semHasFit);out.semAddFactor();assert.equal(sem.state.semFit,null);
sem.state.semF=[...model(),{name:'Other',items:['x','y']}];out=sem.renderVals();out.semFactors[1].remove();assert.equal(sem.state.semF.length,1);
console.log('SEM marker/model edits, data/missing rules and in-flight changes cannot expose stale results.');

const png=await make();png.plotPng=async()=> 'data:image/png;base64,iVBORw0KGgo=';
let file;png.dlBlob=(blob,name)=>{file={blob,name};};
await png.dlPlotAs({name:'synthetic'},'png');assert.equal(file.name,'synthetic.png');assert.equal(file.blob.type,'image/png');assert.deepEqual([...new Uint8Array(await file.blob.arrayBuffer())],[137,80,78,71,13,10,26,10]);
png._svgs={tt:{isConnected:true,viewBox:{baseVal:{width:680,height:380}}}};png.svgExport=()=>'<svg/>';
await png.dlSvg('tt','ttest-chart');assert.equal(file.name,'ttest-chart.png');
png.plotPng=async()=>{throw Error('decode failed');};await png.dlPlotAs({name:'synthetic'},'png');assert.match(png.message,/Could not render/);
console.log('Current-plot and main-chart PNGs use Blob downloads; encoding failure is reported.');
for(const obj of [c,report,plots,sem,png]){clearTimeout(obj._ghostT);clearTimeout(obj._mfOkT);clearTimeout(obj._snapT);}
