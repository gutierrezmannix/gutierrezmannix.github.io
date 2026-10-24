// GM26 observed scatter ranges begin
export function observedRange(values) {
  let lo=Infinity, hi=-Infinity;
  for (const v of values) if (Number.isFinite(v)) { if(v<lo)lo=v; if(v>hi)hi=v; }
  return lo<=hi ? [lo,hi] : null;
}
export function scatterRangeTicks(lo,hi,count=6) {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi<lo) return [];
  if (lo===hi) return [lo];
  // Always label both actual endpoints; keep interior labels far enough away.
  const gap=(hi-lo)/(count+1);
  return [lo,...ticks(lo,hi,count).filter(v=>v>lo+gap && v<hi-gap),hi];
}
function scatterTickLabel(v) {
  if (!Number.isFinite(v)) return '';
  return Number(v.toPrecision(6)).toLocaleString('en-US',{maximumSignificantDigits:6});
}
export function scatterChart(R,c,o) {
  if (!c || c.error) return null;
  const W=680,H=400,m={l:66,r:20,t:18,b:52};
  // Fallback keeps direct engine callers working; the workbench supplies each
  // variable's finite extent after active filters and missing-value rules.
  const data=o.dataRange || {}, valid=r=>r && r.length===2 && r.every(Number.isFinite) && r[1]>=r[0];
  const xr=valid(data.x)?data.x:observedRange(c.xs), yr=valid(data.y)?data.y:observedRange(c.ys);
  if(!xr || !yr) return null;
  const [xmn,xmx]=axDom(xr[0],xr[1],o.ax,'x',0), [ymn,ymx]=axDom(yr[0],yr[1],o.ax,'y',0);
  const sx=v=>m.l+(W-m.l-m.r)*(v-xmn)/(xmx-xmn);
  const sy=v=>H-m.b-(H-m.t-m.b)*(v-ymn)/(ymx-ymn);
  const kids=[];
  scatterRangeTicks(ymn,ymx,5).forEach((v,i)=>{
    kids.push(R.createElement('line',{key:'gy'+i,x1:m.l,x2:W-m.r,y1:sy(v),y2:sy(v),stroke:PAL.grid}));
    kids.push(txt(R,m.l-7,sy(v)+4,scatterTickLabel(v),{key:'gyt'+i,textAnchor:'end'}));
  });
  const xt=scatterRangeTicks(xmn,xmx,6);
  xt.forEach((v,i)=>kids.push(txt(R,sx(v),H-m.b+16,scatterTickLabel(v),{
    key:'xt'+i,textAnchor:i===0?'start':i===xt.length-1?'end':'middle'
  })));
  const step=Math.max(1,Math.floor(c.n/1400)),rr=c.n>2000?2.4:3.2;
  let d='';
  for(let i=0;i<c.n;i+=step) if(Number.isFinite(c.xs[i])&&Number.isFinite(c.ys[i]))
    d+='M'+sx(c.xs[i]).toFixed(1)+','+sy(c.ys[i]).toFixed(1)+'h0';
  if(d)kids.push(R.createElement('path',{key:'pts',d,stroke:o.color||PAL.blue,strokeOpacity:.45,strokeWidth:rr*2,strokeLinecap:'round',fill:'none'}));
  // Clip the true line; clamping its endpoints would change the apparent slope
  // whenever the user narrows the Y limits.
  kids.push(R.createElement('line',{key:'fit',x1:sx(xmn),y1:sy(c.fit.icept+c.fit.slope*xmn),
    x2:sx(xmx),y2:sy(c.fit.icept+c.fit.slope*xmx),stroke:PAL.orange,strokeWidth:2.5}));
  kids.push(R.createElement('line',{key:'ax',x1:m.l,x2:W-m.r,y1:H-m.b,y2:H-m.b,stroke:PAL.axis}));
  kids.push(txt(R,(m.l+W-m.r)/2,H-10,truncLab(o.xlab,56),{key:'xl',textAnchor:'middle',fill:PAL.dim}));
  kids.push(R.createElement('text',{key:'yl',x:16,y:(m.t+H-m.b)/2,fill:PAL.dim,fontSize:11,fontFamily:MONO,textAnchor:'middle',
    transform:'rotate(-90 16 '+(m.t+H-m.b)/2+')'},truncLab(o.ylab,44)));
  return {node:svgBase(R,o.key,o.refCb,W,H,clipMarks(R,kids,o.key,/^(pts|fit)$/,m.l,m.t,W-m.l-m.r,H-m.t-m.b)),
    sampled:step>1,shown:Math.ceil(c.n/step),domain:{x:[xmn,xmx],y:[ymn,ymx]}};
}
// GM26 observed scatter ranges end
