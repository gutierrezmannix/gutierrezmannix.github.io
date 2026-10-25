  // GM26 t-test methods begin
  ttRecord(out, options) {
    const E=this._E, S=this.state, r=E.ttDetails({...options,alpha:this.alpha(),weighted:!!S.weightVar});
    if(r.error){out.ttHasRes=false;out.ttHasErr=true;out.ttErr=r.error;return;}
    const scripts=this.ttCommands(options);
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
  // Console, do-file and R export: the command as typed in Stata or R, by variable name. Subgroups are added
  // by the console (withIf); the data are not embedded.
  ttCommands(options){
    const S=this.state,xn=S.exploreVar,alpha=this.alpha(),lv=Number((100*(1-alpha)).toFixed(4)),lev=lv===95?'':', level('+lv+')',conf=lv===95?'':', conf.level = '+Number((1-alpha).toFixed(6));
    if(options.mode==='value'){const mu=Number(S.ttMu);return {stata:'ttest '+xn+' == '+mu+lev,r:'t.test(df$'+xn+', mu = '+mu+conf+')'};}
    if(options.mode==='paired'){const y2=S.ttY2;return {stata:'ttest '+xn+' == '+y2+lev,r:'t.test(df$'+xn+', df$'+y2+', paired = TRUE'+conf+')'};}
    const gv=S.ttG,g=this.ttGroups(),num=this.effMeta(gv)?.type==='numeric',q=v=>num?v:'"'+String(v).replace(/"/g,'\\"')+'"';
    const sel=g.levels>2?' if inlist('+gv+', '+q(g.lo)+', '+q(g.hi)+')':'',rsel=g.levels>2?'subset(df, '+gv+' %in% c('+q(g.lo)+', '+q(g.hi)+'))':'df';
    return {stata:'ttest '+xn+sel+', by('+gv+') unequal'+(lev?' '+lev.slice(2):''),r:'t.test('+xn+' ~ '+gv+', data = '+rsel+', var.equal = FALSE'+conf+')'};
  }
  // The two compared groups in the order Stata and R report them (sorted codes), and whether that reverses
  // the order chosen on the page (first minus second).
  ttGroups(){
    const S=this.state,gv=S.ttG,f=gv?this.nvLevels(gv):null,labs=f?f.rows.map(r=>String(r.label)):[];
    const A=labs.length===2?labs[0]:S.ttA,B=labs.length===2?labs[1]:S.ttB,num=this.effMeta(gv)?.type==='numeric';
    const before=num?Number(A)>Number(B):String(A)>String(B);
    return {levels:labs.length,first:A,second:B,lo:before?B:A,hi:before?A:B,flip:before};
  }
  // GM26 t-test methods end
