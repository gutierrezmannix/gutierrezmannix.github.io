// Console commands for Tests ▾ analyses and the console row filter (random-pass fixes, build .41).
import assert from 'node:assert/strict';
import fs from 'node:fs';import {gunzipSync} from 'node:zlib';
const page=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),template=JSON.parse(page.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]),manifest=JSON.parse(page.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1]);
const E=await import('data:text/javascript;base64,'+gunzipSync(Buffer.from(manifest['7f0c6180-e6c1-4faf-bd4a-6b2fddc15715'].data,'base64')).toString('base64'));
class Base {props={};setState(p,cb){this.state={...this.state,...(typeof p==='function'?p(this.state):p)};cb?.();}forceUpdate(){}}
globalThis.React={createElement:(tag,props,...children)=>({tag,props,children})};globalThis.window={innerWidth:1600};globalThis.document={documentElement:{style:{zoom:''}}};
const C=new Function('DCLogic',template.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1]+';return Component')(Base);
const c=new C();c._E=E;
// Aliases back to names: factor terms are alias + level ("v31" = v3 at level 1 when there is no v31).
const L={v3:'majority',v5:'party',v6:'cabinet_type',v31:'other'};
assert.equal(c.asRelabel('v31',{v3:'majority'}),'majority1');assert.equal(c.asRelabel('v31',L),'other');assert.equal(c.asRelabel('v5left',L),'partyleft');assert.equal(c.asRelabel('v6minority and v3',L),'cabinet_typeminority and majority');
// Commands: text categorical predictors are encoded and entered as i.; coded numbers as i. / factor(); stcox uses Efron ties as coxph does.
const meta={majority:'numeric',party:'text',cabinet_type:'text'};c.effMeta=n=>({type:meta[n]==='text'?'string':'numeric'});
const data={v1:{name:'months',type:'numeric'},v2:{name:'ended',type:'numeric'},v3:{name:'majority',type:'categorical'},v4:{name:'ideol_range',type:'numeric'},v6:{name:'cabinet_type',type:'categorical'}};
const cox=c.asCommands({id:'cox',title:'Cox'},{id:'cox',alpha:.05,fields:{time:['v1'],event:['v2'],predictors:['v3','v4','v6']},options:{},data});
assert.equal(cox.stata,'encode cabinet_type generate(cabinet_type_c)\nstset months, failure(ended)\nstcox i.majority ideol_range i.cabinet_type_c, efron');
assert.equal(cox.r,'survival::coxph(survival::Surv(months, ended) ~ factor(majority) + ideol_range + cabinet_type, data = df)');
const las=c.asCommands({id:'lasso',title:'Lasso'},{id:'lasso',alpha:.05,fields:{y:['v1'],predictors:['v4','v6']},options:{family:'binomial',folds:10,trainFraction:.7,seed:42},data});
assert.match(las.stata,/lasso logit months ideol_range i\.cabinet_type_c if gm_split == 1, selection\(cv, folds\(10\) serule\) rseed\(42\)/);assert.match(las.stata,/split\(0\.7 0\.3\)/);
assert.match(las.r,/set\.seed\(42\); tr <- sort\(sample\.int\(nrow\(d\), floor\(nrow\(d\) \* 0\.7\)\)\)/);assert.match(las.r,/family = "binomial", alpha = 1, nfolds = 10/);
const mc=c.asCommands({id:'mcnemar_exact',title:'Exact McNemar'},{id:'mcnemar_exact',alpha:.1,fields:{y:['v1'],y2:['v2']},options:{},data:{v1:{name:'before'},v2:{name:'after'}}});
assert.equal(mc.stata,'mcc after before, level(90)');assert.equal(mc.r,'binom.test(sum(df$before == 0 & df$after == 1, na.rm = TRUE), sum(df$before != df$after, na.rm = TRUE), conf.level = 0.9)');
const mcs=c.asCommands({id:'mcnemar_exact',title:'Exact McNemar'},{id:'mcnemar_exact',alpha:.05,fields:{},options:{inputMode:'summary',table:'40, 3\n15, 53'},data:{}});
assert.equal(mcs.stata,'mcci 53 3 15 40');assert.equal(mcs.r,'binom.test(3, 18)');
// Exported keep if: numeric codes unquoted; missing excluded explicitly (Stata treats missing as larger than any number).
c.state={...c.state};assert.equal(c.cmdText({t:'filter',v:'majority',op:'!=',val:'0',cat:true},'stata'),'keep if majority != 0 & !missing(majority)');
assert.equal(c.cmdText({t:'filter',v:'cabinet_type',op:'==',val:'single',cat:true},'stata'),'keep if cabinet_type == "single"');
assert.equal(c.fltText({v:'a',op:'==',val:'1',more:[{v:'b',op:'!=',val:'0'}]}),'a == 1 & b != 0');
clearTimeout(c._ghostT);console.log('Analysis commands (Cox, lasso, exact McNemar), alias relabelling and cumulative keep/drop filters passed.');
