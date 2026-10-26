  // GM26 output view begin
  // The main area's Output view, like Stata's Results window: every command, its printed result and every
  // chart from this session, in the order they were made. It replaces the Tests and Charts directory pages
  // (the Tests ▾ and Charts ▾ menus list every method).
  outputView(h,button){
    const S=this.state,dial=S.dialect==='r'?'r':'stata',prompt=dial==='stata'?'. ':'> ';
    const log=(S.conLog||[]).map((d,i)=>({key:'c'+i,at:d.at||0,order:i,d})),plots=(this._plots||[]).map((p,i)=>({key:'p'+p.id,at:p.at||0,order:i,p}));
    const items=[...log,...plots].sort((a,b)=>a.at-b.at||(a.d?0:1)-(b.d?0:1)||a.order-b.order);
    const cmdBox=h('form',{className:'ov-cmd',onSubmit:e=>{e.preventDefault();const t=String(S.ovCmd||'').trim();if(!t)return;this.setState({ovCmd:''});this.runCmdLine(t);}},
      h('span',{className:'ov-prompt','aria-hidden':true},dial==='stata'?'.':'>'),
      h('input',{'aria-label':(dial==='stata'?'Stata':'R')+' command',value:S.ovCmd||'',placeholder:dial==='stata'?'Type a Stata command — e.g. summarize edad · tab sexo · regress y x1 x2':'Type a command — e.g. summary(df$edad)',onChange:e=>this.setState({ovCmd:e.target.value})}),
      button('Run',null,{type:'submit'}));
    const entry=it=>{
      if(it.d){const d=it.d,out=this.conTable(d,dial);let cmd='';try{cmd=this.cmdText(d,dial);}catch(e){cmd='';}
        return h('article',{key:it.key,className:'ov-entry'},h('pre',{className:'ov-line',title:'Click to run again',onClick:()=>this.rerunCmd(d)},prompt+cmd),out?h('pre',{className:'ov-out'},out):d.res?h('pre',{className:'ov-res'},d.res):null);}
      const p=it.p,prev=items[items.indexOf(it)-1],prevCmd=prev?(prev.d?(()=>{try{return this.cmdText(prev.d,dial);}catch(e){return '';}})():prev.p.cmd):'';
      return h('figure',{key:it.key,className:'ov-figure'},p.cmd&&p.cmd!==prevCmd?h('pre',{className:'ov-line'},prompt+p.cmd):null,h('div',{className:'ov-plot',role:'img','aria-label':p.title,dangerouslySetInnerHTML:{__html:p.xml}}),
        h('figcaption',null,h('span',null,p.title+(p.sg?' · '+p.sg:'')),button('PNG',async()=>{try{const url=await this.plotPng(p,2);this.dlBlob(new Blob([this.b64bytes(url)],{type:'image/png'}),p.name+'.png');}catch(e){this.flash('Could not render this chart as PNG');}}),button('SVG',()=>this.dlBlob(new Blob([this.svgExport(p.xml,p.title)||p.xml],{type:'image/svg+xml'}),p.name+'.svg'))));
    };
    return h('section',{className:'ov-view','aria-label':'Output'},
      h('header',{className:'ov-head'},h('h2',null,'Output'),h('p',null,'Every command, result and chart from this session, in order. Choose an analysis from Tests ▾ or a chart from Charts ▾; you can also type commands here.')),
      cmdBox,
      items.length?h('div',{className:'ov-list'},...items.map(entry)):h('p',{className:'ov-empty'},'Nothing has been run yet. Results and charts will appear here as you work.'));
  }
  // An open toolbar menu ends above the bottom of the window, with one scrollbar (its own).
  menuFit(){try{for(const m of document.querySelectorAll('.mf-menu')){if(!m.getClientRects().length)continue;const z=parseFloat(document.documentElement.style.zoom)||1,top=m.getBoundingClientRect().top,room=Math.max(160,Math.floor((window.innerHeight-top-12)/z));m.style.boxSizing='border-box';if(m.style.maxHeight!==room+'px')m.style.maxHeight=room+'px';m.style.overflowY='auto';}}catch(e){}}
  // GM26 output view end
