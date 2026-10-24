"""Regenerate independent OLS references with NumPy least squares and SciPy F tails."""
import json
from pathlib import Path
import numpy as np
from scipy.stats import f
from scipy.optimize import minimize
from scipy.special import expit

def reference(y, x, robust=False):
    keep = np.isfinite(y) & np.isfinite(x).all(axis=1)
    y, x = y[keep], x[keep]
    x = np.column_stack([np.ones(len(y)), x])
    b = np.linalg.lstsq(x, y, rcond=None)[0]
    residual = y - x @ b
    sse, sst = residual @ residual, ((y-y.mean())**2).sum()
    n, p = x.shape; q = p-1
    bread = np.linalg.inv(x.T @ x)
    cov = bread * sse / (n-p)
    stat = ((sst-sse)/q)/(sse/(n-p))
    if robust:
        scores = x * residual[:, None]
        cov = bread @ (scores.T @ scores) @ bread * n/(n-p)
        stat = b[1:] @ np.linalg.solve(cov[1:,1:], b[1:]) / q
    return dict(n=n,b=b.tolist(),se=np.sqrt(np.diag(cov)).tolist(),F=float(stat),df1=q,df2=n-p,R2=float(1-sse/sst),p=float(f.sf(stat,q,n-p)))

cases=[]
for robust in (False,True):
    i=np.arange(240,dtype=float)
    x=np.column_stack([(i%17-8)/8, (i%3==1).astype(float), (i%3==2).astype(float)])
    y=.25+.8*x[:,0]-.4*x[:,1]+.2*x[:,2]+np.sin(i*1.37)*.3
    y[(i%11)==0]=np.nan; x[(i%13)==0,0]=np.nan; x[(i%19)==0,1:]=np.nan
    cases.append(dict(name='multiple-'+('HC1' if robust else 'classical'),robust=robust,
        y=[None if not np.isfinite(v) else float(v) for v in y],
        x=[[None if not np.isfinite(v) else float(v) for v in row] for row in x],
        expected=reference(y,x,robust)))
i=np.arange(1025720,dtype=float); x=((i%7)<3).astype(float)
y=.05+.8*x+np.sin(i*.73)*.3; y[512799:]=np.nan
large=reference(y,x[:,None])
target=Path(__file__).with_name('regression-reference.json')
i=np.arange(300,dtype=float)
x=np.column_stack([(i%23-11)/11,(i%3==1).astype(float)])
prob=expit(-.35+.7*x[:,0]-.2*x[:,1]); y=(((i*37)%101)/101<prob).astype(float)
y[(i%17)==0]=np.nan; x[(i%29)==0,0]=np.nan
keep=np.isfinite(y)&np.isfinite(x).all(axis=1); X=np.column_stack([np.ones(keep.sum()),x[keep]]); Y=y[keep]
fun=lambda b: np.logaddexp(0,X@b).sum()-Y@(X@b)
jac=lambda b: X.T@(expit(X@b)-Y)
opt=minimize(fun,np.zeros(X.shape[1]),jac=jac,method='BFGS',options={'gtol':1e-10})
assert np.max(np.abs(jac(opt.x)))<1e-7
mu=expit(X@opt.x); cov=np.linalg.inv(X.T@((mu*(1-mu))[:,None]*X))
ll=-fun(opt.x); p0=Y.mean(); ll0=(Y*np.log(p0)+(1-Y)*np.log1p(-p0)).sum()
logit=dict(y=[None if not np.isfinite(v) else float(v) for v in y],x=[[None if not np.isfinite(v) else float(v) for v in row] for row in x],expected=dict(n=len(Y),b=opt.x.tolist(),se=np.sqrt(np.diag(cov)).tolist(),ll=ll,llNull=float(ll0)))
target.write_text(json.dumps(dict(source='NumPy lstsq + direct residual sums of squares; SciPy F survival and BFGS logistic likelihood optimization',cases=cases,large=large,logit=logit),separators=(',',':'))+'\n')
print('Generated independent regression references:',target)
