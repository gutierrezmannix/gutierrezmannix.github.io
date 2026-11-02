// Tests ▾ → Multiple imputation / pooled regression in a real browser, offline (build .63):
//   NODE_PATH=$(npm root -g) node calculator/tests/impute-e2e.cjs
// Auxiliary variables, the default of 20 imputations, Poisson, the outcome checks, the three tables and the notes,
// the Diagnostics text and the console commands. GM26_SHOTS=dir saves screenshots. Fails on any console error.
const fs = require('fs'), os = require('os');
const { chromium } = require('playwright'); const path=require('path');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:1000}});const errs=[];const out=process.env.GM26_SHOTS||'';const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gm26-mi-')),csv=path.join(tmp,'encuesta_mi.csv');let fails=0;
{let s=11;const u=()=>(s=(s*16807)%2147483647)/2147483647,nrm=()=>Math.sqrt(-2*Math.log(u()))*Math.cos(2*Math.PI*u());const L=['satisf,edad,ingreso,educ,sexo'];const E=['primaria','secundaria','universidad'];for(let i=0;i<250;i++){const edad=18+Math.floor(52*u()),e=E[Math.floor(3*u())],ing=Math.round(8000+120*edad+(e==='universidad'?4000:e==='secundaria'?1500:0)+2500*nrm()),sat=+(3+0.0002*ing+nrm()).toFixed(1),hi=sat>5.5?2:1;L.push([u()<.1*hi?'':sat,u()<.05*hi?'':edad,u()<.25*hi?'':ing,u()<.08*hi?'':e,u()<.5?'hombre':'mujer'].join(','));}fs.writeFileSync(csv,L.join('\n'));}
p.on('pageerror',e=>errs.push(String(e)));p.on('console',m=>{if(m.type()==='error'&&!/net::/.test(m.text()))errs.push(m.text().slice(0,300))});
await p.route('**/*',r=>/^(file|data|blob):/.test(r.request().url())?r.continue():r.abort());
await p.goto('file:///home/user/gutierrezmannix.github.io/calculator/index.html');await p.waitForTimeout(2000);
const [fc]=await Promise.all([p.waitForEvent('filechooser'),p.locator('.gi-drop').click()]);await fc.setFiles(csv);
await p.waitForSelector('.mf-main',{timeout:180000});await p.waitForTimeout(1500);
for(let k=0;k<3;k++){const ok=await p.evaluate(()=>{const e=[...document.querySelectorAll('button')].find(x=>x.offsetParent&&x.textContent.trim()==='Multiple imputation / pooled regression');if(e)e.click();return !!e});if(ok)break;await p.locator('button.mf-nav[data-nav="tests"]').click();await p.waitForTimeout(700);}
await p.waitForTimeout(1200);
const ok=(c,w)=>{console.log((c?'  ok  ':'  FAIL ')+w);if(!c)fails++;};
const main=()=>p.locator('.mf-main').innerText();
const tab=async t=>{await p.evaluate(t=>{const e=[...document.querySelectorAll('button,[role=tab]')].find(x=>x.offsetParent&&x.textContent.trim()===t);if(e)e.click()},t);await p.waitForTimeout(600);};
const run=async()=>{await tab('Setup');await p.getByRole('button',{name:'Run analysis'}).click();await p.waitForTimeout(500);await p.waitForFunction(()=>!/Running/i.test(document.querySelector('.mf-main').innerText),null,{timeout:120000}).catch(()=>{});await p.waitForTimeout(800);};
let t=await main();
ok(/Auxiliary variables \(optional/.test(t),'Setup has the optional Auxiliary variables field');
ok(await p.locator('input[aria-label="Number of imputations"]').inputValue()==='20','imputations default 20');
const fams=await p.locator('select[aria-label="Family"] option').allTextContents();ok(fams.includes('poisson'),'Family offers '+fams.join(', '));
await p.locator('select[aria-label="Outcome"]').selectOption('satisf');await p.locator('select[aria-label="Predictors"]').selectOption(['edad','ingreso','educ']);
await p.locator('select[aria-label="Auxiliary variables (optional: used to impute, not in the regression)"]').selectOption(['sexo']).catch(e=>console.log('aux select by label failed',e.message.slice(0,100)));
await run();t=await main();
ok(/Missing data/.test(t)&&/Rubin-pooled estimates/.test(t)&&/Missing information/.test(t),'three tables: Missing data, Rubin-pooled estimates, Missing information');
ok(/sexo\s+auxiliary\s+0/.test(t),'sexo listed as auxiliary');ok(!/\bsexo/.test(t.split('Rubin-pooled estimates')[1].split('Missing information')[0]),'sexo is not in the regression');
ok(/rows are complete on every variable/.test(t)&&/statistically significant at α/.test(t)&&/Fraction of missing information/.test(t),'plain-language notes');
if(out)await p.screenshot({path:out+'/mi-results.png',fullPage:true});
await tab('Diagnostics');t=await main();ok(!/\bNULL\b/.test(t)&&/No logged events/.test(t),'Diagnostics: no "NULL"');if(out)await p.screenshot({path:out+'/mi-diag.png',fullPage:true});
// binomial with a 1–7 outcome: a clear error
await tab('Setup');await p.locator('select[aria-label="Family"]').selectOption('binomial');await run();t=await main();
ok(/needs an outcome coded 0\/1/.test(t),'binomial on a 1–7 outcome: clear error');
// categorical 3-level outcome
await tab('Setup');await p.locator('select[aria-label="Outcome"]').selectOption('educ');await p.locator('select[aria-label="Predictors"]').selectOption(['edad','ingreso']);await run();t=await main();ok(/exactly 2 categories; this one has 3/.test(t),'3-category outcome with binomial: clear error');
await tab('Setup');await p.locator('select[aria-label="Family"]').selectOption('gaussian');await run();t=await main();ok(/The outcome is categorical/.test(t),'categorical outcome with gaussian: clear error');
// binary categorical outcome with binomial works
await tab('Setup');await p.locator('select[aria-label="Family"]').selectOption('binomial');await p.locator('select[aria-label="Outcome"]').selectOption('sexo');await p.locator('select[aria-label="Predictors"]').selectOption(['edad','ingreso','satisf']);
await p.locator('select[aria-label="Auxiliary variables (optional: used to impute, not in the regression)"]').selectOption([]).catch(()=>{});await run();t=await main();ok(/Rubin-pooled estimates/.test(t),'binary outcome sexo with binomial runs');
// poisson
await tab('Setup');await p.locator('select[aria-label="Family"]').selectOption('poisson');await p.locator('select[aria-label="Outcome"]').selectOption('edad');await p.locator('select[aria-label="Predictors"]').selectOption(['ingreso','educ']);await run();t=await main();ok(/Rubin-pooled estimates/.test(t),'Poisson runs');
// console commands
await p.evaluate(()=>[...document.querySelectorAll('button')].find(e=>e.offsetParent&&/^Console\b/.test(e.textContent.trim()))?.click());await p.waitForTimeout(800);
const body=await p.locator('body').innerText();ok(/mi impute chained/.test(body),'console shows Stata mi impute chained');
await p.setViewportSize({width:390,height:844});await p.waitForTimeout(600);ok(await p.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)<=1,'phone width: no sideways scroll');
ok(!errs.length,'no console errors '+errs.join(' | '));await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
