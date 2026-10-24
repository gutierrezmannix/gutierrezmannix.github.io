  // GM26 Stata output order begin
  stataTerms(rows) {
    const rank = r => /^(?:\/cut|Cut )/.test(r.raw || r.term || '') ? 2 : /^(?:\(constant\)|_cons|Constant)$/.test(r.raw || r.term || '') ? 1 : 0;
    return [...rows].sort((a,b) => rank(a)-rank(b));
  }
  stataTable(headers, rows, label) {
    const h=React.createElement;
    return h('table',{className:'stata-result-table','aria-label':label},
      h('thead',null,h('tr',null,...headers.map((v,i)=>h('th',{key:i,scope:'col'},v)))),
      h('tbody',null,...rows.map((row,i)=>h('tr',{key:i},...row.map((v,j)=>h(j?'td':'th',{key:j,...(j?{}:{scope:'row'})},v))))));
  }
  stataRegressionVals(out, M, mdl) {
    const cell=(k,v,tip='')=>({k,v,tip}), f=(v,d=4)=>this.fmt(v,d);
    const count=cell('N USED',this.fmtN(M.n),'Observations actually used to estimate this model.');
    out.stataHasAnova=mdl==='ols'&&!M.vce&&Number.isFinite(M.sst);
    if(mdl==='ols') {
      out.sumCells=[count,cell('F',f(M.F,2),'Joint test that all slope coefficients are zero; F may exceed 99,999.'),cell('DF',this.fmtN(M.df1)+', '+this.fmtN(M.df2)),cell('PROB > F',this.fmtP(M.pModel)),cell('R-SQUARED',f(M.R2)),cell('ADJ R-SQUARED',f(M.adjR2)),cell('ROOT MSE',f(M.rmse))];
      if(out.stataHasAnova)out.stataAnovaRows=[
        {source:'Model',ss:f(M.sst-M.sse),df:this.fmtN(M.df1),ms:f((M.sst-M.sse)/M.df1)},
        {source:'Residual',ss:f(M.sse),df:this.fmtN(M.df2),ms:f(M.sse/M.df2)},
        {source:'Total',ss:f(M.sst),df:this.fmtN(M.df1+M.df2),ms:f(M.sst/(M.df1+M.df2))}
      ];
      if(out.stataHasAnova)out.stataAnovaEl=this.stataTable(['Source','SS','df','MS'],out.stataAnovaRows.map(r=>[r.source,r.ss,r.df,r.ms]),'OLS analysis of variance');
      out.stataFitExtra='';
    } else {
      out.sumCells=[count];
      if(!M.vce) {
        const df=M.coefs.filter(c=>c.term!=='(constant)').length,lr=Math.max(0,2*(M.ll-M.llNull));
        if(df>0&&Number.isFinite(lr))out.sumCells.push(cell('LR CHI² ('+df+')',f(lr,2)),cell('PROB > CHI²',this.fmtP(this._E.pChi2(lr,df))));
      }
      out.sumCells.push(cell('PSEUDO R²',f(M.mcfadden)),cell('LOG LIKELIHOOD',f(M.ll)));
      out.stataFitExtra='Null log likelihood = '+f(M.llNull)+' · Converged: '+(M.converged?'yes':'no');
    }
  }
  stataTtestSummary(out, options, result) {
    const S=this.state,E=this._E,paired=options.mode==='paired',groups=options.mode==='groups';
    const key='stataTT|'+[S.ttMode,S.exploreVar,S.ttY2,S.ttG,S.ttA,S.ttB,S.ttMu,result.alpha,S.dver||0].join('|');
    const data=this.memo(key,()=>{
      let x=options.x,y=options.y;
      if(paired){const xx=[],yy=[];for(let i=0;i<x.length;i++)if(Number.isFinite(x[i])&&Number.isFinite(y[i])){xx.push(x[i]);yy.push(y[i]);}x=Float64Array.from(xx);y=Float64Array.from(yy);}
      const a=E.descNum(x,null),b=y?E.descNum(y,null):null;
      return {a,b};
    });
    const row=(label,d)=>{
      const se=d.sd/Math.sqrt(d.n),critical=E.ttCritical(result.alpha,d.n-1);
      return {label,n:this.fmtN(d.n),mean:this.fmt(d.mean,4),se:this.fmt(se,4),sd:this.fmt(d.sd,4),ci:'['+this.fmt(d.mean-critical*se,4)+', '+this.fmt(d.mean+critical*se,4)+']'};
    };
    out.stataTtTitle=groups?'Two-sample t test with unequal variances (Welch)':paired?'Paired t test':'One-sample t test';
    out.stataTtCI=Number((100*(1-result.alpha)).toFixed(4))+'% conf. interval';
    out.stataTtRows=[row(groups?(options.labels?.[0]||S.ttA||'First group'):S.exploreVar,data.a)];
    if(data.b)out.stataTtRows.push(row(groups?(options.labels?.[1]||S.ttB||'Second group'):S.ttY2,data.b));
    if(groups||paired)out.stataTtRows.push({label:'diff (first − second)',n:paired?this.fmtN(result.nA):'—',mean:this.fmt(result.estimate,4),se:this.fmt(result.se,4),sd:paired?this.fmt(result.sd,4):'—',ci:'['+this.fmt(result.lo,4)+', '+this.fmt(result.hi,4)+']'});
    out.stataTtEl=this.stataTable(['Variable / group','Obs','Mean','Std. err.','Std. dev.',out.stataTtCI],out.stataTtRows.map(r=>[r.label,r.n,r.mean,r.se,r.sd,r.ci]),'T-test sample summary');
    out.ttCells=out.ttCells.filter(c=>/^T \(DF\)$|^P$|COHEN|TEST VALUE/.test(c.k));
    const lines=[['Variable / group','Obs','Mean','Std. err.','Std. dev.',out.stataTtCI],...out.stataTtRows.map(r=>[r.label,r.n,r.mean,r.se,r.sd,r.ci])];
    const table=out.stataTtTitle+'\n'+lines.map(r=>r.join('\t')).join('\n')+'\n\n'+(options.mode==='value'?'Mean':'Mean difference (first minus second)')+'\t'+result.estimate+'\nStandard error\t'+result.se+'\nt\t'+result.t+'\ndf\t'+result.df+'\np (two-sided)\t'+result.p+'\nCI lower\t'+result.lo+'\nCI upper\t'+result.hi+'\nConfidence level\t'+(1-result.alpha)+'\nN (first sample / complete pairs)\t'+result.nA+(groups?'\nN (second sample)\t'+result.nB:'');
    if(this._ttLast)this._ttLast.tbl=table;
    out.ttCopy=()=>this.copyTSV('ttestx',table);
  }
  stataOutputVals(out) {
    const order=(rows,keys)=>rows&&[...rows].sort((a,b)=>{const x=keys.indexOf(a.k),y=keys.indexOf(b.k);return(x<0?keys.length:x)-(y<0?keys.length:y);});
    out.descCells=order(out.descCells,['N VALID','MEAN','SD','MIN','MAX','MEDIAN','Q1','Q3']);
    out.crCells=order(out.crCells,['N COMPLETE','ITEMS','ALPHA','VERDICT']);
    if(out.coefRows)out.coefRows=this.stataTerms(out.coefRows).map(c=>({...c,term:c.raw==='(constant)'?'_cons':c.term}));
    if(out.tsRows)out.tsRows=this.stataTerms(out.tsRows);
    if(out.semFitCells){
      const ll=out.semFitCells.find(c=>c.k==='LOG LIKELIHOOD');
      out.stataSemSample=out.semFitSub+(ll?' · Log likelihood = '+ll.v:'');
      out.semFitCells=order(out.semFitCells.filter(c=>!['N','LOG LIKELIHOOD'].includes(c.k)),['CHI²','DF','P','RMSEA','CFI','TLI','SRMR']);
    }
    if(out.semRows){
      const blocks=[];for(const row of out.semRows){if(row.isHead)blocks.push([]);if(blocks.length)blocks.at(-1).push(row);}
      const rank=b=>b[0].term.startsWith('PATHS')?0:b[0].term.startsWith('MEASUREMENT')?1:b[0].term.startsWith('INTERCEPTS')?2:b[0].term.startsWith('ITEM ERROR')?3:4;
      out.semRows=blocks.sort((a,b)=>rank(a)-rank(b)).flat();
    }
  }
  // GM26 Stata output order end
