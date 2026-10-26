  // GM26 time-series setup begin
  // Every Tests → Time series page starts like Stata's tsset: the time variable (numbers or text dates), an optional
  // panel variable, and which series to analyse. The series is built and checked here, before R starts, and R
  // receives one regular row per period. Forecast periods come back labelled as dates.
  tsKinds(){return {decompose:'decompose',naive:'forecast',snaive:'forecast',drift:'forecast',ets:'forecast',arima:'arima',sarima:'arima',tsreg:'regression',ardl:'regression',var:'system',vecm:'system',breaks:'regression',countts:'regression'};}
  tsTime(c){
    const E=this._E,tv=c.fields?.time?.[0];if(!tv)return null;const meta=this.effMeta(tv);if(!meta)return null;
    const as=c.tsAs||'auto',key='tsd|'+tv+'|'+as+'|'+(c.tsOrder||'auto')+'|'+(this.state.dver||0)+'|'+(meta.type||'');
    return this.memo(key,()=>{
      const raw=this._raw,col=raw.cols[raw.names.indexOf(tv)];let r;
      if(meta.type==='numeric'){const a=(this.numVals(tv)||{}).a||new Float64Array(0);r=E.tsdReadNumber(a,['yearly','quarterly','monthly','daily','weekly','generic'].includes(as)?as:as==='trading'?'daily':'auto');r.source='number';}
      else{r=E.tsdReadText(col?col.a:[],c.tsOrder||'auto');r.source='text';}
      return r;
    });
  }
  tsFirstDay(codes){for(const t of codes)if(Number.isFinite(t))return new Date(Date.UTC(1960,0,1)+t*86400000).getUTCDate()===1;return true;}
  tsFreqName(f){return (this._E.TSD_FREQ[f]||{}).label||f;}
  tsColumnValues(name){
    if(!name)return null;const meta=this.effMeta(name);if(!meta)return null;
    if(meta.type==='numeric'){const a=(this.numVals(name)||{}).a;return a?Array.from(a,v=>Number.isFinite(v)?String(v):null):null;}
    const raw=this._raw,col=raw.cols[raw.names.indexOf(name)];return col?Array.from(col.a,v=>v==null||v===''?null:String(v)):null;
  }
  tsBuild(info,c){
    const E=this._E,kind=this.tsKinds()[info.id],r=this.tsTime(c),out={kind,read:r,errors:[],notes:[],freq:'',series:null,units:[],candidates:[]};
    const tv=c.fields?.time?.[0];if(!tv){out.errors.push('Choose the time variable.');return out;}
    if(!r||!r.freq){out.errors.push(r&&r.source==='text'?'“'+tv+'” does not look like dates. Use a column such as 2014-01-01, 2014-01, 2014m1, 2014q1, “Nov 1, 2011” or a year.':'“'+tv+'” has no usable time values.');return out;}
    if(r.nonInteger){out.errors.push('“'+tv+'” has fractional values. Time must be whole periods (years, months, days…) or dates.');return out;}
    let freq=r.freq;const as=c.tsAs||'auto',mask=this.mask(),uv=c.tsUnit||'',unit=uv?this.tsColumnValues(uv):null;
    if(as!=='auto'){
      if(r.source==='text'){
        if(['weekly','trading','daily'].includes(as)&&r.freq==='daily')freq=as;
        else if(as!==r.freq){out.errors.push('“'+tv+'” contains '+this.tsFreqName(r.freq).toLowerCase()+' dates; it cannot be read as '+this.tsFreqName(as).toLowerCase()+'. Choose Automatic.');return out;}
      }else freq=as==='trading'?'trading':as;
    }else if(freq==='daily')freq=E.tsdDailyKind(r.codes,unit,mask);
    let codes=r.codes;
    if(r.freq==='daily'&&['monthly','quarterly','yearly'].includes(freq)){codes=E.tsdFromDays(r.codes,freq);out.notes.push('Every date in “'+tv+'” is the '+(this.tsFirstDay(r.codes)?'first':'last')+' day of its '+({monthly:'month',quarterly:'quarter',yearly:'year'}[freq])+', so the dates are read as '+this.tsFreqName(freq).toLowerCase()+' periods. Choose Daily under “Read time as” to keep daily dates.');}
    out.freq=freq;
    if(r.invalid)out.errors.push(r.invalid+' value'+(r.invalid>1?'s':'')+' of “'+tv+'” could not be read as '+this.tsFreqName(r.freq).toLowerCase()+' dates (e.g. '+r.bad.map(v=>'“'+v+'”').join(', ')+'). Fix them in Browse, or use a subgroup to exclude them.');
    if(r.ambiguous&&!c.tsOrder)out.notes.push('Dates such as '+'“'+String(this._raw.cols[this._raw.names.indexOf(tv)].a.find(v=>v!=null&&v!==''))+'” could be month/day or day/month. They are read as month/day/year (MDY); change the order below if needed.');
    const vars={},take=n=>{const a=(this.numVals(n)||{}).a;if(a)vars[n]=a;};
    for(const n of [...(c.fields?.y||[]),...(c.fields?.predictors||[]),...(c.fields?.variables||[])])take(n);
    const pick=c.tsSeries||'',combine=pick==='mean'||pick==='sum'?pick:'',unitPick=pick.startsWith('unit:')?pick.slice(5):'';
    const s=E.tsdSeries({time:codes,freq,unit,unitPick,combine,repeats:c.tsRepeats||'',vars,mask});
    out.series=s;out.units=s.units;
    if(!uv&&s.dupPeriods){
      const names=this._raw.names.filter(n=>n!==tv&&!(c.fields?.y||[]).includes(n)).slice(0,60);
      out.candidates=this.memo('tscand|'+tv+'|'+freq+'|'+(this.state.dver||0)+'|'+this.filterSig(),()=>E.tsdPanelCandidates(codes,names.map(n=>[n,this.tsColumnValues(n)||[]]),mask)).slice(0,4);
    }
    out.errors.push(...s.errors);
    return out;
  }
  // tsset-style summary (plain text, like Stata's output)
  tsSummary(b,c){
    if(!b||!b.series||!b.freq)return '';
    const E=this._E,f=E.TSD_FREQ[b.freq]||{},s=b.series,tv=c.fields?.time?.[0],uv=c.tsUnit,lab=t=>E.tsdLabel(t,b.freq);
    const lines=[];
    if(uv){const bal=s.unitsBalanced?'strongly balanced':'unbalanced';lines.push('panel variable:  '+uv+' ('+s.units.length+' units, '+bal+')');}
    const p=s.periods,lo=p.length?p[0]:Math.min(...s.units.map(u=>u.first)),hi=p.length?p[p.length-1]:Math.max(...s.units.map(u=>u.last)),first=Number.isFinite(lo)?lab(lo):'—',last=Number.isFinite(hi)?lab(hi):'—';
    lines.push(' time variable:  '+tv+', '+first+' to '+last+(b.read.source==='text'?'  (text dates, read as '+(f.label||'').toLowerCase()+')':''));
    lines.push('         delta:  1 '+(f.unit||'period')+(b.freq==='trading'?' (weekdays only; calendar gaps at weekends/holidays are ignored)':''));
    const pick=c.tsSeries||'';
    if(uv&&s.units.length>1)lines.push('     analysing:  '+(pick.startsWith('unit:')?this.vlabel(uv,pick.slice(5)):pick==='mean'?'all '+s.units.length+' units, averaged per period':pick==='sum'?'all '+s.units.length+' units, summed per period':'(choose a series below)')+(p.length?' · '+p.length+' periods':''));
    else lines.push('       periods:  '+p.length);
    if(!uv&&s.dupPeriods&&c.tsRepeats)lines.push('       repeats:  '+s.dupPeriods+' periods with more than one row, '+(c.tsRepeats==='sum'?'summed':'averaged'));
    return lines.join('\n');
  }
  tsPacket(info,c){
    const b=this.tsBuild(info,c);if(b.errors.length)throw Error(b.errors[0]);
    const E=this._E,s=b.series,f=E.TSD_FREQ[b.freq]||{cycle:1},kind=b.kind,data={},fields={},alias=new Map();let k=0;
    const add=(name,values)=>{const key='v'+(++k);alias.set(name,key);data[key]={name,type:'numeric',values:values.map(v=>Number.isFinite(v)?v:null)};return key;};
    for(const n of c.fields?.y||[])fields.y=[add(n,s.rows.map(r=>r[n]))];
    fields.time=[add(c.fields.time[0],s.periods.map((t,i)=>E.tsdIndex(t,b.freq,i)))];
    for(const role of ['predictors','variables'])if((c.fields?.[role]||[]).length)fields[role]=c.fields[role].map(n=>alias.get(n)||add(n,s.rows.map(r=>r[n])));
    const cycle=Number(c.options?.frequency)>0&&c.tsCycleSet?Number(c.options.frequency):f.cycle;
    const options={...info.options,...c.options,frequency:cycle,inputMode:'raw'};
    if(kind==='arima'&&(c.tsOrderMode||'auto')!=='manual'){options.p=-1;options.d=-1;options.q=-1;}
    if(kind==='arima'&&(c.tsOrderMode||'auto')==='manual'){for(const [key,d] of [['p',1],['d',0],['q',0],['P',0],['D',0],['Q',0]])if(options[key]==null||options[key]===''||Number(options[key])<0)options[key]=d;}
    const packet={id:info.id,alpha:this.alpha(),options,fields,data,color:this.state.chartColor||this._E.PAL.cat[0],tsLabels:{freq:b.freq,periods:s.periods}};
    if(info.id==='tsreg'&&(c.fields?.predictors||[]).length){
      const h=Number(options.horizon)||12,grid=c.tsFuture||{},fut={};
      for(const n of c.fields.predictors){const vals=[];for(let i=0;i<h;i++){const v=grid[n]?.[i];if(v===''||v==null||!Number.isFinite(Number(v)))throw Error('Enter the future value of '+n+' for '+this.tsFutureLabels(b,h)[i]+' (Future values of the predictors, below).');vals.push(Number(v));}fut[alias.get(n)]={name:n,type:'numeric',values:vals};}
      packet.future=fut;
    }
    return packet;
  }
  tsFutureLabels(b,h){
    const E=this._E,p=b.series?.periods||[],last=p[p.length-1],out=[];if(!Number.isFinite(last))return Array.from({length:h},(_,i)=>'period +'+(i+1));
    let t=last;for(let i=0;i<h;i++){if(b.freq==='trading'){do{t++;}while([0,6].includes(new Date(Date.UTC(1960,0,1)+t*86400000).getUTCDay()));}else t+=b.freq==='weekly'?7:1;out.push(E.tsdLabel(t,b.freq==='weekly'?'daily':b.freq));}
    return out;
  }
  // Results from R: the Time column becomes date labels (2024m1, 2011q3, 3 Nov 2011…).
  tsRelabel(result,packet){
    const L=packet&&packet.tsLabels;if(!L||!result||!Array.isArray(result.tables))return result;
    const E=this._E,p=L.periods,f=L.freq,n=p.length,b={freq:f,series:{periods:p}};
    const code=v=>{if(typeof v!=='number')return null;if(f==='monthly')return Math.round((v-1960)*12);if(f==='quarterly')return Math.round((v-1960)*4);if(f==='yearly'||f==='generic')return Math.round(v);return null;};
    const lab=v=>{if(typeof v!=='number')return v;const cd=code(v);if(cd!=null)return E.tsdLabel(cd,f);const pos=Math.round(v);if(pos>=1&&pos<=n)return E.tsdLabel(p[pos-1],f==='weekly'?'daily':f);if(pos>n)return this.tsFutureLabels(b,pos-n)[pos-n-1];return v;};
    for(const t of result.tables){const cols=Array.isArray(t.columns)?t.columns:[t.columns];const j=cols.indexOf('Time');if(j<0||!Array.isArray(t.rows))continue;t.rows=t.rows.map(row=>{if(!Array.isArray(row))return row;const r=row.slice();r[j]=lab(r[j]);return r;});}
    return result;
  }
  tsSetup(info,c,h,button,set,opt,extra){
    const S=this.state,E=this._E,cols=S.cols||[],kind=this.tsKinds()[info.id],b=this.tsBuild(info,c),f=E.TSD_FREQ[b.freq]||{};
    const field=(label,control,hint,key)=>h('label',{className:'cs-field',key:key||label},h('span',null,label),control,hint?h('small',{className:'ts-hint'},hint):null);
    const sel=(value,onChange,options,aria)=>h('select',{'aria-label':aria,value,onChange:e=>onChange(e.target.value)},...options.map(([v,l])=>h('option',{key:v,value:v},l)));
    const setField=(k,v)=>set({fields:{...(c.fields||{}),[k]:v}});
    const numeric=cols.filter(v=>v.type==='numeric').map(v=>v.name),tv=c.fields?.time?.[0]||'',yv=c.fields?.y?.[0]||'';
    const checks=(k,label,exclude)=>{const cur=c.fields?.[k]||[];return h('fieldset',{className:'ts-checks',key:k},h('legend',null,label),...numeric.filter(n=>!exclude.includes(n)).map(n=>h('label',{key:n,className:'cs-check'},h('input',{type:'checkbox',checked:cur.includes(n),onChange:e=>setField(k,e.target.checked?[...cur,n]:cur.filter(x=>x!==n))}),n)));};
    const numIn=(k,label,def,attrs={})=>field(label,h('input',{'aria-label':label,type:'number',step:1,value:c.options?.[k]??def,onChange:e=>opt(k,e.target.value===''?'':Number(e.target.value)),...attrs}),attrs.hint,k);
    // 1 · time and panel
    const asOptions=[['auto','Automatic'+(b.freq&&(c.tsAs||'auto')==='auto'?' — '+this.tsFreqName(b.freq).toLowerCase():'')],['yearly','Annual'],['quarterly','Quarterly'],['monthly','Monthly'],['weekly','Weekly'],['daily','Daily (every calendar day)'],['trading','Trading days (weekdays only)'],['generic','Integer periods (1, 2, 3…)']];
    const unitChoices=[['','None — one series'],...cols.filter(v=>v.name!==tv).map(v=>[v.name,v.name])];
    const timeSec=h('section',{className:'ts-sec',key:'time'},h('h3',null,'1 · Time variable'),h('p',{className:'ts-lead'},'Like Stata’s tsset: which variable is time and, for panel data, which variable identifies each unit. Text dates are read automatically.'),
      h('div',{className:'cs-controls'},
        this.asAnnualSupported(info.id)?field('Each row is',sel(c.inputMode||'raw',mode=>set({inputMode:mode,annualPreview:null,...(mode==='annual_proportion'?{annualWeight:c.annualWeight??S.weightVar??'',options:{...c.options,frequency:1,horizon:3}}:{})}),[['raw','One period (or one unit in one period)'],['annual_proportion','One person / record → proportion by year']],'Each row is')):null,
        field('Time variable',sel(tv,v=>set({fields:{...(c.fields||{}),time:v?[v]:[]},tsAs:'auto',tsOrder:'',tsSeries:'',tsRepeats:''}),[['','Select a variable'],...cols.map(v=>[v.name,v.name])],'Time variable')),
        field('Read time as',sel(c.tsAs||'auto',v=>set({tsAs:v}),asOptions,'Read time as'),b.read&&b.read.source==='number'&&!['auto','yearly','generic'].includes(c.tsAs||'auto')?'Numbers are read as Stata date codes (%t'+({quarterly:'q',monthly:'m',daily:'d',trading:'d',weekly:'d'}[c.tsAs]||'')+').':''),
        b.read&&b.read.slash?field('Date order',sel(c.tsOrder||'auto',v=>set({tsOrder:v==='auto'?'':v}),[['auto','Automatic'],['mdy','Month / day / year (11/01/2011 = Nov 1)'],['dmy','Day / month / year (01/11/2011 = 1 Nov)']],'Date order')):null,
        field('Panel variable (optional)',sel(c.tsUnit||'',v=>set({tsUnit:v,tsSeries:'',tsRepeats:''}),unitChoices,'Panel variable'))),
      c.tsUnit&&b.units.length>1?field('Series to analyse',sel(c.tsSeries||'',v=>set({tsSeries:v}),[['','Choose…'],...b.units.map(u=>['unit:'+u.label,String(this.vlabel(c.tsUnit,u.label))+' ('+u.n+' periods)']),['mean','All units combined — average per period'],['sum','All units combined — sum per period']],'Series to analyse'),'These methods model one series. Pick a unit, or combine the units period by period.','series'):null,
      !c.tsUnit&&b.series&&b.series.dupPeriods?h('div',{className:'ts-repeats'},h('p',null,'Some periods have more than one row ('+b.series.dupExamples.join(', ')+'). '+(b.candidates.length?'If each row is a different unit (state, country…), choose it as the panel variable:':'Choose how to combine them, or fix the data first:')),
        h('div',{className:'ts-buttons'},...b.candidates.map(x=>button('Use '+x.name+' as the panel variable ('+x.units+' units)',()=>set({tsUnit:x.name,tsSeries:'',tsRepeats:''}),{key:x.name})),button('Average the repeated rows',()=>set({tsRepeats:'mean'}),{key:'mean','aria-pressed':c.tsRepeats==='mean'}),button('Sum the repeated rows',()=>set({tsRepeats:'sum'}),{key:'sum','aria-pressed':c.tsRepeats==='sum'}),c.tsRepeats?button('Stop and show the repeats',()=>set({tsRepeats:''}),{key:'stop'}):null)):null,
      tv&&b.series&&b.freq?h('pre',{className:'ts-tsset',role:'status'},this.tsSummary(b,c)):null,
      ...b.notes.map((n,i)=>h('p',{className:'ts-note',key:'n'+i},n)));
    // 2 · model
    const yExclude=[tv,c.tsUnit].filter(Boolean),modelParts=[];
    if(kind!=='system')modelParts.push(field(kind==='regression'&&info.id==='countts'?'Count outcome':'Dependent variable',sel(yv,v=>setField('y',v?[v]:[]),[['','Select a variable'],...numeric.filter(n=>!yExclude.includes(n)).map(n=>[n,n])],'Dependent variable')));
    if(kind==='regression')modelParts.push(checks('predictors',info.id==='tsreg'||info.id==='ardl'?'Predictors':'Predictors (optional)',[...yExclude,yv]));
    if(kind==='system')modelParts.push(checks('variables','Variables (choose two or more)',yExclude));
    if(kind==='arima'){
      const manual=(c.tsOrderMode||'auto')==='manual';
      modelParts.push(h('fieldset',{className:'ts-radio',key:'order'},h('legend',null,'ARIMA order'),
        h('label',{className:'cs-check'},h('input',{type:'radio',name:'tsorder',checked:!manual,onChange:()=>set({tsOrderMode:'auto'})}),'Choose automatically (lowest AICc)'),
        h('label',{className:'cs-check'},h('input',{type:'radio',name:'tsorder',checked:manual,onChange:()=>set({tsOrderMode:'manual',options:{...c.options,p:Math.max(0,Number(c.options?.p??1)),d:Math.max(0,Number(c.options?.d??0)),q:Math.max(0,Number(c.options?.q??0))}})}),'Set the order myself')));
      if(manual){modelParts.push(h('div',{className:'ts-order',key:'pdq'},numIn('p','AR terms (p)',1,{min:0,max:20}),numIn('d','Differences (d)',0,{min:0,max:3}),numIn('q','MA terms (q)',0,{min:0,max:20})));
        if(info.id==='sarima')modelParts.push(h('div',{className:'ts-order',key:'PDQ'},numIn('P','Seasonal AR (P)',0,{min:0,max:5}),numIn('D','Seasonal differences (D)',0,{min:0,max:2}),numIn('Q','Seasonal MA (Q)',0,{min:0,max:5})));}
    }
    if(info.id==='tsreg')modelParts.push(field('Seasonality',sel(c.options?.fourier>0?'fourier':c.options?.seasonalDummies?'dummies':'none',v=>set({options:{...c.options,fourier:v==='fourier'?Math.max(1,Number(c.options?.fourier)||2):0,seasonalDummies:v==='dummies'}}),[['none','None'],['dummies','Seasonal dummies ('+(f.cycle||1)+' per cycle)'],['fourier','Fourier terms (smooth seasonality)']],'Seasonality')),c.options?.fourier>0?numIn('fourier','Fourier pairs (K)',2,{min:1,max:Math.max(1,Math.floor((f.cycle||2)/2))}):null);
    if(info.id==='ardl')modelParts.push(numIn('lags','Maximum lag',2,{min:1,max:12}));
    if(info.id==='var'||info.id==='vecm')modelParts.push(numIn('lags','Lags',2,{min:1,max:12}));
    if(info.id==='vecm')modelParts.push(numIn('rank','Cointegrating rank',1,{min:1,max:5}));
    if(info.id==='breaks')modelParts.push(numIn('breaks','Number of breaks',1,{min:1,max:10}),field('Minimum segment (share of the series)',h('input',{'aria-label':'Minimum segment',type:'number',step:0.05,min:0.05,max:0.45,value:c.options?.trim??0.15,onChange:e=>opt('trim',Number(e.target.value))})));
    if(info.id==='countts')modelParts.push(field('Distribution',sel(c.options?.family||'negbin',v=>opt('family',v),[['negbin','Negative binomial (allows overdispersion)'],['poisson','Poisson']],'Distribution')),numIn('lags','Lags of the count',1,{min:1,max:12}));
    if(info.id==='decompose')modelParts.push(h('p',{className:'ts-lead',key:'stl'},'Splits the series into trend, seasonal and remainder parts. Needs at least two full seasonal cycles ('+(2*(f.cycle||1))+' '+(f.units||'periods')+').'));
    const modelSec=h('section',{className:'ts-sec',key:'model'},h('h3',null,'2 · Model'),h('div',{className:'cs-controls'},...modelParts.filter(Boolean)));
    // 3 · forecast
    const forecasting=['forecast','arima','system'].includes(kind)||info.id==='tsreg',horizon=Number(c.options?.horizon??info.options.horizon??12);
    const more=h('details',{className:'ts-more',key:'more'},h('summary',null,'More options'),h('div',{className:'cs-controls'},
      'evaluate' in info.options?h('label',{className:'cs-check',key:'ev'},h('input',{type:'checkbox',checked:!!(c.options?.evaluate??info.options.evaluate),onChange:e=>opt('evaluate',e.target.checked)}),'Check accuracy with rolling one-step forecasts'):null,
      'initial' in info.options?numIn('initial','First training window (0 = automatic)',0,{min:0}):null,
      'frequency' in info.options?field('Seasonal cycle',h('input',{'aria-label':'Seasonal cycle',type:'number',min:1,step:1,value:c.tsCycleSet?c.options?.frequency:(f.cycle||1),onChange:e=>set({tsCycleSet:true,options:{...c.options,frequency:Number(e.target.value)}})}),(c.tsCycleSet?'Set by you. ':'From the '+(this.tsFreqName(b.freq)||'').toLowerCase()+' dates. ')+'Observations per seasonal cycle (12 for monthly, 4 for quarterly, 1 for annual).','cycle'):null));
    const futureSec=info.id==='tsreg'&&(c.fields?.predictors||[]).length&&b.series&&!b.errors.length?(()=>{const labs=this.tsFutureLabels(b,horizon),grid=c.tsFuture||{},preds=c.fields.predictors;return h('div',{className:'ts-future',key:'future'},h('p',null,'Future values of the predictors (one row per forecast period):'),h('div',{className:'as-table-scroll'},h('table',{className:'as-table'},h('thead',null,h('tr',null,h('th',null,'Period'),...preds.map(n=>h('th',{key:n},n)))),h('tbody',null,...labs.map((l,i)=>h('tr',{key:i},h('td',null,l),...preds.map(n=>h('td',{key:n},h('input',{type:'number',step:'any','aria-label':n+' in '+l,value:grid[n]?.[i]??'',onChange:e=>{const g={...grid,[n]:[...(grid[n]||[])]};g[n][i]=e.target.value;set({tsFuture:g});}})))))))));})():null;
    const fcSec=forecasting?h('section',{className:'ts-sec',key:'fc'},h('h3',null,'3 · Forecast'),h('div',{className:'cs-controls'},field('Forecast ahead',h('input',{'aria-label':'Forecast ahead',type:'number',min:1,max:500,step:1,value:horizon,onChange:e=>opt('horizon',e.target.value===''?'':Number(e.target.value))}),(f.units||'periods'))),futureSec,more):h('section',{className:'ts-sec',key:'fc'},more);
    const ready=!b.errors.length&&(kind==='system'?(c.fields?.variables||[]).length>=2:!!yv);
    const problems=b.errors.length?h('div',{className:'ts-problems',role:'alert'},...b.errors.map((e,i)=>h('p',{key:i,className:'as-error'},e))):!ready?h('p',{className:'ts-hint'},!tv?'Choose the time variable to start.':kind==='system'?'Choose two or more variables to run.':'Choose the dependent variable to run.'):null;
    return h('div',null,h('p',{className:'as-runtime-note'},'Runs in your browser with the built-in statistical engine. No internet connection is needed; your data stay on this device.'),timeSec,tv?modelSec:null,tv?fcSec:null,problems,
      button(S.analysisBusy?'Running…':'Run analysis',()=>this.asRun(),{disabled:!!S.analysisBusy||!ready,className:'as-run',title:ready?'':(b.errors[0]||(kind==='system'?'Choose two or more variables.':'Choose the dependent variable.'))}),this.asRunStatus(h,button));
  }
  // Time series tab: survey records → one value per unit and period (Stata collapse)
  tsMakeId(){
    const raw=this._raw;if(!raw)return;let name='obs_id',k=2;while(raw.names.includes(name))name='obs_id'+k++;
    this.addDerivedCol(name,{k:'n',a:Float64Array.from({length:raw.n},(_,i)=>i+1)},'observation identifier (row number)','id');
    this.setState({tsId:name});this.pushLog({t:'tsvars',stata:'generate long '+name+' = _n',r:'df$'+name+' <- seq_len(nrow(df))',res:'Each record now has its own key: '+name+' = 1 … '+raw.n.toLocaleString('en-US')+'.'});
  }
  tsCollapseText(prep,setup){
    const S=this.state,n=prep.cellN.filter(x=>x>0).sort((a,b)=>a-b),med=n.length?n[Math.floor(n.length/2)]:0,stat={mean:'mean',median:'median',sum:'sum',min:'minimum',max:'maximum',range:'range'}[prep.collapse]||prep.collapse;
    const per=setup.effective==='yearly'?'year':setup.effective==='quarterly'?'quarter':setup.effective==='monthly'?'month':setup.effective==='daily'?'day':'period';
    return prep.inputRows.toLocaleString('en-US')+' records → '+(prep.valid||0)+' '+(prep.nUnits>1?'unit–'+per+'s':per+'s')+' ('+stat+' of '+(S.tsY||'the outcome')+(S.tsW?', weighted by '+S.tsW:'')+'). Records per '+(prep.nUnits>1?'unit–'+per:per)+': '+(n.length?n[0]+' to '+n[n.length-1]+' (median '+med+')':'—')+'.'
      +(prep.missingOutcome?' '+prep.missingOutcome+(prep.missingOutcome===1?' record with a missing outcome is':' records with a missing outcome are')+' left out.':'')+(prep.badWeight?' '+prep.badWeight+(prep.badWeight===1?' record with a missing or non-positive weight is':' records with a missing or non-positive weight are')+' left out.':'')
      +(S.tsId?(prep.repeatedIds?' Warning: '+prep.repeatedIds+' records repeat an '+S.tsId+' already seen in the same unit and period.':' Every '+S.tsId+' is unique within each unit and period.')+(prep.missingId?' '+prep.missingId+' records have no '+S.tsId+'.':''):'')
      +' The model is then fitted to these values.';
  }
  // Run: fits the model shown in the setup, records the command and result in the console and Output, and
  // shows the results (they then follow later changes to the setup).
  tsRunNow(){
    const d=this._tsLast,go=sel=>setTimeout(()=>{try{document.querySelector(sel)?.scrollIntoView({behavior:'smooth',block:'start'});}catch(e){}},80);
    if(!d){this.setState({tsRunMsg:'Not run: '+(this._tsWhy||'complete the setup above.')});go('#ts-results-anchor');return;}
    const at=new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});
    this.pushLog({...d});this.setState({tsRan:true,tsRunMsg:'✓ Fitted at '+at+' — the command and result are also in the console and Output.'});go('#ts-results-anchor');
  }
  // The console shows what Stata and R print for the exported commands (newey / regress, vce(cluster); coeftest()
  // with NeweyWest / vcovCL), with the script's variable names and the app's estimates.
  tsVarNames(res,scripts){const p=((scripts&&scripts.short&&scripts.short.stata||'').match(/(\S+)outcome\b/)||[0,'gmts_'])[1],units=(res.units||[]).map(String);
    return {p,rows:res.coefs.map((c,j)=>{const t=c.term;return {...c,j,name:t==='(constant)'?'_cons':/^time/.test(t)?p+'trend':/level shift/.test(t)?p+'post':/change in trend/.test(t)?p+'since':/spike/.test(t)?p+'pulse':/lag\)$/.test(t)?p+'lag':'',level:/^unit = /.test(t)?units.indexOf(t.slice(7))+1:0};})};}
  tsStataText(res,scripts){
    if(!res||!res.coefs||!res.V)return '';const E=this._E,{p,rows}=this.tsVarNames(res,scripts),R=(v,w)=>String(v).padStart(w),G=v=>this.stataG(v),dep=p+'outcome';
    const pct=Math.round((1-this.alpha())*100),crit=E.critInv(this.alpha(),res.df),hdr=(l,k,v)=>l.padEnd(48)+k.padEnd(18)+'='+R(v,11),out=[];
    if(!res.pooled){
      // F test of every coefficient except the constant, with the Newey–West covariance (as newey reports it)
      const ix=rows.filter(r=>r.name!=='_cons').map(r=>r.j),q=ix.length,A=ix.map(i=>ix.map(j=>res.V[i][j])),b=ix.map(i=>res.coefs[i].b),n=q;
      const M=A.map((r,i)=>[...r,...A.map((_,j)=>i===j?1:0)]);let ok=true;
      for(let c=0;c<n;c++){let piv=c;for(let r=c+1;r<n;r++)if(Math.abs(M[r][c])>Math.abs(M[piv][c]))piv=r;if(!(Math.abs(M[piv][c])>1e-300)){ok=false;break;}[M[c],M[piv]]=[M[piv],M[c]];const d=M[c][c];for(let k=0;k<2*n;k++)M[c][k]/=d;for(let r=0;r<n;r++)if(r!==c){const f=M[r][c];if(f)for(let k=0;k<2*n;k++)M[r][k]-=f*M[c][k];}}
      let F=NaN;if(ok&&q){let w=0;for(let i=0;i<n;i++)for(let j=0;j<n;j++)w+=b[i]*M[i][n+j]*b[j];F=w/q;}const pf=E.pF(F,q,res.df);
      out.push(hdr('Regression with Newey-West standard errors','Number of obs',this.fmtN(res.n)),hdr('Maximum lag = '+((res.seType.match(/lag (\d+)/)||[0,''])[1]),'F('+q+', '+res.df+')',Number.isFinite(F)?F.toFixed(2):'.'),hdr('','Prob > F',Number.isFinite(pf)?pf.toFixed(4):'.'),'');
    }else{
      const K=res.fe?res.P+res.nUnits:res.P,rmse=Math.sqrt(res.sse/(res.n-K));
      out.push(hdr('Linear regression','Number of obs',this.fmtN(res.n)));if(!res.fe)out.push(hdr('','R-squared',res.r2.toFixed(4)));
      out.push(hdr('','Root MSE',Number(rmse.toPrecision(5)).toString().replace(/^0\./,'.')),'',('(Std. err. adjusted for '+res.nUnits+' clusters in '+p+'unit)').padStart(78));
    }
    const row=(lab,c)=>lab+' |'+R(G(c.b),11)+R(G(c.se),11)+R(!Number.isFinite(c.t)?'.':Math.abs(c.t)>=99999.995?c.t.toExponential(1).replace(/e\+?(-?)(\d+)$/,(m,g,d)=>'e'+(g||'+')+d.padStart(2,'0')):c.t.toFixed(2),9)+R(Number.isFinite(c.p)?c.p.toFixed(3):'.',8)+R(G(c.b-crit*c.se),13)+R(G(c.b+crit*c.se),12);
    out.push('------------------------------------------------------------------------------','             |'+(res.pooled?'               Robust':'             Newey-West'),R(this.abbr(dep,12),12)+' | Coefficient  std. err.      t    P>|t|     ['+pct+'% conf. interval]','-------------+----------------------------------------------------------------');
    rows.filter(r=>r.name&&r.name!=='_cons').forEach(r=>out.push(row(R(this.abbr(r.name,12),12),r)));
    const lv=rows.filter(r=>r.level);if(lv.length){out.push('             |',R(this.abbr(p+'unit',12),12)+' |');lv.forEach(r=>out.push(row(R(r.level,11)+' ',r)));}
    rows.filter(r=>r.name==='_cons').forEach(r=>out.push(row(R('_cons',12),r)));
    out.push('------------------------------------------------------------------------------');
    if(res.fe)out.push('Note: '+p+'unit indicators and _cons are not shown; the app removes each unit’s mean instead (same slopes and standard errors).');
    return out.join('\n');
  }
  // R's format.pval (as printCoefmat calls it) and printCoefmat for coeftest()
  tsRPval(pv,digits=4){const eps=2.220446049250313e-16,r=pv.map(()=>''),idx=pv.map((v,i)=>i),nz=idx.filter(i=>!(pv[i]<eps)),z=idx.filter(i=>pv[i]<eps);
    const fix=nz.filter(i=>{const e=Math.floor(Math.log10(pv[i]>0?pv[i]:1e-50));return e>=-3||(e===-4&&digits>1);}),sci=nz.filter(i=>!fix.includes(i));
    for(const g of [fix,sci])if(g.length){const f=this.rFormat(g.map(i=>pv[i]),digits);g.forEach((i,k)=>{r[i]=f[k];});}
    if(z.length){let d=Math.max(1,digits-2),sep=' ';if(nz.length){const nc=Math.max(...nz.map(i=>r[i].length));if(d>1&&d+6>nc)d=Math.max(1,nc-7);sep=d===1&&nc<=6?'':' ';}else sep=d===1?'':' ';z.forEach(i=>{r[i]='<'+sep+this.rFormat([eps],d)[0].trim();});}
    return r;}
  tsRText(res,scripts){
    if(!res||!res.coefs)return '';const {p,rows}=this.tsVarNames(res,scripts),digits=5;
    const shown=rows.filter(r=>r.name||r.level),names=shown.map(r=>r.name==='_cons'?'(Intercept)':r.level?'factor('+p+'unit)'+r.level:r.name);
    const cs=shown.flatMap(r=>[r.b,r.se]),acs=cs.map(Math.abs).filter(v=>Number.isFinite(v)&&v!==0),digmin=1+(acs.length?Math.floor(Math.log10(Math.min(...acs))):0),dec=Math.max(1,digits-digmin);
    const fin=v=>Number.isFinite(v),rounded=cs.map(v=>fin(v)?Number(v.toFixed(Math.min(dec,100))):v),fcs=this.rFormat(rounded,digits);
    cs.forEach((v,i)=>{if(fin(v)&&v!==0&&Number(fcs[i])===0)fcs[i]=this.rFormat([v],digits-1)[0].trim();if(!fin(v))fcs[i]=Number.isNaN(v)?'NaN':'NA';});
    const ft=this.rFormat(shown.map(r=>fin(r.t)?Number(r.t.toFixed(4)):r.t),digits),fp=this.tsRPval(shown.map(r=>r.p));
    const stars=shown.some(r=>r.p<0.1),st=v=>(v<0.001?'***':v<0.01?'**':v<0.05?'*':v<0.1?'.':' ').padEnd(3);
    const cols=['Estimate','Std. Error','t value','Pr(>|t|)',...(stars?['']:[])],cells=shown.map((r,i)=>[fcs[2*i],fcs[2*i+1],ft[i],fp[i],...(stars?[st(r.p)]:[])]);
    const w=cols.map((c,j)=>Math.max(c.length,...cells.map(r=>r[j].length))),w0=Math.max(...names.map(n=>n.length));
    const lines=['','t test of coefficients:','',' '.repeat(w0)+cols.map((c,j)=>' '+c.padStart(w[j])).join(''),...cells.map((r,i)=>names[i].padEnd(w0)+r.map((c,j)=>' '+c.padStart(w[j])).join(''))];
    if(stars)lines.push('---',"Signif. codes:  0 '***' 0.001 '**' 0.01 '*' 0.05 '.' 0.1 ' ' 1");
    if(res.fe)lines.push('# (Intercept) and factor('+p+'unit) rows are not shown: the app removes each unit’s mean instead (same slopes and standard errors).');
    return lines.join('\n');
  }
  // GM26 time-series setup end
