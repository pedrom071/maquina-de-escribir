/* ============ diagramas: mapa de relaciones y línea de tiempo ============ */
const SVGNS = 'http://www.w3.org/2000/svg';
function sv(tag, attrs, text) {
  const e = document.createElementNS(SVGNS, tag);
  if (attrs) for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
  if (text != null) e.textContent = text;
  return e;
}
const SEC_COLORS = ['var(--coh-fg)', 'var(--rec-fg)', 'var(--bien-fg)', 'var(--rep-fg)', 'var(--dud-fg)', 'var(--ort-fg)'];

const Diagrams = {
  st: null, tab: 'rel', drag: null,
  render(st) {
    this.st = st || this.st;
    const P = App.P(); if (!P || !this.st) return;
    this.st.textContent = '';
    const wrap = h('div', { class: 'dg' });
    wrap.append(h('div', { class: 'vhead', style: 'margin:0' }, h('div', null, h('h2', { text: 'Diagramas' }), h('p', { text: 'Relaciones entre personajes y el orden de los hechos frente al orden en que los cuentas.' }))));
    const tabs = h('div', { class: 'tabs', role: 'tablist' });
    [['rel', 'Relaciones'], ['tl', 'Línea de tiempo']].forEach(([k, l]) => tabs.append(h('button', { type: 'button', role: 'tab', 'aria-selected': this.tab === k ? 'true' : 'false', text: l, onclick: () => { this.tab = k; this.render(); } })));
    wrap.append(tabs);
    const body = h('div', { style: 'display:flex;flex-direction:column;gap:1rem' });
    wrap.append(body);
    this.st.append(wrap);
    if (this.tab === 'rel') this.renderRel(body, P); else this.renderTl(body, P);
  },
  remoteRefresh() { if (this.drag) return; const a = document.activeElement; if (a && this.st && this.st.contains(a) && /INPUT|SELECT|TEXTAREA/.test(a.tagName)) return; this.render(); },
  pd() { return App.proj(); },

  /* ---------- relaciones ---------- */
  nodes(P) {
    const out = [];
    ((P.bible && P.bible.sections) || []).forEach((s, si) => { if (!s.graph) return; (s.items || []).forEach(it => { if ((it.title || '').trim()) out.push({ id: it.id, label: it.title.trim(), color: SEC_COLORS[si % SEC_COLORS.length], sec: s.label }); }); });
    return out;
  },
  renderRel(body, P) {
    const nodes = this.nodes(P), ro = !RT.canWrite;
    if (!nodes.length) { body.append(h('div', { class: 'empty', text: 'Agrega personajes en la biblia (o activa «Mostrar en el mapa» en otra sección) para verlos aquí.' })); return; }
    const W = 1000, H = 620;
    const rel = P.relations || { nodes: {}, edges: [] };
    const pos = {};
    nodes.forEach((n, i) => {
      const p = rel.nodes && rel.nodes[n.id];
      if (p) pos[n.id] = { x: p.x, y: p.y };
      else { const a = (i / nodes.length) * Math.PI * 2 - Math.PI / 2; pos[n.id] = { x: W / 2 + Math.cos(a) * 250, y: H / 2 + Math.sin(a) * 220 }; }
    });
    const svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Mapa de relaciones' });
    svg.append(sv('rect', { x: 0, y: 0, width: W, height: H, fill: 'var(--sheet)' }));
    const gE = sv('g'), gN = sv('g');
    svg.append(gE, gN);
    const nodeW = (n) => Math.min(220, 26 + n.label.length * 7.6);
    const drawEdges = () => {
      gE.textContent = '';
      (rel.edges || []).forEach(e => {
        const a = pos[e.from], b = pos[e.to]; if (!a || !b) return;
        gE.append(sv('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: 'var(--line2)', 'stroke-width': 1.6 }));
        if (e.label) {
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, w = 18 + e.label.length * 6.4;
          const g = sv('g', { style: 'cursor:pointer' });
          g.append(sv('rect', { x: mx - w / 2, y: my - 11, width: w, height: 22, rx: 11, fill: 'var(--bg)', stroke: 'var(--line2)' }));
          g.append(sv('text', { x: mx, y: my + 4, 'text-anchor': 'middle', 'font-size': 11.5, fill: 'var(--soft)' }, e.label));
          if (!ro) g.addEventListener('click', (ev) => this.edgeMenu(ev, e.id));
          gE.append(g);
        }
      });
    };
    nodes.forEach(n => {
      const p = pos[n.id], w = nodeW(n);
      const g = sv('g', { class: 'gnode', transform: 'translate(' + p.x + ',' + p.y + ')', tabindex: '0', role: 'button', 'aria-label': n.label + ' (' + n.sec + ')' });
      g.append(sv('rect', { x: -w / 2, y: -17, width: w, height: 34, rx: 17, fill: 'var(--sheet)', stroke: n.color, 'stroke-width': 2 }));
      g.append(sv('text', { x: 0, y: 5, 'text-anchor': 'middle', 'font-size': 14, fill: 'var(--ink)', 'font-weight': 500 }, n.label.length > 26 ? n.label.slice(0, 25) + '…' : n.label));
      if (!ro) {
        g.addEventListener('pointerdown', (e) => {
          e.preventDefault(); g.setPointerCapture(e.pointerId);
          const m = svg.getScreenCTM().inverse();
          const pt = (ev) => { const q = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m); return { x: Math.max(40, Math.min(W - 40, q.x)), y: Math.max(24, Math.min(H - 24, q.y)) }; };
          const s = pt(e); this.drag = { id: n.id, dx: p.x - s.x, dy: p.y - s.y };
          const move = (ev) => { const q = pt(ev); p.x = q.x + this.drag.dx; p.y = q.y + this.drag.dy; g.setAttribute('transform', 'translate(' + p.x + ',' + p.y + ')'); drawEdges(); };
          const up = () => { g.removeEventListener('pointermove', move); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up); this.drag = null; this.pd().update(x => { x.relations = x.relations || { nodes: {}, edges: [] }; x.relations.nodes = x.relations.nodes || {}; x.relations.nodes[n.id] = { x: Math.round(p.x), y: Math.round(p.y) }; }); };
          g.addEventListener('pointermove', move); g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
        });
      }
      gN.append(g);
    });
    drawEdges();
    body.append(h('div', { class: 'canvas', id: 'rel-canvas' }, svg));
    const tools = h('div', { class: 'row' });
    if (!ro) {
      const from = h('select', { class: 'sel', id: 'rel-from', 'aria-label': 'Desde', style: 'width:auto' }), to = h('select', { class: 'sel', id: 'rel-to', 'aria-label': 'Hacia', style: 'width:auto' });
      nodes.forEach(n => { from.append(h('option', { value: n.id, text: n.label })); to.append(h('option', { value: n.id, text: n.label })); });
      if (nodes[1]) to.value = nodes[1].id;
      const lab = h('input', { class: 'inp', id: 'rel-label', placeholder: 'Relación (hermano de, ama a, le debe…)', style: 'width:auto;flex:1 1 220px' });
      const addE = () => {
        if (from.value === to.value) { App.toast('Elige dos personajes distintos.'); return; }
        this.pd().update(x => { x.relations = x.relations || { nodes: {}, edges: [] }; x.relations.edges = x.relations.edges || []; x.relations.edges.push({ id: uid('r'), from: from.value, to: to.value, label: lab.value.trim() }); }, { now: true });
        this.render();
      };
      lab.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addE(); } });
      tools.append(from, h('span', { class: 'muted', text: '→' }), to, lab, btn('Agregar relación', addE, 'primary'));
    }
    body.append(tools);
    const t2 = h('div', { class: 'row' });
    if (!ro) t2.append(btn('Ordenar en círculo', () => { this.pd().update(x => { if (x.relations) x.relations.nodes = {}; }, { now: true }); this.render(); }, 'small'));
    t2.append(h('span', { class: 'spacer' }), btn([icon('down'), 'SVG'], () => this.exportSvg(svg, 'relaciones'), 'small'), btn([icon('down'), 'PNG'], () => this.exportPng(svg, 'relaciones'), 'small'));
    body.append(t2);
    body.append(h('p', { class: 'muted', style: 'margin:0;font-size:.8125rem', text: 'Arrastra los nombres para ordenarlos. Toca una etiqueta para editar o borrar la relación.' }));
  },
  edgeMenu(ev, eid) {
    const anchor = ev.currentTarget.querySelector('rect') || ev.currentTarget;
    UI.menu(anchor, [
      { label: 'Editar relación', onClick: async () => { const P = App.P(); const e = P.relations.edges.find(z => z.id === eid); const v = await UI.prompt('Relación', 'Etiqueta', e ? e.label : ''); if (v != null) { this.pd().update(x => { const z = x.relations.edges.find(q => q.id === eid); if (z) z.label = v; }, { now: true }); this.render(); } } },
      { label: 'Eliminar relación', danger: true, onClick: () => { this.pd().update(x => { x.relations.edges = x.relations.edges.filter(q => q.id !== eid); }, { now: true }); this.render(); } }
    ], { alignLeft: true });
  },

  /* ---------- línea de tiempo ---------- */
  renderTl(body, P) {
    const ro = !RT.canWrite;
    const evs = P.timeline || [];
    const chs = App.chapterList();
    body.append(this.tlChart(P, evs, chs));
    const tbl = h('table', { class: 'tl-table' });
    tbl.append(h('thead', null, h('tr', null, h('th', { text: '#', title: 'Orden en la historia' }), h('th', { text: 'Hecho' }), h('th', { text: 'Cuándo' }), h('th', { text: 'Se cuenta en' }), h('th', { text: 'Nota' }), h('th', { text: '' }))));
    const tb = h('tbody');
    evs.forEach(e => {
      const set = (fn) => this.pd().update(x => { const z = x.timeline.find(q => q.id === e.id); if (z) fn(z); }, { silent: true });
      const num = h('input', { class: 'num', id: 'tl-' + e.id + '-n', type: 'number', min: '0', value: e.chrono || '', 'aria-label': 'Orden en la historia', readonly: ro || null });
      num.addEventListener('change', () => { set(z => { z.chrono = parseInt(num.value, 10) || 0; }); this.render(); });
      const ti = h('input', { id: 'tl-' + e.id + '-t', value: e.title || '', 'aria-label': 'Hecho', readonly: ro || null });
      ti.addEventListener('input', () => set(z => { z.title = ti.value; }));
      ti.addEventListener('change', () => this.render());
      const wh = h('input', { id: 'tl-' + e.id + '-w', value: e.when || '', 'aria-label': 'Cuándo', readonly: ro || null, placeholder: '—' });
      wh.addEventListener('input', () => set(z => { z.when = wh.value; }));
      const sel = h('select', { id: 'tl-' + e.id + '-c', 'aria-label': 'Se cuenta en', disabled: ro || null }, h('option', { value: '', text: 'Por contar' }));
      chs.forEach((c, i) => sel.append(h('option', { value: c.id, text: (i + 1) + '. ' + (c.title || App.unit()) })));
      sel.value = e.cid && chs.find(c => c.id === e.cid) ? e.cid : '';
      sel.addEventListener('change', () => { set(z => { z.cid = sel.value || null; }); this.render(); });
      const no = h('input', { id: 'tl-' + e.id + '-o', value: e.note || '', 'aria-label': 'Nota', readonly: ro || null });
      no.addEventListener('input', () => set(z => { z.note = no.value; }));
      tb.append(h('tr', null, h('td', null, num), h('td', null, ti), h('td', null, wh), h('td', null, sel), h('td', null, no),
        h('td', null, ro ? null : ibtn('trash', 'Eliminar hecho', () => { this.pd().update(x => { x.timeline = x.timeline.filter(q => q.id !== e.id); }, { now: true }); this.render(); }))));
    });
    tbl.append(tb);
    body.append(h('div', { class: 'scrollx panel', style: 'padding:.6rem' }, tbl));
    const row = h('div', { class: 'row' });
    if (!ro) row.append(btn([icon('plus'), 'Agregar hecho'], () => {
      const id = uid('e');
      const next = evs.reduce((m, e) => Math.max(m, e.chrono || 0), 0) + 1;
      this.pd().update(x => { x.timeline = x.timeline || []; x.timeline.push({ id: id, title: '', when: '', chrono: next, cid: null, note: '' }); }, { now: true });
      this.render(); setTimeout(() => { const t = $('#tl-' + id + '-t'); if (t) t.focus(); }, 30);
    }, 'primary'));
    row.append(h('span', { class: 'spacer' }));
    const chart = $('#tl-svg', body);
    if (chart) row.append(btn([icon('down'), 'SVG'], () => this.exportSvg(chart, 'linea-de-tiempo'), 'small'), btn([icon('down'), 'PNG'], () => this.exportPng(chart, 'linea-de-tiempo'), 'small'));
    body.append(row);
  },
  tlChart(P, evs, chs) {
    if (!evs.length) return h('div', { class: 'empty', text: 'Agrega hechos con su orden en la historia y el ' + App.unit().toLowerCase() + ' donde los cuentas. El gráfico muestra los saltos en el tiempo del relato.' });
    const story = evs.slice().sort((a, b) => (a.chrono || 1e9) - (b.chrono || 1e9));
    const chIdx = new Map(chs.map((c, i) => [c.id, i]));
    const told = evs.filter(e => e.cid && chIdx.has(e.cid)).sort((a, b) => (chIdx.get(a.cid) - chIdx.get(b.cid)) || (evs.indexOf(a) - evs.indexOf(b)));
    const untold = evs.filter(e => !(e.cid && chIdx.has(e.cid)));
    const narr = told.concat(untold);
    const step = 150, padL = 120, n = evs.length;
    const W = Math.max(900, padL + step * n + 40), H = 330, y1 = 80, y2 = 250;
    const svg = sv('svg', { id: 'tl-svg', viewBox: '0 0 ' + W + ' ' + H, width: W, role: 'img', 'aria-label': 'Línea de tiempo: orden de la historia y orden del relato', style: 'min-width:' + Math.min(W, 1100) + 'px' });
    svg.append(sv('rect', { x: 0, y: 0, width: W, height: H, fill: 'var(--sheet)' }));
    svg.append(sv('text', { x: 16, y: y1 + 4, 'font-size': 11, fill: 'var(--soft)', 'font-family': 'var(--f-mono)' }, 'HISTORIA'));
    svg.append(sv('text', { x: 16, y: y2 + 4, 'font-size': 11, fill: 'var(--soft)', 'font-family': 'var(--f-mono)' }, 'RELATO'));
    svg.append(sv('line', { x1: padL - 20, y1: y1, x2: W - 20, y2: y1, stroke: 'var(--line2)' }));
    svg.append(sv('line', { x1: padL - 20, y1: y2, x2: W - 20, y2: y2, stroke: 'var(--line2)' }));
    const xs = new Map(), xn = new Map();
    story.forEach((e, i) => xs.set(e.id, padL + i * step));
    narr.forEach((e, i) => xn.set(e.id, padL + i * step));
    let lastCh = null;
    narr.forEach((e, i) => {
      const cname = e.cid && chIdx.has(e.cid) ? (chIdx.get(e.cid) + 1) + '. ' + (chs[chIdx.get(e.cid)].title || '') : 'Por contar';
      if (cname !== lastCh) { svg.append(sv('text', { x: xn.get(e.id) - 8, y: y2 + 46, 'font-size': 11, fill: 'var(--faint)', 'font-family': 'var(--f-mono)' }, cname.length > 22 ? cname.slice(0, 21) + '…' : cname)); lastCh = cname; }
    });
    evs.forEach(e => {
      const a = xs.get(e.id), b = xn.get(e.id), isTold = e.cid && chIdx.has(e.cid);
      const back = isTold && b > a + 1;
      svg.append(sv('path', { d: 'M' + a + ' ' + (y1 + 8) + ' C' + a + ' ' + ((y1 + y2) / 2) + ' ' + b + ' ' + ((y1 + y2) / 2) + ' ' + b + ' ' + (y2 - 8), fill: 'none', stroke: isTold ? (back || b < a - 1 ? 'var(--accent)' : 'var(--line2)') : 'var(--line2)', 'stroke-width': isTold ? 1.8 : 1.2, 'stroke-dasharray': isTold ? null : '4 4' }));
    });
    const label = (x, y, text, up) => {
      const words = (text || '(sin título)').split(/\s+/); const lines = ['']; words.forEach(w => { if ((lines[lines.length - 1] + ' ' + w).trim().length > 18 && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = (lines[lines.length - 1] + ' ' + w).trim(); });
      lines.slice(0, 2).forEach((l, i) => svg.append(sv('text', { x: x, y: up ? y - 18 - (Math.min(2, lines.length) - 1 - i) * 14 : y + 24 + i * 14, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--ink)' }, i === 1 && lines.length > 2 ? l + '…' : l)));
    };
    story.forEach(e => { const x = xs.get(e.id); svg.append(sv('circle', { cx: x, cy: y1, r: 7, fill: 'var(--sheet)', stroke: 'var(--accent)', 'stroke-width': 2 })); label(x, y1, (e.chrono ? e.chrono + '. ' : '') + e.title, true); });
    narr.forEach(e => { const x = xn.get(e.id), isTold = e.cid && chIdx.has(e.cid); svg.append(sv('circle', { cx: x, cy: y2, r: 7, fill: isTold ? 'var(--accent)' : 'var(--sheet)', stroke: isTold ? 'var(--accent)' : 'var(--line2)', 'stroke-width': 2 })); });
    const box = h('div', { class: 'canvas scrollx' }, svg);
    return h('div', { style: 'display:flex;flex-direction:column;gap:.4rem' }, box, h('p', { class: 'muted', style: 'margin:0;font-size:.8125rem', text: 'Arriba, los hechos en el orden en que ocurren; abajo, en el orden en que los cuentas. Las líneas que se cruzan son saltos en el tiempo; las punteadas, hechos aún por contar.' }));
  },

  /* ---------- exportar ---------- */
  inlineSvg(svg) {
    const c = svg.cloneNode(true);
    const cs = getComputedStyle(document.documentElement);
    const resolve = (v) => v && v.indexOf('var(') >= 0 ? v.replace(/var\((--[a-z0-9-]+)\)/gi, (m, n) => cs.getPropertyValue(n).trim() || '#888') : v;
    c.querySelectorAll('*').forEach(el => ['fill', 'stroke', 'font-family', 'style'].forEach(a => { const v = el.getAttribute(a); if (v) el.setAttribute(a, resolve(v)); }));
    c.setAttribute('xmlns', SVGNS);
    c.setAttribute('font-family', 'Hanken Grotesk, Segoe UI, sans-serif');
    const vb = (c.getAttribute('viewBox') || '0 0 1000 600').split(' ').map(Number);
    c.setAttribute('width', vb[2]); c.setAttribute('height', vb[3]); c.removeAttribute('style');
    return { text: new XMLSerializer().serializeToString(c), w: vb[2], h: vb[3] };
  },
  name(base) { return slug(App.P().title) + '-' + base; },
  exportSvg(svg, base) { const s = this.inlineSvg(svg); IO.save(this.name(base) + '.svg', s.text); },
  exportPng(svg, base) {
    const s = this.inlineSvg(svg);
    const img = new Image();
    const url = URL.createObjectURL(new Blob([s.text], { type: 'image/svg+xml' }));
    img.onload = () => {
      const k = 2, cv = document.createElement('canvas'); cv.width = s.w * k; cv.height = s.h * k;
      const ctx = cv.getContext('2d'); ctx.scale(k, k); ctx.drawImage(img, 0, 0, s.w, s.h);
      URL.revokeObjectURL(url);
      cv.toBlob(b => { if (b) IO.save(this.name(base) + '.png', b); }, 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); App.toast('No se pudo crear la imagen.'); };
    img.src = url;
  }
};
window.Diagrams = Diagrams;
