/* ============ estadísticas ============ */
function sentences(text) {
  return text.split(/(?<=[.!?…])\s+(?=[«"“¿¡(\p{Lu}—–-])/u).map(s => s.trim()).filter(Boolean);
}
const Stats = {
  render(st) {
    const P = App.P(); if (!P) return;
    const chs = App.chapterList().map((c, i) => { const d = App.ch(c.id); return { c: c, i: i, d: d && d.data }; });
    let total = 0, notesOpen = 0, notesDone = 0;
    const byType = {}; TKEYS.forEach(k => byType[k] = { open: 0, done: 0 });
    const freq = new Map(), longs = [];
    chs.forEach(x => {
      x.words = x.d ? chapterWords(x.d) : 0; total += x.words;
      if (!x.d) return;
      allMarks(x.d).forEach(({ m }) => { if (m.done) { notesDone++; byType[m.type].done++; } else { notesOpen++; byType[m.type].open++; } });
      let sw = 0, sn = 0;
      x.d.paras.forEach(p => {
        const t = parText(p);
        (t.match(/[\p{L}\p{N}]+/gu) || []).forEach(w => { const f = fold(w); if (f.length >= 4 && !STOP.has(f)) { const e = freq.get(f); if (e) e.n++; else freq.set(f, { w: w.toLowerCase(), n: 1 }); } });
        sentences(t).forEach(s => { const n = countWords(s); sw += n; sn++; if (n >= 40) longs.push({ cid: x.c.id, pid: p.id, s: s, n: n, ch: x.i + 1 }); });
      });
      x.avg = sn ? Math.round(sw / sn) : 0;
    });
    const wrap = h('div', { class: 'st' });
    wrap.append(h('div', { class: 'vhead', style: 'margin:0' }, h('div', null, h('h2', { text: 'Estadísticas' }), h('p', { text: 'Avance, ritmo de escritura y señales del texto. Toca una palabra o una frase para ir a ella.' }))));
    const today = App.wordsToday();
    const tiles = h('div', { class: 'tiles' });
    const tile = (v, k) => tiles.append(h('div', { class: 'tile' }, h('div', { class: 'v', text: v }), h('div', { class: 'k', text: k })));
    tile(fmtN(total), 'palabras');
    tile((today >= 0 ? '+' : '') + fmtN(today), 'hoy');
    tile(P.goal ? Math.min(100, Math.round(100 * total / P.goal)) + '%' : '—', P.goal ? 'de la meta de ' + fmtN(P.goal) : 'sin meta (ajústala en Ajustes)');
    tile(String(Math.max(1, Math.round(total / 230))) + ' min', 'de lectura');
    tile(fmtN(notesOpen), 'notas abiertas');
    wrap.append(tiles);

    const two = h('div', { class: 'two' });
    const bars = h('div', { class: 'panel' }, h('h3', { text: 'Palabras por ' + App.unit().toLowerCase() }));
    const maxW = Math.max(1, ...chs.map(x => x.words));
    const list = h('div', { style: 'display:flex;flex-direction:column;gap:.45rem' });
    chs.forEach(x => {
      list.append(h('button', { type: 'button', style: 'display:grid;grid-template-columns:minmax(0,9rem) minmax(0,1fr) auto;gap:.6rem;align-items:center;border:0;background:none;padding:0;cursor:pointer;text-align:left;color:inherit', onclick: () => App.go(App.chHash(x.c.id)) },
        h('span', { style: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.8438rem', text: (x.i + 1) + '. ' + (x.c.title || App.unit()) }),
        h('span', { style: 'height:10px;border-radius:2px;background:var(--sunk);overflow:hidden' }, h('span', { style: 'display:block;height:100%;width:' + (100 * x.words / maxW) + '%;background:var(--accent)' })),
        h('span', { style: 'font:400 .7188rem var(--f-mono);color:var(--soft);font-variant-numeric:tabular-nums', text: fmtN(x.words) + (x.avg ? ' · ' + x.avg + ' p/frase' : '') })));
    });
    bars.append(list);
    two.append(bars);

    const days = h('div', { class: 'panel' }, h('h3', { text: 'Últimos 30 días' }));
    const ds = []; for (let i = 29; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = dayKey(d); const v = P.days && P.days[k] ? Math.max(0, P.days[k].e - P.days[k].s) : 0; ds.push({ k: k, v: v, d: d }); }
    const maxD = Math.max(1, ...ds.map(d => d.v));
    const W = 600, H = 170, bw = W / 30;
    const svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + (H + 22), class: 'chart', role: 'img', 'aria-label': 'Palabras escritas por día en los últimos 30 días', style: 'width:100%;height:auto' });
    [0.5, 1].forEach(f => svg.append(sv('line', { x1: 0, x2: W, y1: H - H * f, y2: H - H * f, stroke: 'var(--line)' })));
    svg.append(sv('text', { x: 2, y: 12 }, fmtN(maxD)));
    ds.forEach((d, i) => {
      const hh = d.v ? Math.max(2, H * d.v / maxD) : 0;
      const r = sv('rect', { x: i * bw + 2, y: H - hh, width: bw - 4, height: hh, rx: 2, fill: i === 29 ? 'var(--accent)' : 'var(--rep-fg)', opacity: i === 29 ? 1 : .55 });
      r.append(sv('title', null, d.d.getDate() + ' ' + MESES[d.d.getMonth()] + ': ' + fmtN(d.v) + ' palabras'));
      svg.append(r);
      if (i % 7 === 2 || i === 29) svg.append(sv('text', { x: i === 29 ? W - 2 : i * bw + bw / 2, y: H + 16, 'text-anchor': i === 29 ? 'end' : 'middle' }, i === 29 ? 'hoy' : d.d.getDate() + ' ' + MESES[d.d.getMonth()]));
    });
    days.append(svg);
    const hs = Habit.streaks(Habit.merge([{ days: P.days }]));
    days.append(h('p', { class: 'muted', style: 'margin:.5rem 0 0;font-size:.8125rem', text: hs.cur ? 'Llevas ' + plural(hs.cur, 'día seguido', 'días seguidos') + ' escribiendo en este proyecto' + (hs.best > hs.cur ? ' (tu mejor racha: ' + plural(hs.best, 'día') + ')' : '') + '.' : 'Se cuenta lo que escribes cada día en este proyecto.' }));
    two.append(days);
    wrap.append(two);

    const two2 = h('div', { class: 'two' });
    let top = Array.from(freq.values()).sort((a, b) => b.n - a.n);
    if (top.filter(t => t.n > 1).length >= 12) top = top.filter(t => t.n > 1);
    top = top.slice(0, 36);
    const cloud = h('div', { class: 'wcloud' });
    top.forEach(t => cloud.append(h('button', { type: 'button', onclick: () => Search.open(t.w, true) }, t.w, h('b', { text: String(t.n) }))));
    two2.append(h('div', { class: 'panel' }, h('h3', { text: 'Palabras que más usas' }), top.length ? cloud : h('p', { class: 'muted', text: 'Escribe un poco más para ver tus palabras frecuentes.' })));
    const lp = h('div', { class: 'longs' });
    longs.sort((a, b) => b.n - a.n).slice(0, 8).forEach(l => lp.append(h('button', { type: 'button', onclick: () => { App.go(App.chHash(l.cid)); setTimeout(() => Search.open(l.s.slice(0, 60)), 150); } }, l.s.length > 220 ? l.s.slice(0, 220) + '…' : l.s, h('span', { text: l.n + ' palabras · ' + App.unit().toLowerCase() + ' ' + l.ch }))));
    two2.append(h('div', { class: 'panel' }, h('h3', { text: 'Frases más largas' }), longs.length ? lp : h('p', { class: 'muted', text: 'No hay frases de más de 40 palabras.' })));
    wrap.append(two2);

    const nt = h('div', { class: 'panel' }, h('h3', { text: 'Notas del corrector' }));
    const rows = h('div', { style: 'display:flex;flex-wrap:wrap;gap:.5rem' });
    TKEYS.forEach(k => rows.append(h('span', { class: 'chip ' + k, style: 'cursor:default' }, h('span', { class: 'g', text: TYPES[k].g }), h('span', { text: TYPES[k].l }), h('span', { class: 'c', text: byType[k].open + ' abiertas · ' + byType[k].done + ' resueltas' }))));
    nt.append(rows);
    if (window.Style) Style.render(wrap);
    if (window.Habit && P.days && Object.keys(P.days).length) wrap.append(Habit.panel([{ id: App.pid, title: P.title, days: P.days }], { title: 'Rachas en este proyecto' + (App.findProj(App.pid) && App.findProj(App.pid).space === 'team' ? ' (todo el equipo)' : '') }));
    wrap.append(nt);
    st.append(wrap);
  }
};
window.Stats = Stats;

/* ============ buscar y reemplazar ============ */
const Search = {
  q: '', repl: '', exact: false, word: false, scope: 'project', results: [], idx: -1,
  open(q, word) {
    if (q != null) { this.q = q; if (word != null) this.word = !!word; }
    const qi = h('input', { class: 'inp', id: 'sr-q', placeholder: 'Buscar…', value: this.q, 'aria-label': 'Buscar' });
    const ri = h('input', { class: 'inp', id: 'sr-r', placeholder: 'Reemplazar por…', value: this.repl, 'aria-label': 'Reemplazar por', disabled: !RT.canWrite || null });
    const ex = h('input', { type: 'checkbox', checked: this.exact }), wd = h('input', { type: 'checkbox', checked: this.word });
    const sc = h('select', { class: 'sel', id: 'sr-scope', style: 'width:auto' }, h('option', { value: 'project', text: 'Todo el proyecto' }), h('option', { value: 'chapter', text: 'Este ' + App.unit().toLowerCase() }));
    sc.value = this.scope;
    const res = h('div', { style: 'display:flex;flex-direction:column;gap:.45rem', id: 'sr-res' });
    const count = h('div', { class: 'muted', style: 'font-size:.8125rem' });
    const body = h('div', { style: 'display:flex;flex-direction:column;gap:.7rem' }, qi, ri,
      h('div', { class: 'checks' }, h('label', null, ex, 'Mayúsculas y tildes exactas'), h('label', null, wd, 'Palabra completa'), sc), count, res);
    const replAll = btn('Reemplazar todo', () => this.replaceAll(), 'primary', { disabled: !RT.canWrite || null });
    const nav = h('div', { class: 'row', style: 'width:100%' }, btn('Anterior', () => this.step(-1), 'small'), btn('Siguiente', () => this.step(1), 'small'), h('span', { class: 'spacer' }), replAll);
    UI.drawer({ title: 'Buscar', key: 'search', body: body, foot: nav, onClose: () => { this.results = []; this.idx = -1; this.q = ''; if (window.CSS && CSS.highlights) { CSS.highlights.delete('busca'); CSS.highlights.delete('busca-act'); } } });
    const run = debounce(() => { this.q = qi.value; this.repl = ri.value; this.exact = ex.checked; this.word = wd.checked; this.scope = sc.value; this.run(res, count); }, 180);
    [qi, ri].forEach(i => i.addEventListener('input', run)); [ex, wd, sc].forEach(i => i.addEventListener('change', run));
    qi.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.step(e.shiftKey ? -1 : 1); } });
    this.run(res, count);
    setTimeout(() => { qi.focus(); qi.select(); }, 30);
  },
  chapters() {
    const list = App.chapterList();
    return this.scope === 'chapter' && App.cid ? list.filter(c => c.id === App.cid) : list;
  },
  run(res, count) {
    this.results = []; this.idx = -1;
    res.textContent = '';
    const re = buildMatcher(this.q, { exact: this.exact, word: this.word });
    if (!this.q || !re) { count.textContent = ''; this.applyInEditor(); return; }
    const opts = { exact: this.exact };
    this.chapters().forEach(c => {
      const d = App.ch(c.id); if (!d || !d.data) return;
      d.data.paras.forEach(p => {
        const t = parText(p);
        findInText(t, re, opts).forEach(([s, e]) => this.results.push({ cid: c.id, pid: p.id, s: s, e: e, t: t }));
      });
    });
    count.textContent = this.results.length ? plural(this.results.length, 'resultado') : 'Sin resultados.';
    let lastC = null;
    this.results.slice(0, 300).forEach((r, i) => {
      if (r.cid !== lastC) { res.append(h('div', { class: 'label', style: 'margin-top:.3rem', text: (App.chIndex(r.cid) + 1) + '. ' + (App.chTitle(r.cid) || App.unit()) })); lastC = r.cid; }
      const a = Math.max(0, r.s - 60), b = Math.min(r.t.length, r.e + 60);
      res.append(h('div', { class: 'res', dataset: { i: i }, onclick: () => this.go(i) }, h('div', { class: 'snip' }, (a ? '…' : '') + r.t.slice(a, r.s), h('mark', { text: r.t.slice(r.s, r.e) }), r.t.slice(r.e, b) + (b < r.t.length ? '…' : ''))));
    });
    if (this.results.length > 300) res.append(h('p', { class: 'muted', text: 'Se muestran los primeros 300.' }));
    this.applyInEditor();
  },
  step(d) { if (!this.results.length) return; this.go((this.idx + d + this.results.length) % this.results.length); },
  go(i) {
    const r = this.results[i]; if (!r) return;
    this.idx = i;
    $$('#sr-res .res').forEach(x => x.style.borderColor = x.dataset.i === String(i) ? 'var(--accent)' : '');
    const finish = () => {
      const pe = Editor.pEl(r.pid); if (!pe) return;
      const rg = Editor.rangeIn(pe, r.s, r.e);
      if (rg) { const el = rg.startContainer.parentElement; if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      this.applyInEditor();
    };
    if (App.tab !== 'escribir' || App.cid !== r.cid) { App.go(App.chHash(r.cid)); setTimeout(finish, 160); } else finish();
  },
  applyInEditor() {
    if (!window.CSS || !CSS.highlights || typeof Highlight === 'undefined') return;
    const all = [], act = [];
    if (UI.drawerOpen('search') && Editor.root && this.results.length) {
      this.results.forEach((r, i) => {
        if (r.cid !== Editor.cid) return;
        const pe = Editor.pEl(r.pid); if (!pe) return;
        const rg = Editor.rangeIn(pe, r.s, r.e); if (!rg) return;
        (i === this.idx ? act : all).push(rg);
      });
    }
    CSS.highlights.set('busca', new Highlight(...all));
    CSS.highlights.set('busca-act', new Highlight(...act));
  },
  async replaceAll() {
    if (!RT.canWrite || !this.results.length) return;
    const re = buildMatcher(this.q, { exact: this.exact, word: this.word }); if (!re) return;
    const cids = Array.from(new Set(this.results.map(r => r.cid)));
    const ok = await UI.confirm('Reemplazar todo', 'Se reemplazarán ' + plural(this.results.length, 'aparición', 'apariciones') + ' de «' + this.q + '» por «' + this.repl + '» en ' + plural(cids.length, App.unit().toLowerCase(), kindOf(App.P()).units.toLowerCase()) + '. Antes se guarda una versión de cada uno.', 'Reemplazar');
    if (!ok) return;
    let n = 0;
    for (const cid of cids) {
      const d = App.ch(cid); if (!d || !d.data) continue;
      await Versions.saveVersion(cid, 'Antes de reemplazar «' + this.q.slice(0, 40) + '»');
      if (Editor.cid === cid) Editor.pushUndo();
      d.update(x => { x.paras = x.paras.map(p => { const np = clone(p); const k = replaceInPara(np, re, { exact: this.exact }, this.repl); n += k; if (k && Editor.cid === cid) Editor.addDirty(p.id); return np; }); }, { silent: true, now: true });
      if (Editor.cid === cid) { Editor.render(true); Editor.afterChange(); }
    }
    App.toast(plural(n, 'reemplazo hecho', 'reemplazos hechos') + '. Puedes volver atrás desde el historial.');
    const res = $('#sr-res'); if (res) this.run(res, res.previousElementSibling);
  }
};
window.Search = Search;
