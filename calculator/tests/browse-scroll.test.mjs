import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
const page=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const template=JSON.parse(page.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
const manifest=JSON.parse(page.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1]);
const E=await import('data:text/javascript;base64,'+gunzipSync(Buffer.from(manifest['7f0c6180-e6c1-4faf-bd4a-6b2fddc15715'].data,'base64')).toString('base64'));
const code=template.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
class Base{props={};setState(p){this.state={...this.state,...(typeof p==='function'?p(this.state):p)};}forceUpdate(){this.updates=(this.updates||0)+1;}}
globalThis.React={createElement:(tag,props,...children)=>({tag,props:props||{},children})};
globalThis.window={innerWidth:1800};globalThis.document={documentElement:{style:{zoom:''}}};
let frame;globalThis.requestAnimationFrame=fn=>{frame=fn;return 1;};
const C=new Function('DCLogic',code+';return Component')(Base);
const c=new C();c._E=E;
// A million rows, 86 variables; arrays can share storage for this DOM-size check.
const a=Float64Array.from({length:1025720},(_,i)=>i+0.123456789012345);
c._raw={n:a.length,names:Array.from({length:86},(_,i)=>'v'+i),labels:Array(86).fill(''),vlabs:{},cols:Array.from({length:86},()=>({k:'n',a}))};
c.state={...c.state,screen:'work',tab:'browse',nRows:a.length,autoScreen:false,cols:c._raw.names.map((name,idx)=>({name,idx,type:'numeric',valid:a.length,miss:0,distinct:a.length}))};
const walk=(node,fn)=>{if(!node||typeof node!=='object')return;fn(node);for(const child of node.children||[])walk(child,fn);};
const inputs=out=>{const list=[];walk(out.browseGridEl,n=>{if(n.tag==='input')list.push(n);});return list;};
let out={};c.browseScrollVals(out,c.state.cols);
assert.ok(inputs(out).length<400);assert.equal(inputs(out)[0].props.defaultValue,String(a[0]));
assert.equal(out.browseGridEl.children[0].props['aria-rowcount'],1025721);
const el={scrollTop:0,scrollLeft:0,clientHeight:510,clientWidth:900};c._browseEl=el;
const geometry=c.browseWindow(a.length,86,1e10,1e4,510,900);
assert.ok(geometry.height<=8000036);assert.equal(geometry.end,a.length);
el.scrollTop=geometry.maxTop;el.scrollLeft=86*96+60-el.clientWidth;
out={};c.browseScrollVals(out,c.state.cols);
assert.ok(inputs(out).some(n=>n.props['data-ck']==='1025719:85'),'last row/variable must be reachable');
assert.ok(inputs(out).length<400,'DOM size must stay bounded at the end');
const last=inputs(out).find(n=>n.props['data-ck']==='1025719:85');
assert.equal(last.props.defaultValue,String(a.at(-1)));
// Filtered scrolling uses original row IDs, including sparse matches at the end.
const mask=new Uint8Array(a.length);mask[3]=1;mask[990000]=1;mask[a.length-1]=1;
c.conds=()=>[{v:'v0',t:'cmp',op:'>',val:'0'}];c.mask=()=>mask;
el.scrollTop=0;el.scrollLeft=0;out={};c.browseScrollVals(out,c.state.cols);
assert.deepEqual([...c.browseIndex().rows],[3,990000,1025719]);
assert.ok(inputs(out).some(n=>n.props['data-ck']==='990000:0'));assert.match(out.browseNote,/3 ROWS IN SUBGROUP/);
assert.equal(c.browseIndex(),c.browseIndex(),'filtered index is reused during scrolling');
c.mask=()=>new Uint8Array(a.length);out={};c.browseScrollVals(out,c.state.cols);assert.equal(inputs(out).length,0);assert.match(JSON.stringify(out),/No rows match/);
// Hidden/reordered columns retain their original dataset index.
c.conds=()=>[];out={};c.browseScrollVals(out,[c.state.cols[85],c.state.cols[1]]);
assert.equal(inputs(out)[0].props['data-ck'],'0:85');
// No-op focus/blur preserves exact values and does not append rows at the end.
const saves=[];c.commitCell=(r,idx,value)=>saves.push({r,idx,value});
c._browseDraft={raw:c._raw,r:a.length-1,idx:85,value:String(a.at(-1))};c.browseSaveDraft();assert.equal(saves.length,0);
c._browseDraft={raw:c._raw,r:200,idx:85,value:'1.2345678901234567'};c.browseSaveDraft();assert.deepEqual(saves.pop(),{r:200,idx:85,value:'1.2345678901234567'});
// Scrolling a draft out of view commits it before its input is removed.
out={};c.browseScrollVals(out,c.state.cols);const input=inputs(out)[0];input.props.onFocus({target:{value:'12'}});input.props.onChange({target:{value:'42'}});
el.scrollTop=30000;c.browseSchedule();frame();assert.equal(saves.pop().value,'42');assert.equal(c._browseDraft,null);
// Tab, Enter and Shift+Tab cross virtual boundaries and filtered rows correctly.
el.scrollTop=0;el.scrollLeft=0;out={};c.browseScrollVals(out,c.state.cols);
const row0=inputs(out)[0];let prevented=0;row0.props.onKeyDown({key:'Tab',preventDefault(){prevented++;}});assert.equal(c._focusNext,'0:1');
row0.props.onKeyDown({key:'Enter',preventDefault(){prevented++;}});assert.equal(c._focusNext,'1:0');assert.equal(prevented,2);
assert.ok(c.browseMove(1000000,85));assert.equal(c._focusNext,'1000000:85');assert.ok(el.scrollTop>0&&el.scrollLeft>0);
assert.equal(c.browseMove(a.length,0),false);
// Window fitting accounts for text-size zoom and is stable after page scrolling.
globalThis.window.innerHeight=936;globalThis.window.scrollY=200;
el.style={};el.offsetHeight=500;el.getBoundingClientRect=()=>({top:200,height:560});
c.browseAfterUpdate();assert.equal(el.style.height,'390px');
window.scrollY=0;el.getBoundingClientRect=()=>({top:400,height:560});c.browseAfterUpdate();assert.equal(el.style.height,'390px');
// Old session/jump offsets are translated into scroll positions once, not every update.
c.state.bRow=1700;c.state.bCol=30;c.browseAfterUpdate();assert.ok(el.scrollTop>0);assert.equal(el.scrollLeft,2880);
el.scrollTop=123;el.scrollLeft=456;c.browseAfterUpdate();assert.equal(el.scrollTop,123);assert.equal(el.scrollLeft,456);
// Columns with value labels preserve editable raw numbers and expose label tooltips.
c._raw.vlabs.v0=new Map([[a[0],'Label for first value']]);el.scrollTop=0;el.scrollLeft=0;out={};c.browseScrollVals(out,c.state.cols);
assert.match(inputs(out)[0].props.title,/Label for first value/);
assert.ok(!template.includes('{{ browsePager }}'));
assert.ok(template.includes('max-width: none;'));
// Browse gets its own collapsed dock preference without changing other analyses.
const small=new C(), csv=Buffer.from('x,y\n1,2\n2,4\n3,5\n');small._E=E;
small._raw=await E.parseCSV(csv.buffer.slice(csv.byteOffset,csv.byteOffset+csv.byteLength),()=>{});
small.state={...small.state,screen:'work',tab:'browse',nRows:3,autoScreen:false,mfDock:true,cols:small._raw.names.map((_,i)=>E.profileCol(small._raw,i))};
let v=small.renderVals();assert.equal(v.mfDockShow,false);assert.ok(v.mfDockRail);assert.match(v.layoutCols,/46px$/);
v.mfDockTabs.find(t=>t.short==='Plots').open();v=small.renderVals();assert.ok(v.mfDockShow);
v.mfDockClose();v=small.renderVals();assert.equal(v.mfDockShow,false);assert.equal(small.state.mfDock,true);
small.openModelGuide();assert.equal(small.renderVals().mfPaneHelp,true);small.renderVals().mfDockClose();
small.state.tab='one';assert.equal(small.renderVals().mfDockShow,true);
assert.equal(c.browseWindow(100,86,0,0,500,900).cw,96);
clearTimeout(small._ghostT);clearTimeout(small._mfOkT);
console.log('Million-row/86-variable bounded scrolling, endpoints, sparse/empty filters, original row/column IDs, precision, draft commits, keyboard movement and legacy jumps passed.');
