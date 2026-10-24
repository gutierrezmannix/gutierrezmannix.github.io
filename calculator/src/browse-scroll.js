  // GM26 scrolling browser begin
  browseIndex() {
    const raw = this._raw, mask = this.conds().length ? this.mask() : null;
    const old = this._browseIndex;
    if (old && old.raw === raw && old.n === raw.n && old.mask === mask) return old;
    let rows = null;
    if (mask) {
      let count = 0; for (let i = 0; i < raw.n; i++) if (mask[i]) count++;
      rows = new Uint32Array(count);
      for (let i = 0, j = 0; i < raw.n; i++) if (mask[i]) rows[j++] = i;
    }
    return this._browseIndex = { raw, n: raw.n, mask, rows, count: rows ? rows.length : raw.n };
  }
  browseWindow(count, cols, top, left, height, width) {
    const rh = 34, hh = 36, cw = 128, nw = 76;
    const bodyH = Math.max(1, height - hh), logicalH = count * rh;
    // Browsers limit element height. Compress only the scrollbar for huge files.
    const physicalH = Math.min(logicalH, 8000000);
    const maxTop = Math.max(0, physicalH - bodyH), maxLogical = Math.max(0, logicalH - bodyH);
    top = Math.max(0, Math.min(top, maxTop));
    const logical = maxTop ? top * maxLogical / maxTop : 0;
    const first = Math.max(0, Math.floor(logical / rh) - 4);
    const end = Math.min(count, Math.ceil((logical + bodyH) / rh) + 4);
    const colFirst = Math.max(0, Math.floor(Math.max(0, left) / cw) - 2);
    const colEnd = Math.min(cols, Math.ceil((left + width - nw) / cw) + 2);
    return { rh, hh, cw, nw, first, end, colFirst: Math.min(colFirst, cols), colEnd,
      top, logical, maxTop, maxLogical, height: hh + physicalH, width: nw + cols * cw };
  }
  browseSaveDraft() {
    const d = this._browseDraft;
    this._browseDraft = null;
    if (d && this._raw === d.raw && d.r < d.raw.n && d.idx < d.raw.cols.length) {
      const col = d.raw.cols[d.idx], v = col.a[d.r], t = String(d.value).trim();
      const same = col.k === 'n' ? ((t === '' || t === '.') ? !Number.isFinite(v) : Number(t) === v) : String(v == null ? '' : v) === t;
      if (!same) this.commitCell(d.r, d.idx, d.value);
    }
  }
  browseAfterUpdate() {
    const el = this._browseEl;
    if (!el || this.state.tab !== 'browse' || this.state.browseMode === 'vars') return;
    // Existing "show in Browse" actions and old sessions still select their target.
    const target = [this.state.bRow || 0, this.state.bCol || 0].join(':');
    if (target !== this._browseTarget) {
      this._browseTarget = target;
      const g = this._browseGeometry;
      if (g) {
        el.scrollTop = g.maxLogical ? Math.min(g.maxTop, (this.state.bRow || 0) * g.rh * g.maxTop / g.maxLogical) : 0;
        el.scrollLeft = Math.max(0, (this.state.bCol || 0) * g.cw);
        this.browseSchedule();
      }
    }
    const size = el.clientWidth + ':' + el.clientHeight;
    if (size !== this._browseSize) { this._browseSize = size; this.browseSchedule(); }
  }
  browseSchedule() {
    if (this._browseFrame != null) return;
    this._browseFrame = requestAnimationFrame(() => {
      this._browseFrame = null;
      const el = this._browseEl;
      if (!el || this.state.tab !== 'browse' || this.state.browseMode === 'vars') return;
      this._browsePosition = { top: el.scrollTop, left: el.scrollLeft };
      const g = this.browseWindow(this.browseIndex().count, this._browseColumns.length, el.scrollTop, el.scrollLeft, el.clientHeight, el.clientWidth);
      const d = this._browseDraft;
      if (d && (d.pos < g.first || d.pos >= g.end || d.col < g.colFirst || d.col >= g.colEnd)) this.browseSaveDraft();
      this.forceUpdate();
    });
  }
  browseMove(pos, col) {
    const ix = this.browseIndex(), cols = this._browseColumns, el = this._browseEl, g = this._browseGeometry;
    if (!el || !g || pos < 0 || pos >= ix.count || col < 0 || col >= cols.length) return false;
    this.browseSaveDraft();
    const r = ix.rows ? ix.rows[pos] : pos;
    this._focusNext = r + ':' + cols[col].idx;
    const bodyH = Math.max(1, el.clientHeight - g.hh);
    let y = g.logical;
    if (pos * g.rh < y) y = pos * g.rh;
    if ((pos + 1) * g.rh > y + bodyH) y = (pos + 1) * g.rh - bodyH;
    el.scrollTop = g.maxLogical ? y * g.maxTop / g.maxLogical : 0;
    if (col * g.cw < el.scrollLeft) el.scrollLeft = col * g.cw;
    if ((col + 1) * g.cw > el.scrollLeft + el.clientWidth - g.nw) el.scrollLeft = (col + 1) * g.cw - el.clientWidth + g.nw;
    this.browseSchedule();
    return true;
  }
  browseScrollVals(out, columns) {
    const R = React, h = R.createElement, raw = this._raw, ix = this.browseIndex(), S = this.state;
    this._browseColumns = columns;
    if (this._browseRaw !== raw || this._browseFilter !== this.filterSig()) {
      this._browseRaw = raw; this._browseFilter = this.filterSig(); this._browseTarget = null; this._browsePosition = { top: 0, left: 0 };
      if (this._browseEl) { this._browseEl.scrollTop = 0; this._browseEl.scrollLeft = 0; }
    }
    const el = this._browseEl;
    const g = this._browseGeometry = this.browseWindow(ix.count, columns.length, el ? el.scrollTop : 0, el ? el.scrollLeft : 0, el ? el.clientHeight : 480, el ? el.clientWidth : 800);
    const visible = columns.slice(g.colFirst, g.colEnd), nodes = [], headers = [];
    for (let ci = g.colFirst; ci < g.colEnd; ci++) {
      const c = columns[ci];
      headers.push(h('button', { key: c.name, role: 'columnheader', 'aria-colindex': ci + 2, title: 'Edit ' + c.name + ' in Data', style: { left: g.nw + ci * g.cw }, onClick: () => { this.browseSaveDraft(); this.openColPanel(c.name); this.setState({ tab: 'data' }); } }, c.name));
    }
    nodes.push(h('div', { key: 'head', role: 'row', 'aria-rowindex': 1, className: 'mf-browse-head' }, h('div', { className: 'mf-browse-number', role: 'columnheader' }, 'Row'), ...headers));
    for (let pos = g.first; pos < g.end; pos++) {
      const r = ix.rows ? ix.rows[pos] : pos;
      const cells = visible.map((c, k) => {
        const ci = g.colFirst + k, col = raw.cols[c.idx], v = col.a[r], num = col.k === 'n';
        const missing = num ? !Number.isFinite(v) : v == null || v === '';
        const value = missing ? '' : num ? this.numberText(v) : String(v), ck = r + ':' + c.idx;
        const label = !missing && num && raw.vlabs && raw.vlabs[c.name] ? raw.vlabs[c.name].get(v) : '';
        const draft = this._browseDraft;
        return h('input', { key: ck + '|' + (S.dver || 0), className: 'mf-browse-cell', 'data-ck': ck,
          'aria-label': c.name + ', row ' + (r + 1), 'aria-colindex': ci + 2,
          defaultValue: draft && draft.ck === ck ? draft.value : value, placeholder: missing ? '.' : undefined,
          title: label ? value + ' — ' + label : value, spellCheck: false,
          style: { left: g.nw + ci * g.cw, textAlign: num ? 'right' : 'left', color: !num ? 'var(--cB0342C, #B0342C)' : label ? 'var(--c194F39, #1D5443)' : undefined },
          onFocus: e => { this._browseDraft = { ck, raw, r, idx: c.idx, pos, col: ci, value: e.target.value }; },
          onChange: e => { this._browseDraft = { ck, raw, r, idx: c.idx, pos, col: ci, value: e.target.value }; },
          onBlur: () => { if (this._browseDraft && this._browseDraft.ck === ck) this.browseSaveDraft(); },
          onKeyDown: e => {
            if (e.key === 'Escape') { this._browseDraft = null; e.target.value = value; e.target.blur(); return; }
            let row = pos, column = ci;
            if (e.key === 'Enter' || e.key === 'ArrowDown') row += e.shiftKey && e.key === 'Enter' ? -1 : 1;
            else if (e.key === 'ArrowUp') row--;
            else if (e.key === 'Tab') { column += e.shiftKey ? -1 : 1; if (column >= columns.length) { column = 0; row++; } if (column < 0) { column = columns.length - 1; row--; } }
            else return;
            if (row >= 0 && row < ix.count && column >= 0 && column < columns.length) { e.preventDefault(); this.browseMove(row, column); }
          }
        });
      });
      nodes.push(h('div', { key: 'row-' + r, className: 'mf-browse-row', role: 'row', 'aria-rowindex': pos + 2,
        style: { top: g.hh + g.top + pos * g.rh - g.logical } },
        h('div', { className: 'mf-browse-number', role: 'rowheader' }, String(r + 1)), ...cells));
    }
    if (!ix.count || !columns.length) nodes.push(h('div', { key: 'empty', className: 'mf-browse-empty', role: 'status' }, !columns.length ? 'Your dataset has no visible variables. Create a variable in Data, or restore hidden variables.' : 'No rows match the current subgroup. Change or clear the subgroup to browse the data.'));
    if (!this._browseRef) this._browseRef = node => {
      if (this._browseEl === node) return;
      if (this._browseRO) { this._browseRO.disconnect(); this._browseRO = null; }
      if (this._browseEl) this._browsePosition = { top: this._browseEl.scrollTop, left: this._browseEl.scrollLeft };
      this._browseEl = node;
      if (node) {
        node.scrollTop = this._browsePosition ? this._browsePosition.top : 0;
        node.scrollLeft = this._browsePosition ? this._browsePosition.left : 0;
        if (typeof ResizeObserver !== 'undefined') { this._browseRO = new ResizeObserver(() => this.browseSchedule()); this._browseRO.observe(node); }
        this.browseSchedule();
      } else this.browseSaveDraft();
    };
    out.browseGridEl = h('div', { className: 'mf-browse-scroll', ref: this._browseRef, onScroll: () => this.browseSchedule(), tabIndex: 0, role: 'region', 'aria-label': 'Scrollable dataset. Scroll vertically for rows and horizontally for variables.' },
      h('div', { className: 'mf-browse-canvas', role: 'table', 'aria-label': 'Dataset', 'aria-rowcount': ix.count + 1, 'aria-colcount': columns.length + 1, style: { height: Math.max(g.height, 140), width: g.width } }, ...nodes));
    out.bNoVars = !columns.length; out.bShowAdd = !!S.bEdit || !columns.length;
    out.browseNote = (ix.count ? this.fmtN(ix.count) : '0') + ' ROWS' + (ix.mask ? ' IN SUBGROUP · ' + this.fmtN(raw.n) + ' TOTAL' : '') + ' × ' + columns.length + ' VARIABLES · SCROLL TO BROWSE · CLICK TO EDIT · ENTER ↓ · TAB → · SAVE AS CSV TO KEEP EDITS';
  }
  // GM26 scrolling browser end
