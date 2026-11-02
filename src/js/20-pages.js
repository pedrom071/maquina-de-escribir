/* ============ páginas, saltos de página, navegación y secciones especiales ============ */
const SPECIAL = {
  dedicatoria: { l: 'Dedicatoria', front: true, o: 1 },
  epigrafe: { l: 'Epígrafe', front: true, o: 2 },
  prefacio: { l: 'Prefacio', front: true, o: 3 },
  prologo: { l: 'Prólogo', front: true, o: 4 },
  introduccion: { l: 'Introducción', front: true, o: 5 },
  nota: { l: 'Nota del autor', front: true, o: 6 },
  epilogo: { l: 'Epílogo', front: false, o: 1 },
  apendice: { l: 'Apéndice', front: false, o: 2 },
  glosario: { l: 'Glosario', front: false, o: 3 },
  agradecimientos: { l: 'Agradecimientos', front: false, o: 4 },
  sobre: { l: 'Sobre el autor', front: false, o: 5 }
};
const PAGE_RATIO = 1.5; // alto del bloque de texto respecto de su ancho (aprox. una página de libro)

const Pages = {
  pages: [], cur: 1,
  /* ---------- capítulos y secciones especiales ---------- */
  role(c) { return c && c.role && SPECIAL[c.role] ? c.role : null; },
  number(cid) {
    let n = 0, out = null;
    App.chapterList().forEach(c => { if (!this.role(c) && c.role !== 'parte') { n++; if (c.id === cid) out = n; } });
    return out;
  },
  regularCount() { return App.chapterList().filter(c => !this.role(c) && c.role !== 'parte').length; },
  label(c) {
    const r = this.role(c); if (r) return SPECIAL[r].l;
    if (c.role === 'parte') return Collections.partLabel(c);
    return App.unit() + ' ' + this.number(c.id);
  },
  /* Lugar donde va una sección especial: delante (antes del primer capítulo) o al final. */
  insertIndex(list, role) {
    const sp = SPECIAL[role];
    if (sp.front) { let i = 0; while (i < list.length && this.role(list[i]) && SPECIAL[list[i].role].front && SPECIAL[list[i].role].o <= sp.o) i++; return i; }
    let i = list.length; while (i > 0 && this.role(list[i - 1]) && !SPECIAL[list[i - 1].role].front && SPECIAL[list[i - 1].role].o > sp.o) i--; return i;
  },
  addSpecial(role) {
    const pd = App.proj(); if (!pd) return;
    const sp = SPECIAL[role]; const cid = uid('c');
    App.chapters.create(cid, { paras: [{ id: uid('p'), segs: [] }] });
    pd.update(x => { const i = this.insertIndex(x.chapters, role); x.chapters.splice(i, 0, { id: cid, title: sp.l, role: role }); }, { now: true });
    App.go(App.chHash(cid));
  },
  setRole(cid, role) {
    App.proj().update(x => { const c = x.chapters.find(c => c.id === cid); if (!c) return; if (role) { c.role = role; if (!c.title || /^(Capítulo|Parte|Sección|Escena|Poema)\s+\d+$/.test(c.title)) c.title = SPECIAL[role].l; } else delete c.role; }, { now: true });
    if (window.Editor && Editor.cid === cid) Editor.refreshHeader();
  },
  addMenu(anchor) {
    const k = kindOf(App.P());
    const front = Object.keys(SPECIAL).filter(r => SPECIAL[r].front), back = Object.keys(SPECIAL).filter(r => !SPECIAL[r].front);
    UI.menu(anchor, [
      { label: 'Nuevo ' + k.unit.toLowerCase(), onClick: () => App.addChapter() },
      { label: 'Nueva parte (agrupa ' + k.units.toLowerCase() + ')', onClick: () => Collections.addPart() },
      { sep: true }, { header: 'Al comienzo' }
    ].concat(front.map(r => ({ label: SPECIAL[r].l, onClick: () => this.addSpecial(r) })), [{ sep: true }, { header: 'Al final' }], back.map(r => ({ label: SPECIAL[r].l, onClick: () => this.addSpecial(r) }))));
  },
  roleMenu(anchor, cid) {
    const c = App.chapterList().find(x => x.id === cid); const cur = this.role(c);
    UI.menu(anchor, [{ label: 'Normal (numerado)', checked: !cur, onClick: () => this.setRole(cid, null) }, { sep: true }].concat(Object.keys(SPECIAL).map(r => ({ label: SPECIAL[r].l, checked: cur === r, onClick: () => this.setRole(cid, r) }))));
  },
  /* ---------- navegación ---------- */
  neighbor(dir) {
    const list = App.chapterList(); const i = list.findIndex(c => c.id === App.cid);
    return list[i + dir] || null;
  },
  goChapter(dir) {
    const c = this.neighbor(dir); if (!c) { App.toast(dir > 0 ? 'Es el último.' : 'Es el primero.'); return; }
    if (App.focus) App.keepFocus = { ultra: !!App.ultra }; // en foco y ultra foco se sigue en el mismo modo
    App.go(App.chHash(c.id));
    setTimeout(() => { const s = $('#stage'); if (s) s.scrollTop = 0; window.scrollTo(0, 0); }, 60);
  },
  navEl() {
    const prev = this.neighbor(-1), next = this.neighbor(1);
    const box = h('nav', { class: 'ch-nav', 'aria-label': 'Navegar entre ' + kindOf(App.P()).units.toLowerCase() });
    const lab = (c) => c.title || this.label(c);
    const sub = (c) => (c.title && c.title !== this.label(c)) ? this.label(c) : '';
    box.append(prev ? h('button', { type: 'button', class: 'cn-link prev', onclick: () => this.goChapter(-1), title: keys('alt', 'pgup') }, h('span', { class: 'cn-arrow', text: '←' }), h('span', { class: 'cn-txt' }, h('span', { class: 'cn-k', text: sub(prev) || 'Anterior' }), h('span', { class: 'cn-t', text: lab(prev) }))) : h('span'));
    const mid = h('div', { class: 'cn-mid' });
    mid.append(h('button', { type: 'button', class: 'cn-ico', onclick: () => this.palette(), title: 'Ir a… (' + keys('mod', 'K') + ')', 'aria-label': 'Ir a…' }, icon('search')));
    mid.append(h('button', { type: 'button', class: 'cn-ico', onclick: () => Lectura.open(App.cid), title: 'Leer como libro (' + keys('mod', 'shift', 'L') + ')', 'aria-label': 'Modo lectura' }, icon('leer')));
    if (RT.canWrite) mid.append(h('button', { type: 'button', class: 'cn-ico', onclick: (e) => this.addMenu(e.currentTarget), title: 'Agregar ' + App.unit().toLowerCase() + ', parte o sección', 'aria-label': 'Agregar' }, icon('plus')));
    box.append(mid);
    box.append(next ? h('button', { type: 'button', class: 'cn-link next', onclick: () => this.goChapter(1), title: keys('alt', 'pgdn') }, h('span', { class: 'cn-txt' }, h('span', { class: 'cn-k', text: sub(next) || 'Siguiente' }), h('span', { class: 'cn-t', text: lab(next) })), h('span', { class: 'cn-arrow', text: '→' })) : h('span'));
    return box;
  },
  /* Paleta «Ir a…»: capítulos, secciones especiales, páginas del capítulo y vistas del proyecto. */
  palette() {
    if (App.view !== 'project') return;
    const items = [];
    App.chapterList().forEach(c => items.push({ g: kindOf(App.P()).units, t: (this.role(c) || c.role === 'parte' ? '' : this.number(c.id) + '. ') + (c.title || this.label(c)), s: this.role(c) ? SPECIAL[c.role].l : c.role === 'parte' ? Collections.partLabel(c) : '', fn: () => { if (App.focus && c.id !== App.cid) App.keepFocus = { ultra: !!App.ultra }; App.go(App.chHash(c.id)); } }));
    App.chapterList().forEach(c => { const d = App.ch(c.id); if (!d || !d.data) return; d.data.paras.forEach(p => p.segs.forEach(s => { if (s.m && s.m.type === 'pend' && !s.m.done) items.push({ g: 'Por escribir', t: s.m.text.replace(/^\[|\]$/g, '') || 'por escribir', s: c.title || this.label(c), fn: () => { App.go(App.chHash(c.id)); setTimeout(() => { const pe = Editor.root && Editor.root.querySelector('p[data-id="' + p.id + '"]'); if (pe) { pe.scrollIntoView({ block: 'center' }); Editor.setActive && Editor.setActive(s.m.id, false); } }, 300); } }); })); });
    if (App.tab === 'escribir' && this.pages.length > 1) this.pages.forEach((pg, i) => items.push({ g: 'Páginas de este ' + App.unit().toLowerCase(), t: 'Página ' + (i + 1), s: pg.peek, fn: () => this.goPage(i + 1) }));
    [['Biblia', '-biblia'], ['Ideas', '-ideas'], ['Diagramas', '-diagramas'], ['Estadísticas', '-estadisticas'], ['Ajustes', '-ajustes']].forEach(([t, s]) => items.push({ g: 'Proyecto', t: t, s: '', fn: () => App.go('p-' + App.pid + s) }));
    const inp = h('input', { class: 'inp', placeholder: 'Escribe para filtrar: capítulo, página, «biblia»…', 'aria-label': 'Ir a' });
    const list = h('div', { class: 'pal-list', role: 'listbox' });
    let sel = 0, shown = [];
    const draw = () => {
      const q = fold(inp.value.trim());
      const num = /^\d+$/.test(q) ? +q : null;
      shown = items.filter(it => !q || fold(it.t + ' ' + it.s + ' ' + it.g).includes(q) || (num && (it.t === 'Página ' + num || it.t.startsWith(num + '. '))));
      sel = Math.min(sel, Math.max(0, shown.length - 1));
      list.textContent = ''; let lastG = null;
      shown.forEach((it, i) => {
        if (it.g !== lastG) { list.append(h('div', { class: 'pal-g', text: it.g })); lastG = it.g; }
        list.append(h('button', { type: 'button', class: 'pal-it' + (i === sel ? ' on' : ''), role: 'option', onclick: () => { close(); it.fn(); } }, h('span', { text: it.t }), it.s ? h('span', { class: 's', text: it.s }) : null));
      });
      const on = list.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' });
    };
    inp.addEventListener('input', () => { sel = 0; draw(); });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(shown.length - 1, sel + 1); draw(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
      else if (e.key === 'Enter') { e.preventDefault(); const it = shown[sel]; if (it) { close(); it.fn(); } }
    });
    const close = UI.modal({ title: 'Ir a…', body: h('div', { class: 'pal' }, inp, list) });
    draw();
    setTimeout(() => inp.focus(), 30);
  },
  /* ---------- páginas ---------- */
  mode() { return App.prefs.pageView === 'paginas' ? 'paginas' : 'continuo'; },
  setMode(m) { App.prefs.pageView = m; App.savePrefs(); this.layout(); App.renderStatus(); },
  layout() {
    const root = window.Editor && Editor.root; if (!root) { this.pages = []; return; }
    const paged = this.mode() === 'paginas';
    const paper = Editor.paper;
    paper.classList.toggle('paged', paged);
    // medir sin los separadores
    const ps = $$('#doc > p', document);
    ps.forEach(p => { p.classList.remove('pg-start'); p.removeAttribute('data-pg'); });
    const W = root.clientWidth || 600;
    const H = Math.round(W * PAGE_RATIO);
    const pages = []; let start = null, top = 0, first = true;
    const peek = (p) => (p.textContent || '').trim().slice(0, 60);
    ps.forEach(p => {
      const y = p.offsetTop, hgt = p.offsetHeight;
      const forced = p.classList.contains('pb') && !first;
      if (first) { start = { el: p, top: y }; pages.push({ els: [p], peek: peek(p) }); top = y; first = false; return; }
      const pg = pages[pages.length - 1];
      if (forced || (y + hgt - top > H && pg.els.length)) { pages.push({ els: [p], peek: peek(p), forced: forced }); top = y; }
      else { pg.els.push(p); if (!pg.peek) pg.peek = peek(p); }
    });
    pages.forEach((pg, i) => { pg.pids = pg.els.map(e => e.dataset.id); });
    this.pages = pages;
    if (paged) pages.forEach((pg, i) => { if (i) { pg.els[0].classList.add('pg-start'); pg.els[0].dataset.pg = String(i); } });
    root.dataset.pages = String(pages.length);
    this.track();
  },
  layoutSoon: debounce(function () { Pages.layout(); }, 300),
  pageOfPid(pid) { const i = this.pages.findIndex(pg => pg.pids.includes(pid)); return i < 0 ? 1 : i + 1; },
  track(fromScroll) {
    const c = window.Editor && Editor.lastCaret;
    let n = c ? this.pageOfPid(c.pid) : 1;
    if ((fromScroll || !c) && this.pages.length) {
      const mid = window.innerHeight * 0.4; n = 1;
      this.pages.forEach((pg, i) => { const r = pg.els[0].getBoundingClientRect(); if (r.top < mid) n = i + 1; });
    }
    if (n !== this.cur) { this.cur = n; App.renderStatus(); }
  },
  goPage(n) {
    const pg = this.pages[n - 1]; if (!pg) return;
    pg.els[0].scrollIntoView({ block: 'start', behavior: 'smooth' });
    if (window.Editor && Editor.setCaret && RT.canWrite) Editor.setCaret({ pid: pg.pids[0], off: 0 });
    this.cur = n; App.renderStatus();
  },
  pagePids(n) { const pg = this.pages[(n || this.cur) - 1]; return pg ? pg.pids.slice() : []; },
  /* ---------- saltos de página ---------- */
  hasBreak(pid) { const d = Editor.cdoc && Editor.cdoc.data; const p = d && d.paras.find(x => x.id === pid); return !!(p && p.pb); },
  toggleBreak(pid) {
    pid = pid || (Editor.lastCaret && Editor.lastCaret.pid);
    if (!pid || !Editor.cdoc) { App.toast('Pon el cursor en el párrafo que debe empezar en una página nueva.'); return; }
    const i = Editor.cdoc.data.paras.findIndex(p => p.id === pid);
    if (i === 0) { App.toast('El primer párrafo ya empieza en una página nueva.'); return; }
    Editor.pushUndo();
    Editor.cdoc.update(d => { const p = d.paras.find(x => x.id === pid); if (p) { if (p.pb) delete p.pb; else p.pb = true; } }, { silent: true });
    Editor.render(true); Editor.afterChange();
  },
  /* ---------- revisión de una página ---------- */
  reviewQuick() { const pids = this.pagePids(); if (!pids.length) return; Checker.run(App.cid, pids).then(r => r && App.toast('Página ' + this.cur + ' revisada: ' + plural(r.added || 0, 'marca nueva', 'marcas nuevas') + '.')); },
  reviewAI() { const pids = this.pagePids(); if (!pids.length || !Review.ok()) return; pids.forEach(pid => Review.enqueue({ cid: App.cid, pid: pid, force: true })); App.toast('Revisando la página ' + this.cur + ' (' + plural(pids.length, 'párrafo') + ').'); }
};
window.Pages = Pages;
document.addEventListener('keydown', (e) => {
  if (!window.App || App.view !== 'project') return;
  const mod = e.metaKey || e.ctrlKey;
  if (mod && !e.shiftKey && !e.altKey && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); Pages.palette(); return; }
  if (App.tab === 'escribir' && e.altKey && !mod && (e.key === 'PageDown' || e.key === 'PageUp')) { e.preventDefault(); Pages.goChapter(e.key === 'PageDown' ? 1 : -1); }
});
document.addEventListener('scroll', rafThrottle(() => { if (window.Editor && Editor.root) Pages.track(true); }), true);
