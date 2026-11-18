/* @ds-bundle: {"format":4,"namespace":"CS","components":[{"name":"Wordmark"},{"name":"NetworkBar"},{"name":"SiteFooter"},{"name":"ArtifactCard"},{"name":"ReportHeader"},{"name":"Prose"},{"name":"Toc"},{"name":"Callout"},{"name":"Quote"},{"name":"References"},{"name":"Figure"},{"name":"DataTable"},{"name":"Legend"},{"name":"LineChart"},{"name":"BarChart"},{"name":"LikertChart"},{"name":"StatTile"},{"name":"SampleNote"},{"name":"Button"},{"name":"Select"},{"name":"SegmentedControl"},{"name":"FilterBar"},{"name":"Disclosure"},{"name":"Badge"},{"name":"Icon"},{"name":"CodeBlock"},{"name":"TextInput"}]} */
/* ciencia.social. Funciona sem React: CS.theme e CS.charts são JavaScript puro.
   Os componentes React geram exatamente as mesmas classes de bundle.css. */
(function () {
  'use strict';
  var HOME = 'https://ciencia.social';
  var h = function () { return window.React.createElement.apply(null, arguments); };
  var cx = function () { return Array.prototype.filter.call(arguments, Boolean).join(' '); };
  var rest = function (o, keys) { var r = {}; for (var k in o) if (keys.indexOf(k) < 0) r[k] = o[k]; return r; };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  /* Números no formato pt-BR. format: 'percent' | 'number' | função */
  var NF = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
  function fmt(v, format) {
    if (v === null || v === undefined || isNaN(v)) return 's/d';
    if (typeof format === 'function') return format(v);
    return NF.format(v) + (format === 'percent' ? '%' : '');
  }

  /* Tema */
  var THEME_KEY = 'cs-tema';
  var theme = {
    get: function () { return document.documentElement.getAttribute('data-theme') || 'light'; },
    set: function (t, persist) {
      document.documentElement.setAttribute('data-theme', t);
      if (persist !== false) { try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* armazenamento bloqueado */ } }
      var btns = document.querySelectorAll('[data-cs-theme-toggle]:not([data-cs-react])');
      for (var i = 0; i < btns.length; i++) btns[i].innerHTML = iconSVG(t === 'dark' ? 'sun' : 'moon') + '<span>' + (t === 'dark' ? 'Tema claro' : 'Tema escuro') + '</span>';
      try { document.dispatchEvent(new CustomEvent('cs-tema', { detail: t })); } catch (e) { /* navegador antigo */ }
    },
    toggle: function () { theme.set(theme.get() === 'dark' ? 'light' : 'dark'); },
    /* Chame uma vez por página. Respeita a escolha salva, depois o padrão do artefato (opts.padrao),
       depois o sistema; imprime sempre no claro. */
    init: function (opts) {
      opts = opts || {};
      var saved = null; try { saved = localStorage.getItem(THEME_KEY); } catch (e) { /* idem */ }
      var dark = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
      theme.set(saved || opts.padrao || (dark ? 'dark' : 'light'), false);
      if (theme._ligado) return;
      theme._ligado = true;
      document.addEventListener('click', function (ev) {
        var b = ev.target.closest && ev.target.closest('[data-cs-theme-toggle]');
        if (b && !b.hasAttribute('data-cs-react')) theme.toggle();
      });
      var before = null;
      var opened = [];
      window.addEventListener('beforeprint', function () {
        before = theme.get(); theme.set('light', false);
        opened = Array.prototype.filter.call(document.querySelectorAll('details.cs-disclosure'), function (d) { return !d.open; });
        opened.forEach(function (d) { d.open = true; });
      });
      window.addEventListener('afterprint', function () {
        if (before) theme.set(before, false);
        opened.forEach(function (d) { d.open = false; });
      });
    }
  };

  /* Paleta resolvida, para Observable Plot, D3, ECharts etc. */
  function palette() {
    var cs = getComputedStyle(document.documentElement);
    var v = function (n) { return cs.getPropertyValue('--' + n).trim(); };
    var range = function (p, n) { var a = []; for (var i = 1; i <= n; i++) a.push(v(p + i)); return a; };
    return {
      categorical: range('data-', 8),
      sequential: range('seq-', 7),
      diverging: ['div-neg-2', 'div-neg-1', 'div-mid', 'div-pos-1', 'div-pos-2'].map(v),
      grid: v('line'), axis: v('line-strong'), text: v('ink-3'), ground: v('surface')
    };
  }

  /* Tooltip */
  function makeTip(el) {
    var t = document.createElement('div');
    t.className = 'cs-tooltip'; t.hidden = true; t.setAttribute('role', 'status');
    el.appendChild(t);
    return {
      show: function (html, x, y) {
        t.innerHTML = html; t.hidden = false;
        var w = t.offsetWidth, H = t.offsetHeight, W = el.clientWidth;
        var left = x + 14; if (left + w > W) left = Math.max(0, x - w - 14);
        t.style.left = left + 'px'; t.style.top = Math.max(0, y - H - 10) + 'px';
      },
      hide: function () { t.hidden = true; }
    };
  }
  function legendHTML(items, line) {
    return '<ul class="cs-legend">' + items.map(function (i) {
      return '<li><span class="cs-legend__key' + (line ? ' cs-legend__key--line' : '') + '" style="background:' + i.color + '"></span>' + esc(i.label) + '</li>';
    }).join('') + '</ul>';
  }
  function dataColor(slot) { return 'var(--data-' + slot + ')'; }

  function niceTicks(lo, hi, n) {
    var span = hi - lo || 1, step = Math.pow(10, Math.floor(Math.log10(span / n))), err = span / n / step;
    if (err >= 7.5) step *= 10; else if (err >= 3) step *= 5; else if (err >= 1.5) step *= 2;
    var a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step, t = [];
    for (var v = a; v <= b + step / 2; v += step) t.push(+v.toFixed(6));
    return t;
  }

  /* Linha: 2px, pontas de 8px com anel, um único eixo, cruz e tooltip por ponteiro e teclado */
  function lineChart(el, o) {
    var series = (o.series || []).map(function (s, i) { return { name: s.name, values: s.values, color: dataColor(s.slot || i + 1) }; });
    var x = o.x || [], H = o.height || 280, active = -1, tip, ro, svgEl, lastW = 0;
    function render() {
      var W = el.clientWidth || 640; lastW = W;
      var all = []; series.forEach(function (s) { s.values.forEach(function (v) { if (v !== null && v !== undefined) all.push(v); }); });
      var lo = o.yMin !== undefined ? o.yMin : Math.min(0, Math.min.apply(null, all));
      var hi = o.yMax !== undefined ? o.yMax : Math.max.apply(null, all);
      var ticks = niceTicks(lo, hi, 4); lo = ticks[0]; hi = ticks[ticks.length - 1];
      var yl = Math.max.apply(null, ticks.map(function (t) { return fmt(t, o.format).length; }));
      var ml = 8 + yl * 7, mt = 10, mb = 26, last = x.length - 1;
      var y = function (v) { return mt + (H - mt - mb) * (1 - (v - lo) / (hi - lo)); };
      var ends = series.map(function (s) { var i = s.values.length - 1; while (i > 0 && s.values[i] == null) i--; return { s: s, v: s.values[i], i: i }; });
      var labels = series.length <= 4 && W >= 520, sorted, mr = 12;
      if (labels) {
        sorted = ends.slice().sort(function (a, b) { return y(a.v) - y(b.v); });
        for (var k = 1; k < sorted.length; k++) if (y(sorted[k].v) - y(sorted[k - 1].v) < 16) labels = false;
      }
      if (labels) mr = 16 + Math.max.apply(null, ends.map(function (e) { return (e.s.name + ' ' + fmt(e.v, o.format)).length; })) * 6.8;
      var px = function (i) { return ml + (W - ml - mr) * (last ? i / last : 0.5); };
      var every = Math.max(1, Math.ceil(x.length / Math.max(2, Math.floor((W - ml - mr) / 64))));
      var s = '<svg role="img" tabindex="0" aria-label="' + esc(o.ariaLabel || 'Gráfico de linhas') + '" viewBox="0 0 ' + W + ' ' + H + '" height="' + H + '">';
      ticks.forEach(function (t) {
        s += '<line class="' + (t === lo ? 'cs-chart__base' : 'cs-chart__grid') + '" x1="' + ml + '" x2="' + (W - mr) + '" y1="' + y(t) + '" y2="' + y(t) + '"/>';
        s += '<text x="' + (ml - 8) + '" y="' + (y(t) + 4) + '" text-anchor="end">' + esc(fmt(t, o.format)) + '</text>';
      });
      x.forEach(function (l, i) { if (i % every === 0 || i === last) s += '<text x="' + px(i) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(l) + '</text>'; });
      series.forEach(function (se) {
        var d = '', pen = false;
        se.values.forEach(function (v, i) { if (v === null || v === undefined) { pen = false; return; } d += (pen ? 'L' : 'M') + px(i).toFixed(1) + ' ' + y(v).toFixed(1); pen = true; });
        s += '<path class="cs-chart__line" d="' + d + '" style="stroke:' + se.color + '"/>';
      });
      ends.forEach(function (e) { s += '<circle class="cs-chart__dot" r="4" cx="' + px(e.i) + '" cy="' + y(e.v) + '" style="fill:' + e.s.color + '"/>'; });
      if (labels) ends.forEach(function (e) { s += '<text class="cs-chart__endlabel" x="' + (px(e.i) + 10) + '" y="' + (y(e.v) + 4) + '">' + esc(e.s.name) + ' ' + esc(fmt(e.v, o.format)) + '</text>'; });
      s += '<g class="cs-chart__hover"></g></svg>';
      el.innerHTML = (series.length > 1 ? legendHTML(series.map(function (q) { return { label: q.name, color: q.color }; }), true) : '') + s;
      el.classList.add('cs-chart');
      tip = makeTip(el);
      svgEl = el.querySelector('svg');
      var hover = svgEl.querySelector('.cs-chart__hover');
      function show(i) {
        active = i;
        var g = '<line class="cs-chart__cross" x1="' + px(i) + '" x2="' + px(i) + '" y1="' + mt + '" y2="' + (H - mb) + '"/>';
        var rows = series.map(function (q) { return { q: q, v: q.values[i] }; }).filter(function (r) { return r.v !== null && r.v !== undefined; }).sort(function (a, b) { return b.v - a.v; });
        rows.forEach(function (r) { g += '<circle class="cs-chart__dot" r="4" cx="' + px(i) + '" cy="' + y(r.v) + '" style="fill:' + r.q.color + '"/>'; });
        hover.innerHTML = g;
        var offset = svgEl.getBoundingClientRect().top - el.getBoundingClientRect().top;
        tip.show('<strong>' + esc(x[i]) + '</strong>' + rows.map(function (r) { return '<div class="cs-tooltip__row"><span class="cs-tooltip__key" style="background:' + r.q.color + '"></span>' + esc(r.q.name) + '<b>' + esc(fmt(r.v, o.format)) + '</b></div>'; }).join(''), px(i), offset + Math.min.apply(null, rows.map(function (r) { return y(r.v); }).concat(H)) );
      }
      function hide() { active = -1; hover.innerHTML = ''; tip.hide(); }
      svgEl.addEventListener('pointermove', function (ev) {
        var r = svgEl.getBoundingClientRect(), mx = (ev.clientX - r.left) * W / r.width;
        var i = Math.max(0, Math.min(last, Math.round((mx - ml) / ((W - ml - mr) / (last || 1)))));
        if (i !== active) show(i);
      });
      svgEl.addEventListener('pointerleave', hide);
      svgEl.addEventListener('blur', hide);
      svgEl.addEventListener('keydown', function (ev) {
        if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') { ev.preventDefault(); show(Math.max(0, Math.min(last, (active < 0 ? 0 : active) + (ev.key === 'ArrowRight' ? 1 : -1)))); }
        if (ev.key === 'Escape') hide();
      });
    }
    render();
    if (window.ResizeObserver) { ro = new ResizeObserver(function () { if (Math.abs(el.clientWidth - lastW) > 1) render(); }); ro.observe(el); }
    return { update: function (n) { o = n; series = (o.series || []).map(function (s, i) { return { name: s.name, values: s.values, color: dataColor(s.slot || i + 1) }; }); x = o.x || []; H = o.height || 280; render(); }, destroy: function () { if (ro) ro.disconnect(); el.innerHTML = ''; } };
  }

  /* Barras horizontais: HTML e CSS, sem medir nada. Um hue só, valor na ponta. */
  function barHTML(o) {
    var items = o.items || [], c = dataColor(o.slot || 1);
    var max = o.max !== undefined ? o.max : Math.max.apply(null, items.map(function (i) { return i.value; }));
    return '<div class="cs-bars"' + (o.ariaLabel ? ' role="group" aria-label="' + esc(o.ariaLabel) + '"' : '') + '>' + items.map(function (i) {
      var pct = max ? (i.value / max) * 82 : 0;
      return '<div class="cs-bars__label">' + esc(i.label) + '</div><div class="cs-bars__track"><div class="cs-bars__bar" style="width:' + pct.toFixed(2) + '%;background:' + c + '"></div><span class="cs-bars__value">' + esc(fmt(i.value, o.format)) + '</span></div>';
    }).join('') + '</div>';
  }
  function barChart(el, o) { el.innerHTML = barHTML(o); el.classList.add('cs-chart'); return { update: function (n) { el.innerHTML = barHTML(n); }, destroy: function () { el.innerHTML = ''; } }; }

  /* Likert: barras empilhadas divergentes, centradas no meio do ponto neutro */
  var LIKERT = ['neg-2', 'neg-1', 'mid', 'pos-1', 'pos-2'];
  var LIKERT_LABELS = ['Discordo totalmente', 'Discordo', 'Não concordo nem discordo', 'Concordo', 'Concordo totalmente'];
  function likertHTML(o) {
    var labels = o.levels || LIKERT_LABELS, rows = o.rows || [];
    var leftOf = function (v) { return v[0] + v[1] + v[2] / 2; }, rightOf = function (v) { return v[4] + v[3] + v[2] / 2; };
    var L = Math.max.apply(null, rows.map(function (r) { return leftOf(r.values); }));
    var R = Math.max.apply(null, rows.map(function (r) { return rightOf(r.values); }));
    var range = (L + R) || 1;
    var html = legendHTML(labels.map(function (l, i) { return { label: l, color: 'var(--div-' + LIKERT[i] + ')' }; }));
    html += '<div class="cs-likert">' + rows.map(function (r) {
      var offset = ((L - leftOf(r.values)) / range) * 100, total = r.values.reduce(function (a, b) { return a + b; }, 0);
      var segs = r.values.map(function (v, i) {
        if (!v) return '';
        var w = (v / total) * 100;
        var inside = (v / range) >= 0.07 ? esc(fmt(Math.round(v), o.format || 'percent')) : '';
        return '<span class="cs-likert__seg" tabindex="0" style="width:' + w.toFixed(3) + '%;background-color:var(--div-' + LIKERT[i] + ');color:var(--on-div-' + LIKERT[i] + ')" data-tip="' + esc(labels[i]) + '" data-val="' + esc(fmt(v, o.format || 'percent')) + '" aria-label="' + esc(labels[i] + ': ' + fmt(v, o.format || 'percent')) + '">' + inside + '</span>';
      }).join('');
      return '<div class="cs-likert__label">' + esc(r.label) + '</div><div class="cs-likert__track"><div class="cs-likert__zero" style="left:' + ((L / range) * 100).toFixed(3) + '%"></div><div class="cs-likert__row" style="left:' + offset.toFixed(3) + '%;width:' + ((total / range) * 100).toFixed(3) + '%">' + segs + '</div></div>';
    }).join('') + '</div>';
    return html;
  }
  function wireTips(el) {
    var tip = makeTip(el);
    function on(ev) {
      var t = ev.target.closest && ev.target.closest('[data-tip]'); if (!t) return tip.hide();
      var er = el.getBoundingClientRect(), tr = t.getBoundingClientRect();
      tip.show('<div class="cs-tooltip__row">' + esc(t.getAttribute('data-tip')) + '<b>' + esc(t.getAttribute('data-val')) + '</b></div>', tr.left - er.left + tr.width / 2, tr.top - er.top);
    }
    el.addEventListener('pointerover', on); el.addEventListener('focusin', on);
    el.addEventListener('pointerleave', function () { tip.hide(); }); el.addEventListener('focusout', function () { tip.hide(); });
  }
  function likertChart(el, o) { el.innerHTML = likertHTML(o); el.classList.add('cs-chart'); wireTips(el); return { update: function (n) { el.innerHTML = likertHTML(n); wireTips(el); }, destroy: function () { el.innerHTML = ''; } }; }

  var charts = { line: lineChart, bar: barChart, likert: likertChart, barHTML: barHTML, likertHTML: likertHTML, format: fmt };

  /* Ícones: Lucide 0.460.0 (ISC). Copyright (c) Lucide Contributors 2022; partes (c) Cole Bemis 2013-2022 (Feather, MIT).
     Só o desenho interno de cada ícone, em viewBox 24. */
  var ICONS = {
    "search": "<circle cx=\"11\" cy=\"11\" r=\"8\"/><path d=\"m21 21-4.3-4.3\"/>",
    "arrow-right": "<path d=\"M5 12h14\"/><path d=\"m12 5 7 7-7 7\"/>",
    "arrow-left": "<path d=\"m12 19-7-7 7-7\"/><path d=\"M19 12H5\"/>",
    "arrow-up-right": "<path d=\"M7 7h10v10\"/><path d=\"M7 17 17 7\"/>",
    "external-link": "<path d=\"M15 3h6v6\"/><path d=\"M10 14 21 3\"/><path d=\"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6\"/>",
    "copy": "<rect width=\"14\" height=\"14\" x=\"8\" y=\"8\" rx=\"2\" ry=\"2\"/><path d=\"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2\"/>",
    "check": "<path d=\"M20 6 9 17l-5-5\"/>",
    "sun": "<circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2\"/><path d=\"M12 20v2\"/><path d=\"m4.93 4.93 1.41 1.41\"/><path d=\"m17.66 17.66 1.41 1.41\"/><path d=\"M2 12h2\"/><path d=\"M20 12h2\"/><path d=\"m6.34 17.66-1.41 1.41\"/><path d=\"m19.07 4.93-1.41 1.41\"/>",
    "moon": "<path d=\"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z\"/>",
    "chevron-down": "<path d=\"m6 9 6 6 6-6\"/>",
    "chevron-right": "<path d=\"m9 18 6-6-6-6\"/>",
    "x": "<path d=\"M18 6 6 18\"/><path d=\"m6 6 12 12\"/>",
    "menu": "<line x1=\"4\" x2=\"20\" y1=\"12\" y2=\"12\"/><line x1=\"4\" x2=\"20\" y1=\"6\" y2=\"6\"/><line x1=\"4\" x2=\"20\" y1=\"18\" y2=\"18\"/>",
    "download": "<path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"/><polyline points=\"7 10 12 15 17 10\"/><line x1=\"12\" x2=\"12\" y1=\"15\" y2=\"3\"/>",
    "file-text": "<path d=\"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z\"/><path d=\"M14 2v4a2 2 0 0 0 2 2h4\"/><path d=\"M10 9H8\"/><path d=\"M16 13H8\"/><path d=\"M16 17H8\"/>",
    "file-json": "<path d=\"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z\"/><path d=\"M14 2v4a2 2 0 0 0 2 2h4\"/><path d=\"M10 12a1 1 0 0 0-1 1v1a1 1 0 0 1-1 1 1 1 0 0 1 1 1v1a1 1 0 0 0 1 1\"/><path d=\"M14 18a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1 1 1 0 0 1-1-1v-1a1 1 0 0 0-1-1\"/>",
    "book-open": "<path d=\"M12 7v14\"/><path d=\"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z\"/>",
    "code": "<polyline points=\"16 18 22 12 16 6\"/><polyline points=\"8 6 2 12 8 18\"/>",
    "terminal": "<polyline points=\"4 17 10 11 4 5\"/><line x1=\"12\" x2=\"20\" y1=\"19\" y2=\"19\"/>",
    "database": "<ellipse cx=\"12\" cy=\"5\" rx=\"9\" ry=\"3\"/><path d=\"M3 5V19A9 3 0 0 0 21 19V5\"/><path d=\"M3 12A9 3 0 0 0 21 12\"/>",
    "braces": "<path d=\"M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1\"/><path d=\"M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1\"/>",
    "list": "<path d=\"M3 12h.01\"/><path d=\"M3 18h.01\"/><path d=\"M3 6h.01\"/><path d=\"M8 12h13\"/><path d=\"M8 18h13\"/><path d=\"M8 6h13\"/>",
    "list-tree": "<path d=\"M21 12h-8\"/><path d=\"M21 6H8\"/><path d=\"M21 18h-8\"/><path d=\"M3 6v4c0 1.1.9 2 2 2h3\"/><path d=\"M3 10v6c0 1.1.9 2 2 2h3\"/>",
    "layers": "<path d=\"m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z\"/><path d=\"m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65\"/><path d=\"m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65\"/>",
    "network": "<rect x=\"16\" y=\"16\" width=\"6\" height=\"6\" rx=\"1\"/><rect x=\"2\" y=\"16\" width=\"6\" height=\"6\" rx=\"1\"/><rect x=\"9\" y=\"2\" width=\"6\" height=\"6\" rx=\"1\"/><path d=\"M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3\"/><path d=\"M12 12V8\"/>",
    "git-compare": "<circle cx=\"18\" cy=\"18\" r=\"3\"/><circle cx=\"6\" cy=\"6\" r=\"3\"/><path d=\"M13 6h3a2 2 0 0 1 2 2v7\"/><path d=\"M11 18H8a2 2 0 0 1-2-2V9\"/>",
    "briefcase": "<path d=\"M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16\"/><rect width=\"20\" height=\"14\" x=\"2\" y=\"6\" rx=\"2\"/>",
    "graduation-cap": "<path d=\"M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z\"/><path d=\"M22 10v6\"/><path d=\"M6 12.5V16a6 3 0 0 0 12 0v-3.5\"/>",
    "users": "<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"M22 21v-2a4 4 0 0 0-3-3.87\"/><path d=\"M16 3.13a4 4 0 0 1 0 7.75\"/>",
    "user": "<path d=\"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2\"/><circle cx=\"12\" cy=\"7\" r=\"4\"/>",
    "info": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16v-4\"/><path d=\"M12 8h.01\"/>",
    "triangle-alert": "<path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/>",
    "circle-help": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3\"/><path d=\"M12 17h.01\"/>",
    "filter": "<polygon points=\"22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3\"/>",
    "sliders-horizontal": "<line x1=\"21\" x2=\"14\" y1=\"4\" y2=\"4\"/><line x1=\"10\" x2=\"3\" y1=\"4\" y2=\"4\"/><line x1=\"21\" x2=\"12\" y1=\"12\" y2=\"12\"/><line x1=\"8\" x2=\"3\" y1=\"12\" y2=\"12\"/><line x1=\"21\" x2=\"16\" y1=\"20\" y2=\"20\"/><line x1=\"12\" x2=\"3\" y1=\"20\" y2=\"20\"/><line x1=\"14\" x2=\"14\" y1=\"2\" y2=\"6\"/><line x1=\"8\" x2=\"8\" y1=\"10\" y2=\"14\"/><line x1=\"16\" x2=\"16\" y1=\"18\" y2=\"22\"/>",
    "play": "<polygon points=\"6 3 20 12 6 21 6 3\"/>",
    "pause": "<rect x=\"14\" y=\"4\" width=\"4\" height=\"16\" rx=\"1\"/><rect x=\"6\" y=\"4\" width=\"4\" height=\"16\" rx=\"1\"/>",
    "link": "<path d=\"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71\"/><path d=\"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71\"/>",
    "message-square": "<path d=\"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z\"/>",
    "bot": "<path d=\"M12 8V4H8\"/><rect width=\"16\" height=\"12\" x=\"4\" y=\"8\" rx=\"2\"/><path d=\"M2 14h2\"/><path d=\"M20 14h2\"/><path d=\"M15 13v2\"/><path d=\"M9 13v2\"/>",
    "wrench": "<path d=\"M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z\"/>",
    "hash": "<line x1=\"4\" x2=\"20\" y1=\"9\" y2=\"9\"/><line x1=\"4\" x2=\"20\" y1=\"15\" y2=\"15\"/><line x1=\"10\" x2=\"8\" y1=\"3\" y2=\"21\"/><line x1=\"16\" x2=\"14\" y1=\"3\" y2=\"21\"/>",
    "table": "<path d=\"M12 3v18\"/><rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"/><path d=\"M3 9h18\"/><path d=\"M3 15h18\"/>",
    "chart-column": "<path d=\"M3 3v16a2 2 0 0 0 2 2h16\"/><path d=\"M18 17V9\"/><path d=\"M13 17V5\"/><path d=\"M8 17v-3\"/>",
    "scale": "<path d=\"m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z\"/><path d=\"m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z\"/><path d=\"M7 21h10\"/><path d=\"M12 3v18\"/><path d=\"M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2\"/>",
    "quote": "<path d=\"M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z\"/><path d=\"M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z\"/>",
    "calendar": "<path d=\"M8 2v4\"/><path d=\"M16 2v4\"/><rect width=\"18\" height=\"18\" x=\"3\" y=\"4\" rx=\"2\"/><path d=\"M3 10h18\"/>",
    "clock": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><polyline points=\"12 6 12 12 16 14\"/>",
    "shield-check": "<path d=\"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z\"/><path d=\"m9 12 2 2 4-4\"/>",
    "plug": "<path d=\"M12 22v-5\"/><path d=\"M9 8V2\"/><path d=\"M15 8V2\"/><path d=\"M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z\"/>",
    "server": "<rect width=\"20\" height=\"8\" x=\"2\" y=\"2\" rx=\"2\" ry=\"2\"/><rect width=\"20\" height=\"8\" x=\"2\" y=\"14\" rx=\"2\" ry=\"2\"/><line x1=\"6\" x2=\"6.01\" y1=\"6\" y2=\"6\"/><line x1=\"6\" x2=\"6.01\" y1=\"18\" y2=\"18\"/>",
    "package": "<path d=\"M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z\"/><path d=\"M12 22V12\"/><path d=\"m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7\"/><path d=\"m7.5 4.27 9 5.15\"/>",
    "globe": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20\"/><path d=\"M2 12h20\"/>",
    "mail": "<rect width=\"20\" height=\"16\" x=\"2\" y=\"4\" rx=\"2\"/><path d=\"m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7\"/>",
    "circle-check": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"m9 12 2 2 4-4\"/>",
    "circle-x": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"m15 9-6 6\"/><path d=\"m9 9 6 6\"/>",
    "eye": "<path d=\"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>",
    "scan-search": "<path d=\"M3 7V5a2 2 0 0 1 2-2h2\"/><path d=\"M17 3h2a2 2 0 0 1 2 2v2\"/><path d=\"M21 17v2a2 2 0 0 1-2 2h-2\"/><path d=\"M7 21H5a2 2 0 0 1-2-2v-2\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"m16 16-1.9-1.9\"/>",
    "route": "<circle cx=\"6\" cy=\"19\" r=\"3\"/><path d=\"M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15\"/><circle cx=\"18\" cy=\"5\" r=\"3\"/>",
    "compass": "<path d=\"m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z\"/><circle cx=\"12\" cy=\"12\" r=\"10\"/>",
    "library": "<path d=\"m16 6 4 14\"/><path d=\"M12 6v14\"/><path d=\"M8 8v12\"/><path d=\"M4 4v16\"/>"
  };

  /* Realce de sintaxe: tokens com classe, sem HTML. lang: json | js | python | bash | text */
  var KW = {
    js: ' const let var function return await async if else for while new import from export default true false null undefined of in typeof class this ',
    python: ' import from as def return if elif else for while in not and or None True False with class lambda try except ',
    bash: ''
  };
  var HL = {
    js: /(\/\/[^\n]*)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`[^`]*`)|(\b\d+(?:\.\d+)?\b)|([^\s\S])|([A-Za-z_$][\w$]*)|([{}\[\]().,:;=<>+*\/|&!?-])/g,
    python: /(#[^\n]*)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(\b\d+(?:\.\d+)?\b)|([^\s\S])|([A-Za-z_]\w*)|([{}\[\]().,:;=<>+*\/|&!-])/g,
    bash: /(^[ \t]*#[^\n]*)|("(?:\\.|[^"\\\n])*"|'[^'\n]*')|([^\s\S])|(\s--?[A-Za-z][\w-]*)|(^[ \t]*[A-Za-z][\w.-]*(?=[ \t]|$))|(\\$)/gm
  };
  function highlight(code, lang) {
    code = code == null ? '' : String(code);
    var out = [];
    function push(t, c) { if (!t) return; var l = out[out.length - 1]; if (l && l.c === c) l.t += t; else out.push({ t: t, c: c }); }
    var m, last = 0, re;
    if (lang === 'json') {
      re = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}\[\],:])/g;
      while ((m = re.exec(code))) {
        push(code.slice(last, m.index), '');
        if (m[1]) { push(m[1], m[2] ? 'key' : 'str'); if (m[2]) push(m[2], 'pun'); }
        else if (m[3]) push(m[3], 'num');
        else if (m[4]) push(m[4], 'kw');
        else push(m[5], 'pun');
        last = re.lastIndex;
      }
      push(code.slice(last), '');
      return out;
    }
    re = HL[lang];
    if (!re) return [{ t: code, c: '' }];
    re = new RegExp(re.source, re.flags);
    var kw = KW[lang] || '';
    while ((m = re.exec(code))) {
      if (m[0] === '') { re.lastIndex++; continue; }
      push(code.slice(last, m.index), '');
      if (m[1]) push(m[1], 'com');
      else if (m[2]) push(m[2], 'str');
      else if (m[3]) push(m[3], 'num');
      else if (m[4]) push(m[4], 'key');
      else if (m[5]) {
        if (lang === 'bash') push(m[5], 'kw');
        else if (kw.indexOf(' ' + m[5] + ' ') >= 0) push(m[5], 'kw');
        else if (code.charAt(re.lastIndex) === '(') push(m[5], 'key');
        else push(m[5], '');
      }
      else push(m[6], 'pun');
      last = re.lastIndex;
    }
    push(code.slice(last), '');
    return out;
  }
  function highlightHTML(code, lang) {
    return highlight(code, lang).map(function (t) { return t.c ? '<span class="cs-tk-' + t.c + '">' + esc(t.t) + '</span>' : esc(t.t); }).join('');
  }
  function iconSVG(name, size, label) {
    var d = ICONS[name]; if (!d) return '';
    size = size || 16;
    return '<svg class="cs-icon" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" focusable="false"' + (label ? ' role="img" aria-label="' + esc(label) + '"' : ' aria-hidden="true"') + '>' + d + '</svg>';
  }

  /* ---- React ---- */
  function useChart(fn, props) {
    var React = window.React, ref = React.useRef(null), key = JSON.stringify(props);
    React.useEffect(function () { var c = fn(ref.current, props); return c.destroy; }, [key]);
    return ref;
  }

  function Wordmark(p) {
    var cn = cx('cs-wordmark', p.size === 'lg' && 'cs-wordmark--lg', p.className);
    return p.href ? h('a', { className: cn, href: p.href }, 'ciencia.social') : h('span', { className: cn }, 'ciencia.social');
  }

  function NetworkBar(p) {
    var React = window.React;
    var _s = React.useState(null), t = _s[0], setT = _s[1];
    React.useEffect(function () {
      setT(theme.get());
      var on = function () { setT(theme.get()); };
      document.addEventListener('cs-tema', on);
      return function () { document.removeEventListener('cs-tema', on); };
    }, []);
    var links = p.links || [];
    return h('header', { className: cx('cs-netbar', p.className) },
      h('div', { className: cx('cs-page', p.width === 'report' && 'cs-page--report', 'cs-netbar__in') },
        h(Wordmark, { href: p.home || HOME }),
        p.artifact ? h('span', { className: 'cs-netbar__sep', 'aria-hidden': 'true' }, '/') : null,
        p.artifact ? (p.artifactHref ? h('a', { className: 'cs-netbar__name', href: p.artifactHref }, p.artifact) : h('span', { className: 'cs-netbar__name' }, p.artifact)) : null,
        h('nav', { className: 'cs-netbar__nav', 'aria-label': 'Navegação do artefato' },
          links.map(function (l) { return h('a', { key: l.href, href: l.href, 'aria-current': l.current ? 'page' : undefined }, l.label); }),
          p.themeToggle === false ? null : h('button', { type: 'button', className: 'cs-theme', 'data-cs-theme-toggle': '', 'data-cs-react': '', onClick: function () { theme.toggle(); setT(theme.get()); } }, h(Icon, { name: t === 'dark' ? 'sun' : 'moon' }), h('span', null, t === 'dark' ? 'Tema claro' : 'Tema escuro')))));
  }

  function SiteFooter(p) {
    var cols = p.columns || [];
    return h('footer', { className: cx('cs-footer', p.className) },
      h('div', { className: cx('cs-page', p.width === 'report' && 'cs-page--report') },
        h('div', { className: 'cs-footer__grid' },
          h('div', { className: 'cs-footer__brand' }, h(Wordmark, { href: p.home || HOME }), p.note ? h('p', null, p.note) : null),
          cols.map(function (c) {
            return h('section', { key: c.title },
              h('h2', null, c.title),
              c.items ? h('ul', null, c.items.map(function (it, i) { return h('li', { key: i }, it.href ? h('a', { href: it.href }, it.label) : (it.label || it)); })) : c.children);
          }))));
  }

  function ArtifactCard(p) {
    var Tag = p.href ? 'a' : 'div';
    return h(Tag, { className: cx('cs-artifact', p.className), href: p.href },
      h('div', { className: 'cs-artifact__type' }, h('span', { className: 'cs-meta-text' }, p.type), p.status ? h(Badge, { status: p.status }) : null),
      h('h3', { className: 'cs-artifact__title' }, p.title),
      p.description ? h('p', { className: 'cs-artifact__desc' }, p.description) : null,
      p.date ? h('div', { className: 'cs-artifact__foot' }, p.date) : null);
  }

  function ReportHeader(p) {
    var meta = p.meta || [];
    return h('div', { className: cx('cs-rhead', p.className) },
      h('div', { className: 'cs-rhead__eyebrow' }, p.eyebrow ? h('span', { className: 'cs-meta-text' }, p.eyebrow) : null, p.status ? h(Badge, { status: p.status }) : null),
      h('h1', { className: 'cs-rhead__title' }, p.title),
      p.subtitle ? h('p', { className: 'cs-rhead__sub' }, p.subtitle) : null,
      meta.length ? h('dl', { className: 'cs-rhead__meta' }, meta.map(function (m, i) { return h('div', { key: i }, h('dt', null, m.label), h('dd', null, m.value)); })) : null);
  }

  function Prose(p) { return h(p.as || 'div', Object.assign(rest(p, ['as', 'className', 'children']), { className: cx('cs-prose', p.className) }), p.children); }

  function tocList(items) {
    return h('ol', null, items.map(function (it) {
      return h('li', { key: it.href }, h('a', { href: it.href, 'aria-current': it.current ? 'location' : undefined }, it.label), it.children ? tocList(it.children) : null);
    }));
  }
  function Toc(p) {
    return h('nav', { className: cx('cs-toc', p.className), 'aria-label': p.title || 'Sumário' },
      h('p', { className: 'cs-toc__title' }, p.title || 'Sumário'), tocList(p.items || []));
  }

  var CALLOUT = { nota: 'Nota metodológica', achado: 'Achado', limite: 'Limitação', ia: 'Uso de IA' };
  function Callout(p) {
    var k = p.kind || 'nota';
    return h('aside', { className: cx('cs-callout', 'cs-callout--' + k, p.className) },
      h('span', { className: 'cs-callout__label' }, p.label || CALLOUT[k]),
      h('div', { className: 'cs-callout__body' }, p.children));
  }

  function Quote(p) {
    return h('figure', { className: cx('cs-quote', p.className) }, h('blockquote', null, p.children), p.speaker ? h('figcaption', null, p.speaker) : null);
  }

  function References(p) {
    return h('section', { className: cx('cs-refs', p.className) },
      h('h2', null, p.title || 'Referências'),
      h('ol', null, (p.items || []).map(function (it, i) { return h('li', { key: i }, it); })));
  }

  function Figure(p) {
    var card = p.variant === 'card';
    var num = p.number ? (p.kind || 'Figura') + ' ' + p.number + ' – ' : null;
    return h('figure', { className: cx('cs-figure', card && 'cs-figure--card', p.className) },
      h('figcaption', { className: 'cs-figure__head' },
        h('span', { className: 'cs-figure__title' }, num ? h('span', { className: 'cs-figure__num' }, num) : null, p.title),
        p.subtitle ? h('span', { className: 'cs-figure__sub' }, p.subtitle) : null),
      h('div', { className: 'cs-figure__body' }, p.children),
      (p.source || p.note || p.table) ? h('div', { className: 'cs-figure__foot' },
        p.source ? h('p', null, 'Fonte: ', p.source) : null,
        p.note ? h('p', null, 'Nota: ', p.note) : null,
        p.table ? h(Disclosure, { summary: 'Ver dados em tabela' }, p.table) : null) : null);
  }

  function DataTable(p) {
    var cols = p.columns || [], rows = p.rows || [];
    var num = p.number ? (p.kind || 'Tabela') + ' ' + p.number + ' – ' : null;
    return h('div', { className: cx('cs-table-wrap', p.className) },
      h('div', { className: 'cs-table-scroll', tabIndex: 0, role: 'region', 'aria-label': p.title || 'Tabela' },
        h('table', { className: 'cs-table' },
          p.title ? h('caption', null, num ? h('span', { className: 'cs-figure__num' }, num) : null, p.title) : null,
          h('thead', null, h('tr', null, cols.map(function (c) { return h('th', { key: c.key, scope: 'col', className: c.numeric ? 'cs-num' : undefined }, c.label); }))),
          h('tbody', null, rows.map(function (r, i) {
            return h('tr', { key: i }, cols.map(function (c) { return h('td', { key: c.key, className: c.numeric ? 'cs-num' : undefined }, c.numeric && typeof r[c.key] === 'number' ? fmt(r[c.key], c.format) : r[c.key]); }));
          })))),
      p.source ? h('p', { className: 'cs-table__foot' }, 'Fonte: ', p.source) : null,
      p.note ? h('p', { className: 'cs-table__foot' }, 'Nota: ', p.note) : null);
  }

  function Legend(p) {
    return h('ul', { className: cx('cs-legend', p.className) }, (p.items || []).map(function (i, idx) {
      return h('li', { key: i.label }, h('span', { className: cx('cs-legend__key', p.line && 'cs-legend__key--line'), style: { background: i.color || dataColor(i.slot || idx + 1) } }), i.label);
    }));
  }

  function chartProps(p) { return rest(p, ['className']); }
  function LineChart(p) { var ref = useChart(lineChart, chartProps(p)); return h('div', { ref: ref, className: cx('cs-chart', p.className) }); }
  function BarChart(p) { return h('div', { className: cx('cs-chart', p.className), dangerouslySetInnerHTML: { __html: barHTML(p) } }); }
  function LikertChart(p) {
    var React = window.React, ref = React.useRef(null);
    React.useEffect(function () { wireTips(ref.current); }, []);
    return h('div', { ref: ref, className: cx('cs-chart', p.className), dangerouslySetInnerHTML: { __html: likertHTML(p) } });
  }

  function StatTile(p) {
    return h('div', { className: cx('cs-stat', p.hero && 'cs-stat--hero', p.className) },
      h('div', { className: 'cs-stat__label' }, p.label),
      h('div', { className: 'cs-stat__value' }, p.value),
      p.delta ? h('div', { className: 'cs-stat__delta' }, p.delta) : null,
      p.n ? h('div', { className: 'cs-stat__n' }, p.n) : null);
  }

  function SampleNote(p) {
    return h('dl', { className: cx('cs-sample', p.className) }, (p.items || []).map(function (i) { return h('div', { key: i.label }, h('dt', null, i.label), h('dd', null, i.value)); }));
  }

  function Button(p) {
    var v = p.variant || 'quiet', cn = cx('cs-btn', v !== 'quiet' && 'cs-btn--' + v, p.className), o = Object.assign(rest(p, ['variant', 'className', 'children', 'icon', 'iconEnd']), { className: cn });
    var a = p.icon ? h(Icon, { name: p.icon }) : null, b = p.iconEnd ? h(Icon, { name: p.iconEnd }) : null;
    if (p.href) return h('a', o, a, p.children, b);
    if (!o.type) o.type = 'button';
    return h('button', o, a, p.children, b);
  }

  function Select(p) {
    var o = Object.assign(rest(p, ['label', 'options', 'className', 'id', 'block']), { className: 'cs-select' });
    return h('label', { className: cx('cs-field', p.block && 'cs-field--block', p.className) },
      h('span', { className: 'cs-field__label' }, p.label),
      h('select', o, (p.options || []).map(function (op) { var v = op.value !== undefined ? op.value : op; return h('option', { key: v, value: v }, op.label || op); })));
  }

  function SegmentedControl(p) {
    return h('fieldset', { className: cx('cs-seg', p.className) },
      h('legend', { className: 'cs-seg__legend' }, p.legend),
      h('div', { className: 'cs-seg__opts' }, (p.options || []).map(function (op) {
        var v = op.value !== undefined ? op.value : op;
        var input = { type: 'radio', name: p.name, value: v };
        if (p.value !== undefined) { input.checked = p.value === v; input.onChange = function () { p.onChange && p.onChange(v); }; }
        else { input.defaultChecked = p.defaultValue === v; }
        return h('label', { key: v, className: 'cs-seg__opt' }, h('input', input), h('span', null, op.label || op));
      })));
  }

  function FilterBar(p) {
    return h('div', { className: cx('cs-filters', p.className), role: 'group', 'aria-label': p.label || 'Filtros' }, p.children,
      p.end ? h('div', { className: 'cs-filters__end' }, p.end) : null);
  }

  function Disclosure(p) {
    return h('details', { className: cx('cs-disclosure', p.className), open: p.open }, h('summary', null, p.summary), h('div', { className: 'cs-disclosure__body' }, p.children));
  }

  var BADGE = { rascunho: 'Rascunho', preliminar: 'Preliminar', revisao: 'Em revisão', consolidado: 'Consolidado', retificado: 'Retificado', ilustrativo: 'Dados ilustrativos' };
  function Badge(p) {
    var s = p.status || 'rascunho';
    return h('span', { className: cx('cs-badge', 'cs-badge--' + s, p.className) }, p.children || BADGE[s]);
  }

  /* Ícone por nome, do conjunto Lucide embutido. Com label, é imagem com nome; sem label, decorativo. */
  function Icon(p) {
    var d = ICONS[p.name];
    if (!d) return null;
    var size = p.size || 16;
    var a = { className: cx('cs-icon', p.className), width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: p.stroke || 1.75, strokeLinecap: 'round', strokeLinejoin: 'round', focusable: 'false', dangerouslySetInnerHTML: { __html: d } };
    if (p.label) { a.role = 'img'; a['aria-label'] = p.label; } else { a['aria-hidden'] = 'true'; }
    return h('svg', a);
  }

  /* Bloco de código com realce de sintaxe e botão de copiar */
  function CodeBlock(p) {
    var React = window.React, _s = React.useState(false), done = _s[0], setDone = _s[1];
    var code = p.code == null ? '' : String(p.code);
    var toks = highlight(code, p.lang);
    function copy() {
      var ok = function () { setDone(true); setTimeout(function () { setDone(false); }, 2000); };
      try { navigator.clipboard.writeText(code).then(ok, function () {}); } catch (e) { /* sem área de transferência */ }
    }
    return h('div', { className: cx('cs-code', p.className) },
      h('div', { className: 'cs-code__head' },
        h('span', { className: 'cs-code__title' }, p.title || p.lang || 'Código'),
        p.meta ? h('span', { className: 'cs-code__meta' }, p.meta) : null,
        p.copy === false ? null : h('button', { type: 'button', className: 'cs-code__copy', onClick: copy, 'aria-live': 'polite' }, h(Icon, { name: done ? 'check' : 'copy', size: 14 }), done ? 'Copiado' : 'Copiar')),
      h('pre', { className: 'cs-code__pre', tabIndex: 0, 'aria-label': p.title || 'Código', style: p.maxHeight ? { maxHeight: p.maxHeight } : undefined },
        h('code', null, toks.map(function (t, i) { return h('span', { key: i, className: t.c ? 'cs-tk-' + t.c : undefined }, t.t); }))));
  }

  /* Campo de texto na altura única dos controles, com ícone opcional à esquerda */
  function TextInput(p) {
    var o = Object.assign(rest(p, ['label', 'hideLabel', 'icon', 'block', 'className', 'end']), { className: 'cs-input__el' });
    if (!o.type) o.type = 'text';
    return h('label', { className: cx('cs-field', p.block && 'cs-field--block', p.className) },
      h('span', { className: cx('cs-field__label', p.hideLabel && 'cs-sr') }, p.label),
      h('span', { className: 'cs-input' }, p.icon ? h(Icon, { name: p.icon }) : null, h('input', o), p.end || null));
  }

  window.CS = Object.assign(window.CS || {}, {
    theme: theme, charts: charts, palette: palette,
    highlight: highlight, highlightHTML: highlightHTML, icon: iconSVG, icons: Object.keys(ICONS),
    Icon: Icon, CodeBlock: CodeBlock, TextInput: TextInput,
    Wordmark: Wordmark, NetworkBar: NetworkBar, SiteFooter: SiteFooter, ArtifactCard: ArtifactCard,
    ReportHeader: ReportHeader, Prose: Prose, Toc: Toc, Callout: Callout, Quote: Quote, References: References,
    Figure: Figure, DataTable: DataTable, Legend: Legend, LineChart: LineChart, BarChart: BarChart, LikertChart: LikertChart, StatTile: StatTile, SampleNote: SampleNote,
    Button: Button, Select: Select, SegmentedControl: SegmentedControl, FilterBar: FilterBar, Disclosure: Disclosure, Badge: Badge
  });
})();
