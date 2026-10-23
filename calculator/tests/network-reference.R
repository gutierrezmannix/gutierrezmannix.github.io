# Rscript calculator/tests/network-reference.R /tmp/gm26-network-reference [edges.csv nodes.csv]
# Generates graphs in R, then independent sna centralities and base-R logistic MPLE references.
suppressPackageStartupMessages(library(sna))
args <- commandArgs(trailingOnly=TRUE)
out <- if(length(args)) args[1] else tempfile('gm26-network-')
dir.create(out,recursive=TRUE,showWarnings=FALSE)
options(digits=17)
reference <- function(a, directed, stem, ids=seq_len(nrow(a))) {
  mode <- if(directed) 'digraph' else 'graph'
  write.table(a,file.path(out,paste0(stem,'.csv')),sep=',',row.names=FALSE,col.names=FALSE)
  ev <- abs(evcent(a,use.eigen=TRUE))
  # PageRank: solve the damped Markov stationary equations, including dangling nodes.
  transition <- a / pmax(1,rowSums(a)); transition[rowSums(a)==0,] <- 1/nrow(a)
  pr <- solve(diag(nrow(a))-.85*t(transition),rep(.15/nrow(a),nrow(a)))
  write.csv(data.frame(node=ids,degree=degree(a,gmode=mode),indegree=degree(a,gmode=mode,cmode='indegree'),outdegree=degree(a,gmode=mode,cmode='outdegree'),betweenness=betweenness(a,gmode=mode),closeness=closeness(a,gmode=mode,cmode=if(directed)'directed'else'undirected'),harmonic=closeness(a,gmode=mode,cmode=if(directed)'suminvdir'else'suminvundir'),eigenvector=ev/max(ev),pagerank=pr),file.path(out,paste0(stem,'-ref.csv')),row.names=FALSE)
  ij <- which(if(directed) row(a)!=col(a) else upper.tri(a),arr.ind=TRUE)
  i <- ij[,1]; j <- ij[,2]; n <- nrow(a); group <- seq_len(n)%%3; value <- sin(seq_len(n))
  # triangle change = common partners for undirected; multiplicity of directed two-edge orientations otherwise.
  sym <- if(directed) a+t(a) else a
  d <- data.frame(y=a[ij], mutual=t(a)[ij], triangle=(sym%*%sym)[ij], same=as.numeric(group[i]==group[j]), sociality=value[i]+value[j], difference=abs(value[i]-value[j]))
  forms <- list(edges=y~1, attributes=y~same+sociality+difference, triangle=y~triangle)
  if(directed) forms <- c(forms,list(mutual=y~mutual,all=y~mutual+triangle+same+sociality+difference))
  for(name in names(forms)) {
    f <- glm(forms[[name]],data=d,family=binomial(),control=glm.control(epsilon=1e-12,maxit=100))
    stopifnot(f$converged,all(is.finite(coef(f))))
    write.csv(data.frame(estimate=coef(f),se=sqrt(diag(vcov(f)))),file.path(out,paste0(stem,'-',name,'-fit.csv')),row.names=FALSE)
  }
}
set.seed(8261)
for(directed in c(TRUE,FALSE)) for(k in 1:10) reference(rgraph(18,tprob=.1+k*.035,mode=if(directed)'digraph'else'graph'),directed,paste0('sim-',directed,'-',k))
if(length(args)>=3) {
  e <- read.csv(args[2],check.names=FALSE,stringsAsFactors=FALSE)
  nodes <- read.csv(args[3],check.names=FALSE,stringsAsFactors=FALSE)
  i <- match(trimws(e[['Vertex 1']]),trimws(nodes[['Vertex']]))
  j <- match(trimws(e[['Vertex 2']]),trimws(nodes[['Vertex']]))
  keep <- !is.na(i)&!is.na(j)&i!=j
  a <- matrix(0,nrow(nodes),nrow(nodes)); a[cbind(i[keep],j[keep])] <- 1
  reference(a,TRUE,'media',nodes[['Vertex']])
  print(c(nodes=nrow(a),ties=sum(a),density=gden(a),meanDegree=mean(degree(a)),reciprocity=grecip(a,measure='edgewise')))
}
cat('R references written to',normalizePath(out),'using sna',as.character(packageVersion('sna')),'\n')
