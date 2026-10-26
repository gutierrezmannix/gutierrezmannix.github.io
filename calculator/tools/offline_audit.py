"""Fixes from the offline audit of every tab (build 2026-10-25.32).

Each patch is idempotent: it is skipped when its replacement text is already present.
"""


def patch(text, old, new):
    if new in text:
        return text
    if text.count(old) != 1:
        raise RuntimeError('offline_audit: expected one anchor, found %d: %s' % (text.count(old), old[:90]))
    return text.replace(old, new)


def integrate_component(c):
    # The cached weight array follows the chosen weight variable, not only the filter (a weight set by svyset or
    # a restored session no longer reuses the previous weight).
    c = patch(c, "return this.memo('w|' + this.filterSig(),", "return this.memo('w|' + this.state.weightVar + '|' + this.filterSig(),")
    # The new-version check is skipped while the browser is offline (no failed request in the console).
    c = patch(c, "if (this._vcBusy || typeof fetch === 'undefined') return;", "if (this._vcBusy || typeof fetch === 'undefined' || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;")
    return c


def integrate_engine(e):
    # Stata 7–8 files (.dta formats 110–112, still written by R's foreign::write.dta): letter type codes in 110,
    # 12-byte formats and single missing values at the type maxima, otherwise the same layout as 113.
    e = patch(e, "  if (ver !== 113 && ver !== 114 && ver !== 115) throw new Error('unsupported .dta version (' + ver + '). Export as CSV or Stata 13+ instead.');",
              "  if (ver < 110 || ver > 115) throw new Error('unsupported .dta version (' + ver + '). Export as CSV or from Stata 7 or later instead.');\n  const old = ver < 113;")
    e = patch(e, "  const types = []; for (let i = 0; i < K; i++) types.push(u8[p + i]); p += K;\n  const rdA",
              "  const types = []; for (let i = 0; i < K; i++) types.push(u8[p + i]); p += K;\n  if (ver === 110) for (let i = 0; i < K; i++) { const t = types[i]; types[i] = { 98: 251, 105: 252, 108: 253, 102: 254, 100: 255 }[t] || (t >= 128 ? t - 127 : t); }\n  const rdA")
    e = patch(e, "  p += (ver === 113 ? 12 : 49) * K;", "  p += (ver <= 113 ? 12 : 49) * K;")
    e = patch(e, "        else if (t === 253) { const v = dv.getInt32(q, le); cols[c].a[r] = v > 2147483620 ? NaN : v; }\n        else if (t === 252) { const v = dv.getInt16(q, le); cols[c].a[r] = v > 32740 ? NaN : v; }\n        else if (t === 251) { const v = dv.getInt8(q); cols[c].a[r] = v > 100 ? NaN : v; }",
              "        else if (t === 253) { const v = dv.getInt32(q, le); cols[c].a[r] = v > (old ? 2147483646 : 2147483620) ? NaN : v; }\n        else if (t === 252) { const v = dv.getInt16(q, le); cols[c].a[r] = v > (old ? 32766 : 32740) ? NaN : v; }\n        else if (t === 251) { const v = dv.getInt8(q); cols[c].a[r] = v > (old ? 126 : 100) ? NaN : v; }")
    return e
