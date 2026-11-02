/* ============ biblia: fichas, cabos sueltos y decisiones ============ */
const Bible = {
  st: null, confirm: null,
  pd() { return App.proj(); },
  set(fn) { this.pd().update(fn, { silent: true }); },
  render(st) {
    this.st = st || this.st;
    const pd = this.pd(); if (!pd || !this.st) return;
    const P = pd.data, ro = !RT.canWrite;
    this.st.textContent = '';
    const wrap = h('div', { class: 'bible' });
    const actions = h('div', { class: 'row' });
    if (RT.sample && !ro && App.chapterList().length) actions.append(btn('Extraer de un ' + App.unit().toLowerCase(), (e) => this.pickExtract(e.currentTarget)));
    if (!ro) actions.append(btn([icon('plus'), 'Sección'], () => this.addSection()));
    wrap.append(h('div', { class: 'vhead', style: 'margin:0' }, h('div', null, h('h2', { text: 'Biblia' }), h('p', { text: 'Lo que ya está decidido sobre tu mundo. El revisor lo usa para detectar contradicciones.' })), actions));
    const texts = this.chapterTexts();
    if (!ro && window.Coherence) { Coherence.markSeen(P); const sy = this.syncPanel(P); if (sy) wrap.append(sy); }
    ((P.bible && P.bible.sections) || []).forEach(s => wrap.append(this.section(s, texts, ro)));
    wrap.append(this.threads(P, ro), this.decisions(P, ro));
    this.st.append(wrap);
    $$('textarea', wrap).forEach(autoGrow);
  },
  /* El texto manda: cambios del texto que la biblia todavía no refleja. */
  syncPanel(P) {
    const list = Coherence.bibleSync(P);
    if (!list.length) return null;
    const box = h('div', { class: 'panel bible-sync' }, h('div', { class: 'row', style: 'justify-content:space-between;gap:.6rem' },
      h('div', null, h('h3', { style: 'margin:0', text: 'Al día con el texto' }), h('p', { class: 'muted', style: 'margin:.2rem 0 0;font-size:.82rem', text: 'El texto manda: estas fichas no coinciden con lo que escribiste (o con lo que borraste).' })),
      list.length > 1 ? btn('Aplicar todo', () => { list.forEach(sg => Coherence.applySync(sg)); App.toast('Biblia actualizada con el texto.'); this.render(); }, 'small primary') : null));
    list.forEach(sg => box.append(h('div', { class: 'bs-it' }, h('span', { text: sg.text }),
      h('div', { class: 'row', style: 'gap:.3rem' }, btn(sg.apply, () => { Coherence.applySync(sg); this.render(); }, 'small'), btn('Mantener', () => { Coherence.ignoreSync(sg); this.render(); }, 'small ghost')))));
    return box;
  },
  chapterTexts() {
    return App.chapterList().map((c, i) => { const d = App.ch(c.id); return { id: c.id, n: i + 1, title: c.title, text: d && d.data ? fold(d.data.paras.map(parText).join('\n')) : '' }; });
  },
  appearances(card, texts) {
    const names = [card.title].concat(((card.fields && card.fields['También llamado']) || '').split(',')).map(s => (s || '').trim()).filter(s => s.length > 1);
    if (!names.length) return [];
    const res = [];
    texts.forEach(t => {
      let n = 0;
      names.forEach(nm => { const re = buildMatcher(nm, { word: true }); if (re) n += findInText(t.text, re, { exact: true }).length; });
      if (n) res.push({ id: t.id, n: n, label: (t.title || App.unit() + ' ' + t.n), idx: t.n });
    });
    return res;
  },
  section(s, texts, ro) {
    const sec = h('section', { class: 'bsec', 'aria-label': s.label });
    const name = h('input', { id: 'bs-' + s.id, value: s.label, 'aria-label': 'Nombre de la sección', readonly: ro || null, size: Math.max(6, s.label.length + 1) });
    name.addEventListener('input', () => { name.size = Math.max(6, name.value.length + 1); this.set(x => { const z = this.sec(x, s.id); if (z) z.label = name.value; }); });
    const hd = h('div', { class: 'bhd' }, name, h('span', { class: 'muted', style: 'font-size:.8125rem', text: plural((s.items || []).length, 'ficha') }));
    if (!ro) {
      hd.append(h('span', { class: 'spacer' }), btn([icon('plus'), 'Agregar'], () => this.addItem(s.id), 'small'), ibtn('more', 'Opciones de la sección', (e) => this.secMenu(e.currentTarget, s)));
    }
    sec.append(hd);
    const cards = h('div', { class: 'cards' });
    (s.items || []).forEach(it => cards.append(this.card(s, it, texts, ro)));
    if (!(s.items || []).length) cards.append(h('div', { class: 'empty', style: 'padding:1.2rem', text: ro ? 'Sin fichas.' : 'Sin fichas todavía. Agrega una o usa «Extraer» desde un ' + App.unit().toLowerCase() + '.' }));
    sec.append(cards);
    return sec;
  },
  sec(x, sid) { return ((x.bible && x.bible.sections) || []).find(z => z.id === sid); },
  item(x, sid, iid) { const s = this.sec(x, sid); return s && (s.items || []).find(z => z.id === iid); },
  card(s, it, texts, ro) {
    const c = h('article', { class: 'card', dataset: { id: it.id } });
    const t = h('input', { class: 'ct', id: 'b-' + it.id + '-t', value: it.title || '', placeholder: 'Nombre', 'aria-label': 'Nombre', readonly: ro || null });
    t.addEventListener('input', () => this.set(x => { const z = this.item(x, s.id, it.id); if (z) z.title = t.value; }));
    c.append(t);
    if ((s.fields || []).length) {
      const fl = h('div', { class: 'fl' });
      s.fields.forEach((f, i) => {
        const inp = h('textarea', { id: 'b-' + it.id + '-f' + i, rows: '1', 'aria-label': f, readonly: ro || null, placeholder: '—', class: 'fv' });
        inp.value = (it.fields && it.fields[f]) || '';
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
        inp.addEventListener('input', () => this.set(x => { const z = this.item(x, s.id, it.id); if (z) { z.fields = z.fields || {}; z.fields[f] = inp.value; } }));
        fl.append(h('label', { for: inp.id, text: f }), inp);
      });
      c.append(fl);
    }
    const ta = h('textarea', { id: 'b-' + it.id + '-b', placeholder: 'Notas', 'aria-label': 'Notas', readonly: ro || null, rows: String(Math.min(10, Math.max(2, ((it.body || '').match(/\n/g) || []).length + 2))) });
    ta.value = it.body || '';
    ta.addEventListener('input', () => this.set(x => { const z = this.item(x, s.id, it.id); if (z) z.body = ta.value; }));
    c.append(ta);
    const apps = this.appearances(it, texts);
    if (apps.length) {
      const a = h('div', { class: 'apps' }, h('span', { text: 'Aparece en' }));
      apps.forEach(ap => a.append(h('button', { type: 'button', title: 'Buscar en ' + ap.label, text: ap.idx + ' ×' + ap.n, onclick: () => { App.go(App.chHash(ap.id)); setTimeout(() => Search.open(it.title), 120); } })));
      c.append(a);
    }
    if (!ro) {
      const del = h('button', { class: 'act' + (this.confirm === it.id ? ' warn' : ''), type: 'button', text: this.confirm === it.id ? '¿Eliminar ficha?' : 'Eliminar' });
      del.addEventListener('click', () => {
        if (this.confirm !== it.id) { this.confirm = it.id; this.render(); setTimeout(() => { if (this.confirm === it.id) { this.confirm = null; if (App.tab === 'biblia') this.render(); } }, 3000); return; }
        this.confirm = null;
        this.pd().update(x => { const z = this.sec(x, s.id); if (z) z.items = z.items.filter(q => q.id !== it.id); }, { now: true });
        this.render();
      });
      c.append(h('div', { class: 'cfoot' }, del));
    }
    return c;
  },
  addItem(sid) {
    const id = uid('i');
    this.pd().update(x => { const z = this.sec(x, sid); if (z) { z.items = z.items || []; z.items.push({ id: id, title: '', fields: {}, body: '' }); } }, { now: true });
    this.render();
    setTimeout(() => { const t = $('#b-' + id + '-t'); if (t) { t.focus(); t.scrollIntoView({ block: 'center' }); } }, 30);
  },
  async addSection() {
    const name = await UI.prompt('Nueva sección', 'Nombre (por ejemplo: Objetos, Época, Fuentes)', '', 'Crear');
    if (!name) return;
    this.pd().update(x => { x.bible = x.bible || { sections: [] }; x.bible.sections.push({ id: uid('s'), label: name, fields: [], graph: false, items: [] }); }, { now: true });
    this.render();
  },
  secMenu(a, s) {
    UI.menu(a, [
      { label: 'Editar campos', onClick: async () => { const v = await UI.prompt('Campos de «' + s.label + '»', 'Separados por coma (por ejemplo: Rol, Edad, Rasgos)', (s.fields || []).join(', ')); if (v != null) { this.pd().update(x => { const z = this.sec(x, s.id); if (z) z.fields = v.split(',').map(q => q.trim()).filter(Boolean); }, { now: true }); this.render(); } } },
      { label: 'Mostrar en el mapa de relaciones', checked: !!s.graph, onClick: () => { this.pd().update(x => { const z = this.sec(x, s.id); if (z) z.graph = !z.graph; }, { now: true }); this.render(); } },
      { label: 'Subir sección', onClick: () => { this.pd().update(x => { const a = x.bible.sections; const i = a.findIndex(z => z.id === s.id); if (i > 0) a.splice(i - 1, 0, a.splice(i, 1)[0]); }, { now: true }); this.render(); } },
      { sep: true },
      { label: 'Eliminar sección', danger: true, onClick: async () => { if (await UI.confirm('Eliminar sección', 'Se borrará «' + s.label + '» y sus ' + plural((s.items || []).length, 'ficha') + '.', 'Eliminar', true)) { this.pd().update(x => { x.bible.sections = x.bible.sections.filter(z => z.id !== s.id); }, { now: true }); this.render(); } } }
    ]);
  },
  pickExtract(a) {
    UI.menu(a, App.chapterList().map((c, i) => ({ label: (i + 1) + '. ' + (c.title || App.unit()), onClick: () => Review.extract(c.id) })), { alignLeft: true });
  },

  threads(P, ro) {
    const sec = h('section', { class: 'bsec', 'aria-label': 'Cabos sueltos' });
    const hd = h('div', { class: 'bhd' }, h('h3', { style: 'font:400 1.7rem/1.1 var(--f-display);margin:0', text: 'Cabos sueltos' }), h('span', { class: 'muted', style: 'font-size:.8125rem', text: plural((P.threads || []).filter(t => t.status !== 'done').length, 'abierto', 'abiertos') }));
    if (!ro) hd.append(h('span', { class: 'spacer' }), btn([icon('plus'), 'Agregar'], () => { const id = uid('t'); this.pd().update(x => { x.threads = x.threads || []; x.threads.push({ id: id, title: '', body: '', status: 'open', at: Date.now() }); }, { now: true }); this.render(); setTimeout(() => { const t = $('#th-' + id + '-t'); if (t) t.focus(); }, 30); }, 'small'));
    sec.append(hd);
    const lst = h('div', { class: 'lst' });
    const list = (P.threads || []).slice().sort((a, b) => (a.status === 'done') - (b.status === 'done'));
    if (!list.length) lst.append(h('div', { class: 'empty', style: 'padding:1.1rem', text: 'Preguntas abiertas, promesas al lector, datos por fijar. Puedes crearlos desde una nota de coherencia.' }));
    list.forEach(t => {
      const done = t.status === 'done';
      const ti = h('input', { class: 'ti', id: 'th-' + t.id + '-t', value: t.title || '', placeholder: 'Cabo suelto', 'aria-label': 'Cabo suelto', readonly: ro || null });
      ti.addEventListener('input', () => this.set(x => { const z = x.threads.find(q => q.id === t.id); if (z) z.title = ti.value; }));
      const tb = h('textarea', { id: 'th-' + t.id + '-b', placeholder: 'Detalle', 'aria-label': 'Detalle', readonly: ro || null, rows: '1' });
      tb.value = t.body || '';
      tb.addEventListener('input', () => this.set(x => { const z = x.threads.find(q => q.id === t.id); if (z) z.body = tb.value; }));
      const side = h('div', { class: 'row', style: 'flex:none' });
      side.append(h('button', { class: 'pill ' + (done ? 'done' : 'open'), type: 'button', disabled: ro || null, text: done ? 'resuelto' : 'abierto', title: done ? 'Reabrir' : 'Marcar resuelto', onclick: () => { this.pd().update(x => { const z = x.threads.find(q => q.id === t.id); if (z) z.status = done ? 'open' : 'done'; }, { now: true }); this.render(); } }));
      if (t.markId && t.cid && App.ch(t.cid) && findMark(App.ch(t.cid).data, t.markId)) side.append(btn('Ver marca', () => { App.go(App.chHash(t.cid)); setTimeout(() => { const sp = $('.m[data-id="' + CSS.escape(t.markId) + '"]'); if (sp) { sp.scrollIntoView({ block: 'center' }); Editor.setActive(t.markId, true); } }, 150); }, 'small ghost'));
      if (!ro) side.append(ibtn('trash', 'Eliminar cabo suelto', () => { this.pd().update(x => { x.threads = x.threads.filter(q => q.id !== t.id); }, { now: true }); this.render(); }));
      lst.append(h('div', { class: 'li' + (done ? ' done' : '') }, h('div', { class: 'grow' }, ti, tb), side));
    });
    sec.append(lst);
    return sec;
  },
  decisions(P, ro) {
    const sec = h('section', { class: 'bsec', 'aria-label': 'Decisiones' });
    sec.append(h('div', { class: 'bhd' }, h('h3', { style: 'font:400 1.7rem/1.1 var(--f-display);margin:0', text: 'Decisiones' }), h('span', { class: 'muted', style: 'font-size:.8125rem', text: 'Lo que decidiste y no quieres olvidar.' })));
    const lst = h('div', { class: 'lst' });
    (P.decisions || []).forEach(d => {
      const ti = h('input', { class: 'ti', id: 'dc-' + d.id, value: d.text || '', 'aria-label': 'Decisión', readonly: ro || null, style: 'font-weight:400' });
      ti.addEventListener('input', () => this.set(x => { const z = x.decisions.find(q => q.id === d.id); if (z) z.text = ti.value; }));
      lst.append(h('div', { class: 'li' }, h('div', { class: 'grow' }, ti, h('span', { class: 'muted', style: 'font:400 .6875rem var(--f-mono)', text: fmtDate(d.at) + (d.by && d.by !== RT.me && window.Collab ? ' · ' + Collab.name(d.by) : '') })),
        ro ? null : ibtn('trash', 'Eliminar decisión', () => { this.pd().update(x => { x.decisions = x.decisions.filter(q => q.id !== d.id); }, { now: true }); this.render(); })));
    });
    if (!ro) {
      const inp = h('input', { class: 'inp', id: 'dc-new', placeholder: 'Ej.: El protagonista tiene 27 años y nunca dice su nombre.' });
      const addD = () => { const v = inp.value.trim(); if (!v) return; this.pd().update(x => { x.decisions = x.decisions || []; x.decisions.push({ id: uid('d'), text: v, at: Date.now(), by: RT.me || 'local' }); }, { now: true }); this.render(); setTimeout(() => { const n = $('#dc-new'); if (n) n.focus(); }, 20); };
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addD(); } });
      lst.append(h('div', { class: 'row' }, h('div', { style: 'flex:1;min-width:0' }, inp), btn('Anotar', addD, 'primary')));
    }
    sec.append(lst);
    return sec;
  },
  remoteRefresh() {
    const a = document.activeElement;
    const id = a && a.id, s = a && a.selectionStart, e = a && a.selectionEnd;
    const y = window.scrollY;
    this.render();
    if (id) { const n = document.getElementById(id); if (n) { n.focus(); try { n.setSelectionRange(s, e); } catch (er) {} } }
    window.scrollTo(0, y);
  }
};
window.Bible = Bible;
