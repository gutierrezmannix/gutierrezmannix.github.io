  // GM26 network component begin
  ergmR(terms) {
    const S = this.state, p = this._E.netPrepare(this._netE, this._netN, { from:S.ngFrom, to:S.ngTo, id:S.ngId, directed:S.ngDir });
    return p.error ? '# ' + p.error : this._E.netRScript(p.net, terms);
  }
  runErgm() {
    const S = this.state, E = this._E;
    const p = E.netPrepare(this._netE, this._netN, { from:S.ngFrom, to:S.ngTo, id:S.ngId, directed:S.ngDir });
    if (p.error) return this.setState({ ngFit:null, ngErr:p.error });
    const net = p.net, terms = this.ergmTerms(), stamp = JSON.stringify([S.ngFrom,S.ngTo,S.ngId,S.ngDir,S.ngMutual,S.ngTri,S.ngAttr]);
    const token = this._ngRunToken = (this._ngRunToken || 0) + 1;
    this.setState({ ngBusy:true, ngFit:null, ngErr:'' });
    setTimeout(() => {
      const T = this.state;
      if (token !== this._ngRunToken || stamp !== JSON.stringify([T.ngFrom,T.ngTo,T.ngId,T.ngDir,T.ngMutual,T.ngTri,T.ngAttr]) || this._netE !== p.edgesSource || this._netN !== p.nodesSource) {
        if (token === this._ngRunToken) this.setState({ ngBusy:false }); return;
      }
      let fit;
      try { fit = E.ergmFit(net,terms); } catch (e) { fit = { error:String(e.message || e) }; }
      const modelError = fit.error || '';
      if (modelError) fit = Object.assign({coefs:[], modelError}, E.netSummary(net));
      this._ngNet = net; this._ngLays = {};
      // Bound expensive graph calculations independently of MPLE's dyad limit.
      this._ngCent = net.n <= 400 ? E.netCentrality(net) : null;
      this._ngLay = net.n <= 400 ? E.netLayout(net.n,net.und,net.n > 200 ? 160 : 240) : null;
      fit.info = Object.assign({},p.info,{terms,id:Date.now()});
      this.setState({ngBusy:false, ngFit:fit, ngErr:modelError});
      this.pushLog({t:'ergm',r:E.netRScript(net,terms),res:this.fmtN(net.n)+' nodes · '+this.fmtN(fit.edges)+' ties · density '+this.fmt(fit.density,3)+(modelError?' · descriptives only: '+modelError:'')});
    },30);
    p.edgesSource = this._netE; p.nodesSource = this._netN;
  }
  addNetCentralities(columns, net, centrality) {
    const raw = this._raw, nr = this._netN, idc = nr ? nr.names.indexOf(this.state.ngId) : -1;
    if (!raw || raw !== nr || idc < 0) return this.setState({ ngCentMsg:'Open the NODES file as the current dataset, choose USE CURRENT DATASET for nodes, and run again. You can also COPY the table.' });
    this._snapT = 0; this.snap('add network centralities');
    const position = new Map(net.ids.map((id,i)=>[id,i])), made = [], tags = Object.assign({},this.state.genTags);
    for (const [measure] of columns) {
      const a = Float64Array.from(raw.cols[idc].a,id=>{ const i=position.get(this.netKey(id)); return i == null ? NaN : centrality[measure][i]; });
      const name = 'sna_' + measure, at = raw.names.indexOf(name), col = {k:'n',a};
      if (at >= 0) raw.cols[at] = col;
      else { raw.names.push(name); raw.labels.push('network centrality: '+measure); raw.cols.push(col); }
      made.push(name); tags[name] = 'sna';
    }
    this.clearMemo();
    const treat = Object.assign({},this.state.treat); made.forEach(name=>{treat[name]='numeric';});
    this.setState({cols:raw.names.map((_,i)=>this._E.profileCol(raw,i,this.state.autoScreen)),treat,genTags:tags,ngN:this.netMeta(raw,this.state.ngN.name),ngCentMsg:'Added '+made.join(', ')+' — use them in Regression, Plots or anywhere else.'});
    this.pushLog({t:'snacent',res:'added '+made.join(', ')});
  }
  // GM26 network component end
