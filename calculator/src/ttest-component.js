  // GM26 t-test methods begin
  ttRecord(out, options) {
    const E=this._E, S=this.state, r=E.ttDetails({...options,alpha:this.alpha(),weighted:!!S.weightVar});
    if(r.error){out.ttHasRes=false;out.ttHasErr=true;out.ttErr=r.error;return;}
    const scripts=E.ttScripts({...options,alpha:this.alpha()});
    if (options.mode !== 'groups') {
      const paired = options.mode === 'paired', label = paired ? 'Mean paired difference' : 'Sample mean';
      const reference = paired ? 0 : options.mu;
      out.ttChartEl = E.marginsChart(React, { grid: [label], xCat: true, series: [
        { label: label + ' (' + Number((100 * (1-r.alpha)).toFixed(4)) + '% CI)', pts: [{x:label,y:r.estimate,lo:r.lo,hi:r.hi}] },
        { label: paired ? 'Null difference (0)' : 'Reference value (' + reference + ')', pts: [{x:label,y:reference,lo:reference,hi:reference}] }
      ] }, { key: 'tt|' + options.mode + '|' + r.estimate + '|' + r.lo + '|' + r.hi + '|' + reference + '|' + (S.chartColor || ''),
        xlab: '', ylab: label, color:S.chartColor || '#2E7D58', refCb:this.svgRef('tt'),
        ax:this.axUI('tt',[options.mode,S.exploreVar,S.ttY2,S.ttMu],{y:true,zero:'y',yName:label}) });
    }
    const estimateName=options.mode==='value'?'Mean':'Mean difference (first minus second)';
    const table='Statistic\tValue\n'+[[estimateName,r.estimate],['Standard error',r.se],['t',r.t],['df',r.df],['p (two-sided)',r.p],['CI lower',r.lo],['CI upper',r.hi],['Confidence level',1-r.alpha],['N (first sample / complete pairs)',r.nA],...(options.mode==='groups'?[['N (second sample)',r.nB]]:[])].map(row=>row.join('\t')).join('\n');
    const setup={};['exploreVar','ttMode','ttMu','ttG','ttA','ttB','ttY2','subg','flt','missingCodes','autoScreen','alphaSel'].forEach(k=>{setup[k]=S[k];});
    this._ttLast={t:'ttestx',r:scripts.r,stata:scripts.stata,setup,tbl:table,res:(options.mode==='value'?'One-sample':options.mode==='groups'?'Welch independent-samples':'Paired-samples')+' t-test: t('+this.fmt(r.df,2)+') = '+this.fmt(r.t,3)+', '+this.apaP(r.p)};
    out.ttCmd=S.dialect==='r'?scripts.r:scripts.stata;
    out.ttCopyLabel=this.cpLabel('ttestx');out.ttCopy=()=>this.copyTSV('ttestx',table);
    const report=this._ttLast;out.ttLog=()=>this.pushLog({...report});
  }
  // GM26 t-test methods end
