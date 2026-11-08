/* ============================================================
   Dashboards — shared helpers (no dependencies, works offline)
   - EN/ES language switch, remembered in this browser
   - small DOM + formatting helpers
   ============================================================ */
(function () {
  'use strict';

  const KEY = 'dashboards-lang';
  function readLang() {
    try { const v = localStorage.getItem(KEY); if (v === 'en' || v === 'es') return v; } catch (e) {}
    const nav = (navigator.language || 'en').toLowerCase();
    return nav.startsWith('es') ? 'es' : 'en';
  }
  function saveLang(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  const listeners = [];
  const Dash = {
    lang: readLang(),
    dict: { en: {}, es: {} },

    /** Add page strings: Dash.strings({ en: {...}, es: {...} }) */
    strings(d) {
      Object.assign(this.dict.en, d.en || {});
      Object.assign(this.dict.es, d.es || {});
    },
    /** Translate a key; {name} placeholders are filled from vars. */
    t(key, vars) {
      let s = (this.dict[this.lang] && this.dict[this.lang][key]);
      if (s == null) s = this.dict.en[key];
      if (s == null) s = key;
      if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
      return s;
    },
    setLang(v) {
      if (v !== 'en' && v !== 'es') return;
      this.lang = v; saveLang(v);
      document.documentElement.lang = v;
      this.applyStatic();
      listeners.forEach((fn) => fn(v));
    },
    onLang(fn) { listeners.push(fn); },

    /** Fill every [data-i18n] element's text, and [data-i18n-attr="attr:key"]. */
    applyStatic() {
      document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = this.t(el.dataset.i18n); });
      document.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = this.t(el.dataset.i18nHtml); });
      document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
        el.dataset.i18nAttr.split(';').forEach((pair) => {
          const [attr, key] = pair.split(':');
          if (attr && key) el.setAttribute(attr.trim(), this.t(key.trim()));
        });
      });
      document.querySelectorAll('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === this.lang)));
    },

    /* ---- DOM helpers ---- */
    $(sel, root) { return (root || document).querySelector(sel); },
    $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); },
    el(tag, attrs, children) {
      const e = document.createElement(tag);
      if (attrs) for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'text') e.textContent = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
        else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? '' : v);
      }
      (children || []).forEach((c) => { if (c != null) e.append(c.nodeType ? c : document.createTextNode(String(c))); });
      return e;
    },
    svg(tag, attrs) {
      const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
      if (attrs) for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
      return e;
    },
    esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },

    /* ---- numbers ---- */
    num(v, d) {
      if (v == null || !isFinite(v)) return '—';
      return Number(v).toLocaleString(this.lang === 'es' ? 'es-MX' : 'en-US', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
    },

    /* ---- tooltip ---- */
    tip: null,
    showTip(html, x, y) {
      if (!this.tip) { this.tip = this.el('div', { class: 'tip', role: 'tooltip' }); document.body.append(this.tip); }
      this.tip.innerHTML = html;
      this.tip.style.display = 'block';
      const r = this.tip.getBoundingClientRect();
      let left = x + 14, top = y + 14;
      if (left + r.width > window.innerWidth - 8) left = x - r.width - 14;
      if (top + r.height > window.innerHeight - 8) top = y - r.height - 14;
      this.tip.style.left = Math.max(8, left) + 'px';
      this.tip.style.top = Math.max(8, top) + 'px';
    },
    hideTip() { if (this.tip) this.tip.style.display = 'none'; },

    /* ---- CSV ---- */
    parseCSV(text) {
      // RFC-4180-ish: handles quoted fields with commas, quotes and newlines.
      const rows = []; let row = []; let f = ''; let q = false;
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (q) {
          if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
          else f += c;
        } else if (c === '"') q = true;
        else if (c === ',') { row.push(f); f = ''; }
        else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
        else if (c !== '\r') f += c;
      }
      if (f !== '' || row.length) { row.push(f); rows.push(row); }
      return rows;
    },
    download(name, text) {
      const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
      const a = this.el('a', { href: URL.createObjectURL(blob), download: name });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
  };

  window.Dash = Dash;
  document.addEventListener('DOMContentLoaded', () => {
    document.documentElement.lang = Dash.lang;
    document.querySelectorAll('.lang button').forEach((b) => b.addEventListener('click', () => Dash.setLang(b.dataset.lang)));
    Dash.applyStatic();
  });
})();
