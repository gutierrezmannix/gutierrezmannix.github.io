"""Generate the method directory consumed by the browser and integration tests."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
rows=[]
def a(group,id,title,inputs='',packages='',options=None,summary=''):
 rows.append(dict(group=group,id=id,title=title,inputs=inputs.split(),packages=packages.split(),options=options or {},summary=summary.split()))
g='T-tests'
a(g,'summary_t1','One-sample t-test from summaries',summary='mean1 sd1 n1 null')
a(g,'summary_t2','Independent t-test from summaries',summary='mean1 sd1 n1 mean2 sd2 n2')
a(g,'summary_tp','Paired t-test from difference summaries',summary='meanDifference sdDifference pairs null')
g='Proportions & categorical tests'
a(g,'prop1','One-proportion score test','y',options={'null':.5},summary='successes trials null')
a(g,'prop2','Two-proportion score test','y group',summary='successes1 trials1 successes2 trials2')
a(g,'binomial','Exact binomial test','y',options={'null':.5},summary='successes trials null')
a(g,'gof','Chi-square goodness of fit','group',options={'expected':''},summary='counts expected')
a(g,'fisher','Fisher exact test','group group2',summary='table')
a(g,'mcnemar','McNemar paired binary test','y y2',summary='table')
a(g,'mcnemar_exact','Exact McNemar test','y y2',summary='table')
g='Nonparametric tests'
a(g,'mannwhitney','Mann–Whitney / Wilcoxon rank-sum','y group')
a(g,'signedrank','Wilcoxon signed-rank','y y2')
a(g,'kruskal','Kruskal–Wallis','y group')
a(g,'friedman','Friedman repeated-rank test','y group subject')
g='ANOVA & ANCOVA'
a(g,'welch_anova','Welch one-way ANOVA','y group')
a(g,'factorial','Factorial ANOVA','y factors','car',{'ss':'II','interactions':True})
a(g,'ancova','ANCOVA','y group covariates','car',{'ss':'II','interactions':False})
a(g,'repeated','Repeated-measures ANOVA','y subject group','car')
a(g,'tukey','Tukey comparisons','y group')
a(g,'gameshowell','Games–Howell comparisons','y group')
a(g,'dunnett','Dunnett comparisons','y group','multcomp',{'reference':''})
a(g,'contrasts','Planned contrasts','y group','multcomp',{'contrasts':'','adjust':'holm'})
a(g,'pairwise','Adjusted pairwise comparisons','y group',options={'adjust':'holm','rank':False})
g='Regression'
for id,title,pkg,options in [('multinomial','Multinomial logistic','nnet',{}),('probit','Binary probit','',{}),('negbin','Negative-binomial','MASS',{}),('hurdle','Hurdle count model','pscl',{'countFamily':'negbin'}),('zeroinfl','Zero-inflated count model','pscl',{'countFamily':'negbin'}),('robustreg','Robust linear regression','MASS',{}),('quantile','Quantile regression','quantreg',{'tau':.5}),('spline','Natural-spline regression','',{'df':4}),('gam','Generalized additive model','mgcv',{'family':'gaussian','df':5})]:a(g,id,title,'y predictors',pkg,options)
g='Multilevel & panel models'
a(g,'mixed','Linear mixed-effects model','y predictors subject','lme4',{'reml':True,'randomSlope':''})
a(g,'glmm','Generalized mixed-effects model','y predictors subject','lme4',{'family':'binomial','randomSlope':''})
a(g,'panel_fe','Panel fixed effects','y predictors subject time','plm',{'effects':'individual'})
a(g,'panel_re','Panel random effects','y predictors subject time','plm',{'effects':'individual'})
a(g,'panel_dynamic','Dynamic panel GMM','y predictors subject time','plm',{'lags':2})
g='Time series'
a(g,'decompose','Seasonal decomposition (STL)','y time',options={'frequency':12})
for id,title in [('naive','Naïve forecast'),('snaive','Seasonal naïve forecast'),('drift','Random walk with drift'),('ets','Exponential smoothing / ETS'),('arima','ARIMA'),('sarima','Seasonal ARIMA')]:a(g,id,title,'y time','forecast',{'frequency':12 if id in ['snaive','sarima'] else 1,'horizon':12,'evaluate':True,'initial':0,**({'p':-1,'d':-1,'q':-1} if id in ['arima','sarima'] else {}),**({'P':0,'D':0,'Q':0} if id=='sarima' else {})})
a(g,'tsreg','Time-series regression with predictors','y time predictors','forecast',{'frequency':1,'horizon':12,'fourier':0,'seasonalDummies':False})
a(g,'ardl','Distributed-lag / ARDL','y time predictors','ARDL',{'lags':2})
a(g,'var','Vector autoregression (VAR)','variables time','vars',{'lags':2,'horizon':12})
a(g,'vecm','Cointegration / VECM','variables time','urca vars',{'lags':2,'rank':1,'horizon':12})
a(g,'breaks','Structural-break analysis','y time predictors','strucchange',{'breaks':1,'trim':.15})
a(g,'countts','Count time-series regression','y time predictors','MASS',{'family':'negbin','lags':1})
g='Survival analysis'
a(g,'km','Kaplan–Meier and log-rank','time event','survival')
a(g,'cox','Cox proportional hazards','time event predictors','survival')
a(g,'survreg','Parametric survival regression','time event predictors','survival',{'distribution':'weibull'})
g='Scales & dimension reduction'
a(g,'pca','Principal components analysis','variables',options={'standardize':True})
a(g,'efa','Exploratory factor analysis','variables','psych',{'nfactors':2,'rotation':'oblimin','factorMethod':'minres'})
g='Resampling & study planning'
a(g,'bootstrap','Bootstrap confidence interval','y','boot',{'repetitions':999,'statistic':'mean','seed':1729,'resample':'iid','blockLength':4})
a(g,'permutation','Permutation location test','y group','coin',{'repetitions':9999,'seed':1729})
a(g,'power_t','Power / sample size: means',packages='pwr',options={'effect':.5,'power':.8,'sample':0,'design':'two.sample'})
a(g,'power_prop','Power / sample size: proportions',packages='pwr',options={'p1':.5,'p2':.6,'power':.8,'sample':0,'design':'two.sample'})
a(g,'power_corr','Power / sample size: correlation',packages='pwr',options={'effect':.3,'power':.8,'sample':0})
a(g,'power_anova','Power / sample size: ANOVA',packages='pwr',options={'effect':.25,'groups':3,'power':.8,'sample':0})
a(g,'precision','Sample size for precision',options={'target':'proportion','margin':.05,'proportion':.5,'sd':1,'population':0,'responseRate':1,'designEffect':1})
g='Survey inference & missing data'
a(g,'survey_desc','Survey descriptive estimates','variables weight','survey',{'surveyStat':'mean'})
a(g,'survey_test','Survey-adjusted comparisons','y group weight','survey',{'surveyTest':'means'})
a(g,'impute','Multiple imputation / pooled regression','y predictors','mice',{'imputations':5,'iterations':10,'family':'gaussian','seed':1729})
a(g,'missing','Missing-data patterns','variables')
g='Predictive modeling'
for id,title,pkg,op in [('ridge','Ridge regression','glmnet',{}),('lasso','Lasso regression','glmnet',{}),('elastic','Elastic net','glmnet',{'penalty':.5}),('tree','Decision tree','rpart',{'complexity':.01})]:a(g,id,title,'y predictors',pkg,{**op,'family':'gaussian','trainFraction':.8,'folds':5,'seed':1729})
a(g,'classification','Classification evaluation','y probability',options={'threshold':.5})
a(g,'kmeans','K-means clustering','variables',options={'clusters':3,'standardize':True,'seed':1729})
a(g,'hierarchical','Hierarchical clustering','variables',options={'clusters':3,'standardize':True,'linkage':'ward.D2'})
g='Data management'
a(g,'merge','Merge / join datasets','keys',options={'join':'left','manyToMany':False})
a(g,'append','Append datasets')
a(g,'long','Reshape wide to long','subject variables')
a(g,'wide','Reshape long to wide','subject time y')
a(g,'duplicates','Identify duplicate keys','keys')
(ROOT/'src/analysis-catalog.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
print(len(rows),'methods')
