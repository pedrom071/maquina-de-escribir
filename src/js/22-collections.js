/* ============ partes, carpetas y juntar proyectos ============
   - Partes: separadores dentro de un proyecto que agrupan capítulos o poemas (como carpetas).
   - Carpetas: ordenan los proyectos en el inicio.
   - Juntar: une varios proyectos (por ejemplo, poemas sueltos) en un libro, o mueve y copia capítulos entre proyectos. */
const ROMAN = (n) => { const r = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let s = ''; r.forEach(([v, l]) => { while (n >= v) { s += l; n -= v; } }); return s; };

const Collections = {
  /* ---------- partes dentro de un proyecto ---------- */
  isPart(c) { return !!(c && c.role === 'parte'); },
  partNumber(cid) { let n = 0, out = null; App.chapterList().forEach(c => { if (this.isPart(c)) { n++; if (c.id === cid) out = n; } }); return out; },
  partLabel(c) { return 'Parte ' + ROMAN(this.partNumber(c.id) || 1); },
  /* Capítulos de cada parte: desde la parte hasta la siguiente parte o las secciones finales. */
  partOf(cid) {
    let cur = null;
    for (const c of App.chapterList()) {
      if (this.isPart(c)) cur = c;
      else if (Pages.role(c) && !SPECIAL[c.role].front) cur = null;
      if (c.id === cid) return this.isPart(c) ? null : cur;
    }
    return null;
  },
  children(pid) {
    const list = App.chapterList(); const i = list.findIndex(c => c.id === pid); const out = [];
    for (let j = i + 1; j < list.length; j++) { const c = list[j]; if (this.isPart(c) || (Pages.role(c) && !SPECIAL[c.role].front)) break; out.push(c); }
    return out;
  },
  addPart(afterCid) {
    const pd = App.proj(); if (!pd) return;
    const cid = uid('c');
    App.chapters.create(cid, { paras: [{ id: uid('p'), segs: [] }] });
    pd.update(x => {
      const n = x.chapters.filter(c => c.role === 'parte').length + 1;
      let i;
      if (afterCid) { i = x.chapters.findIndex(c => c.id === afterCid) + 1; }
      else { i = x.chapters.length; while (i > 0 && x.chapters[i - 1].role && SPECIAL[x.chapters[i - 1].role] && !SPECIAL[x.chapters[i - 1].role].front) i--; }
      x.chapters.splice(i, 0, { id: cid, title: 'Parte ' + ROMAN(n), role: 'parte' });
    }, { now: true });
    App.go(App.chHash(cid));
    setTimeout(() => { const t = $('.ch-title'); if (t) { t.focus(); t.select(); } }, 120);
  },
  /* Mueve un capítulo al final de una parte (o fuera de toda parte). */
  moveToPart(cid, partId) {
    App.proj().update(x => {
      const a = x.chapters; const i = a.findIndex(c => c.id === cid); if (i < 0) return;
      const [c] = a.splice(i, 1);
      let j;
      if (partId) {
        j = a.findIndex(z => z.id === partId) + 1;
        while (j < a.length && a[j].role !== 'parte' && !(a[j].role && SPECIAL[a[j].role] && !SPECIAL[a[j].role].front)) j++;
      } else {
        // fuera de las partes: antes de la primera parte
        j = a.findIndex(z => z.role === 'parte'); if (j < 0) j = a.length;
      }
      a.splice(j, 0, c);
    }, { now: true });
  },
  partMenu(anchor, cid) {
    const parts = App.chapterList().filter(c => this.isPart(c));
    const cur = this.partOf(cid);
    UI.menu(anchor, [{ label: 'Sin parte (al comienzo)', checked: !cur, onClick: () => this.moveToPart(cid, null) }, { sep: true }]
      .concat(parts.map(p => ({ label: this.partLabel(p) + (p.title && p.title !== this.partLabel(p) ? ': ' + p.title : ''), checked: cur && cur.id === p.id, onClick: () => this.moveToPart(cid, p.id) })))
      .concat([{ sep: true }, { label: 'Nueva parte…', onClick: () => this.addPart() }]));
  },
  toggleCollapse(pid) {
    App.prefs.collapsed = App.prefs.collapsed || {};
    if (App.prefs.collapsed[pid]) delete App.prefs.collapsed[pid]; else App.prefs.collapsed[pid] = true;
    App.savePrefs(); App.renderSide();
  },
  collapsed(pid) { return !!(App.prefs.collapsed && App.prefs.collapsed[pid]); },

  /* ---------- carpetas en el inicio ---------- */
  folders() {
    const set = new Set((App.prefs.folders || []).filter(Boolean));
    App.allProjects().forEach(x => { if (!x.doc.data.trashed && x.doc.data.folder) set.add(x.doc.data.folder); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  },
  setFolder(d, name) {
    d.update(x => { if (name) x.folder = name; else delete x.folder; }, { now: true });
    if (name) { const f = App.prefs.folders || []; if (!f.includes(name)) { f.push(name); App.prefs.folders = f; App.savePrefs(); } }
    App.renderHomeSoon();
  },
  async newFolder(d) {
    const name = await UI.prompt('Nueva carpeta', 'Nombre de la carpeta', ''); if (!name || !name.trim()) return;
    const n = name.trim();
    const f = App.prefs.folders || []; if (!f.includes(n)) { f.push(n); App.prefs.folders = f; App.savePrefs(); }
    if (d) this.setFolder(d, n); else { App.prefs.homeFolder = n; App.savePrefs(); App.renderHomeSoon(); }
  },
  folderMenu(anchor, d) {
    const cur = d.data.folder || null;
    UI.menu(anchor, [{ label: 'Sin carpeta', checked: !cur, onClick: () => this.setFolder(d, null) }, { sep: true }]
      .concat(this.folders().map(f => ({ label: f, checked: cur === f, onClick: () => this.setFolder(d, f) })))
      .concat([{ sep: true }, { label: 'Nueva carpeta…', onClick: () => this.newFolder(d) }]));
  },
  async renameFolder(old) {
    const name = await UI.prompt('Renombrar carpeta', 'Nombre', old); if (!name || !name.trim() || name.trim() === old) return;
    const n = name.trim();
    App.allProjects().forEach(x => { if (x.doc.data.folder === old) x.doc.update(z => { z.folder = n; }, { now: true }); });
    App.prefs.folders = (App.prefs.folders || []).map(f => f === old ? n : f); if (App.prefs.homeFolder === old) App.prefs.homeFolder = n; App.savePrefs();
    App.renderHomeSoon();
  },
  async deleteFolder(name) {
    if (!await UI.confirm('Quitar carpeta', 'Los proyectos de «' + name + '» quedarán sin carpeta. No se borra ningún texto.', 'Quitar carpeta')) return;
    App.allProjects().forEach(x => { if (x.doc.data.folder === name) x.doc.update(z => { delete z.folder; }, { now: true }); });
    App.prefs.folders = (App.prefs.folders || []).filter(f => f !== name); if (App.prefs.homeFolder === name) App.prefs.homeFolder = null; App.savePrefs();
    App.renderHomeSoon();
  },
  /* Barra de carpetas del inicio. */
  folderBar(list) {
    const fs = this.folders();
    if (!fs.length && !RT.canWrite) return null;
    const cur = App.prefs.homeFolder && fs.includes(App.prefs.homeFolder) ? App.prefs.homeFolder : null;
    const bar = h('div', { class: 'fbar', role: 'tablist', 'aria-label': 'Carpetas' });
    const chip = (label, val, n) => h('button', { type: 'button', role: 'tab', class: 'fchip' + (cur === val ? ' on' : ''), 'aria-selected': cur === val ? 'true' : 'false', onclick: () => { App.prefs.homeFolder = val; App.savePrefs(); App.renderHomeSoon(); } }, icon(val ? 'folder' : 'grid'), h('span', { text: label }), h('b', { text: String(n) }));
    bar.append(chip('Todos', null, list.length));
    fs.forEach(f => bar.append(chip(f, f, list.filter(x => x.doc.data.folder === f).length)));
    if (RT.canWrite) bar.append(h('button', { type: 'button', class: 'fchip add', onclick: () => this.newFolder(null) }, icon('plus'), h('span', { text: 'Carpeta' })));
    if (cur && RT.canWrite) {
      bar.append(h('span', { class: 'spacer' }));
      const inF = list.filter(x => x.doc.data.folder === cur);
      if (inF.length >= 2) bar.append(btn([icon('book'), 'Juntar en un libro'], () => this.joinDialog(inF.map(x => x.doc.id)), 'small'));
      bar.append(ibtn('more', 'Opciones de la carpeta', (e) => UI.menu(e.currentTarget, [{ label: 'Renombrar carpeta', onClick: () => this.renameFolder(cur) }, { label: 'Quitar carpeta', danger: true, onClick: () => this.deleteFolder(cur) }])));
    }
    return { bar: bar, cur: cur };
  },

  /* ---------- copiar capítulos entre proyectos ---------- */
  strip(data) { const o = {}; Object.keys(data || {}).forEach(k => { if (k[0] !== '_') o[k] = data[k]; }); return o; },
  async readChapters(pid) {
    Store.flushAll && Store.flushAll();
    const f = App.findProj(pid); if (!f) return [];
    const base = App.spacePath(f.space) + '/' + pid;
    const out = [];
    for (const c of (f.doc.data.chapters || [])) {
      let data = null;
      if (App.pid === pid && App.ch(c.id) && App.ch(c.id).data) data = clone(App.ch(c.id).data);
      else { try { const s = await RT.db.doc(base + '/chapters/' + c.id).get(); data = s.exists === false ? null : (typeof s.data === 'function' ? s.data() : s.data); } catch (e) { data = null; } }
      out.push({ meta: c, data: this.strip(data || { paras: [] }) });
    }
    return out;
  },
  async writeChapter(space, pid, cid, data) {
    const d = this.strip(data); delete d.report; delete d.dismiss;
    d.paras = d.paras && d.paras.length ? d.paras : [{ id: uid('p'), segs: [] }];
    d._v = uid('v');
    await RT.db.doc(App.spacePath(space) + '/' + pid + '/chapters/' + cid).set(d);
  },
  /* Inserta entradas de capítulos en otro proyecto, antes de sus secciones finales. */
  appendEntries(x, entries) {
    let i = x.chapters.length; while (i > 0 && x.chapters[i - 1].role && SPECIAL[x.chapters[i - 1].role] && !SPECIAL[x.chapters[i - 1].role].front) i--;
    x.chapters.splice(i, 0, ...entries);
  },
  projectPicker(exclude, onPick, title, allowNew) {
    const list = App.allProjects().filter(x => !x.doc.data.trashed && x.doc.id !== exclude);
    const sel = h('select', { class: 'sel', 'aria-label': 'Proyecto' });
    if (allowNew) sel.append(h('option', { value: '__new', text: 'Un proyecto nuevo…' }));
    list.forEach(x => sel.append(h('option', { value: x.doc.id, text: x.doc.data.title + (x.doc.data.folder ? ' · ' + x.doc.data.folder : '') })));
    UI.modal({ title: title, body: h('label', { class: 'field' }, h('span', { text: 'Proyecto' }), sel), buttons: [{ label: 'Cancelar' }, { label: 'Listo', cls: 'primary', onClick: () => { onPick(sel.value); } }] });
  },
  chapterTo(cid, move) {
    const title = (move ? 'Mover' : 'Copiar') + ' «' + (App.chTitle(cid) || App.unit()) + '» a…';
    this.projectPicker(App.pid, async (target) => {
      let tpid = target;
      if (target === '__new') {
        const t = await UI.prompt('Proyecto nuevo', 'Título', App.chTitle(cid) || 'Sin título'); if (t == null) return;
        tpid = await this.createEmpty(t, App.P().kind, App.findProj(App.pid).space);
      }
      const f = App.findProj(tpid); if (!f) return;
      const d = App.ch(cid); if (!d || !d.data) return;
      Store.flushAll && Store.flushAll();
      const ncid = uid('c'); const meta = App.chapterList().find(c => c.id === cid);
      await this.writeChapter(f.space, tpid, ncid, clone(d.data));
      f.doc.update(x => { this.appendEntries(x, [{ id: ncid, title: meta.title || '', role: meta.role && meta.role !== 'parte' ? meta.role : undefined }]); x.stats = x.stats || {}; }, { now: true });
      if (move && App.chapterList().length > 1) App.trashChapter(cid);
      App.toast((move ? 'Movido' : 'Copiado') + ' a «' + f.doc.data.title + '».', { action: { label: 'Abrir', fn: () => App.go('p-' + tpid + '-c-' + ncid) } });
    }, title, true);
  },
  async createEmpty(title, kind, space) {
    space = space && App.colls[space] ? space : (App.colls.mine ? 'mine' : 'team');
    const np = newProjectData(title, kind || 'otro', 0);
    const pid = uid('p');
    np.data.createdBy = RT.me || null; np.data.chapters = [];
    np.data.stats = { words: 0, chapters: 0, peek: '' };
    App.colls[space].create(pid, np.data);
    await new Promise(r => setTimeout(r, 30));
    return pid;
  },

  /* ---------- juntar proyectos en uno ---------- */
  joinDialog(preselect) {
    const all = App.allProjects().filter(x => !x.doc.data.trashed);
    const pre = new Set(preselect || []);
    const box = h('div', { class: 'join' });
    const checks = h('div', { class: 'join-list' });
    const order = all.slice().sort((a, b) => (pre.has(b.doc.id) - pre.has(a.doc.id)) || (a.doc.data.title || '').localeCompare(b.doc.data.title || '', 'es'));
    order.forEach(x => {
      const c = h('input', { type: 'checkbox', value: x.doc.id, checked: pre.has(x.doc.id) });
      const P = x.doc.data;
      checks.append(h('label', { class: 'join-it' }, c, h('span', { class: 't', text: P.title || 'Sin título' }), h('span', { class: 's', text: kindOf(P).label + ' · ' + plural((P.chapters || []).length, kindOf(P).unit.toLowerCase(), kindOf(P).units.toLowerCase()) + (P.folder ? ' · ' + P.folder : '') })));
    });
    const firstKind = (all.find(x => pre.has(x.doc.id)) || all[0] || { doc: { data: {} } }).doc.data.kind || 'poesia';
    const title = h('input', { class: 'inp', value: preselect && preselect.length && App.prefs.homeFolder ? App.prefs.homeFolder : '', placeholder: 'Por ejemplo: Poemario del puerto' });
    const kind = h('select', { class: 'sel' }); Object.keys(KINDS).forEach(k => kind.append(h('option', { value: k, text: KINDS[k].label }))); kind.value = firstKind;
    const target = h('select', { class: 'sel' }, h('option', { value: '__new', text: 'Un proyecto nuevo' }), ...all.map(x => h('option', { value: x.doc.id, text: 'Agregar a «' + x.doc.data.title + '»' })));
    const asParts = h('input', { type: 'checkbox' });
    const trash = h('input', { type: 'checkbox' });
    const sync = () => { const isNew = target.value === '__new'; title.disabled = !isNew; kind.disabled = !isNew; };
    target.addEventListener('change', sync); sync();
    const picked = () => Array.from(checks.querySelectorAll('input:checked')).map(i => i.value);
    const updParts = () => { const ids = picked(); asParts.checked = ids.some(id => ((App.findProj(id) || { doc: { data: {} } }).doc.data.chapters || []).length > 1); };
    checks.addEventListener('change', updParts); updParts();
    box.append(
      h('p', { class: 'muted', style: 'margin:0', text: 'Elige los proyectos que quieres reunir, en el orden en que aparecen. Se copian sus textos, notas y fichas de la biblia; los originales no se tocan, salvo que lo pidas.' }),
      checks,
      h('label', { class: 'field' }, h('span', { text: 'Juntar en' }), target),
      h('div', { class: 'row', style: 'gap:.8rem;align-items:flex-end' }, h('label', { class: 'field', style: 'flex:2' }, h('span', { text: 'Título del libro' }), title), h('label', { class: 'field', style: 'flex:1' }, h('span', { text: 'Tipo' }), kind)),
      h('label', { class: 'row', style: 'gap:.45rem;font-size:.875rem' }, asParts, 'Cada proyecto como una parte (Parte I, II…)'),
      h('label', { class: 'row', style: 'gap:.45rem;font-size:.875rem' }, trash, 'Después, mover los originales a la papelera'));
    UI.modal({ title: 'Juntar proyectos', body: box, buttons: [{ label: 'Cancelar' }, { label: 'Juntar', cls: 'primary', onClick: () => {
      const ids = order.map(x => x.doc.id).filter(id => picked().includes(id));
      if (!ids.length) { App.toast('Elige al menos un proyecto.'); return false; }
      this.join(ids, { target: target.value, title: title.value.trim() || 'Libro sin título', kind: kind.value, asParts: asParts.checked, trash: trash.checked });
    } }] });
  },
  async join(ids, o) {
    App.toast('Juntando ' + plural(ids.length, 'proyecto') + '…');
    let tpid = o.target, f;
    if (tpid === '__new') { tpid = await this.createEmpty(o.title, o.kind); }
    f = App.findProj(tpid); if (!f) { App.toast('No se encontró el proyecto de destino.'); return; }
    const entries = [], bibles = [], dict = new Set(), threads = [];
    for (const sid of ids) {
      if (sid === tpid) continue;
      const src = App.findProj(sid); if (!src) continue;
      const P = src.doc.data;
      const chs = await this.readChapters(sid);
      if (o.asParts) { const pc = uid('c'); await this.writeChapter(f.space, tpid, pc, { paras: [{ id: uid('p'), segs: [] }] }); entries.push({ id: pc, title: P.title || 'Parte', role: 'parte' }); }
      for (const c of chs) {
        if (o.asParts && c.meta.role === 'parte') continue;
        const ncid = uid('c');
        await this.writeChapter(f.space, tpid, ncid, c.data);
        // un proyecto de un solo texto con título genérico toma el título del proyecto (útil para poemas sueltos)
        let t = c.meta.title || '';
        if (chs.length === 1 && (!t || /^(Capítulo|Parte|Sección|Escena|Poema)\s+\d+$/.test(t))) t = P.title || t;
        const e = { id: ncid, title: t }; if (c.meta.role && c.meta.role !== 'parte') e.role = c.meta.role; else if (c.meta.role === 'parte') e.role = 'parte';
        entries.push(e);
      }
      ((P.bible && P.bible.sections) || []).forEach(s => bibles.push(s));
      (P.dictionary || []).forEach(w => dict.add(w));
      (P.threads || []).forEach(t => threads.push(Object.assign({}, t, { id: uid('t') })));
    }
    f.doc.update(x => {
      this.appendEntries(x, entries);
      x.bible = x.bible || { sections: [] };
      bibles.forEach(s => {
        let t = x.bible.sections.find(z => (z.label || '').toLowerCase() === (s.label || '').toLowerCase());
        if (!t) { t = { id: uid('s'), label: s.label, fields: (s.fields || []).slice(), graph: !!s.graph, items: [] }; x.bible.sections.push(t); }
        (s.fields || []).forEach(fl => { if (!(t.fields || []).includes(fl)) (t.fields = t.fields || []).push(fl); });
        (s.items || []).forEach(it => { if (!(t.items || []).some(z => (z.title || '').trim().toLowerCase() === (it.title || '').trim().toLowerCase() && it.title)) (t.items = t.items || []).push(Object.assign(clone(it), { id: uid('i') })); });
      });
      if (dict.size) x.dictionary = Array.from(new Set((x.dictionary || []).concat(Array.from(dict))));
      if (threads.length) x.threads = (x.threads || []).concat(threads);
    }, { now: true });
    if (o.trash) ids.forEach(id => { if (id === tpid) return; const s = App.findProj(id); if (s) s.doc.update(z => { z.trashed = true; }, { now: true }); });
    App.toast('Listo: «' + f.doc.data.title + '» tiene ahora ' + plural((f.doc.data.chapters || []).length, kindOf(f.doc.data).unit.toLowerCase(), kindOf(f.doc.data).units.toLowerCase()) + '.');
    App.go('p-' + tpid);
    return tpid;
  }
};
window.Collections = Collections;
