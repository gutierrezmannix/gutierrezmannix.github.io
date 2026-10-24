  // GM26 model guide methods begin
  modelGuideData() { return __MODEL_GUIDE_DATA__; }
  modelGuideCurrent() {
    const S=this.state;
    if(S.tab==='analysis'&&S.analysisId!=='__directory')return 'advanced-'+S.analysisId;
    if(S.tab==='ttest')return 'ttest-'+(S.ttMode==='value'?'value':S.ttMode==='paired'?'paired':'groups');
    if(S.tab==='two') { const spec=this.twoSpec();return spec?.mode==='ct'?'chi-square':spec?.mode==='means'?(spec.nG===2?'ttest-groups':'anova'):'pearson'; }
    if(S.tab==='reg')return ({ols:'ols',logistic:'logistic',ologit:'ordinal',poisson:'poisson'})[S.regModel]||'ols';
    return ({one:'univariate',plots:'univariate',text:'word-frequency',ts:'time-series',ergm:'centrality',sem:'cfa',data:'alpha'})[S.tab]||'univariate';
  }
  openModelGuide() {
    this.setState({mfPane:'help',mfDock:true,mfMobile:'dock',mfFile:false,mfNav:'',mfSettings:false,
      dhOpen:false,exOpen:false,modelGuideQuery:'',modelGuideCategory:'',modelGuideId:this.modelGuideCurrent()});
  }
  modelGuideVals(out) {
    const S=this.state,models=this.modelGuideData(),current=this.modelGuideCurrent();
    const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\s]/g,' ');
    const query=S.modelGuideQuery||'',category=S.modelGuideCategory||'';
    const words=norm(query).trim().split(/\s+/).filter(Boolean);
    out.modelGuideQuery=query;out.modelGuideCategory=category;
    out.modelGuideQuerySet=e=>this.setState({modelGuideQuery:e.target.value});
    out.modelGuideCategorySet=e=>this.setState({modelGuideCategory:e.target.value,modelGuideId:''});
    out.modelGuideReset=()=>this.setState({modelGuideQuery:'',modelGuideCategory:'',modelGuideId:''});
    out.modelGuideHasFilter=!!(query||category);
    out.modelGuideCurrent=()=>this.openModelGuide();
    out.modelGuideCategories=[['summary','Descriptive analysis'],['means','Compare means'],['association','Association'],['regression','Regression'],
      ['text','Text analysis'],['time','Time series'],['networks','Networks analysis'],['sem','Structural equation modeling'],['other','Other tools'],['basics','Key terms']].map(([id,label])=>({id,label}));
    const selected=S.modelGuideId==null?current:S.modelGuideId;
    out.modelGuideEntries=models.filter(m=>(!category||m.category===category)&&words.every(w=>norm([m.id,m.aliases||'',m.title,m.question,m.what,m.use,m.data,m.read,m.caution,m.example].join(' ')).includes(w))).map(m=>({
      id:m.id,title:m.title,question:m.question,open:selected===m.id,hasRoute:!!m.route,
      toggle:()=>this.setState({modelGuideId:selected===m.id?'':m.id}),
      fields:[['What it does',m.what],['Use it for',m.use],['Data needed',m.data],['Read the result',m.read],['Keep in mind',m.caution],['Example',m.example]].map(([label,text])=>({label,text})),
      sources:m.sources,hasSources:!!m.sources.length,
      go:()=>{if(m.route)this.setState(Object.assign({mfMobile:'analysis',mfFile:false,mfNav:'',mfSettings:false},m.route));}
    }));
    out.modelGuideEmpty=!out.modelGuideEntries.length;
    out.modelGuideCount=out.modelGuideEntries.length+' of '+models.length+' guide entries';
  }
  // GM26 model guide methods end
