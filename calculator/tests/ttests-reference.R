# Rscript calculator/tests/ttests-reference.R /tmp/gm26-ttests
out<-commandArgs(trailingOnly=TRUE)[1];dir.create(out,recursive=TRUE,showWarnings=FALSE)
set.seed(4526);rows<-list()
for(mode in c('value','groups','paired'))for(k in 1:30){
 n<-if(k==1)2 else 4+k; x<-rnorm(n,mean=2+k/10,sd=.2+k/10)
 y<-if(mode=='groups')rnorm(n+3,3,sd=1+k/2)else x+rnorm(n,.5,.3)
 if(k>5){x[2]<-NA;y[3]<-NA}
 mu<-k/15;alpha<-if(k==1).0001 else if(k%%2).05 else .01
 f<-if(mode=='value')t.test(x,mu=mu,conf.level=1-alpha)else if(mode=='paired')t.test(x,y,paired=TRUE,conf.level=1-alpha)else t.test(x,y,conf.level=1-alpha)
 len<-max(length(x),length(y));write.csv(data.frame(x=c(x,rep(NA,len-length(x))),y=c(y,rep(NA,len-length(y)))),file.path(out,paste0(mode,'-',k,'.csv')),row.names=FALSE)
 estimate<-if(mode=='groups')unname(f$estimate[1]-f$estimate[2])else unname(f$estimate)
 rows[[length(rows)+1]]<-data.frame(mode=mode,k=k,mu=mu,alpha=alpha,estimate=estimate,t=unname(f$statistic),df=unname(f$parameter),p=f$p.value,lo=f$conf.int[1],hi=f$conf.int[2])
}
write.csv(do.call(rbind,rows),file.path(out,'reference.csv'),row.names=FALSE)
cat('90 reference t-tests generated using R',getRversion()|>as.character(),'\n')
