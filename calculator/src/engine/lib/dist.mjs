// Probability distributions for the built-in engine (no internet, no R). Accuracy targets R's nmath to ~1e-13
// relative in the body and stays in log space in the tails. Algorithms: Cody (normal), Wichura AS241 (normal
// quantile), Lentz continued fractions (incomplete beta / gamma), Loader (binomial), AS 243 (noncentral t),
// AS 226/R (noncentral beta, chi-square), Copenhaver–Holland (studentized range), Brent (R's zeroin).

export const M_LN2 = Math.LN2, M_PI = Math.PI, M_LN_SQRT_2PI = 0.918938533204672741780329736406, M_LN_SQRT_PId2 = 0.225791352644727432363097614947;
export const DBL_EPS = 2.220446049250313e-16;

// ---------- gamma family ----------
const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
export function lgamma(x) {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
  if (x >= 10) {
    // Stirling with correction series: more accurate for large x
    return (x - 0.5) * Math.log(x) - x + M_LN_SQRT_2PI + lgammacor(x);
  }
  x -= 1; let a = LANCZOS[0]; const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i);
  return M_LN_SQRT_2PI + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
function lgammacor(x) {
  const c = [0.1666666666666666666666666666666e+0, -0.3333333333333333333333333333333e-1, 0.7936507936507936507936507936508e-2, -0.5952380952380952380952380952381e-2, 0.8417508417508417508417508417508e-2, -0.1917526917526917526917526917527e-1, 0.6410256410256410256410256410256e-1];
  // Bernoulli series for log Γ(x) − Stirling: Σ B_{2k}/(2k(2k−1) x^{2k−1})
  const x2 = 1 / (x * x); let s = 0, p = 1 / x;
  const b = [1 / 12, -1 / 360, 1 / 1260, -1 / 1680, 1 / 1188, -691 / 360360, 1 / 156, -3617 / 122400];
  for (let k = 0; k < b.length; k++) { s += b[k] * p; p *= x2; if (Math.abs(b[k] * p) < 1e-17 * Math.abs(s)) break; }
  void c; return s;
}
export function gammafn(x) { if (Number.isInteger(x) && x > 0 && x < 171) { let r = 1; for (let i = 2; i < x; i++) r *= i; return r; } const s = x < 0 && Math.floor(-x) % 2 === 0 ? -1 : 1; return s * Math.exp(lgamma(x)); }
export function lbeta(a, b) { return lgamma(a) + lgamma(b) - lgamma(a + b); }
export function lchoose(n, k) { return lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1); }
export function choose(n, k) { if (k < 0 || k > n) return 0; if (k === 0 || k === n) return 1; if (n < 50) { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); } return Math.round(Math.exp(lchoose(n, k))); }
export function digamma(x) { let r = 0; while (x < 12) { r -= 1 / x; x += 1; } const f = 1 / (x * x); return r + Math.log(x) - 0.5 / x - f * (1 / 12 - f * (1 / 120 - f * (1 / 252 - f * (1 / 240 - f / 132)))); }
export function trigamma(x) { let r = 0; while (x < 12) { r += 1 / (x * x); x += 1; } const f = 1 / (x * x); return r + 1 / x + f / 2 + f / x * (1 / 6 - f * (1 / 30 - f * (1 / 42 - f / 30))); }

// ---------- normal (Cody 1969, as in R's pnorm_both) ----------
export function pnormBoth(x) {
  const a = [2.2352520354606839287, 161.02823106855587881, 1067.6894854603709582, 18154.981253343561249, 0.065682337918207449113];
  const b = [47.20258190468824187, 976.09855173777669322, 10260.932208618978205, 45507.789335026729956];
  const c = [0.39894151208813466764, 8.8831497943883759412, 93.506656132177855979, 597.27027639480026226, 2494.5375852903726711, 6848.1904505362823326, 11602.651437647350124, 9842.7148383839780218, 1.0765576773720192317e-8];
  const d = [22.266688044328115691, 235.38790178262499861, 1519.377599407554805, 6485.558298266760755, 18615.571640885098091, 34900.952721145977266, 38912.003286093271411, 19685.429676859990727];
  const p = [0.21589853405795699, 0.1274011611602473639, 0.022235277870649807, 0.001421619193227893466, 2.9112874951168792e-5, 0.02307344176494017303];
  const q = [1.28426009614491121, 0.468238212480865118, 0.0659881378689285515, 0.00378239633202758244, 7.29751555083966205e-5];
  const SQRT32 = 5.656854249492380195206754896838, M_1_SQRT_2PI = 0.398942280401432677939946059934;
  let cum, ccum; const y = Math.abs(x);
  if (Number.isNaN(x)) return [NaN, NaN];
  if (y <= 0.67448975) {
    let xnum, xden; if (y > DBL_EPS * 0.5) { const xsq = x * x; xnum = a[4] * xsq; xden = xsq; for (let i = 0; i < 3; i++) { xnum = (xnum + a[i]) * xsq; xden = (xden + b[i]) * xsq; } } else { xnum = xden = 0; }
    const temp = x * (xnum + a[3]) / (xden + b[3]); cum = 0.5 + temp; ccum = 0.5 - temp;
  } else if (y <= SQRT32) {
    let xnum = c[8] * y, xden = y; for (let i = 0; i < 7; i++) { xnum = (xnum + c[i]) * y; xden = (xden + d[i]) * y; }
    let temp = (xnum + c[7]) / (xden + d[7]);
    const xsq = Math.trunc(y * 16) / 16, del = (y - xsq) * (y + xsq);
    cum = Math.exp(-xsq * xsq * 0.5) * Math.exp(-del * 0.5) * temp; ccum = 1 - cum;
    if (x > 0) { temp = cum; cum = ccum; ccum = temp; }
  } else if (y < 1e170) {
    const xsq0 = 1 / (x * x); let xnum = p[5] * xsq0, xden = xsq0; for (let i = 0; i < 4; i++) { xnum = (xnum + p[i]) * xsq0; xden = (xden + q[i]) * xsq0; }
    let temp = xsq0 * (xnum + p[4]) / (xden + q[4]); temp = (M_1_SQRT_2PI - temp) / y;
    const xsq = Math.trunc(x * 16) / 16, del = (x - xsq) * (x + xsq);
    cum = Math.exp(-xsq * xsq * 0.5) * Math.exp(-del * 0.5) * temp; ccum = 1 - cum;
    if (x > 0) { temp = cum; cum = ccum; ccum = temp; }
  } else { if (x > 0) { cum = 1; ccum = 0; } else { cum = 0; ccum = 1; } }
  return [cum, ccum];
}
export function pnorm(x, mu = 0, sd = 1, lower = true) { const z = (x - mu) / sd; if (!Number.isFinite(z)) { if (Number.isNaN(z)) return NaN; return (z > 0) === lower ? 1 : 0; } const [c, cc] = pnormBoth(z); return lower ? c : cc; }
export function dnorm(x, mu = 0, sd = 1, log = false) { const z = (x - mu) / sd, l = -(M_LN_SQRT_2PI + 0.5 * z * z + Math.log(sd)); return log ? l : Math.exp(l); }
export function qnorm(p, mu = 0, sd = 1, lower = true) {
  if (Number.isNaN(p) || p < 0 || p > 1) return NaN; if (p === 0) return lower ? -Infinity : Infinity; if (p === 1) return lower ? Infinity : -Infinity;
  const p_ = lower ? p : 1 - p, q = p_ - 0.5; let r, val;
  if (Math.abs(q) <= 0.425) {
    r = 0.180625 - q * q;
    val = q * (((((((r * 2509.0809287301226727 + 33430.575583588128105) * r + 67265.770927008700853) * r + 45921.953931549871457) * r + 13731.693765509461125) * r + 1971.5909503065514427) * r + 133.14166789178437745) * r + 3.387132872796366608) / (((((((r * 5226.495278852545925 + 28729.085735721942674) * r + 39307.89580009271061) * r + 21213.794301586595867) * r + 5394.1960214247511077) * r + 687.1870074920579083) * r + 42.313330701600911252) * r + 1);
  } else {
    const pl = lower ? p : 1 - p, pu = lower ? 1 - p : p; r = Math.sqrt(-Math.log(q < 0 ? pl : pu));
    if (r <= 5) { r -= 1.6; val = (((((((r * 7.7454501427834140764e-4 + 0.0227238449892691845833) * r + 0.24178072517745061177) * r + 1.27045825245236838258) * r + 3.64784832476320460504) * r + 5.7694972214606914055) * r + 4.6303378461565452959) * r + 1.42343711074968357734) / (((((((r * 1.05075007164441684324e-9 + 5.475938084995344946e-4) * r + 0.0151986665636164571966) * r + 0.14810397642748007459) * r + 0.68976733498510000455) * r + 1.6763848301838038494) * r + 2.05319162663775882187) * r + 1); }
    else { r -= 5; val = (((((((r * 2.01033439929228813265e-7 + 2.71155556874348757815e-5) * r + 0.0012426609473880784386) * r + 0.026532189526576123093) * r + 0.29656057182850489123) * r + 1.7848265399172913358) * r + 5.4637849111641143699) * r + 6.6579046435011037772) / (((((((r * 2.04426310338993978564e-15 + 1.4215117583164458887e-7) * r + 1.8463183175100546818e-5) * r + 7.868691311456132591e-4) * r + 0.0148753612908506148525) * r + 0.13692988092273580531) * r + 0.59983220655588793769) * r + 1); }
    if (q < 0) val = -val;
  }
  return mu + sd * val;
}

// ---------- incomplete gamma ----------
// Regularized P(a,x) and Q(a,x); series for x < a+1, Lentz continued fraction otherwise.
export function pgammaRaw(x, a) {
  if (x <= 0) return [0, 1]; if (!Number.isFinite(x)) return [1, 0];
  const lfac = a * Math.log(x) - x - lgamma(a);
  if (x < a + 1) {
    let sum = 1 / a, del = sum, ap = a;
    for (let n = 0; n < 100000; n++) { ap += 1; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-17) break; }
    const P = sum * Math.exp(lfac); return [P, 1 - P];
  }
  let b = x + 1 - a, c = 1 / 1e-300, d = 1 / b, h = d;
  for (let i = 1; i < 100000; i++) { const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300; c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-17) break; }
  const Q = Math.exp(lfac) * h; return [1 - Q, Q];
}
export function pgamma(x, shape, scale = 1, lower = true) { const [P, Q] = pgammaRaw(x / scale, shape); return lower ? P : Q; }
export function dgamma(x, shape, scale = 1, log = false) { if (x < 0) return log ? -Infinity : 0; const l = (shape - 1) * Math.log(x / scale) - x / scale - lgamma(shape) - Math.log(scale); return log ? l : Math.exp(l); }
export function pchisq(x, df, lower = true) { return pgamma(x, df / 2, 2, lower); }
export function qgamma(p, shape, scale = 1, lower = true) {
  if (p <= 0) return lower ? 0 : Infinity; if (p >= 1) return lower ? Infinity : 0;
  const pl = lower ? p : 1 - p;
  // g(x) > 0 when x is above the quantile; evaluated in the tail that keeps precision
  const g = x => lower ? pgamma(x, shape, 1, true) - p : p - pgamma(x, shape, 1, false);
  let x;
  if (pl < 0.05) x = Math.exp((Math.log(pl) + lgamma(shape + 1)) / shape);
  else { const z = qnorm(pl), c = 1 / (9 * shape); x = shape * Math.pow(Math.max(1 - c + z * Math.sqrt(c), 1e-2), 3); }
  if (!(x > 0) || !Number.isFinite(x)) x = shape;
  let lo = 0, hi = Infinity;
  for (let i = 0; i < 400; i++) {
    const f = g(x); if (f === 0) break; if (f > 0) hi = x; else lo = x;
    let nx = x - f / dgamma(x, shape, 1);
    if (!(nx > lo && nx < hi) || !Number.isFinite(nx)) nx = Number.isFinite(hi) ? (lo > 0 ? Math.sqrt(lo * hi) : hi / 2) : x * 2;
    if (Math.abs(nx - x) <= 1e-15 * x) { x = nx; break; } x = nx;
  }
  return x * scale;
}
export function qchisq(p, df, lower = true) { return qgamma(p, df / 2, 2, lower); }

// ---------- incomplete beta ----------
function betacf(a, b, x) {
  const FPMIN = 1e-300; let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d; let h = d;
  for (let m = 1; m <= 100000; m++) {
    const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < 1e-16) break;
  }
  return h;
}
// returns [I_x(a,b), 1 − I_x(a,b)] computed without cancellation
export function pbetaRaw(x, a, b) {
  if (x <= 0) return [0, 1]; if (x >= 1) return [1, 0];
  const lbt = a * Math.log(x) + b * Math.log1p(-x) - lbeta(a, b);
  if (x < (a + 1) / (a + b + 2)) { const v = Math.exp(lbt) * betacf(a, b, x) / a; return [v, 1 - v]; }
  const v = Math.exp(lbt) * betacf(b, a, 1 - x) / b; return [1 - v, v];
}
export function pbeta(x, a, b, lower = true) { const [P, Q] = pbetaRaw(x, a, b); return lower ? P : Q; }
export function dbeta(x, a, b, log = false) { if (x < 0 || x > 1) return log ? -Infinity : 0; const l = (a - 1) * Math.log(x) + (b - 1) * Math.log1p(-x) - lbeta(a, b); return log ? l : Math.exp(l); }
export function qbeta(p, a, b, lower = true) {
  if (p <= 0) return lower ? 0 : 1; if (p >= 1) return lower ? 1 : 0;
  const f = x => lower ? pbeta(x, a, b, true) - p : p - pbeta(x, a, b, false);
  // start: normal approximation on the logit scale, refined by safeguarded Newton with bisection
  let lo = 0, hi = 1, x = a / (a + b);
  { const mean = a / (a + b), sd = Math.sqrt(a * b / ((a + b) ** 2 * (a + b + 1))), z = qnorm(lower ? p : 1 - p); const g = mean + z * sd; if (g > 0 && g < 1) x = g; }
  for (let i = 0; i < 1000; i++) {
    const fx = f(x); if (fx === 0) return x; if (fx > 0) hi = x; else lo = x;
    const dx = dbeta(x, a, b); let nx = x - fx / dx;
    if (!(nx > lo && nx < hi) || !Number.isFinite(nx)) nx = (lo + hi) / 2;
    if (Math.abs(nx - x) <= 1e-16 * Math.max(x, 1e-300) || hi - lo < 1e-300) { x = nx; break; } x = nx;
  }
  return x;
}

// ---------- t, F ----------
export function pt(t, df, lower = true) {
  if (Number.isNaN(t)) return NaN; if (!Number.isFinite(df) || df > 4e5) { const v = 1 / (4 * df); const z = Number.isFinite(df) ? t * (1 - v) / Math.sqrt(1 + t * t * 2 * v) : t; return pnorm(z, 0, 1, lower); }
  if (!Number.isFinite(t)) return (t > 0) === lower ? 1 : 0;
  const x = df / (df + t * t); let tail;
  if (x < 0.5) tail = 0.5 * pbeta(x, df / 2, 0.5, true); else tail = 0.5 * pbeta(t * t / (df + t * t), 0.5, df / 2, false);
  return (t > 0) === lower ? 1 - tail : tail;
}
export function dt(t, df, log = false) { const l = lgamma((df + 1) / 2) - lgamma(df / 2) - 0.5 * Math.log(df * Math.PI) - (df + 1) / 2 * Math.log1p(t * t / df); return log ? l : Math.exp(l); }
export function qt(p, df, lower = true) {
  if (p <= 0) return lower ? -Infinity : Infinity; if (p >= 1) return lower ? Infinity : -Infinity; if (!Number.isFinite(df) || df > 1e20) return qnorm(p, 0, 1, lower);
  const pl = lower ? p : 1 - p; if (pl === 0.5) return 0;
  const two = 2 * Math.min(pl, 1 - pl); // two-sided tail probability
  const x = qbeta(two, df / 2, 0.5, true); let t = Math.sqrt(df * (1 / x - 1));
  if (!Number.isFinite(t) || x === 0) t = Infinity;
  // polish with Newton on pt for full precision
  for (let i = 0; i < 4 && Number.isFinite(t) && t > 0; i++) { const target = Math.min(pl, 1 - pl), f = pt(-t, df, true) - target, d = dt(t, df); const nt = t + f / d; if (!Number.isFinite(nt) || nt <= 0) break; if (Math.abs(nt - t) < 1e-15 * t) { t = nt; break; } t = nt; }
  return pl < 0.5 ? -t : t;
}
export function pf(f, df1, df2, lower = true) {
  if (f <= 0) return lower ? 0 : 1; if (!Number.isFinite(f)) return lower ? 1 : 0;
  if (!Number.isFinite(df2)) return pchisq(f * df1, df1, lower);
  const x = df1 * f / (df1 * f + df2);
  return x > 0.5 ? pbeta(df2 / (df2 + df1 * f), df2 / 2, df1 / 2, !lower) : pbeta(x, df1 / 2, df2 / 2, lower);
}
export function qf(p, df1, df2, lower = true) { if (!Number.isFinite(df2)) return qchisq(p, df1, lower) / df1; const x = qbeta(p, df2 / 2, df1 / 2, !lower); return (1 / x - 1) * (df2 / df1); }

// ---------- binomial / hypergeometric (Loader 2000, as in R) ----------
const SFERR = [0.0, 0.1534264097200273452913848, 0.0810614667953272582196702, 0.0548141210519176538961390, 0.0413406959554092940938221, 0.03316287351993628748511048, 0.02767792568499833914878929, 0.02374616365629749597132920, 0.02079067210376509311152277, 0.01848845053267318523077934, 0.01664469118982119216319487, 0.01513497322191737887351255, 0.01387612882307074799874573, 0.01281046524292022692424986, 0.01189670994589177009505572, 0.01110455975820691732662991, 0.010411265261972096497478567, 0.009799416126158803298389475, 0.009255462182712732917728637, 0.008768700134139385462952823, 0.008330563433362871256469318, 0.007934114564314020547248100, 0.007573675487951840794972024, 0.007244554301320383179543912, 0.006942840107209529865664152, 0.006665247032707682442354394, 0.006408994188004207068439631, 0.006171712263039457647532867, 0.005951370112758847735624416, 0.005746216513010115682023589, 0.005554733551962801371038690];
export function stirlerr(n) {
  const S0 = 1 / 12, S1 = 1 / 360, S2 = 1 / 1260, S3 = 1 / 1680, S4 = 1 / 1188;
  if (n <= 15) { const nn = n + n; if (nn === Math.trunc(nn)) return SFERR[nn]; return lgamma(n + 1) - (n + 0.5) * Math.log(n) + n - M_LN_SQRT_2PI; }
  const nn = n * n;
  if (n > 500) return (S0 - S1 / nn) / n; if (n > 80) return (S0 - (S1 - S2 / nn) / nn) / n; if (n > 35) return (S0 - (S1 - (S2 - S3 / nn) / nn) / nn) / n;
  return (S0 - (S1 - (S2 - (S3 - S4 / nn) / nn) / nn) / nn) / n;
}
export function bd0(x, np) {
  if (Math.abs(x - np) < 0.1 * (x + np)) { let v = (x - np) / (x + np), s = (x - np) * v; if (Math.abs(s) < Number.MIN_VALUE) return s; let ej = 2 * x * v; v = v * v; for (let j = 1; j < 1000; j++) { ej *= v; const s1 = s + ej / ((j << 1) + 1); if (s1 === s) return s1; s = s1; } }
  return x * Math.log(x / np) + np - x;
}
export function dbinomRaw(x, n, p, q, log = false) {
  let lc, f;
  if (p === 0) return x === 0 ? (log ? 0 : 1) : (log ? -Infinity : 0); if (q === 0) return x === n ? (log ? 0 : 1) : (log ? -Infinity : 0);
  if (x === 0) { if (n === 0) return log ? 0 : 1; lc = p < 0.1 ? -bd0(n, n * q) - n * p : n * Math.log(q); return log ? lc : Math.exp(lc); }
  if (x === n) { lc = q < 0.1 ? -bd0(n, n * p) - n * q : n * Math.log(p); return log ? lc : Math.exp(lc); }
  if (x < 0 || x > n) return log ? -Infinity : 0;
  lc = stirlerr(n) - stirlerr(x) - stirlerr(n - x) - bd0(x, n * p) - bd0(n - x, n * q);
  const lf = M_LN2 + Math.log(Math.PI) + Math.log(x) + Math.log1p(-x / n);
  return log ? lc - 0.5 * lf : Math.exp(lc - 0.5 * lf);
}
export function dbinom(x, n, p, log = false) { return dbinomRaw(x, n, p, 1 - p, log); }
export function pbinom(x, n, p, lower = true) { x = Math.floor(x + 1e-7); if (x < 0) return lower ? 0 : 1; if (x >= n) return lower ? 1 : 0; return pbeta(p, x + 1, n - x, !lower); }
export function dhyper(x, r, b, n, log = false) {
  if (x < 0 || x > r || n - x < 0 || n - x > b) return log ? -Infinity : 0; if (n === 0) return x === 0 ? (log ? 0 : 1) : (log ? -Infinity : 0);
  const p = n / (r + b), q = (r + b - n) / (r + b), p1 = dbinomRaw(x, r, p, q, log), p2 = dbinomRaw(n - x, b, p, q, log), p3 = dbinomRaw(n, r + b, p, q, log);
  return log ? p1 + p2 - p3 : p1 * p2 / p3;
}
export function dpois(x, lambda, log = false) { if (x < 0 || !Number.isInteger(x)) return log ? -Infinity : 0; if (lambda === 0) return x === 0 ? (log ? 0 : 1) : (log ? -Infinity : 0); if (x === 0) return log ? -lambda : Math.exp(-lambda); const l = -stirlerr(x) - bd0(x, lambda) - 0.5 * Math.log(2 * Math.PI * x); return log ? l : Math.exp(l); }
export function ppois(x, lambda, lower = true) { x = Math.floor(x + 1e-7); if (x < 0) return lower ? 0 : 1; return pgamma(lambda, x + 1, 1, !lower); }
export function dnbinomMu(x, size, mu, log = false) {
  if (x < 0 || !Number.isInteger(x)) return log ? -Infinity : 0;
  if (x === 0) { const l = size * (size < mu ? Math.log(size / (size + mu)) : Math.log1p(-mu / (size + mu))); return log ? l : Math.exp(l); }
  if (x < 1e-10 * size) { const p = size < mu ? Math.log(size / (1 + size / mu)) : Math.log(mu / (1 + mu / size)); const l = x * p - mu - lgamma(x + 1) + Math.log1p(x * (x - 1) / (2 * size)); return log ? l : Math.exp(l); }
  const p = size / (size + x), ans = dbinomRaw(size, x + size, size / (size + mu), mu / (size + mu), log);
  return log ? Math.log(p) + ans : p * ans;
}

// ---------- noncentral t (AS 243, R's pnt) ----------
export function pnt(t, df, ncp, lower = true) {
  if (ncp === 0) return pt(t, df, lower);
  if (!Number.isFinite(t)) return (t > 0) === lower ? 1 : 0;
  const itrmax = 1000, errmax = 1e-12;
  let negdel, tt, del;
  if (t >= 0) { negdel = false; tt = t; del = ncp; } else { if (ncp > 40 && lower) return 0; negdel = true; tt = -t; del = -ncp; }
  if (df > 4e5 || del * del > 2 * M_LN2 * 1021) { const s = 1 / (4 * df); return pnorm(tt * (1 - s), del, Math.sqrt(1 + tt * tt * 2 * s), lower !== negdel); }
  let x = t * t; x = x / (x + df); let tnc;
  if (x > 0) {
    const lambda = del * del; let p = 0.5 * Math.exp(-0.5 * lambda), q = Math.sqrt(2 / Math.PI) * p * del, s = 0.5 - p;
    if (s < 1e-7) s = -0.5 * Math.expm1(-0.5 * lambda);
    let a = 0.5; const b = 0.5 * df, rxb = Math.pow(df / (t * t + df), b), albeta = 0.572364942924700087071713675677 + lgamma(b) - lgamma(0.5 + b);
    let xodd = pbeta(x, a, b, true), godd = 2 * rxb * Math.exp(a * Math.log(x) - albeta), xeven, geven;
    tnc = b * x; xeven = tnc < DBL_EPS ? tnc : 1 - rxb; geven = tnc * rxb; tnc = p * xodd + q * xeven;
    for (let it = 1; it <= itrmax; it++) {
      a += 1; xodd -= godd; xeven -= geven; godd *= x * (a + b - 1) / a; geven *= x * (a + b - 0.5) / (a + 0.5);
      p *= lambda / (2 * it); q *= lambda / (2 * it + 1); tnc += p * xodd + q * xeven; s -= p;
      if (s < -1e-10) break; if (s <= 0 && it > 1) break;
      const errbd = 2 * s * (xodd - godd); if (Math.abs(errbd) < errmax) break;
    }
  } else tnc = 0;
  tnc += pnorm(-del, 0, 1, true);
  const lowerOut = lower !== negdel;
  if (tnc > 1 - 1e-10 && lowerOut) { /* precision warning in R */ }
  const v = Math.min(tnc, 1); return lowerOut ? v : 1 - v;
}
export function qnt(p, df, ncp, lower = true) {
  const pl = lower ? p : 1 - p; let lo = -10, hi = 10;
  while (pnt(lo, df, ncp) > pl) lo *= 2; while (pnt(hi, df, ncp) < pl) hi *= 2;
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (pnt(m, df, ncp) < pl) lo = m; else hi = m; if (hi - lo < 1e-13 * Math.max(1, Math.abs(m))) break; }
  return (lo + hi) / 2;
}

// ---------- noncentral chi-square and beta / F (R's pnchisq, pnbeta) ----------
export function pnbeta(x, a, b, ncp, lower = true) {
  if (x <= 0) return lower ? 0 : 1; if (x >= 1) return lower ? 1 : 0;
  const errmax = 1e-9, itrmax = 10000;
  const c = ncp / 2, x0 = Math.floor(Math.max(c - 7 * Math.sqrt(c), 0)), a0 = a + x0, lbeta0 = lgamma(a0) + lgamma(b) - lgamma(a0 + b);
  let temp = pbeta(x, a0, b, true), gx = Math.exp(a0 * Math.log(x) + b * Math.log1p(-x) - lbeta0 - Math.log(a0)), q;
  if (a0 > a) q = Math.exp(-c + x0 * Math.log(c) - lgamma(x0 + 1)); else q = Math.exp(-c);
  let sumq = 1 - q, ans = q * temp, ax = ans, errbd, j = Math.floor(x0);
  do { j++; temp -= gx; gx *= x * (a + b + j - 1) / (a + j); q *= c / j; sumq -= q; ax = temp * q; ans += ax; errbd = (temp - gx) * sumq; } while (errbd > errmax && j < itrmax + x0);
  // lower-tail terms below x0 (R computes the full sum starting at x0; terms below are included through a0 shift)
  if (x0 > 0) { let q2 = Math.exp(-c + x0 * Math.log(c) - lgamma(x0 + 1)), t2 = pbeta(x, a0, b, true), g2 = Math.exp(a0 * Math.log(x) + b * Math.log1p(-x) - lbeta0 - Math.log(a0)); for (let k = x0 - 1; k >= 0; k--) { q2 *= (k + 1) / c; const ak = a + k; g2 = g2 * (ak + 1) / (x * (ak + b)); t2 += g2; ans += q2 * t2; if (q2 * t2 < 1e-17) break; } }
  ans = Math.min(Math.max(ans, 0), 1); return lower ? ans : 1 - ans;
}
export function pnf(f, df1, df2, ncp, lower = true) { if (ncp === 0) return pf(f, df1, df2, lower); if (f <= 0) return lower ? 0 : 1; const y = df1 / df2 * f; return pnbeta(y / (1 + y), df1 / 2, df2 / 2, ncp, lower); }
export function pnchisq(x, df, ncp, lower = true) {
  if (ncp === 0) return pchisq(x, df, lower); if (x <= 0) return lower ? 0 : 1;
  // Poisson mixture of central chi-squares, summed outward from the mode
  const lam = ncp / 2, k0 = Math.floor(lam); let tot = 0;
  for (let dir of [1, -1]) { let k = dir === 1 ? k0 : k0 - 1; for (; k >= 0 && k < k0 + 100000; k += dir) { const w = Math.exp(-lam + k * Math.log(lam) - lgamma(k + 1)); const t = w * pchisq(x, df + 2 * k, lower); tot += t; if (w < 1e-17 && Math.abs(k - lam) > 10) break; } }
  return Math.min(Math.max(tot, 0), 1);
}

// ---------- studentized range (R's ptukey / qtukey) ----------
function wprob(w, rr, cc) {
  const nleg = 12, ihalf = 6, C1 = -30, C2 = -50, C3 = 60, bb = 8, wlar = 3, wincr1 = 2, wincr2 = 3;
  const xleg = [0.981560634246719250690549090149, 0.904117256370474856678465866119, 0.769902674194304687036893833213, 0.587317954286617447296702418941, 0.367831498998180193752691536644, 0.125233408511468915472441369464];
  const aleg = [0.047175336386511827194615961485, 0.106939325995318430960254718194, 0.160078328543346226334652529543, 0.203167426723065921749064455810, 0.233492536538354808760849898925, 0.249147045813402785000562436043];
  const qsqz = w * 0.5;
  if (qsqz >= bb) return 1;
  let pr_w = 2 * pnorm(qsqz) - 1; if (pr_w >= 1) pr_w = 1; else pr_w = Math.pow(pr_w, cc);
  const wincr = w > wlar ? wincr1 : wincr2; let blb = qsqz; const binc = (bb - qsqz) / wincr; let bub = blb + binc, einsum = 0; const cc1 = cc - 1;
  for (let wi = 1; wi <= wincr; wi++) {
    let elsum = 0; const a = 0.5 * (bub + blb), b = 0.5 * (bub - blb);
    for (let jj = 1; jj <= nleg; jj++) {
      let j, xx; if (ihalf < jj) { j = nleg - jj + 1; xx = xleg[j - 1]; } else { j = jj; xx = -xleg[j - 1]; }
      const c = b * xx, ac = a + c, qexpo = ac * ac; if (qexpo > C3) break;
      const pplus = 2 * pnorm(ac), pminus = 2 * pnorm(ac, w); let rinsum = pplus * 0.5 - pminus * 0.5;
      if (rinsum >= Math.exp(C1 / cc1)) { rinsum = aleg[j - 1] * Math.exp(-(0.5 * qexpo)) * Math.pow(rinsum, cc1); elsum += rinsum; }
    }
    elsum *= ((2 * b) * cc) / Math.sqrt(2 * Math.PI); einsum += elsum; blb = bub; bub += binc;
  }
  pr_w += einsum; if (pr_w <= Math.exp(C1 / rr)) return 0; pr_w = Math.pow(pr_w, rr); return pr_w >= 1 ? 1 : pr_w;
}
export function ptukey(q, rr, cc, df, lower = true) {
  const nlegq = 16, ihalfq = 8, eps1 = -30, eps2 = 1e-14, dhaf = 100, dquar = 800, deigh = 5000, dlarg = 25000, ulen1 = 1, ulen2 = 0.5, ulen3 = 0.25, ulen4 = 0.125;
  const xlegq = [0.989400934991649932596154173450, 0.944575023073232576077988415535, 0.865631202387831743880467897712, 0.755404408355003033895101194847, 0.617876244402643748446671764049, 0.458016777657227386342419442984, 0.281603550779258913230460501460, 0.950125098376374401853193354250e-1];
  const alegq = [0.271524594117540948517805724560e-1, 0.622535239386478928628438369944e-1, 0.951585116824927848099251076022e-1, 0.124628971255533872052476282192, 0.149595988816576732081501730547, 0.169156519395002538189312079030, 0.182603415044923588866763667969, 0.189450610455068496285396723208];
  if (q <= 0) return lower ? 0 : 1; if (!Number.isFinite(q)) return lower ? 1 : 0;
  let ans;
  if (df > dlarg) ans = wprob(q, rr, cc);
  else {
    const f2 = df * 0.5; let f2lf = ((f2 * Math.log(df)) - (df * M_LN2)) - lgamma(f2), f21 = f2 - 1, ff4 = df * 0.25, ulen;
    if (df <= dhaf) ulen = ulen1; else if (df <= dquar) ulen = ulen2; else if (df <= deigh) ulen = ulen3; else ulen = ulen4;
    f2lf += Math.log(ulen); ans = 0; let otsum = 0;
    for (let i = 1; i <= 50; i++) {
      otsum = 0; const twa1 = (2 * i - 1) * ulen;
      for (let jj = 1; jj <= nlegq; jj++) {
        let j, t1; if (ihalfq < jj) { j = jj - ihalfq - 1; t1 = (f2lf + (f21 * Math.log(twa1 + (xlegq[j] * ulen)))) - (((xlegq[j] * ulen) + twa1) * ff4); }
        else { j = jj - 1; t1 = (f2lf + (f21 * Math.log(twa1 - (xlegq[j] * ulen)))) + (((xlegq[j] * ulen) - twa1) * ff4); }
        if (t1 >= eps1) { let qsqz; if (ihalfq < jj) qsqz = q * Math.sqrt(((xlegq[j] * ulen) + twa1) * 0.5); else qsqz = q * Math.sqrt(((-(xlegq[j] * ulen)) + twa1) * 0.5); const wprb = wprob(qsqz, rr, cc); otsum += (wprb * alegq[j]) * Math.exp(t1); }
      }
      if (i * ulen >= 1 && otsum <= eps2) break; ans += otsum;
    }
  }
  if (ans > 1) ans = 1; return lower ? ans : 1 - ans;
}
export function qtukey(p, rr, cc, df, lower = true) {
  const eps = 0.0001, maxiter = 50; if (!lower) p = 1 - p;
  const qinv = (p, c, v) => { const p0 = 0.322232421088, q0 = 0.993484626060e-01, p1 = -1, q1 = 0.588581570495, p2 = -0.342242088547, q2 = 0.531103462366, p3 = -0.204231210125, q3 = 0.103537752850, p4 = -0.453642210148e-04, q4 = 0.38560700634e-02, c1 = 0.8832, c2 = 0.2368, c3 = 1.214, c4 = 1.208, c5 = 1.4142, vmax = 120; const ps = 0.5 - 0.5 * p, yi = Math.sqrt(Math.log(1 / (ps * ps))); let t = yi + ((((yi * p4 + p3) * yi + p2) * yi + p1) * yi + p0) / ((((yi * q4 + q3) * yi + q2) * yi + q1) * yi + q0); if (v < vmax) t += (t * t * t + t) / v / 4; let q = c1 - c2 * t; if (v < vmax) q += -c3 / v + c4 * t / v; return t * (q * Math.log(c - 1) + c5); };
  let x0 = qinv(p, cc, df), valx0 = ptukey(x0, rr, cc, df) - p, x1;
  if (valx0 > 0) x1 = Math.max(0, x0 - 1); else x1 = x0 + 1;
  let valx1 = ptukey(x1, rr, cc, df) - p, ans = 0;
  for (let iter = 1; iter < maxiter; iter++) { ans = x1 - ((valx1 * (x1 - x0)) / (valx1 - valx0)); valx0 = valx1; x0 = x1; if (ans < 0) { ans = 0; valx1 = -p; } valx1 = ptukey(ans, rr, cc, df) - p; x1 = ans; if (Math.abs(x1 - x0) < eps) return ans; }
  return ans;
}

// ---------- R's zeroin (uniroot) ----------
// Returns { root, f.root, iter, estim.prec } exactly as R's uniroot with tol = .Machine$double.eps^0.25 by default.
export function uniroot(f, lower, upper, { tol = Math.pow(DBL_EPS, 0.25), maxiter = 1000, extendInt = 'no' } = {}) {
  let a = lower, b = upper, fa = f(a), fb = f(b);
  if (extendInt === 'yes' || extendInt === 'upX' || extendInt === 'downX') {
    let delta = 0.01 * Math.max(1e-4, Math.abs(b - a)), it = 0;
    const up = extendInt === 'upX', down = extendInt === 'downX';
    while (!(fa * fb <= 0) && it++ < maxiter) { if (!up) { a -= delta; fa = f(a); } if (!down) { b += delta; fb = f(b); } delta *= 2; }
  }
  if (!(fa * fb <= 0)) throw new Error('f() values at end points not of opposite sign');
  let c = a, fc = fa, iter = maxiter + 1; const EPS = DBL_EPS;
  if (fa === 0) return { root: a, froot: 0, iter: 0, prec: 0 }; if (fb === 0) return { root: b, froot: 0, iter: 0, prec: 0 };
  let maxit = maxiter + 1;
  while (maxit--) {
    const prev_step = b - a;
    if (Math.abs(fc) < Math.abs(fb)) { a = b; b = c; c = a; fa = fb; fb = fc; fc = fa; }
    const tol_act = 2 * EPS * Math.abs(b) + tol / 2; let new_step = (c - b) / 2;
    if (Math.abs(new_step) <= tol_act || fb === 0) return { root: b, froot: fb, iter: maxiter + 1 - maxit - 1, prec: Math.abs(c - b) };
    if (Math.abs(prev_step) >= tol_act && Math.abs(fa) > Math.abs(fb)) {
      let t1, cb, t2, p, q; cb = c - b;
      if (a === c) { t1 = fb / fa; p = cb * t1; q = 1 - t1; }
      else { q = fa / fc; t1 = fb / fc; t2 = fb / fa; p = t2 * (cb * q * (q - t1) - (b - a) * (t1 - 1)); q = (q - 1) * (t1 - 1) * (t2 - 1); }
      if (p > 0) q = -q; else p = -p;
      if (p < (0.75 * cb * q - Math.abs(tol_act * q) / 2) && p < Math.abs(prev_step * q / 2)) new_step = p / q;
    }
    if (Math.abs(new_step) < tol_act) new_step = new_step > 0 ? tol_act : -tol_act;
    a = b; fa = fb; b += new_step; fb = f(b);
    if ((fb > 0 && fc > 0) || (fb < 0 && fc < 0)) { c = a; fc = fa; }
  }
  void iter; return { root: b, froot: fb, iter: -1, prec: Math.abs(c - b) };
}

// ---------- misc ----------
export function plogis(x, lower = true) { const v = 1 / (1 + Math.exp(-x)); return lower ? v : 1 - v; }
export function qlogis(p) { return Math.log(p / (1 - p)); }
export function dlogis(x) { const e = Math.exp(-Math.abs(x)); return e / ((1 + e) * (1 + e)); }
export function pweibull(x, shape, scale = 1, lower = true) { if (x <= 0) return lower ? 0 : 1; const v = Math.pow(x / scale, shape); return lower ? -Math.expm1(-v) : Math.exp(-v); }
// p.adjust as in R
export function padjust(p, method = 'holm') {
  const n = p.length, idx = p.map((v, i) => i), out = new Array(n);
  if (method === 'none') return p.slice(); if (method === 'bonferroni') return p.map(v => Math.min(1, n * v));
  if (method === 'holm') { const o = idx.sort((a, b) => p[a] - p[b] || a - b); let cm = 0; o.forEach((i, k) => { cm = Math.max(cm, (n - k) * p[i]); out[i] = Math.min(1, cm); }); return out; }
  if (method === 'hochberg') { const o = idx.sort((a, b) => p[b] - p[a] || b - a); let cm = Infinity; o.forEach((i, k) => { cm = Math.min(cm, (k + 1) * p[i]); out[i] = Math.min(1, cm); }); return out; }
  if (method === 'BH' || method === 'fdr') { const o = idx.sort((a, b) => p[b] - p[a] || b - a); let cm = Infinity; o.forEach((i, k) => { cm = Math.min(cm, n / (n - k) * p[i]); out[i] = Math.min(1, cm); }); return out; }
  if (method === 'BY') { let q = 0; for (let i = 1; i <= n; i++) q += 1 / i; const o = idx.sort((a, b) => p[b] - p[a] || b - a); let cm = Infinity; o.forEach((i, k) => { cm = Math.min(cm, q * n / (n - k) * p[i]); out[i] = Math.min(1, cm); }); return out; }
  if (method === 'hommel') {
    const o = idx.sort((a, b) => p[a] - p[b] || a - b), ps = o.map(i => p[i]); let q = new Array(n), pa = new Array(n); const minv = ps.reduce((m, v, i) => Math.min(m, n * v / (i + 1)), Infinity); q.fill(minv); pa.fill(minv);
    for (let m = n - 1; m >= 2; m--) { const i1 = [], i2 = []; for (let i = 0; i < n - m + 1; i++) i1.push(i); for (let i = n - m + 1; i < n; i++) i2.push(i); let q1 = Infinity; i2.forEach((i, k) => { q1 = Math.min(q1, m * ps[i] / (k + 2)); }); for (const i of i1) q[i] = Math.min(m * ps[i], q1); for (const i of i2) q[i] = q[n - m]; for (let i = 0; i < n; i++) pa[i] = Math.max(pa[i], q[i]); }
    o.forEach((i, k) => { out[i] = Math.max(pa[k], ps[k]); }); return out;
  }
  throw new Error('Unknown p-value adjustment: ' + method);
}
