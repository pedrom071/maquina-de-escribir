/* ============ editor: la hoja, las marcas y las notas al margen ============ */
function computeEcos(paras) {
  const toks = [];
  const stem = (f) => (f.replace(/(amente|imiento|aciones|ciones|cion|idades|idad|ismos|ismo|istas|ista|ando|iendo|aron|ieron|abamos|aban|abas|aba|ados|adas|idos|idas|ada|ado|ida|ido|ias|ian|ia|ar|er|ir|es|as|os|a|o|e|s)$/, '') || f).slice(0, 7);
  paras.forEach(p => {
    const text = parText(p); const re = /[\p{L}\p{N}]+/gu; let m;
    while ((m = re.exec(text))) {
      const f = fold(m[0]);
      if (f.length < 4 || STOP.has(f) || /^\d+$/.test(f)) continue;
      toks.push({ pid: p.id, s: m.index, e: m.index + m[0].length, k: stem(f) });
    }
  });
  const last = new Map(), hit = new Set();
  toks.forEach((t, i) => { const j = last.get(t.k); if (j != null && i - j <= 22) { hit.add(j); hit.add(i); } last.set(t.k, i); });
  return Array.from(hit).sort((a, b) => a - b).map(i => toks[i]);
}

const Editor = {
  root: null, cid: null, cdoc: null, stage: null, writeEl: null, paper: null, margin: null, titleEl: null, chipsEl: null,
  active: null, editingNote: null, replyTo: null, noteDraft: {}, confirmDel: null,
  hist: new Map(), dirty: new Map(), lastCaret: null, composing: false, selWords: 0, narrow: false,
  pendingRemote: false, sessionEdited: new Set(), ro: null, reviewing: null,

  /* ---------- montaje ---------- */
  mount(stage, cid) {
    const d = App.ch(cid);
    if (this.root && this.cid === cid && stage.contains(this.root)) { this.refreshHeader(); this.layoutSoon(); return; }
    this.unmount();
    this.stage = stage; this.cid = cid; this.cdoc = d;
    this.active = null; this.editingNote = null; this.replyTo = null; this.confirmDel = null;
    stage.textContent = '';
    const P = App.P();
    const bar = this.buildBar();
    this.writeEl = h('div', { class: 'write' });
    this.paper = h('article', { class: 'paper' });
    const eyebrow = h('div', { class: 'ch-eyebrow', id: 'ch-eyebrow' });
    this.titleEl = h('input', { class: 'ch-title', id: 'ch-title', 'aria-label': 'Título', value: App.chTitle(cid), readonly: !RT.canWrite || null, placeholder: 'Sin título' });
    this.titleEl.addEventListener('input', () => {
      const v = this.titleEl.value;
      App.proj().update(x => { const c = x.chapters.find(c => c.id === cid); if (c) c.title = v; }, { silent: true });
      App.renderSideSoon(); App.renderCrumbs();
    });
    this.titleEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.focusStart(); } });
    const pstyle = (P.style && P.style.paragraph) || 'sangria';
    this.root = h('div', {
      class: 'doc ' + pstyle, id: 'doc', contenteditable: RT.canWrite ? 'true' : 'false', spellcheck: 'true', lang: 'es',
      role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Texto', 'data-ph': 'Empieza a escribir…', translate: 'no'
    });
    this.margin = h('div', { class: 'margin', id: 'margin', 'aria-label': 'Notas del corrector' });
    this.navEl = h('nav');
    this.paper.append(eyebrow, this.titleEl, this.root, this.navEl);
    this.writeEl.append(this.paper, this.margin);
    stage.append(bar);
    if (RT.web && RT.canWrite && !AI.ready() && !App.prefs.aiBannerOff) {
      const ban = h('div', { class: 'ai-banner', role: 'note' },
        icon('spark'),
        h('div', null, h('b', { text: 'Estás usando la revisión básica.' }), ' Marca ortografía, repeticiones y frases largas. Conecta tu IA para que además revise coherencia, ambigüedades y te haga informes.'),
        h('div', { class: 'row' }, btn('Conectar IA', () => AI.open(), 'primary small'), btn('Ahora no', () => { App.prefs.aiBannerOff = true; App.savePrefs(); ban.remove(); }, 'ghost small')));
      stage.append(ban);
    }
    stage.append(this.writeEl);
    this.bind();
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) {}
    this.ro = new ResizeObserver(() => { this.checkNarrow(); this.layoutSoon(); if (window.Pages) Pages.layoutSoon(); });
    this.ro.observe(this.writeEl);
    this.narrow = null; // cada hoja nueva vuelve a medir su ancho (al volver al proyecto en el celular)
    this.checkNarrow();
    this.refreshHeader();
    this.render();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => this.layoutSoon());
    document.body.classList.toggle('clean', !!App.prefs.clean);
    if (window.Versions) Versions.prime(cid);
    if (window.Review) Review.onMount(cid);
    if (App.focusOnMount && RT.canWrite) { App.focusOnMount = false; setTimeout(() => this.focusStart(), 30); }
  },
  unmount() {
    if (!this.root) return;
    if (this.cdoc) this.cdoc.flush();
    if (this.ro) this.ro.disconnect();
    this.hideSelbar(); this.closeSheet();
    if (window.CSS && CSS.highlights) ['eco', 'busca', 'busca-act', 'larga'].forEach(k => CSS.highlights.delete(k));
    if (App.focus) this.setFocus(false);
    document.body.classList.remove('clean');
    this.root = null; this.cdoc = null; this.cid = null; this.stage = null;
  },
  focusStart() { if (!this.root) return; this.root.focus(); const p = this.cdoc.data.paras[0]; if (p) this.setCaret({ pid: p.id, off: 0 }); },
  checkNarrow() {
    if (!this.writeEl) return;
    const n = this.writeEl.clientWidth < 860;
    if (n !== this.narrow) { this.narrow = n; this.writeEl.classList.toggle('narrow', n); this.margin.hidden = n; this.renderNotes(); }
  },
  refreshHeader() {
    if (!this.root) return;
    const P = App.P(), k = kindOf(P);
    const c = App.chapterList().find(x => x.id === this.cid);
    const part = c && c.role !== 'parte' ? Collections.partOf(this.cid) : null;
    if (window.Ideas) setTimeout(() => Ideas.chapterBadge(), 0);
    const eb = $('#ch-eyebrow'); if (eb) eb.textContent = Pages.role(c) ? SPECIAL[c.role].l : (c && c.role === 'parte') ? Collections.partLabel(c) + ' · ' + plural(Collections.children(c.id).length, k.unit.toLowerCase(), k.units.toLowerCase()) : (part ? Collections.partLabel(part) + ' · ' : '') + k.unit + ' ' + Pages.number(this.cid) + ' de ' + Pages.regularCount();
    if (this.navEl) { const nn = Pages.navEl(); this.navEl.replaceWith(nn); this.navEl = nn; }
    if (document.activeElement !== this.titleEl) this.titleEl.value = App.chTitle(this.cid);
    const pstyle = (P.style && P.style.paragraph) || 'sangria';
    this.root.classList.toggle('sangria', pstyle === 'sangria'); this.root.classList.toggle('bloque', pstyle === 'bloque');
  },
  projectChanged() { this.refreshHeader(); this.renderNotes(); },

  /* ---------- barra de herramientas ---------- */
  buildBar() {
    const bar = h('div', { class: 'wbar' });
    this.chipsEl = h('div', { class: 'chips', role: 'group', 'aria-label': 'Filtrar marcas' });
    this.chipsEl.addEventListener('click', (e) => {
      const b = e.target.closest('.chip'); if (!b) return;
      const t = b.dataset.type, off = new Set(App.prefs.off);
      if (t === 'all') off.clear();
      else if (off.size === 0) TKEYS.forEach(k => { if (k !== t) off.add(k); });
      else { if (off.has(t)) off.delete(t); else off.add(t); if (off.size === TKEYS.length) off.clear(); }
      App.prefs.off = Array.from(off); App.savePrefs();
      this.decorate(); this.renderNotes(); this.updateChips();
    });
    const tools = h('div', { class: 'tools' });
    if (RT.canWrite) tools.append(btn([icon('spark'), h('span', { class: 'lbl', text: 'Revisar' })], (e) => this.reviewMenu(e.currentTarget), 'small'));
    if ((App.P() || {}).kind === 'poesia') tools.append(btn([icon('metro'), h('span', { class: 'lbl', text: 'Métrica' })], () => Metrica.open(), 'small'));
    tools.append(btn([icon('eye'), h('span', { class: 'lbl', text: 'Ver' })], (e) => this.viewMenu(e.currentTarget), 'small'));
    tools.append(ibtn('leer', 'Leer como libro (' + keys('mod', 'shift', 'L') + ')', () => Lectura.open(this.cid)));
    tools.append(ibtn('clock', 'Historial de versiones', () => Versions.open(this.cid)));
    tools.append(ibtn('more', 'Más opciones', (e) => this.moreMenu(e.currentTarget)));
    bar.append(this.chipsEl, tools);
    return bar;
  },
  updateChips() {
    if (!this.chipsEl || !this.cdoc) return;
    const counts = {}; TKEYS.forEach(k => counts[k] = 0);
    let total = 0;
    allMarks(this.cdoc.data).forEach(x => { if (!x.m.done) { counts[x.m.type] = (counts[x.m.type] || 0) + 1; total++; } });
    const off = new Set(App.prefs.off);
    this.chipsEl.textContent = '';
    const chip = (k, g, l, c, on) => h('button', { class: 'chip ' + k + (c === 0 && k !== 'all' ? ' zero' : ''), type: 'button', dataset: { type: k }, 'aria-pressed': on ? 'true' : 'false', title: l }, h('span', { class: 'g', text: g }), h('span', { class: 'lb', text: l }), h('span', { class: 'c', text: String(c) }));
    this.chipsEl.append(chip('all', '∗', 'Todo', total, off.size === 0));
    TKEYS.forEach(k => this.chipsEl.append(chip(k, TYPES[k].g, TYPES[k].l, counts[k], !off.has(k))));
  },
  reviewMenu(a) {
    const dirtyN = (this.dirty.get(this.cid) || new Set()).size;
    const unit = App.unit().toLowerCase();
    const aiOk = !!RT.sample && (!RT.web || AI.ready());
    const items = [
      { header: 'Sin IA' },
      { label: 'Revisión rápida del ' + unit, onClick: () => Checker.chapter(this.cid) },
      Pages.pages.length > 1 ? { label: 'Revisión rápida de esta página (' + Pages.cur + ')', onClick: () => Pages.reviewQuick() } : null,
      { label: 'Revisión rápida al escribir', checked: App.prefs.autoLocal !== false, keep: true, onClick: () => { App.prefs.autoLocal = App.prefs.autoLocal === false; App.savePrefs(); } },
      { sep: true },
      { header: 'Diálogo' },
      { label: 'Abrir línea de diálogo (—)', kbd: keys('alt', '-'), onClick: () => Dialogo.open() },
      { label: 'Inciso del narrador ( —…—)', kbd: keys('alt', 'I'), onClick: () => Dialogo.inciso() },
      { label: 'Revisar diálogos del ' + unit, onClick: () => Dialogo.check(this.cid) },
      { label: 'Cómo se escriben los diálogos…', onClick: () => Dialogo.help() },
      { sep: true },
      { header: RT.web ? 'Con IA' + (aiOk ? '' : ' (configúrala primero)') : 'Con Claude' }
    ];
    if (!RT.sample) { UI.menu(a, items.filter(Boolean).slice(0, items.filter(Boolean).length - 2)); return; }
    UI.menu(a, items.concat([
      { label: 'Revisar este párrafo', kbd: keys('mod', 'enter'), onClick: () => { const c = this.lastCaret; const pid = c ? c.pid : (this.cdoc.data.paras[0] || {}).id; Review.reviewPara(this.cid, pid, true); } },
      { label: 'Revisar párrafos editados' + (dirtyN ? ' (' + dirtyN + ')' : ''), kbd: keys('mod', 'shift', 'enter'), disabled: !dirtyN, onClick: () => Review.reviewDirty(this.cid) },
      Pages.pages.length > 1 ? { label: 'Revisar esta página (' + Pages.cur + ')', onClick: () => Pages.reviewAI() } : null,
      { label: 'Revisar todo el ' + App.unit().toLowerCase(), onClick: () => Review.reviewChapter(this.cid) },
      { sep: true },
      { label: 'Informe del ' + App.unit().toLowerCase(), onClick: () => Review.report(this.cid) },
      { label: 'Extraer a la biblia', onClick: () => Review.extract(this.cid) },
      { label: 'Preguntar al revisor', onClick: () => Review.ask() },
      { sep: true },
      RT.web
        ? { label: 'IA al hacer una pausa', checked: App.prefs.autoAI === true, keep: true, onClick: () => { App.prefs.autoAI = !(App.prefs.autoAI === true); App.savePrefs(); } }
        : { label: 'Revisar sola al hacer una pausa', checked: !!App.prefs.auto, keep: true, onClick: () => { App.prefs.auto = !App.prefs.auto; App.savePrefs(); App.toast(App.prefs.auto ? 'Revisión automática activada.' : 'Revisión automática desactivada.'); } },
      RT.web ? { label: 'Configurar IA…', onClick: () => AI.open() } : null
    ]), { alignLeft: false });
  },
  viewMenu(a) {
    const toggle = (k, after) => () => { App.prefs[k] = !App.prefs[k]; App.savePrefs(); after && after(); };
    UI.menu(a, [
      { header: 'Hoja' },
      { label: 'Hoja continua', checked: Pages.mode() === 'continuo', onClick: () => Pages.setMode('continuo') },
      { label: 'Páginas numeradas', checked: Pages.mode() === 'paginas', onClick: () => Pages.setMode('paginas') },
      { sep: true },
      { header: 'Mostrar' },
      { label: 'Ecos (palabras repetidas cerca)', checked: !!App.prefs.ecos, keep: true, onClick: toggle('ecos', () => this.applyHighlights()) },
      { label: 'Texto limpio, sin marcas', checked: !!App.prefs.clean, keep: true, onClick: toggle('clean', () => { document.body.classList.toggle('clean', App.prefs.clean); this.renderNotes(); this.applyHighlights(); }) },
      { label: 'Ocultar notas resueltas', checked: !!App.prefs.hideDone, keep: true, onClick: toggle('hideDone', () => { this.decorate(); this.renderNotes(); }) },
      { sep: true },
      { label: 'Sílabas y rima al margen (métrica)', checked: Metrica.on(), keep: true, onClick: () => { App.prefs.metric = !Metrica.on(); App.savePrefs(); Metrica.decorate(); } },
      { label: 'Medir versos…', onClick: () => Metrica.open() },
      { sep: true },
      { label: 'Ver todas las notas en lista', onClick: () => this.notesDrawer() },
      { label: 'Modo foco', kbd: keys('mod', '.'), onClick: () => this.setFocus(true) },
      { label: 'Ultra foco: solo escribir, sin marcas', kbd: keys('mod', 'shift', '.'), onClick: () => this.setUltra(true) },
      { label: 'Leer como libro (una o dos páginas)', kbd: keys('mod', 'shift', 'L'), onClick: () => Lectura.open(this.cid) }
    ]);
  },
  moreMenu(a) {
    const items = [
      { label: 'Guardar una versión', kbd: keys('mod', 'S'), disabled: !RT.canWrite, onClick: () => Versions.saveVersion(this.cid, 'Guardada a mano').then(ok => ok && App.toast('Versión guardada.')) },
      { label: (this.lastCaret && Pages.hasBreak(this.lastCaret.pid)) ? 'Quitar el salto de página' : 'Salto de página antes de este párrafo', kbd: keys('alt', 'enter'), disabled: !RT.canWrite, onClick: () => Pages.toggleBreak() },
      { label: 'Hueco por escribir', kbd: keys('alt', 'H'), disabled: !RT.canWrite, onClick: () => this.insertGap() },
      { label: 'Separador de escena (* * *)', kbd: keys('alt', 'S'), disabled: !RT.canWrite, onClick: () => this.insertSep() },
      { label: 'Anotar una idea', kbd: keys('alt', 'N'), disabled: !RT.canWrite, onClick: () => Ideas.quick() },
      { label: 'Ir a…', kbd: keys('mod', 'K'), onClick: () => Pages.palette() },
      { sep: true },
      { label: 'Dividir aquí: lo que sigue pasa a un ' + App.unit().toLowerCase() + ' nuevo', disabled: !RT.canWrite || !this.lastCaret, onClick: () => this.splitChapter() },
      { label: 'Exportar este ' + App.unit().toLowerCase(), onClick: () => IO.openExport(App.pid, this.cid) },
      { label: 'Crear documento en Claude Docs', disabled: !RT.docs, onClick: () => IO.toClaudeDocs(this.cid) }
    ];
    if (window.Collab && Collab.canSendState) items.push({ label: 'Conversar sobre este texto en el chat', onClick: () => Collab.sendChapter(this.cid) });
    UI.menu(a, items);
  },

  /* ---------- eventos ---------- */
  bind() {
    const r = this.root;
    r.addEventListener('input', (e) => { if (!this.composing) this.sync(e.inputType); });
    r.addEventListener('beforeinput', (e) => this.onBeforeInput(e));
    r.addEventListener('keydown', (e) => this.onKeydown(e));
    r.addEventListener('paste', (e) => this.onPaste(e));
    r.addEventListener('compositionstart', () => { this.composing = true; });
    r.addEventListener('compositionend', () => { this.composing = false; setTimeout(() => { this.sync('insertCompositionText'); if (this.pendingRemote) this.onRemote('merge'); }, 0); });
    r.addEventListener('click', (e) => { const m = e.target.closest('.m'); if (m && !m.classList.contains('off') && !document.body.classList.contains('clean') && !App.ultra) this.setActive(m.dataset.id, true); });
    r.addEventListener('mouseover', (e) => { const m = e.target.closest('.m'); if (!App.ultra) this.hover(m ? m.dataset.id : null); });
    r.addEventListener('mouseleave', () => this.hover(null));
    r.addEventListener('dragstart', (e) => { if (!RT.canWrite) e.preventDefault(); });
    r.addEventListener('blur', () => { setTimeout(() => { if (this.pendingRemote && document.activeElement !== this.root) this.onRemote('merge'); }, 50); });
    this.margin.addEventListener('mouseover', (e) => { const n = e.target.closest('.note'); this.hover(n ? n.dataset.id : null); });
    this.margin.addEventListener('mouseleave', () => this.hover(null));
    this.margin.addEventListener('click', (e) => this.onNoteClick(e));
    this.margin.addEventListener('input', (e) => { if (e.target.tagName === 'TEXTAREA') this.noteDraft[e.target.dataset.k] = e.target.value; });
    this.margin.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('note')) { e.preventDefault(); this.setActive(e.target.dataset.id, false); return; } this.onNoteKey(e); });
  },
  onBeforeInput(e) {
    const t = e.inputType || '';
    if (!RT.canWrite) { e.preventDefault(); return; }
    if (t === 'historyUndo') { e.preventDefault(); this.undo(); return; }
    if (t === 'historyRedo') { e.preventDefault(); this.redo(); return; }
    if (t.indexOf('format') === 0) { e.preventDefault(); return; }
    if (t === 'insertParagraph' || t === 'insertLineBreak') { e.preventDefault(); this.splitAtCaret(); return; }
  },
  onKeydown(e) {
    const mod = e.metaKey || e.ctrlKey;
    if (e.isComposing || this.composing) return;
    if (e.key === 'Escape' && this.active && !UI.drawerState) { e.preventDefault(); e.stopPropagation(); this.setActive(null); return; }
    if (mod && e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) Review.reviewDirty(this.cid);
      else { const c = this.getCaret() || this.lastCaret; if (c) Review.reviewPara(this.cid, c.pid, true); }
      return;
    }
    // estructura: hueco por escribir, separador de escena y salto de página
    if (e.altKey && !mod && !e.shiftKey && (e.code === 'KeyH' || e.code === 'KeyS' || e.key === 'Enter')) { e.preventDefault(); if (e.code === 'KeyH') this.insertGap(); else if (e.code === 'KeyS') this.insertSep(); else Pages.toggleBreak((this.getCaret() || this.lastCaret || {}).pid); return; }
    // diálogo: Alt + guion abre la línea con raya; Alt + I abre o cierra el inciso
    if (e.altKey && !mod && !e.shiftKey && window.Dialogo && (e.code === 'Minus' || e.code === 'NumpadSubtract' || e.code === 'Slash' && /[-–]/.test(e.key) || e.code === 'KeyI')) { e.preventDefault(); if (e.code === 'KeyI') Dialogo.inciso(); else Dialogo.open(); return; }
    if (mod && !e.altKey && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); if (e.shiftKey) this.redo(); else this.undo(); return; }
    if (mod && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); this.redo(); return; }
    if (mod && /^[biu]$/i.test(e.key)) { e.preventDefault(); return; }
    if (!RT.canWrite) return;
    if (e.key === 'Enter') { e.preventDefault(); this.splitAtCaret(); return; }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const sel = getSelection();
      if (!sel.isCollapsed) return;
      const c = this.getCaret(); if (!c) return;
      const paras = this.cdoc.data.paras, i = this.pIndex(c.pid);
      if (i < 0) return;
      if (e.key === 'Backspace' && c.off === 0 && i > 0) { e.preventDefault(); this.join(i); }
      else if (e.key === 'Delete' && c.off === parText(paras[i]).length && i < paras.length - 1) { e.preventDefault(); this.join(i + 1); }
    }
  },
  onPaste(e) {
    e.preventDefault();
    if (!RT.canWrite) return;
    const dt = e.clipboardData || window.clipboardData;
    let text = dt ? dt.getData('text/plain') : '';
    if (!text) return;
    text = cleanInvisible(text).replace(/\r/g, '').replace(/\t/g, ' ').normalize('NFC');
    const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
    if (lines.length <= 1) { document.execCommand('insertText', false, lines[0] != null ? (text.trim() === lines[0] ? text.replace(/\n/g, ' ') : lines[0]) : ''); return; }
    if (!getSelection().isCollapsed) { document.execCommand('delete'); this.sync('deleteByCut'); }
    const c = this.getCaret(); if (!c) return;
    const paras = this.cdoc.data.paras, i = this.pIndex(c.pid);
    if (i < 0) return;
    this.pushUndo();
    const [L, R] = splitSegs(paras[i].segs, c.off);
    const first = { id: paras[i].id, segs: normSegs(L.concat([{ t: lines[0] }])) };
    const mid = lines.slice(1, -1).map(s => ({ id: uid('p'), segs: [{ t: s }] }));
    const lastLine = lines[lines.length - 1];
    const last = { id: uid('p'), segs: normSegs([{ t: lastLine }].concat(R)) };
    const ins = [first].concat(mid, [last]);
    this.cdoc.update(d => { d.paras.splice.apply(d.paras, [i, 1].concat(ins)); }, { silent: true });
    ins.forEach(p => this.addDirty(p.id));
    this.render();
    this.setCaret({ pid: last.id, off: lastLine.length });
    this.scrollToCaret();
    this.afterChange();
  },

  /* ---------- posiciones de cursor ---------- */
  paraOf(node) {
    let n = node;
    while (n && n.parentNode !== this.root) n = n.parentNode;
    return n && n.nodeType === 1 ? n : null;
  },
  pointOffset(pe, node, off) {
    const r = document.createRange(); r.selectNodeContents(pe);
    try { r.setEnd(node, off); } catch (e) { return 0; }
    return r.toString().length;
  },
  getCaret() {
    const sel = getSelection();
    if (!this.root || !sel || !sel.rangeCount || !this.root.contains(sel.anchorNode)) return null;
    const pa = this.paraOf(sel.anchorNode), pf = this.paraOf(sel.focusNode);
    if (!pa || !pa.dataset || !pa.dataset.id) return null;
    const c = { pid: pa.dataset.id, off: this.pointOffset(pa, sel.anchorNode, sel.anchorOffset) };
    if (!sel.isCollapsed && pf && pf.dataset && pf.dataset.id) { c.fpid = pf.dataset.id; c.foff = this.pointOffset(pf, sel.focusNode, sel.focusOffset); }
    return c;
  },
  domPoint(pe, off) {
    const w = document.createTreeWalker(pe, NodeFilter.SHOW_TEXT, null);
    let n, acc = 0, last = null;
    while ((n = w.nextNode())) {
      const len = n.nodeValue.length;
      if (acc + len >= off) return [n, Math.max(0, off - acc)];
      acc += len; last = n;
    }
    if (last) return [last, last.nodeValue.length];
    return [pe, 0];
  },
  pEl(pid) { return this.root ? this.root.querySelector('p[data-id="' + CSS.escape(pid) + '"]') : null; },
  setCaret(c) {
    if (!c) return;
    const pe = this.pEl(c.pid); if (!pe) return;
    const [n, o] = this.domPoint(pe, c.off);
    const sel = getSelection(); const r = document.createRange();
    try {
      r.setStart(n, o); r.collapse(true);
      sel.removeAllRanges(); sel.addRange(r);
      if (c.fpid) { const pf = this.pEl(c.fpid); if (pf) { const [n2, o2] = this.domPoint(pf, c.foff); sel.extend(n2, o2); } }
    } catch (e) {}
  },
  rangeIn(pe, s, e) {
    const [n1, o1] = this.domPoint(pe, s), [n2, o2] = this.domPoint(pe, e);
    const r = new Range();
    try { r.setStart(n1, o1); r.setEnd(n2, o2); } catch (er) { return null; }
    return r;
  },
  scrollToCaret() {
    const sel = getSelection(); if (!sel.rangeCount) return;
    let rect = sel.getRangeAt(0).getBoundingClientRect();
    if (!rect || (!rect.top && !rect.bottom)) { const c = this.getCaret(); const pe = c && this.pEl(c.pid); if (pe) rect = pe.getBoundingClientRect(); }
    if (!rect) return;
    const top = 120, bottom = window.innerHeight - 80;
    if (rect.bottom > bottom) window.scrollBy({ top: rect.bottom - bottom + 40 });
    else if (rect.top < top) window.scrollBy({ top: rect.top - top - 20 });
  },
  pIndex(pid) { return this.cdoc.data.paras.findIndex(p => p.id === pid); },

  /* ---------- pintar ---------- */
  paraEl(p) {
    const pe = document.createElement('p');
    pe.dataset.id = p.id;
    if (p.pb) pe.className = 'pb';
    if (p.segs.length === 1 && p.segs[0].t != null && /^\s*(?:(?:\*\s*){3}|⁂|#)\s*$/.test(p.segs[0].t)) pe.classList.add('sep');
    p.segs.forEach(s => {
      if (s.t != null) pe.append(s.t);
      else if (s.m) {
        const sp = document.createElement('span');
        sp.className = 'm ' + s.m.type + (s.m.done ? ' done' : '');
        sp.dataset.id = s.m.id;
        sp.textContent = s.m.text;
        pe.append(sp);
      }
    });
    if (!pe.firstChild) pe.append(document.createElement('br'));
    return pe;
  },
  /* Pinta la hoja. Con «only» (ids de párrafos) repinta solo esos: en capítulos largos evita repintar todo tras cada revisión rápida. */
  render(keepCaret, only) {
    if (!this.root || !this.cdoc || !this.cdoc.data) return;
    const d = this.cdoc.data;
    if (!d.paras || !d.paras.length) d.paras = [{ id: uid('p'), segs: [] }];
    const caret = keepCaret && document.activeElement === this.root ? this.getCaret() : null;
    if (only && only.length && this.root.childElementCount === d.paras.length) {
      const els = only.map(pid => [pid, this.root.querySelector('p[data-id="' + pid + '"]'), d.paras.find(p => p.id === pid)]);
      if (els.every(([, el, p]) => el && p)) {
        els.forEach(([, el, p]) => el.replaceWith(this.paraEl(p)));
        this.renumber();
        this.decorate();
        if (caret) this.setCaret(caret);
        this.renderNotes(); this.updateChips(); this.highlightsSoon();
        if (window.Pages) Pages.layoutSoon();
        App.renderStatus();
        return;
      }
    }
    const frag = document.createDocumentFragment();
    d.paras.forEach(p => frag.append(this.paraEl(p)));
    this.root.textContent = '';
    this.root.append(frag);
    this.renumber();
    this.decorate();
    if (caret) this.setCaret(caret);
    this.renderNotes(); this.updateChips(); this.highlightsSoon();
    if (window.Pages) Pages.layoutSoon();
    App.renderStatus();
  },
  renumber() {
    let n = 0;
    $$('.m', this.root).forEach(sp => { n++; if (sp.dataset.n !== String(n)) sp.dataset.n = n; });
  },
  visible(m) {
    if (App.prefs.clean) return false;
    if (App.prefs.off.includes(m.type)) return false;
    if (App.prefs.hideDone && m.done) return false;
    return true;
  },
  decorate() {
    if (!this.root) return;
    const map = new Map(); allMarks(this.cdoc.data).forEach(x => map.set(x.m.id, x.m));
    $$('.m', this.root).forEach(sp => {
      const m = map.get(sp.dataset.id);
      sp.classList.toggle('off', !m || !this.visible(m));
      sp.classList.toggle('active', !!m && sp.dataset.id === this.active);
    });
    const dirty = this.dirty.get(this.cid) || new Set();
    $$('p', this.root).forEach(pe => {
      pe.classList.toggle('dirty', dirty.has(pe.dataset.id));
      pe.classList.toggle('rvw', !!(window.Review && Review.isReviewing(this.cid, pe.dataset.id)));
    });
    if (window.Collab) Collab.decorate(this.root, this.cid);
    if (App.focus) this.markCurrent();
  },

  /* ---------- leer lo que el navegador escribió ---------- */
  readDom() {
    const marks = new Map();
    allMarks(this.cdoc.data).forEach(x => marks.set(x.m.id, x.m));
    const used = new Set(), usedP = new Set(), out = [];
    const oldP = new Map(this.cdoc.data.paras.map(p => [p.id, p]));
    const isBlock = (n) => n.nodeType === 1 && /^(P|DIV|H[1-6]|LI|UL|OL|BLOCKQUOTE|SECTION|ARTICLE|PRE)$/.test(n.nodeName);
    const fix = (t) => t.replace(/ /g, ' ').normalize('NFC');
    const walk = (node, segs) => {
      node.childNodes.forEach(c => {
        if (c.nodeType === 3) { if (c.nodeValue) segs.push({ t: fix(c.nodeValue) }); }
        else if (c.nodeType === 1) {
          if (c.nodeName === 'BR') return;
          const id = c.classList && c.classList.contains('m') ? c.dataset.id : null;
          if (id && marks.has(id) && !used.has(id)) {
            used.add(id);
            const m = clone(marks.get(id)); m.text = fix(c.textContent);
            if (m.text) segs.push({ m: m });
          } else walk(c, segs);
        }
      });
    };
    const block = (el) => {
      let id = el.dataset && el.dataset.id;
      if (!id || usedP.has(id)) id = uid('p');
      usedP.add(id);
      const segs = []; walk(el, segs);
      const o = { id: id, segs: normSegs(segs) };
      const old = oldP.get(id); if (old && old.pb) o.pb = true;
      return o;
    };
    let loose = null;
    const flush = () => { if (loose) { const segs = []; loose.forEach(n => { if (n.nodeType === 3) segs.push({ t: fix(n.nodeValue) }); else walk({ childNodes: [n] }, segs); }); const ns = normSegs(segs); if (ns.length) out.push({ id: uid('p'), segs: ns }); loose = null; } };
    this.root.childNodes.forEach(n => {
      if (isBlock(n)) {
        flush();
        if (Array.from(n.childNodes).some(isBlock)) {
          const segsHere = [];
          n.childNodes.forEach(c => { if (isBlock(c)) out.push(block(c)); else if (c.nodeType === 3) segsHere.push({ t: fix(c.nodeValue) }); });
          if (normSegs(segsHere).length) out.push({ id: uid('p'), segs: normSegs(segsHere) });
        } else out.push(block(n));
      } else (loose || (loose = [])).push(n);
    });
    flush();
    if (!out.length) out.push({ id: (this.cdoc.data.paras[0] || {}).id || uid('p'), segs: [] });
    return out;
  },
  isCanonical() {
    const marks = new Set(); allMarks(this.cdoc.data).forEach(x => marks.add(x.m.id));
    const ids = new Set(), mids = new Set();
    for (const pe of this.root.childNodes) {
      if (pe.nodeType !== 1 || pe.nodeName !== 'P' || !pe.dataset.id || ids.has(pe.dataset.id)) return false;
      ids.add(pe.dataset.id);
      const kids = pe.childNodes;
      if (!kids.length) return false;
      for (const c of kids) {
        if (c.nodeType === 3) continue;
        if (c.nodeName === 'BR' && kids.length === 1) continue;
        if (c.nodeName === 'SPAN' && c.classList.contains('m') && marks.has(c.dataset.id) && !mids.has(c.dataset.id) && c.childNodes.length === 1 && c.firstChild.nodeType === 3 && c.textContent) { mids.add(c.dataset.id); continue; }
        return false;
      }
    }
    return true;
  },
  sync(type) {
    if (!this.root || !this.cdoc) return;
    const before = this.cdoc.data.paras;
    const after = this.readDom();
    if (deq(before, after)) { if (!this.isCanonical()) this.render(true); return; }
    if (!RT.canWrite) { this.render(); return; }
    this.histTyping(before, type);
    this.firstEdit(before);
    const bm = new Map(before.map(p => [p.id, p]));
    after.forEach(p => { const b = bm.get(p.id); if (!b || !deq(b.segs, p.segs)) this.addDirty(p.id); });
    this.cdoc.update(d => { d.paras = after; }, { silent: true });
    if (!this.isCanonical()) this.render(true);
    else { this.renumber(); this.decorate(); if (!deq(allMarks({ paras: before }).map(x => x.m.id), allMarks({ paras: after }).map(x => x.m.id))) this.renderNotes(); this.updateChips(); }
    this.afterChange();
  },
  sizeCheck: debounce(function () {
    if (!Editor.cdoc || !Editor.cdoc.data) return;
    const n = JSON.stringify(Editor.cdoc.data).length;
    if (n > 200000 && !Editor._warned) { Editor._warned = true; App.toast('Este ' + App.unit().toLowerCase() + ' es muy largo y se acerca al límite de guardado. Conviene dividirlo (menú ⋯, «Dividir aquí»).'); }
  }, 3000),
  async splitChapter() {
    const c = this.lastCaret; if (!c) return;
    const i = this.pIndex(c.pid); if (i <= 0) { App.toast('Ubica el cursor en el párrafo donde debe empezar el nuevo ' + App.unit().toLowerCase() + '.'); return; }
    const title = await UI.prompt('Dividir ' + App.unit().toLowerCase(), 'Título del nuevo ' + App.unit().toLowerCase(), kindOf(App.P()).unit + ' ' + (App.chapterList().length + 1), 'Dividir');
    if (title == null) return;
    await Versions.saveVersion(this.cid, 'Antes de dividir');
    const rest = clone(this.cdoc.data.paras.slice(i));
    const ncid = uid('c'), cid = this.cid;
    this.pushUndo();
    this.cdoc.update(d => { d.paras = d.paras.slice(0, i); }, { now: true, silent: true });
    App.chapters.create(ncid, { paras: rest });
    App.proj().update(x => { const k = x.chapters.findIndex(z => z.id === cid); x.chapters.splice(k + 1, 0, { id: ncid, title: title || App.unit() }); }, { now: true });
    App.toast('Listo: «' + (title || App.unit()) + '» quedó como ' + App.unit().toLowerCase() + ' aparte.', { action: { label: 'Ir', fn: () => App.go(App.chHash(ncid)) } });
    this.render(); this.afterChange();
  },
  afterChange() {
    this.sizeCheck();
    if (window.Pages) Pages.layoutSoon();
    this.layoutSoon(); this.highlightsSoon();
    App.renderStatus(); App.statsSoon(); App.renderSideSoon();
    if (window.Collab) Collab.caretSoon();
    if (App.focus) { this.markCurrent(); this.typewriter(); }
  },
  firstEdit(before) {
    if (this.sessionEdited.has(this.cid)) return;
    this.sessionEdited.add(this.cid);
    if (window.Versions) Versions.sessionVersion(this.cid, before);
  },
  addDirty(pid) {
    let s = this.dirty.get(this.cid); if (!s) { s = new Set(); this.dirty.set(this.cid, s); }
    s.add(pid);
    if (window.Review) Review.onEdit(this.cid, pid);
  },
  onRemote() {
    if (!this.root) return;
    if (this.composing) { this.pendingRemote = true; return; }
    this.pendingRemote = false;
    this.render(true);
    this.refreshHeader();
  },

  /* ---------- operaciones de párrafo ---------- */
  /* Párrafo nuevo después del actual, con el contenido dado (segs). Devuelve su id. */
  insertParaAfter(segs, extra) {
    if (!RT.canWrite || !this.cdoc) return null;
    const c = this.getCaret() || this.lastCaret; const i = c ? this.pIndex(c.pid) : this.cdoc.data.paras.length - 1;
    this.pushUndo();
    const np = Object.assign({ id: uid('p'), segs: segs }, extra || {});
    const cur = this.cdoc.data.paras[i];
    const empty = cur && !parText(cur).trim();
    this.cdoc.update(d => { if (empty) d.paras[i] = Object.assign({}, np, { id: cur.id }); else d.paras.splice(i + 1, 0, np); }, { silent: true });
    const id = empty ? cur.id : np.id;
    this.addDirty(id);
    this.render(); this.afterChange();
    return id;
  },
  /* Hueco «por escribir»: un párrafo marcado como pendiente para rellenar después. */
  insertGap() {
    const m = { id: uid('m'), type: 'pend', text: '[por escribir]', note: 'Hueco por rellenar. Escribe dentro de los corchetes qué va aquí, o reemplázalo por el texto cuando lo tengas.', by: RT.me || 'local', at: Date.now(), gap: true };
    const pid = this.insertParaAfter([{ m: m }]);
    if (!pid) return;
    // nuevo párrafo vacío después del hueco para seguir escribiendo
    const i = this.pIndex(pid);
    this.cdoc.update(d => { d.paras.splice(i + 1, 0, { id: uid('p'), segs: [] }); }, { silent: true });
    this.render();
    const nid = this.cdoc.data.paras[i + 1].id;
    this.root.focus(); this.setCaret({ pid: nid, off: 0 });
    App.toast('Hueco agregado. Aparece en «Ir a…» y en las notas como pendiente.', { id: 'gap' });
  },
  insertSep() {
    const pid = this.insertParaAfter([{ t: '* * *' }]);
    if (!pid) return;
    const i = this.pIndex(pid);
    this.cdoc.update(d => { d.paras.splice(i + 1, 0, { id: uid('p'), segs: [] }); }, { silent: true });
    this.render();
    this.root.focus(); this.setCaret({ pid: this.cdoc.data.paras[i + 1].id, off: 0 });
  },
  splitAtCaret() {
    if (!RT.canWrite) return;
    if (!getSelection().isCollapsed) { document.execCommand('delete'); this.sync('deleteContentBackward'); }
    const c = this.getCaret(); if (!c) return;
    const i = this.pIndex(c.pid); if (i < 0) return;
    this.pushUndo();
    const p = this.cdoc.data.paras[i];
    const [L, R] = splitSegs(p.segs, c.off);
    const np = { id: uid('p'), segs: R };
    this.cdoc.update(d => { d.paras[i] = Object.assign({}, p, { segs: L }); d.paras.splice(i + 1, 0, np); }, { silent: true });
    this.addDirty(p.id); if (R.length) this.addDirty(np.id);
    this.render();
    this.setCaret({ pid: np.id, off: 0 });
    this.scrollToCaret();
    this.afterChange();
  },
  join(i) {
    const paras = this.cdoc.data.paras, prev = paras[i - 1], cur = paras[i];
    if (!prev || !cur) return;
    this.pushUndo();
    const off = parText(prev).length;
    this.cdoc.update(d => { d.paras[i - 1] = Object.assign({}, prev, { segs: normSegs(prev.segs.concat(cur.segs)) }); d.paras.splice(i, 1); }, { silent: true });
    this.addDirty(prev.id);
    this.render();
    this.setCaret({ pid: prev.id, off: off });
    this.afterChange();
  },

  /* ---------- deshacer ---------- */
  H() { let x = this.hist.get(this.cid); if (!x) { x = { undo: [], redo: [], burst: false, kind: null, t: null }; this.hist.set(this.cid, x); } return x; },
  snapshot() { return { paras: clone(this.cdoc.data.paras), caret: this.getCaret() || this.lastCaret }; },
  pushUndo() { const x = this.H(); x.undo.push(this.snapshot()); if (x.undo.length > 300) x.undo.shift(); x.redo.length = 0; x.burst = false; },
  histTyping(before, type) {
    const x = this.H(); const kind = /^delete/.test(type || '') ? 'del' : 'ins';
    if (!x.burst || x.kind !== kind) { x.undo.push({ paras: clone(before), caret: this.lastCaret }); if (x.undo.length > 300) x.undo.shift(); x.redo.length = 0; }
    x.burst = true; x.kind = kind;
    clearTimeout(x.t); x.t = setTimeout(() => { x.burst = false; }, 1200);
  },
  undo() { const x = this.H(); x.burst = false; if (!x.undo.length) { App.toast('No hay nada que deshacer.'); return; } x.redo.push(this.snapshot()); this.applySnap(x.undo.pop()); },
  redo() { const x = this.H(); x.burst = false; if (!x.redo.length) return; x.undo.push(this.snapshot()); this.applySnap(x.redo.pop()); },
  applySnap(s) {
    if (!RT.canWrite) return;
    const before = this.cdoc.data.paras;
    const bm = new Map(before.map(p => [p.id, p]));
    s.paras.forEach(p => { const b = bm.get(p.id); if (!b || !deq(b.segs, p.segs)) this.addDirty(p.id); });
    this.cdoc.update(d => { d.paras = clone(s.paras); }, { silent: true });
    this.root.focus();
    this.render();
    if (s.caret) this.setCaret(s.caret);
    this.afterChange();
  },

  /* ---------- selección: marcar a mano ---------- */
  onSelection() {
    if (!this.root) return;
    const sel = getSelection();
    const inside = sel && sel.rangeCount && this.root.contains(sel.anchorNode);
    if (inside) {
      const c = this.getCaret();
      if (c) this.lastCaret = c;
      if (sel.isCollapsed) {
        const n = sel.anchorNode; const el = n && (n.nodeType === 1 ? n : n.parentNode);
        const m = el && el.closest ? el.closest('.m') : null;
        if (m && this.root.contains(m) && !m.classList.contains('off')) { if (this.active !== m.dataset.id) this.setActive(m.dataset.id, false, true); }
        else if (this.active && !this.editingNote && !this.replyTo) this.setActive(null, false, true);
        this.selWords = 0;
      } else this.selWords = countWords(sel.toString());
      App.renderStatus();
      if (App.focus) this.markCurrent();
      if (window.Collab) Collab.caretSoon();
    }
    this.selbarSoon();
  },
  selbarSoon: debounce(function () { Editor.updateSelbar(); }, 160),
  updateSelbar() {
    const sel = getSelection();
    if (!this.root || !sel || !sel.rangeCount || sel.isCollapsed || !this.root.contains(sel.anchorNode) || !this.root.contains(sel.focusNode) || document.body.classList.contains('clean')) { this.hideSelbar(); return; }
    const c = this.getCaret(); if (!c) { this.hideSelbar(); return; }
    const one = !c.fpid || c.fpid === c.pid;
    const bar = $('#selbar'); bar.textContent = '';
    if (RT.canWrite && one) {
      ['rep', 'dud', 'coh', 'bien', 'ort', 'rec', 'pend'].forEach(t => bar.append(h('button', { class: 'tb ' + t, type: 'button', title: 'Marcar: ' + TYPES[t].l, 'aria-label': 'Marcar como ' + TYPES[t].l, text: TYPES[t].g, onclick: () => this.markSelection(t) })));
    } else if (RT.canWrite) bar.append(h('span', { class: 'msg', text: 'Para marcar, selecciona dentro de un párrafo.' }));
    if (window.Collab && Collab.canSendState) {
      if (bar.childNodes.length) bar.append(h('span', { class: 'sep' }));
      bar.append(h('button', { class: 'btn small ghost', type: 'button', title: 'Llevar este fragmento a tu conversación con Claude', onclick: () => Collab.sendSelection(sel.toString()) }, icon('chat'), 'Al chat'));
    }
    if (!bar.childNodes.length) { this.hideSelbar(); return; }
    bar.hidden = false;
    const r = sel.getRangeAt(0).getBoundingClientRect();
    const w = bar.offsetWidth, hh = bar.offsetHeight;
    if (r.bottom < 0 || r.top > window.innerHeight) { bar.hidden = true; return; }
    let top = r.top - hh - 10; if (top < 60) top = r.bottom + 10;
    top = Math.max(60, Math.min(top, window.innerHeight - hh - 40));
    bar.style.left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 8)) + 'px';
    bar.style.top = top + 'px';
  },
  hideSelbar() { const b = $('#selbar'); if (b) b.hidden = true; },
  markSelection(type) {
    const c = this.getCaret(); if (!c) return;
    const pid = c.pid; let a = c.off, b = c.foff != null ? c.foff : c.off;
    if (a > b) { const t = a; a = b; b = t; }
    const i = this.pIndex(pid); if (i < 0) return;
    const p = clone(this.cdoc.data.paras[i]);
    const txt = parText(p);
    while (a < b && /\s/.test(txt[a])) a++;
    while (b > a && /\s/.test(txt[b - 1])) b--;
    if (b - a < 1) return;
    const m = { id: uid('m'), type: type, text: '', note: '', by: RT.me || 'local', at: Date.now() };
    if (!wrapMark(p, a, b, m)) { App.toast('Esa selección se cruza con otra marca.'); return; }
    this.pushUndo();
    this.cdoc.update(d => { d.paras[i] = p; }, { silent: true });
    getSelection().removeAllRanges();
    this.hideSelbar();
    if (App.prefs.off.includes(type)) { App.prefs.off = []; App.savePrefs(); }
    this.active = m.id; this.editingNote = m.id;
    this.render();
    this.afterChange();
    setTimeout(() => { const ta = $('textarea[data-k="n-' + m.id + '"]'); if (ta) ta.focus(); }, 30);
  },

  /* ---------- notas ---------- */
  author(by) {
    if (by === 'claude') return RT.web ? AI.label() : 'Claude';
    if (by === 'revisor') return 'Revisor';
    if (!by || by === 'local') return 'Tú';
    if (by === RT.me) return 'Tú';
    return window.Collab ? Collab.name(by) : 'Alguien';
  },
  noteEl(m, inSheet) {
    const el = h('div', { class: 'note ' + m.type + (m.done ? ' done' : '') + (m.id === this.active ? ' active' : ''), dataset: { id: m.id }, tabindex: '0' });
    const num = $('.m[data-id="' + CSS.escape(m.id) + '"]', this.root);
    const head = h('div', { class: 'nhead' }, h('span', { text: TYPES[m.type].g }), h('span', { text: (num ? num.dataset.n + ' · ' : '') + TYPES[m.type].l + (m.done ? ' · resuelta' : '') }), h('span', { class: 'who', text: this.author(m.by) + (m.src === 'auto' ? ' ✓ automática' : '') + (m.at ? ' · ' + relTime(m.at) : ''), title: m.src === 'auto' ? 'Marcada por la revisión automática y confirmada por la IA' : null }));
    if (m.id === this.active || inSheet) head.append(h('button', { class: 'nclose', type: 'button', dataset: { a: 'close', id: m.id }, 'aria-label': 'Cerrar nota', title: 'Cerrar (Esc)' }, icon('close')));
    el.append(head);
    const k = 'n-' + m.id;
    if (this.editingNote === m.id && RT.canWrite) {
      const ta = h('textarea', { 'data-k': k, 'aria-label': 'Nota', placeholder: 'Escribe la nota…' });
      ta.value = this.noteDraft[k] != null ? this.noteDraft[k] : (m.note || '');
      el.append(ta, h('div', { class: 'nacts', style: 'display:flex' }, this.act('Guardar', 'save-note', m.id, 'primary'), this.act('Cancelar', 'cancel-note', m.id)));
      return el;
    }
    el.append(h('p', { class: 'ntext' + (m.note ? '' : ' blank'), text: m.note || (m.by === 'claude' ? '' : 'Sin nota. Edítala para agregar un comentario.') }));
    if (m.fix && m.fix.to) el.append(h('p', { class: 'fix' }, m.fix.applied ? 'Aplicado: ' : 'Propuesta: ', m.fix.applied ? h('ins', { text: m.fix.to }) : [h('del', { text: m.fix.from }), ' → ', h('ins', { text: m.fix.to })]));
    if (m.replies && m.replies.length) {
      const reps = h('div', { class: 'reps' });
      m.replies.forEach(r => reps.append(h('div', { class: 'rep-i' }, h('b', { text: this.author(r.by) + ': ' }), r.text)));
      el.append(reps);
    }
    if (this.replyTo === m.id && RT.canWrite) {
      const ta = h('textarea', { 'data-k': 'r-' + m.id, 'aria-label': 'Respuesta', placeholder: 'Responde…' });
      ta.value = this.noteDraft['r-' + m.id] || '';
      el.append(ta, h('div', { class: 'nacts', style: 'display:flex' }, this.act('Responder', 'send-reply', m.id, 'primary'), this.act('Cancelar', 'cancel-reply', m.id)));
      return el;
    }
    if (RT.canWrite) {
      const acts = h('div', { class: 'nacts' });
      if (m.fix && m.fix.to && !m.fix.applied) acts.append(this.act('Aplicar', 'apply', m.id, 'primary'));
      if (m.fix && m.fix.applied) acts.append(this.act('Deshacer cambio', 'unapply', m.id));
      if (m.by === 'revisor' && m.rule === 'spell' && m.word) acts.append(this.act('Al diccionario', 'dict', m.id));
      if (m.by === 'revisor' && m.rule === 'noficha' && m.word) acts.append(this.act('Crear ficha', 'ficha', m.id, 'primary'), this.act('No es personaje', 'noficha', m.id));
      acts.append(this.act(m.done ? 'Reabrir' : 'Resuelta', 'done', m.id));
      acts.append(this.act('Responder', 'reply', m.id));
      acts.append(this.act('Editar', 'edit', m.id));
      const P = App.P();
      const linked = P && (P.threads || []).some(t => t.markId === m.id);
      if (!linked && (m.type === 'coh' || m.type === 'dud' || m.type === 'pend')) acts.append(this.act('Cabo suelto', 'thread', m.id));
      if (window.Collab && Collab.canSendState) acts.append(this.act('Al chat', 'chat', m.id));
      acts.append(this.act(this.confirmDel === m.id ? '¿Borrar?' : 'Borrar', 'del', m.id, this.confirmDel === m.id ? 'warn' : ''));
      el.append(acts);
    }
    return el;
  },
  act(label, a, id, cls) { return h('button', { class: 'act ' + (cls || ''), type: 'button', dataset: { a: a, id: id }, text: label }); },
  renderNotes() {
    if (!this.margin || !this.cdoc) return;
    if (this.narrow) { this.margin.textContent = ''; this.renderSheet(); return; }
    this.closeSheet();
    const keepFocus = document.activeElement && this.margin.contains(document.activeElement) && document.activeElement.dataset ? document.activeElement.dataset.k : null;
    this.margin.textContent = '';
    allMarks(this.cdoc.data).filter(x => this.visible(x.m)).forEach(x => this.margin.append(this.noteEl(x.m)));
    this.layoutNotes();
    if (keepFocus) { const t = $('[data-k="' + keepFocus + '"]', this.margin); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } }
  },
  layoutSoon: rafThrottle(function () { Editor.layoutNotes(); }),
  layoutNotes() {
    if (this.narrow) { this.positionInline(); return; }
    if (!this.margin || !this.root) return;
    const mr = this.margin.getBoundingClientRect();
    const items = $$('.note', this.margin).map(el => {
      const sp = this.root.querySelector('.m[data-id="' + CSS.escape(el.dataset.id) + '"]');
      return { el: el, top: sp ? sp.getBoundingClientRect().top - mr.top - 4 : 0, h: el.offsetHeight, id: el.dataset.id };
    });
    const gap = 8, a = items.findIndex(it => it.id === this.active);
    let maxB = 0;
    if (a < 0) {
      let y = -Infinity;
      items.forEach(it => { const t = Math.max(it.top, y + gap); it.el.style.top = t + 'px'; y = t + it.h; maxB = y; });
    } else {
      const A = items[a]; A.el.style.top = A.top + 'px';
      let y = A.top + A.h; maxB = y;
      for (let i = a + 1; i < items.length; i++) { const t = Math.max(items[i].top, y + gap); items[i].el.style.top = t + 'px'; y = t + items[i].h; maxB = y; }
      let lim = A.top;
      for (let i = a - 1; i >= 0; i--) { const t = Math.min(items[i].top, lim - gap - items[i].h); items[i].el.style.top = t + 'px'; lim = t; }
    }
    this.margin.style.minHeight = (maxB + 30) + 'px';
  },
  setActive(id, scroll, fromCaret) {
    if (this.active === id) { if (this.narrow && !fromCaret) this.renderSheet(); return; }
    this.active = id; this.confirmDel = null;
    if (this.editingNote && this.editingNote !== id) this.editingNote = null;
    if (this.replyTo && this.replyTo !== id) this.replyTo = null;
    this.decorate();
    if (this.narrow) { if (fromCaret) this.closeSheet(); else this.renderSheet(); return; }
    this.renderNotes();
    if (scroll && id) { const n = $('.note[data-id="' + CSS.escape(id) + '"]', this.margin); if (n) { const r = n.getBoundingClientRect(); if (r.bottom > window.innerHeight - 40 || r.top < 110) window.scrollBy({ top: r.top - 160, behavior: 'smooth' }); } }
  },
  hover(id) {
    if (this._hot === id) return;
    if (this._hot) { $$('[data-id="' + CSS.escape(this._hot) + '"].m, .note[data-id="' + CSS.escape(this._hot) + '"]').forEach(x => x.classList.remove('hot')); }
    this._hot = id;
    if (id) $$('.m[data-id="' + CSS.escape(id) + '"], .note[data-id="' + CSS.escape(id) + '"]').forEach(x => x.classList.add('hot'));
  },
  /* En pantallas angostas la nota se abre dentro de la hoja, bajo su párrafo, y empuja el texto en vez de taparlo. */
  renderSheet() {
    this.closeSheet();
    if (!this.narrow || !this.active || !this.cdoc || !this.paper) return;
    const f = findMark(this.cdoc.data, this.active); if (!f || !this.visible(f.m)) return;
    const pe = this.pEl(f.p.id); if (!pe) return;
    const n = this.noteEl(f.m, true); n.classList.add('active', 'inline'); n.id = 'sheet-pop';
    n.addEventListener('click', (e) => this.onNoteClick(e));
    n.addEventListener('input', (e) => { if (e.target.tagName === 'TEXTAREA') this.noteDraft[e.target.dataset.k] = e.target.value; });
    n.addEventListener('keydown', (e) => this.onNoteKey(e));
    this.paper.append(n);
    this.inlineP = pe;
    this.positionInline();
    requestAnimationFrame(() => {
      const r = n.getBoundingClientRect();
      if (r.bottom > window.innerHeight - 50) window.scrollBy({ top: r.bottom - window.innerHeight + 70, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
  },
  positionInline() {
    const n = $('#sheet-pop'); if (!n || !this.inlineP || !this.paper) return;
    const pe = this.pEl(this.inlineP.dataset.id) || this.inlineP;
    if (pe !== this.inlineP) { this.inlineP.style.marginBottom = ''; this.inlineP = pe; }
    pe.style.marginBottom = '';
    const pr = this.paper.getBoundingClientRect(), r = pe.getBoundingClientRect(), dr = this.root.getBoundingClientRect();
    n.style.top = (r.bottom - pr.top + 10) + 'px';
    n.style.left = Math.max(6, dr.left - pr.left - 10) + 'px';
    n.style.width = Math.min(pr.width - 12, dr.width + 20) + 'px';
    pe.style.marginBottom = (n.offsetHeight + 22) + 'px';
  },
  closeSheet() {
    const s = $('#sheet-pop'); if (s) s.remove();
    if (this.inlineP) { this.inlineP.style.marginBottom = ''; this.inlineP = null; }
  },
  notesDrawer() {
    const body = h('div', { style: 'display:flex;flex-direction:column;gap:.6rem' });
    const marks = allMarks(this.cdoc.data).filter(x => this.visible(x.m));
    if (!marks.length) body.append(h('p', { class: 'muted', text: 'No hay notas visibles con los filtros actuales.' }));
    marks.forEach(x => {
      const n = this.noteEl(x.m); n.style.position = 'relative'; n.classList.remove('active');
      n.addEventListener('click', () => { UI.closeDrawer(); const sp = this.root.querySelector('.m[data-id="' + CSS.escape(x.m.id) + '"]'); if (sp) sp.scrollIntoView({ block: 'center' }); this.setActive(x.m.id, true); });
      body.append(n);
    });
    if (marks.length) body.prepend(h('p', { class: 'muted', style: 'margin:0;font-size:.85rem', text: 'Toca una nota para ir a su lugar en el texto.' }));
    UI.drawer({ title: 'Notas', key: 'notes', body: body });
  },
  onNoteKey(e) {
    if (e.target.tagName !== 'TEXTAREA') return;
    const k = e.target.dataset.k || '';
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); this.noteAction(k[0] === 'r' ? 'send-reply' : 'save-note', k.slice(2)); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.noteAction(k[0] === 'r' ? 'cancel-reply' : 'cancel-note', k.slice(2)); }
  },
  onNoteClick(e) {
    const b = e.target.closest('[data-a]');
    if (b) { e.stopPropagation(); this.noteAction(b.dataset.a, b.dataset.id); return; }
    const n = e.target.closest('.note');
    if (n && n.dataset.id !== this.active && !e.target.closest('textarea')) {
      this.setActive(n.dataset.id, false);
      const sp = this.root.querySelector('.m[data-id="' + CSS.escape(n.dataset.id) + '"]');
      if (sp) { const r = sp.getBoundingClientRect(); if (r.top < 100 || r.bottom > window.innerHeight - 60) sp.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    }
  },
  mutateMark(id, fn, undoable) {
    const i = this.cdoc.data.paras.findIndex(p => p.segs.some(s => s.m && s.m.id === id));
    if (i < 0) return;
    if (undoable) this.pushUndo();
    const p = clone(this.cdoc.data.paras[i]);
    const r = fn(p);
    if (r === false) return;
    this.cdoc.update(d => { d.paras[i] = p; }, { silent: true });
  },
  noteAction(a, id) {
    if (a === 'close') { this.setActive(null); return; }
    if (a === 'ficha' || a === 'noficha') { const fm = findMark(this.cdoc.data, id); if (fm) a === 'ficha' ? Coherence.addCard(fm.m.word) : Coherence.ignore(fm.m.word); return; }
    if (a === 'dict') { const fm = findMark(this.cdoc.data, id); if (fm) Checker.addToDictionary(fm.m.word, /^\p{Lu}/u.test(fm.m.word) ? 'project' : 'user'); return; }
    const f = findMark(this.cdoc.data, id); if (!f) return;
    const m = f.m;
    if (a === 'apply' && m.fix) {
      this.mutateMark(id, p => { const x = p.segs.find(s => s.m && s.m.id === id).m; x.fix.from = x.text; x.text = x.fix.to; x.fix.applied = true; x.done = true; }, true);
    } else if (a === 'unapply' && m.fix) {
      this.mutateMark(id, p => { const x = p.segs.find(s => s.m && s.m.id === id).m; x.text = x.fix.from; x.fix.applied = false; x.done = false; }, true);
    } else if (a === 'done') {
      this.mutateMark(id, p => { const x = p.segs.find(s => s.m && s.m.id === id).m; x.done = !x.done; });
    } else if (a === 'edit') { this.editingNote = id; this.noteDraft['n-' + id] = m.note || ''; }
    else if (a === 'cancel-note') { this.editingNote = null; delete this.noteDraft['n-' + id]; if (!m.note && m.by !== 'claude' && !m.text) {} }
    else if (a === 'save-note') {
      const v = (this.noteDraft['n-' + id] != null ? this.noteDraft['n-' + id] : m.note || '').trim();
      this.mutateMark(id, p => { const x = p.segs.find(s => s.m && s.m.id === id).m; x.note = v; if (x.by === 'claude') x.keep = true; });
      this.editingNote = null; delete this.noteDraft['n-' + id];
    } else if (a === 'reply') { this.replyTo = id; }
    else if (a === 'cancel-reply') { this.replyTo = null; delete this.noteDraft['r-' + id]; }
    else if (a === 'send-reply') {
      const v = (this.noteDraft['r-' + id] || '').trim();
      if (v) this.mutateMark(id, p => { const x = p.segs.find(s => s.m && s.m.id === id).m; x.replies = x.replies || []; x.replies.push({ id: uid('r'), by: RT.me || 'local', text: v, at: Date.now() }); });
      this.replyTo = null; delete this.noteDraft['r-' + id];
    } else if (a === 'thread') {
      App.proj().update(x => { x.threads = x.threads || []; x.threads.push({ id: uid('t'), title: (m.note || m.text).slice(0, 90), body: '«' + m.text + '» (' + App.chTitle(this.cid) + ')', status: 'open', markId: id, cid: this.cid, at: Date.now() }); }, { now: true });
      App.toast('Quedó como cabo suelto en la biblia.', { action: { label: 'Ver', fn: () => App.go('p-' + App.pid + '-biblia') } });
    } else if (a === 'chat') { Collab.sendMark(m, parText(f.p)); return; }
    else if (a === 'del') {
      if (this.confirmDel !== id) { this.confirmDel = id; this.renderNotes(); if (this.narrow) this.renderSheet(); setTimeout(() => { if (this.confirmDel === id) { this.confirmDel = null; this.renderNotes(); } }, 3500); return; }
      this.confirmDel = null;
      this.mutateMark(id, p => { unwrapMark(p, id); }, true);
      if (this.active === id) this.active = null;
    }
    this.render(true);
    if (this.narrow) this.renderSheet();
    setTimeout(() => { const ta = $('textarea[data-k="' + (a === 'reply' ? 'r-' : 'n-') + id + '"]'); if (ta && (a === 'reply' || a === 'edit')) ta.focus(); }, 20);
  },

  /* ---------- resaltados: ecos y búsqueda ---------- */
  highlightsSoon: debounce(function () { Editor.applyHighlights(); if (window.Metrica) Metrica.decorate(); }, 350),
  applyHighlights() {
    if (!this.root || !window.CSS || !CSS.highlights || typeof Highlight === 'undefined') return;
    const ecos = [];
    if (App.prefs.ecos && !App.prefs.clean) {
      const pm = new Map(); $$('p', this.root).forEach(pe => pm.set(pe.dataset.id, pe));
      computeEcos(this.cdoc.data.paras).forEach(t => { const pe = pm.get(t.pid); const r = pe && this.rangeIn(pe, t.s, t.e); if (r) ecos.push(r); });
    }
    CSS.highlights.set('eco', new Highlight(...ecos));
    if (window.Search) Search.applyInEditor();
  },

  /* ---------- modo foco ---------- */
  /* Ultra foco: dentro del modo foco, sin marcas, colores, subrayados ni revisión automática. Al salir, se revisa lo escrito. */
  setUltra(on) {
    if (on && !App.focus) this.setFocus(true);
    const was = !!App.ultra;
    App.ultra = !!on;
    document.body.classList.toggle('ultra', App.ultra);
    if (this.root) this.root.spellcheck = !App.ultra;
    const b = $('#ultra-btn'); if (b) { b.setAttribute('aria-pressed', App.ultra ? 'true' : 'false'); b.textContent = App.ultra ? 'Ultra foco ✓' : 'Ultra foco'; }
    if (was && !App.ultra && this.cid) {
      // al volver, el revisor mira lo que escribiste mientras tanto
      const dirty = Array.from(this.dirty.get(this.cid) || []);
      if (dirty.length && App.prefs.autoLocal !== false) Checker.run(this.cid, dirty.slice(0, 60), true);
    }
  },
  setFocus(on) {
    App.focus = on;
    document.body.classList.toggle('focus', on);
    if (!on && App.ultra) this.setUltra(false);
    if (window.Ideas) Ideas.fab();
    const old = $('#focus-exit'); if (old) old.remove();
    if (on) {
      document.body.append(h('div', { class: 'focus-exit', id: 'focus-exit' },
        h('button', { class: 'btn small', id: 'ultra-btn', type: 'button', 'aria-pressed': App.ultra ? 'true' : 'false', title: 'Sin marcas, colores ni revisión: solo escribir (' + keys('mod', 'shift', '.') + ')', onclick: () => this.setUltra(!App.ultra) }, App.ultra ? 'Ultra foco ✓' : 'Ultra foco'),
        h('button', { class: 'btn small', type: 'button', onclick: () => this.setFocus(false) }, 'Salir · Esc')));
      if (this.root) { this.root.classList.toggle('dim', App.prefs.focusDim !== false); this.root.focus(); if (this.lastCaret) this.setCaret(this.lastCaret); this.markCurrent(); setTimeout(() => this.typewriter(), 50); }
    } else if (this.root) { this.root.classList.remove('dim'); $$('p.cur', this.root).forEach(p => p.classList.remove('cur')); this.layoutSoon(); }
  },
  markCurrent() {
    if (!this.root) return;
    const c = this.lastCaret;
    $$('p', this.root).forEach(pe => pe.classList.toggle('cur', !!c && pe.dataset.id === c.pid));
  },
  typewriter() {
    const sel = getSelection(); if (!sel.rangeCount || !this.root.contains(sel.anchorNode)) return;
    let r = sel.getRangeAt(0).getBoundingClientRect();
    if (!r || (!r.top && !r.bottom)) { const pe = this.paraOf(sel.anchorNode); if (pe) r = pe.getBoundingClientRect(); }
    if (!r) return;
    const target = window.innerHeight * 0.42;
    const d = r.top - target;
    if (Math.abs(d) > 30) window.scrollBy({ top: d, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
};
window.Editor = Editor;
document.addEventListener('selectionchange', () => { if (Editor.root) Editor.onSelection(); });
window.addEventListener('resize', () => { if (Editor.root) { Editor.checkNarrow(); Editor.layoutSoon(); Editor.hideSelbar(); } });
window.addEventListener('scroll', () => { if (Editor.root && !$('#selbar').hidden) Editor.updateSelbar(); }, { passive: true });
