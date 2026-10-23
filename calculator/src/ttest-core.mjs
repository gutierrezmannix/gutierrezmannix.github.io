// Classical unweighted t-tests. Bundled with descNum, welch and pT.
export function oneSampleT(a, w, mu) {
  if (w) return {error:'Classical t-tests require unweighted observations. Clear weights in Settings, or use a model with an appropriate survey design.'};
  if (!Number.isFinite(mu)) return {error:'Enter a finite comparison value.'};
  const d=descNum(a,null);
  if (!d || d.n<2) return {error:'At least 2 valid observations are required.'};
  if (!(d.sd>0) || !Number.isFinite(d.sd)) return {error:'The observations have no usable variation; a t-test cannot be estimated.'};
  const se=d.sd/Math.sqrt(d.n), t=(d.mean-mu)/se, df=d.n-1;
  return {t,df,p:pT(t,df),mean:d.mean,sd:d.sd,n:d.n,mu,se};
}
export function pairedT(a,b,w) {
  if (a.length!==b.length) return {error:'Paired measurements must have equal lengths and match on the same rows.'};
  const difference=new Float64Array(a.length).fill(NaN);let sumA=0,sumB=0,n=0;
  for(let i=0;i<a.length;i++)if(Number.isFinite(a[i])&&Number.isFinite(b[i])){difference[i]=a[i]-b[i];sumA+=a[i];sumB+=b[i];n++;}
  if(n<2)return {error:'At least 2 complete pairs are required. Rows missing either measurement are excluded together.'};
  const r=oneSampleT(difference,w,0);
  return r.error?r:{...r,meanA:sumA/n,meanB:sumB/n};
}
export function ttCritical(alpha,df) {
  if(!(alpha>0&&alpha<1&&df>0))return NaN;
  let lo=0,hi=1;
  while(pT(hi,df)>alpha&&hi<1e12)hi*=2;
  for(let i=0;i<90;i++){const mid=(lo+hi)/2;if(pT(mid,df)>alpha)lo=mid;else hi=mid;}
  return (lo+hi)/2;
}
export function ttDetails(o) {
  const alpha=o.alpha??.05;
  if(!(alpha>0&&alpha<1))return {error:'Choose a confidence level between 0 and 100%.'};
  if(o.weighted)return {error:'Classical t-tests require unweighted observations. Clear weights in Settings, or use a model with an appropriate survey design.'};
  let r,estimate,se,nA,nB;
  if(o.mode==='groups'){
    const a=descNum(o.x,null),b=descNum(o.y,null);
    if(a.n<2||b.n<2)return {error:'Each independent group needs at least 2 valid observations.'};
    r=welch(a,b);if(r.error)return r;
    estimate=a.mean-b.mean;se=Math.sqrt(a.sd*a.sd/a.n+b.sd*b.sd/b.n);nA=a.n;nB=b.n;
    r={...r,meanA:a.mean,meanB:b.mean,n:a.n+b.n};
  }else if(o.mode==='paired'){
    r=pairedT(o.x,o.y,null);if(r.error)return r;estimate=r.mean;se=r.se;nA=r.n;nB=r.n;
  }else{
    r=oneSampleT(o.x,null,o.mu);if(r.error)return r;estimate=r.mean;se=r.se;nA=r.n;
  }
  const critical=ttCritical(alpha,r.df);
  return {...r,mode:o.mode,estimate,se,nA,nB,lo:estimate-critical*se,hi:estimate+critical*se,alpha};
}
export function ttScripts(o) {
  // Use the prepared sample so filters, screened missing codes, group order,
  // and complete-pair selection reproduce exactly without relying on column names.
  const paired=o.mode==='paired',groups=o.mode==='groups',x=[],y=[];
  if(paired){for(let i=0;i<o.x.length;i++)if(Number.isFinite(o.x[i])&&Number.isFinite(o.y[i])){x.push(o.x[i]);y.push(o.y[i]);}}
  else{for(const v of o.x)if(Number.isFinite(v))x.push(v);if(groups)for(const v of o.y)if(Number.isFinite(v))y.push(v);}
  const vector=a=>'c('+a.join(', ')+')',level=100*(1-o.alpha),confidence=1-o.alpha;
  let r='# Prepared, unweighted sample. Filters and missing-value rules already applied.\nx <- '+vector(x)+'\n';
  if(groups||paired)r+='y <- '+vector(y)+'\n';
  r+='t.test(x'+(groups?', y, var.equal = FALSE':paired?', y, paired = TRUE':', mu = '+o.mu)+', conf.level = '+confidence+')';
  let stata='* Prepared, unweighted sample; original dataset restored afterwards.\npreserve\nclear\n';
  if(groups){stata+='input double score byte group\n'+x.map(v=>v+' 0').concat(y.map(v=>v+' 1')).join('\n')+'\nend\nttest score, by(group) unequal level('+level+')';}
  else if(paired){stata+='input double before double after\n'+x.map((v,i)=>v+' '+y[i]).join('\n')+'\nend\nttest before == after, level('+level+')';}
  else{stata+='input double score\n'+x.join('\n')+'\nend\nttest score == '+o.mu+', level('+level+')';}
  return {r,stata:stata+'\nrestore'};
}
