"""Independent NumPy/SciPy/statsmodels checks of webR wrapper results.
Run after DETAILS=1 node tools/analysis_integration.mjs RUNTIME.
"""
import json,sys,numpy as np
from scipy import stats
from scipy import optimize,special
results=json.load(open(sys.argv[1]));byid={r['id']:r for r in results};checks=0

def near(a,b,label,tol=2e-6):
 global checks
 assert np.allclose(a,b,rtol=tol,atol=tol,equal_nan=False),(label,a,b)
 checks+=1

def rows(q,title=None):
 tables=q['result']['tables'];t=next(t for t in tables if title is None or t['title']==title)
 return [dict(zip(t['columns'] if isinstance(t['columns'],list) else [t['columns']],r)) for r in t['rows']]

def values(q,k):return np.array(q['packet']['data'][q['packet']['fields'][k][0]]['values'])

for id in ['summary_t1','summary_t2','summary_tp']:
 q=byid[id];o=q['packet']['options'];a=rows(q)[0]
 if id=='summary_t2':
  v1=o['sd1']**2/o['n1'];v2=o['sd2']**2/o['n2'];est=o['mean1']-o['mean2'];se=np.sqrt(v1+v2);df=(v1+v2)**2/(v1*v1/(o['n1']-1)+v2*v2/(o['n2']-1))
 else:
  est=o['meanDifference'] if id=='summary_tp' else o['mean1'];n=o['pairs'] if id=='summary_tp' else o['n1'];sd=o['sdDifference'] if id=='summary_tp' else o['sd1'];se=sd/np.sqrt(n);df=n-1
 near([a['Estimate'],a['SE'],a['DF'],a['P']],[est,se,df,2*stats.t.sf(abs(est/se),df)],id)
 near([a['Lower'],a['Upper']],est+np.array([-1,1])*stats.t.ppf(.975,df)*se,id+' CI')
for id in ['binomial','prop1','prop2']:
 q=byid[id];y=values(q,'y');a=rows(q,'Test')[0]
 if id=='binomial':near(a['P'],stats.binomtest(sum(y),len(y),.5).pvalue,id)
 elif id=='prop1':near(a['Statistic'],(sum(y)-len(y)*.5)**2/(len(y)*.25),id)
 else:
  g=values(q,'group');n=np.array([sum(g==v) for v in sorted(set(g))]);s=np.array([sum(y[g==v]) for v in sorted(set(g))]);p=s.sum()/n.sum();z=(s[0]/n[0]-s[1]/n[1])/np.sqrt(p*(1-p)*sum(1/n));near(a['Statistic'],z*z,id)
for id in ['mannwhitney','signedrank','kruskal','friedman','fisher','mcnemar_exact','welch_anova']:
 q=byid[id];a=rows(q,'Test')[0]
 if id in ['fisher','mcnemar_exact']:
  if id=='fisher':
   g=values(q,'group');h=values(q,'group2');tab=np.array([[sum((g==i)&(h==j)) for j in sorted(set(h))] for i in sorted(set(g))]);continue # RxC exact p-values have no SciPy 2x2 comparator.
  yy=values(q,'y');zz=values(q,'y2');b=sum((yy==0)&(zz==1));c=sum((yy==1)&(zz==0));p=stats.binomtest(b,b+c).pvalue
 elif id=='signedrank':p=stats.wilcoxon(values(q,'y'),values(q,'y2'),method='approx',correction=True).pvalue
 else:
  y=values(q,'y');g=values(q,'group');groups=[y[g==v] for v in sorted(set(g))]
  if id=='mannwhitney':p=stats.mannwhitneyu(*groups,method='asymptotic',use_continuity=True).pvalue
  elif id=='kruskal':p=stats.kruskal(*groups).pvalue
  elif id=='friedman':p=stats.friedmanchisquare(*groups).pvalue
  else:
   ni=np.array(list(map(len,groups)));mi=np.array(list(map(np.mean,groups)));vi=np.array([np.var(a,ddof=1) for a in groups]);w=ni/vi;k=len(groups);tmp=sum((1-w/w.sum())**2/(ni-1));F=sum(w*(mi-sum(w*mi)/sum(w))**2)/(k-1)/(1+2*(k-2)/(k*k-1)*tmp);p=stats.f.sf(F,k-1,(k*k-1)/(3*tmp))
 near(a['P'],p,id)
q=byid['gameshowell'];yy=values(q,'y');gg=values(q,'group');lv=sorted(set(gg))
for a in rows(q,'Games–Howell simultaneous comparisons'):
 i,j=a['Contrast'].split(' - ');x=yy[gg==i];y=yy[gg==j];v1=np.var(x,ddof=1)/len(x);v2=np.var(y,ddof=1)/len(y);df=(v1+v2)**2/(v1*v1/(len(x)-1)+v2*v2/(len(y)-1));se=np.sqrt((v1+v2)/2);crit=stats.studentized_range.ppf(.95,len(lv),df);p=stats.studentized_range.sf(abs(x.mean()-y.mean())/se,len(lv),df)
 near([a['P.adjusted'],a['Lower'],a['Upper']],[p,x.mean()-y.mean()-crit*se,x.mean()-y.mean()+crit*se],'Games–Howell')
q=byid['pca'];mat=np.array([q['packet']['data'][v]['values'] for v in q['packet']['fields']['variables']]).T;z=(mat-mat.mean(0))/mat.std(0,ddof=1);eigen=np.linalg.eigvalsh(np.cov(z.T))[::-1];near([r['Eigenvalue'] for r in rows(q,'Explained variance')],eigen,'PCA eigenvalues')
q=byid['probit'];y=values(q,'y');X=np.column_stack([q['packet']['data'][v]['values'] for v in q['packet']['fields']['predictors']]);X=np.column_stack([np.ones(len(y)),X]);objective=lambda b:-np.sum(y*special.log_ndtr(X@b)+(1-y)*special.log_ndtr(-X@b));fit=optimize.minimize(objective,np.zeros(X.shape[1]),method='BFGS',options={'gtol':1e-7});b=fit.x;eta=X@b;p=stats.norm.cdf(eta);weight=stats.norm.pdf(eta)**2/(p*(1-p));se=np.sqrt(np.diag(np.linalg.inv(X.T@(weight[:,None]*X))));rr=rows(q,'Coefficients');order=[len(rr)-1,*range(len(rr)-1)];near([rr[i]['Estimate'] for i in order],b,'Probit coefficients',tol=1e-5);near([rr[i]['Std. Error'] for i in order],se,'Probit SE',tol=3e-3)
q=byid['classification'];y=values(q,'y');p=values(q,'probability');rr={a['Metric']:a['Value'] for a in rows(q,'Classification performance')};near(rr['Brier score'],np.mean((y-p)**2),'Brier');pos=p[y==1];neg=p[y==0];auc=np.mean([(a>b)+.5*(a==b) for a in pos for b in neg]);near(rr['AUC'],auc,'AUC')
q=byid['cox'];near(q['result']['analysisN'],len(values(q,'time')),'Cox sample N counts people rather than events')
rr=rows(q,'Coefficients');near([a['Upper CI']-a['coef'] for a in rr],[stats.norm.ppf(.975)*a['se(coef)'] for a in rr],'Cox coefficient CI uses coefficient SE')
assert not any(not r['ok'] for r in results)
print(f'{checks} independent numerical comparisons passed; all {len(results)} method smoke checks passed.')
