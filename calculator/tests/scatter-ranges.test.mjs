import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
const page=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const manifest=JSON.parse(page.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1]);
const E=await import('data:text/javascript;base64,'+gunzipSync(Buffer.from(manifest['7f0c6180-e6c1-4faf-bd4a-6b2fddc15715'].data,'base64')).toString('base64'));
const template=JSON.parse(page.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
const code=template.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
class Base{props={};setState(p,cb){this.state={...this.state,...(typeof p==='function'?p(this.state):p)};cb?.();}forceUpdate(){}}
const R=globalThis.React={createElement:(tag,props,...children)=>({tag,key:props?.key,props,children})};
globalThis.window={innerWidth:1440};globalThis.document={documentElement:{style:{zoom:''}}};
const C=new Function('DCLogic',code+';return Component')(Base);
const csv='year,budget,other\n1895,,1\n1900,1.23456,2\n1920,8,3\n1950,42.6789,4\n2000,5,5\n2025,3.5,6\n2030,,7\n,50.1234567,8';
const bytes=Buffer.from(csv),raw=await E.parseCSV(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),()=>{});
const c=new C();c._E=E;c._raw=raw;c.state={...c.state,screen:'work',cols:raw.names.map((_,i)=>E.profileCol(raw,i)),nRows:raw.n,autoScreen:false};
const render=p=>{c.state={...c.state,...p};c.clearMemo();return c.renderVals();};
const leaves=node=>{if(!node||typeof node!=='object')return [];if(Array.isArray(node))return node.flatMap(leaves);return [node,...(node.children||[]).flatMap(leaves)];};
const corr=E.corr(raw.cols[0].a,raw.cols[1].a,null);
assert.equal(corr.n,5);
assert.deepEqual(E.observedRange(raw.cols[0].a),[1895,2030]);
assert.deepEqual(E.observedRange(raw.cols[1].a),[1.23456,50.1234567]);
assert.equal(E.observedRange([NaN,Infinity,-Infinity]),null);
assert.deepEqual(E.observedRange([-50,-5,-20]),[-50,-5]);
for(const [tab,slot,setup] of [['two','scatter',{xVar:'year',yVar:'budget',twoMode:'corr'}],['plots','plot',{pX:'year',pY:'budget',plotKind:'scatter'}]]){
  let out=render({tab,ax:{},flt:null,...setup});
  const controls=out['ax'+slot[0].toUpperCase()+slot.slice(1)];
  assert.ok(controls.show&&controls.hasX&&controls.hasY&&controls.hasDataRange);
  assert.match(controls.rangeHint,/year: 1895 to 2030/);assert.match(controls.rangeHint,/budget: 1.23456 to 50.1234567/);
  let options=c.scatterOptions(slot,'year','budget'),plot=E.scatterChart(R,corr,{key:slot,...options});
  assert.deepEqual(plot.domain,{x:[1895,2030],y:[1.23456,50.1234567]});
  assert.ok(leaves(plot.node).some(n=>n.tag==='text'&&n.children.includes('1,895')));
  assert.ok(leaves(plot.node).some(n=>n.tag==='text'&&n.children.includes('2,030')));
  controls.setXmin({target:{value:'1910'}});controls.setXmax({target:{value:'2020'}});
  controls.setYmin({target:{value:'10'}});controls.setYmax({target:{value:'20'}});
  out=c.renderVals();plot=E.scatterChart(R,corr,{key:slot,...c.scatterOptions(slot,'year','budget')});
  assert.deepEqual(plot.domain,{x:[1910,2020],y:[10,20]});
  const current=out['ax'+slot[0].toUpperCase()+slot.slice(1)];assert.ok(current.dirty);current.reset();out=c.renderVals();
  assert.equal(out['ax'+slot[0].toUpperCase()+slot.slice(1)].dirty,false);
  assert.deepEqual(E.scatterChart(R,corr,{key:slot,...c.scatterOptions(slot,'year','budget')}).domain,{x:[1895,2030],y:[1.23456,50.1234567]});
  out=render({flt:{v:'year',op:'>=',val:'1920',on:true}});
  assert.match(out['ax'+slot[0].toUpperCase()+slot.slice(1)].rangeHint,/year: 1920 to 2030/);
  assert.deepEqual(c.scatterOptions(slot,'year','budget').dataRange,{x:[1920,2030],y:[3.5,42.6789]});
  // An explicit include-zero selection remains available, and Reset restores
  // the positive observed minimum instead of forcing zero.
  out['ax'+slot[0].toUpperCase()+slot.slice(1)].zeroClick();c.renderVals();
  assert.equal(E.scatterChart(R,corr,{key:slot,...c.scatterOptions(slot,'year','budget')}).domain.y[0],0);
  c.renderVals()['ax'+slot[0].toUpperCase()+slot.slice(1)].reset();
  assert.equal(E.scatterChart(R,corr,{key:slot,...c.scatterOptions(slot,'year','budget')}).domain.y[0],3.5);
}
for(const [lo,hi]of [[1895,2025],[1.23456,42.6789],[-42.7,-1.2],[.00000123,.00000987]]){
  const ticks=E.scatterRangeTicks(lo,hi);assert.equal(ticks[0],lo);assert.equal(ticks.at(-1),hi);assert.ok(ticks.every(v=>v>=lo&&v<=hi));
}
// Manual zoom must not turn a fitted slope of 2 into a shallow diagonal by
// clamping line endpoints to the selected Y limits.
const line=E.scatterChart(R,{n:4,xs:[0,25,75,100],ys:[0,50,150,200],fit:{icept:0,slope:2}},
  {key:'zoom',ax:{x:[0,100],y:[50,100]}});
const fit=leaves(line.node).find(n=>n.props?.key==='fit');
assert.ok(fit.props.y1>348&&fit.props.y2<18);
assert.ok(leaves(line.node).some(n=>n.tag==='g'&&n.props.clipPath==='url(#clip-zoom)'));
assert.ok(!JSON.stringify(line.node).includes('NaN'));
assert.ok(template.includes('axScatter.rangeHint')&&template.includes('axPlot.rangeHint'));
console.log('Observed ranges, exact endpoint ticks, active filters, manual limits, include-zero, Reset and true fit-line clipping passed in Charts and Correlation.');
