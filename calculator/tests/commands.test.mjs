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
// Dynamic panel: a 0/1 predictor read as categorical is treatment-coded (it used to make the GMM matrix singular), and
// Diagnostics report the Arellano-Bond AR(1)/AR(2) and Wald tests exactly as plm's summary(pgmm, robust = TRUE).
{const pk=JSON.parse(fs.readFileSync(new URL('./engine/cases/pass2-panel_dynamic_dem_catx.packet.json',import.meta.url),'utf8'));delete pk.__compare;const r=E.gmRun(pk);assert.ok(!r.error,r.error);
 const dg=[].concat(r.diagnostics);for(const l of ['Autocorrelation test (1): normal = -4.9523 (p-value = 7.3341e-07)','Autocorrelation test (2): normal = -0.8188011 (p-value = 0.4129)','Wald test for coefficients: chisq(3) = 115.4183 (p-value = < 2.22e-16)'])assert.ok(dg.includes(l),l);
 assert.match([].concat(r.notes).join(' '),/exactly identified/);}
const dp=c.asCommands({id:'panel_dynamic',title:'Dynamic'},{id:'panel_dynamic',alpha:.05,fields:{y:['v1'],predictors:['v4','v3'],subject:['v6'],time:['v2']},options:{lags:3},data:{v1:{name:'democracy'},v2:{name:'year'},v3:{name:'majority',type:'categorical'},v4:{name:'ideol_range'},v6:{name:'cabinet_type',type:'categorical'}}});
assert.match(dp.stata,/xtabond2 democracy L\.democracy ideol_range i\.majority, gmm\(L\.democracy, laglimits\(1 2\) collapse\) iv\(ideol_range i\.majority\) noleveleq twostep robust/);assert.match(dp.stata,/encode cabinet_type generate\(cabinet_type_c\)\nxtset cabinet_type_c year/);assert.match(dp.r,/lag\(democracy, 2:3\)/);
const hu=c.asCommands({id:'hurdle',title:'Hurdle'},{id:'hurdle',alpha:.05,fields:{y:['v1'],predictors:['v3','v4'],offset:['v2']},options:{},data:{v1:{name:'protests'},v2:{name:'population_m'},v3:{name:'majority',type:'categorical'},v4:{name:'ideol_range'}}});
assert.equal(hu.r,'pscl::hurdle(protests ~ factor(majority) + ideol_range + offset(log(population_m)), data = df, dist = "negbin")');
// Paired chart: lines coloured by direction, a bold line through the means, and the summary of change.
{const ps=E.csScene('paired',E.csPrepare('paired',{x:[1,2,3,4],y:[2,2,1,6]}),{x:'a',y:'b'});assert.match(ps.note,/Mean 2\.5 → 2\.75 \(mean change \+0\.25\)\. 2 of 4 pairs increased \(blue lines\), 1 decreased \(rust\), 1 unchanged/);assert.ok(ps.markup.includes('stroke-width="4"'));}
// Conjoint plots: cregg-style output with reference levels (estimate 0, blank bounds) plots, grouped by attribute.
{const d=E.csPrepare('conjoint',{x:['Male','Female','35','65'],y:[0,.07,0,-.03],lo:[NaN,.05,NaN,-.06],hi:[NaN,.1,NaN,-.001]});d.rows.forEach((r,i)=>{r.a=['Gender','Gender','Age','Age'][r.i];});
 const sc=E.csScene('conjoint',d,{});for(const t of ['>Gender</text>','>Male (ref.)</text>','>Female</text>','>Age</text>'])assert.ok(sc.markup.includes(t),t);assert.equal(sc.table.length,4);assert.deepEqual(sc.table[0],['Gender','Male','All',0,null,null]);assert.match(sc.note,/reference levels/);
 const bad=E.csPrepare('conjoint',{x:['A'],y:[.2],lo:[NaN],hi:[NaN]});assert.throws(()=>E.csScene('conjoint',bad,{}),/Level “A” has no confidence bounds/);
 const mm=E.csScene('conjoint',E.csPrepare('conjoint',{x:['A','B'],y:[.45,.55],lo:[.4,.5],hi:[.5,.6]}),{refLine:'0.5'});assert.match(mm.note,/Dashed line at 0\.5/);}
// Exact normal / chi-square tails (R's pnorm and pchisq), so console printouts match R digit for digit.
assert.equal(E.pZ(6.4131).toExponential(4),'1.4259e-10');assert.ok(Math.abs(E.pChi2(693.6064,2)/2.428197e-151-1)<1e-5);
// R's coeftest() table (printCoefmat rules), checked against real R output for glm(parties ~ democ, poisson).
assert.equal(c.rCoefText(['(Intercept)','democ'],[{b:0.5990069,se:0.0934032,t:6.413128,p:1.4259e-10},{b:0.1094283,se:0.0295522,t:3.702907,p:0.00021322}],'z'),['','z test of coefficients:','','            Estimate Std. Error z value  Pr(>|z|)    ','(Intercept) 0.599007   0.093403  6.4131 1.426e-10 ***','democ       0.109428   0.029552  3.7029 0.0002132 ***','---','Signif. codes:  0 ‘***’ 0.001 ‘**’ 0.01 ‘*’ 0.05 ‘.’ 0.1 ‘ ’ 1'].join('\n'));
// Regression commands Stata and R can run: text factors encoded; clustered R fits drop rows without a cluster.
c.effMeta=n=>({type:n==='region'?'string':'numeric'});
assert.equal(c.regFix('regress turnout lgdp i.compulsory i.region, vce(robust)',{t:'reg',xs:[{n:'lgdp'},{n:'compulsory',c:true},{n:'region',c:true}]},'stata'),'encode region, generate(region_c)\nregress turnout lgdp i.compulsory i.region_c, vce(robust)');
assert.match(c.regFix('m <- glm(protest ~ democ, family = binomial, data = df)\ncoeftest(m, vcov = vcovCL(m, cluster = ~region))',{t:'reg',m:'logistic',xs:[],vce:{type:'cluster',cl:'region'}},'r'),/data = subset\(df, !is\.na\(region\)\)/);
assert.equal(c.regFix('summary(glm(parties ~ democ, family = poisson, data = df))',{t:'reg',m:'poisson',xs:[]},'r'),'library(lmtest)\nm <- glm(parties ~ democ, family = poisson, data = df)\ncoeftest(m)');
// Timeline commands draw the plotted means (not the raw rows), with the band and breaks at missing periods.
c.numVals=n=>n==='year'?{a:Float64Array.from([1990,1991,1992,1994,1990,1991])}:null;
const tl=c.lineCmd({x:'year',ci:'ci'},'stata',['democracy'],null,[]);assert.match(tl,/collapse \(mean\) democracy \(sd\) gm_sd=democracy \(count\) gm_n=democracy, by\(year\)\ntsset year\ntsfill/);assert.match(tl,/\(rarea gm_lo gm_hi year, sort\) \(line democracy year, sort cmissing\(n\)\)/);
assert.match(c.lineCmd({x:'year',g:'region'},'r',['democracy'],['"Asia"','"Africa"'],[]),/aggregate\(democracy ~ year \+ region, d,[\s\S]*expand\.grid\(year = seq\(min\(a\$year\), max\(a\$year\), by = 1\), region = unique\(a\$region\)\)[\s\S]*colour = region\)\) \+ geom_line\(\)/);
clearTimeout(c._ghostT);console.log('Analysis commands (Cox, lasso, exact McNemar), alias relabelling and cumulative keep/drop filters passed.');
