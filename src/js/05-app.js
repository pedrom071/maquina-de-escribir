/* ============ aplicación: rutas, inicio, proyecto ============ */
const PREF_KEY = 'mde-prefs-v1';
function loadPrefs() {
  const d = { auto: true, ecos: false, clean: false, hideDone: false, off: [], focusDim: true, lastCh: {} };
  try { return Object.assign(d, JSON.parse(localStorage.getItem(PREF_KEY) || '{}')); } catch (e) { return d; }
}

const App = {
  prefs: loadPrefs(),
  colls: { mine: null, team: null }, chapters: null, chaptersPid: null, space: 'mine',
  pid: null, cid: null, tab: 'escribir', view: 'home',
  sideOpen: false, focus: false,

  savePrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify(this.prefs)); } catch (e) {} },
  /* Dos espacios: «mine» (privado de cada persona, en data/users/<id>) y «team» (compartido con quienes tienen acceso). */
  spacePath(space) {
    if (space === 'mine') return RT.local ? 'projects' : (RT.me ? 'data/users/' + RT.me : null);
    if (space === 'team') return RT.local ? null : 'projects';
    return null;
  },
  findProj(pid) {
    for (const sp of ['mine', 'team']) { const c = this.colls[sp]; const d = c && c.get(pid); if (d && d.data) return { doc: d, space: sp }; }
    return null;
  },
  ppath(pid, space) { const f = space ? { space: space } : this.findProj(pid); return f ? this.spacePath(f.space) + '/' + pid : null; },
  proj() { const f = this.pid ? this.findProj(this.pid) : null; return f ? f.doc : null; },
  allProjects() {
    const out = [];
    ['mine', 'team'].forEach(sp => { const c = this.colls[sp]; if (c) c.list().forEach(d => { if (d.id[0] !== '_' && d.data && d.data.title != null) out.push({ doc: d, space: sp }); }); });
    return out;
  },
  P() { const d = this.proj(); return d && d.data; },
  ch(cid) { return this.chapters ? this.chapters.get(cid || this.cid) : null; },
  chapterList() { const P = this.P(); return P ? (P.chapters || []) : []; },
  chTitle(cid) { const c = this.chapterList().find(x => x.id === cid); return c ? c.title : ''; },
  chIndex(cid) { return this.chapterList().findIndex(x => x.id === cid); },
  unit() { return kindOf(this.P()).unit; },

  async init() {
    $('#app').append(this.buildTop(), h('main', { id: 'main' }), h('footer', { class: 'status', id: 'status' }));
    $('#main').append(h('div', { class: 'home' }, h('p', { class: 'muted', text: 'Abriendo tu escritorio…' })));
    await initRuntime();
    ['mine', 'team'].forEach(sp => {
      const path = this.spacePath(sp);
      if (!path) return;
      this.colls[sp] = new Coll(path, { onChange: () => this.onProjects(), onDoc: (sd, kind) => { if (sd.id === '_perfil') Profile.onDoc(sd, kind); else this.onProjectDoc(sd, kind); } });
    });
    Profile.attach(this.colls.mine);
    if (RT.web) {
      $('#btn-share').hidden = true;
      AI.refreshPill();
      window.addEventListener('pagehide', () => { Store.flushAll(); IDB.flush(); });
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { Store.flushAll(); setTimeout(() => IDB.flush(), 50); } });
      if (window.Spell) setTimeout(() => Spell.init(), 1500);
    }
    setTimeout(() => { if (!this.routed) { this.routed = true; Profile.ready(); this.route(); } }, 5000);
    window.addEventListener('hashchange', () => this.route());
    window.addEventListener('beforeunload', () => Store.flushAll());
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') Store.flushAll(); });
    document.addEventListener('keydown', (e) => this.globalKeys(e));
    this.renderSaveStatus();
    if (window.Collab) Collab.init();
  },
  onSaveError(doc, code) {
    if (code === 'invalid_argument') this.toast('No se pudo guardar: el documento es demasiado grande o tiene un formato no válido. Divide el capítulo en dos.');
    else if (code === 'quota_exceeded') this.toast('No se pudo guardar: se llenó el espacio de esta herramienta.');
  },
  onSyncError() { this.renderSaveStatus(); },
  toast(t, o) { UI.toast(t, o); },

  /* ---------- rutas ---------- */
  routed: false,
  onProjects() {
    if (!this.routed) {
      if (['mine', 'team'].some(sp => this.colls[sp] && !this.colls[sp].ready)) return;
      this.routed = true; Profile.ready(); this.route(); return;
    }
    if (this.view === 'home') this.renderHomeSoon();
    else if (!this.proj()) { location.hash = ''; }
  },
  go(hash) { if (location.hash.slice(1) === hash) this.route(); else location.hash = hash; },
  route() {
    const hs = (location.hash || '').slice(1);
    const m = hs.match(/^p-([a-z0-9]+)(?:-(c)-([a-z0-9]+)|-(biblia|ideas|diagramas|estadisticas|ajustes))?$/);
    if (!m || !this.findProj(m[1])) { this.showHome(); return; }
    const pid = m[1];
    let tab = m[4] || 'escribir', cid = m[3] || null;
    this.openProject(pid);
    if (tab === 'escribir') {
      const list = this.chapterList();
      if (!cid || !list.find(c => c.id === cid)) cid = (this.prefs.lastCh[pid] && list.find(c => c.id === this.prefs.lastCh[pid])) ? this.prefs.lastCh[pid] : (list[0] && list[0].id);
      this.cid = cid;
      if (cid) { this.prefs.lastCh[pid] = cid; this.savePrefs(); }
    }
    this.tab = tab;
    this.renderProject();
  },
  chHash(cid) { return 'p-' + this.pid + '-c-' + cid; },

  /* ---------- barra superior ---------- */
  buildTop() {
    const top = h('header', { class: 'top', id: 'top' });
    top.append(
      ibtn('menu', 'Mostrar índice del proyecto', () => this.toggleSide(), { id: 'btn-side', class: 'ibtn only-narrow', hidden: true }),
      h('button', { class: 'brand', type: 'button', onclick: () => this.go(''), title: 'Ir a tus proyectos' }, 'Máquina de ', h('b', { text: 'escribir' })),
      h('nav', { class: 'crumbs', id: 'crumbs', 'aria-label': 'Ubicación' }),
      h('div', { class: 'top-r' },
        h('div', { class: 'peers', id: 'peers' }),
        h('span', { class: 'save', id: 'save-st', role: 'status' }),
        ibtn('search', 'Buscar en el proyecto (' + keys('mod', 'shift', 'F') + ')', () => window.Search && Search.open(), { id: 'btn-search', hidden: true }),
        h('button', { class: 'ai-pill off', id: 'btn-ai', type: 'button', hidden: true, onclick: () => AI.open() }),
        ibtn('people', 'Colaborar', () => window.Collab && Collab.openPanel(), { id: 'btn-share' }),
        h('button', { class: 'ibtn me-btn', id: 'btn-me', type: 'button', 'aria-label': 'Tu perfil y apariencia', title: 'Tu perfil y apariencia', onclick: () => Profile.open() }, icon('palette')),
        h('button', { class: 'ibtn', type: 'button', 'aria-label': 'Atajos y ayuda', title: 'Atajos y ayuda', onclick: () => this.help(), text: '?' })
      )
    );
    return top;
  },
  renderCrumbs() {
    const c = $('#crumbs'); if (!c) return;
    c.textContent = '';
    if (this.view !== 'project') return;
    const P = this.P(); if (!P) return;
    c.append(h('span', { class: 'sep', text: '/' }), h('button', { type: 'button', text: P.title, onclick: () => this.go('p-' + this.pid) }));
    let cur = null;
    if (this.tab === 'escribir' && this.cid) cur = this.chTitle(this.cid) || this.unit();
    else cur = { biblia: 'Biblia', ideas: 'Ideas', diagramas: 'Diagramas', estadisticas: 'Estadísticas', ajustes: 'Ajustes' }[this.tab];
    if (cur) c.append(h('span', { class: 'sep', text: '/' }), h('span', { class: 'cur', text: cur }));
  },
  renderSaveStatus() {
    const el = $('#save-st'); if (!el) return;
    el.className = 'save'; el.textContent = '';
    let txt;
    if (!RT.ready) txt = 'Conectando…';
    else if (!RT.canWrite) txt = 'Solo lectura';
    else if (Store.err && PERMANENT.has(Store.err.code)) { el.classList.add('err'); txt = 'No se pudo guardar'; }
    else if (Store.pendingCount()) { el.classList.add('busy'); txt = Store.err ? 'Reintentando…' : 'Guardando…'; }
    else txt = RT.local ? 'Guardado en este navegador' : 'Guardado';
    el.title = RT.local ? 'Esta vista no tiene la base compartida: lo que escribas queda solo en este navegador.' : (Store.lastSaved ? 'Último guardado ' + relTime(Store.lastSaved) : '');
    el.append(h('span', { class: 'dot' }), h('span', { class: 'txt', text: txt }));
  },

  /* ---------- inicio ---------- */
  renderHomeSoon: debounce(function () { App.renderHome(); }, 120),
  showHome() {
    if (this.view === 'project') this.closeProject();
    this.view = 'home'; this.pid = null; this.cid = null;
    document.body.classList.remove('focus');
    $('#btn-side').hidden = true; $('#btn-search').hidden = true;
    this.renderHome(); this.renderCrumbs(); this.renderStatus();
    if (window.Ideas) { Ideas.fab(); Ideas.renderPanel(); }
    if (window.Collab) Collab.setPresence();
  },
  renderHome() {
    if (this.view !== 'home') return;
    const main = $('#main'); main.textContent = '';
    const all = this.allProjects();
    const order = (a, b) => ((b.doc.data._at || b.doc.data.createdAt || 0) - (a.doc.data._at || a.doc.data.createdAt || 0));
    const mine = all.filter(x => x.space === 'mine' && !x.doc.data.trashed).sort(order);
    const team = all.filter(x => x.space === 'team' && !x.doc.data.trashed).sort(order);
    const trash = all.filter(x => x.doc.data.trashed);
    const wrap = h('div', { class: 'home' });
    const actions = h('div', { class: 'row' });
    if (RT.canWrite) actions.append(btn('Importar', () => IO.openImport(null)), btn('Nuevo proyecto', () => this.newProject(), 'primary'));
    const name = Profile.myName();
    wrap.append(h('div', { class: 'home-hero' },
      h('div', null,
        h('h1', null, name ? 'Hola, ' : 'Tus ', h('em', { text: name || 'proyectos' })),
        h('p', { text: RT.web ? 'Escribe, ordena y revisa. El revisor marca ortografía, repeticiones y frases largas; con tu IA, también coherencia. Las decisiones creativas son tuyas.' : 'Escribe, ordena y revisa. Claude marca repeticiones, dudas y problemas de coherencia; las decisiones creativas son tuyas.' })),
      actions));
    if (!RT.canWrite && !RT.local) wrap.append(h('div', { class: 'panel onboard' }, h('h3', { text: 'Estás en modo lectura' }), h('p', { class: 'muted', style: 'margin:0', text: 'Puedes ver los proyectos compartidos, pero no escribir. Para tener tus propios proyectos aquí, pide a quien te compartió esta herramienta que te invite con permiso de edición.' })));
    const hasTeam = !!this.colls.team;
    wrap.append(h('div', { class: 'sec-hd' }, h('h2', { text: hasTeam ? 'Mis proyectos' : 'Proyectos' }), hasTeam ? h('span', { class: 'muted', text: 'Solo tú los ves.' }) : null));
    const fb = Collections.folderBar(mine.concat(team));
    if (fb) wrap.append(fb.bar);
    const inFolder = (x) => !fb || !fb.cur || x.doc.data.folder === fb.cur;
    const grid = h('div', { class: 'pgrid' });
    const mineShown = mine.filter(inFolder);
    if (fb && !fb.cur && Collections.folders().length) {
      // agrupados por carpeta
      const groups = new Map(); mineShown.forEach(x => { const f = x.doc.data.folder || ''; if (!groups.has(f)) groups.set(f, []); groups.get(f).push(x); });
      Array.from(groups.keys()).sort((a, b) => (a === '') - (b === '') || a.localeCompare(b, 'es')).forEach(f => {
        if (f) grid.append(h('button', { type: 'button', class: 'pgroup', onclick: () => { this.prefs.homeFolder = f; this.savePrefs(); this.renderHomeSoon(); } }, icon('folder'), h('span', { text: f }), h('b', { text: String(groups.get(f).length) })));
        groups.get(f).forEach(x => grid.append(this.projectCard(x.doc, 'mine')));
      });
    } else mineShown.forEach(x => grid.append(this.projectCard(x.doc, 'mine')));
    if (RT.canWrite && this.colls.mine) grid.append(h('button', { class: 'pcard new', type: 'button', onclick: () => this.newProject({ space: 'mine' }) }, icon('plus'), h('span', { text: 'Nuevo proyecto' })));
    if (!this.colls.mine) grid.append(h('div', { class: 'empty', text: 'Tu espacio privado no está disponible en esta vista. Abre la herramienta desde claude.ai con tu cuenta.' }));
    wrap.append(grid);
    if (!mine.length && this.colls.mine && RT.canWrite) wrap.append(this.onboarding());
    if (RT.web && RT.canWrite) {
      const words = mine.concat(team).reduce((n, x) => n + ((x.doc.data.stats && x.doc.data.stats.words) || 0), 0);
      const last = this.prefs.lastBackup || 0, days = Math.floor((Date.now() - last) / 864e5);
      if (words >= 1500 && days >= 14 && !(this.prefs.backupSnooze && Date.now() - this.prefs.backupSnooze < 3 * 864e5)) {
        const note = h('div', { class: 'backup-note', role: 'note' }, icon('book'),
          h('div', null, h('b', { text: last ? 'Hace ' + plural(days, 'día') + ' que no respaldas.' : 'Todavía no tienes un respaldo.' }), ' Tus ' + fmtN(words) + ' palabras viven solo en este navegador; un respaldo te deja recuperarlas o llevarlas a otro computador.'),
          h('div', { class: 'row' }, btn('Descargar respaldo', () => WebBackup.download(), 'small primary'), btn('Más tarde', () => { this.prefs.backupSnooze = Date.now(); this.savePrefs(); note.remove(); }, 'small ghost')));
        wrap.insertBefore(note, wrap.children[1] || null);
      }
    }
    if (window.Habit) { const hp = Habit.projects(); if (hp.length) wrap.append(h('div', { class: 'sec-hd' }, h('h2', { text: 'Tu escritura' }), h('span', { class: 'muted', text: 'Todos tus proyectos juntos' + (hp.some(x => x.shared) ? '; en los compartidos, solo lo que escribiste tú' : '') + '.' })), Habit.panel(hp, { byProject: true, title: 'Rachas y ritmo', who: Habit.me() })); }
    if (hasTeam) {
      wrap.append(h('div', { class: 'sec-hd' }, h('h2', { text: 'Compartidos' }), h('span', { class: 'muted', text: 'Los ven y editan todas las personas con acceso de colaborador a esta herramienta.' })));
      const tg = h('div', { class: 'pgrid' });
      team.filter(inFolder).forEach(x => tg.append(this.projectCard(x.doc, 'team')));
      if (RT.canWrite) tg.append(h('button', { class: 'pcard new', type: 'button', onclick: () => this.newProject({ space: 'team' }) }, icon('plus'), h('span', { text: 'Nuevo proyecto compartido' })));
      else if (!team.length) tg.append(h('div', { class: 'empty', text: 'No hay proyectos compartidos.' }));
      wrap.append(tg);
    }
    if (trash.length) {
      wrap.append(h('div', { class: 'sec-hd' }, h('h2', { text: 'Papelera' })));
      const tl = h('div', { class: 'trash-list' });
      trash.forEach(x => { const d = x.doc; tl.append(h('div', { class: 'trash-item' },
        h('span', { style: 'flex:1;min-width:0', text: d.data.title + (x.space === 'team' ? ' (compartido)' : '') }),
        RT.canWrite ? btn('Restaurar', () => { d.update(z => { z.trashed = false; }, { now: true }); this.renderHomeSoon(); }, 'small') : null,
        RT.canWrite ? btn('Eliminar para siempre', () => this.purgeProject(d, x.space), 'small danger') : null)); });
      wrap.append(tl);
    }
    main.append(wrap);
  },
  onboarding() {
    const steps = [
      ['Crea un proyecto', 'Elige si es novela, cuento, ensayo, columna, guion o poesía. Cada tipo trae su biblia.'],
      ['Escribe o importa', 'Escribe directo en la hoja o trae un Word, Markdown o Google Doc.'],
      RT.web ? ['Revisa sin y con IA', 'La revisión rápida marca ortografía, repeticiones y frases largas mientras escribes. Con tu clave de IA, también coherencia e informes.'] : ['Deja que Claude marque', 'Al hacer una pausa, o con ' + keys('mod', 'enter') + ', aparecen notas al margen. Tú decides qué hacer.'],
      ['Ajusta la apariencia', 'Colores, tipografías, tamaño de letra y ancho de la hoja, desde tu perfil.']
    ];
    const ol = h('ol', { class: 'steps' });
    steps.forEach(([t, d]) => ol.append(h('li', null, h('b', { text: t }), h('span', { text: d }))));
    return h('div', { class: 'panel onboard' }, h('h3', { text: 'Para empezar' }), ol, h('div', { class: 'row' }, btn('Nuevo proyecto', () => this.newProject({ space: 'mine' }), 'primary'), btn('Importar un texto', () => IO.openImport(null)), RT.web && !AI.ready() ? btn([icon('spark'), 'Conectar IA'], () => AI.open()) : null, btn('Apariencia', () => Profile.open())));
  },
  projectCard(d, space) {
    const P = d.data, k = kindOf(P), st = P.stats || {};
    const card = h('div', { class: 'pcard', role: 'link', tabindex: '0', onclick: (e) => { if (!e.target.closest('.more')) this.go('p-' + d.id); }, onkeydown: (e) => { if (e.key === 'Enter' && e.target === card) this.go('p-' + d.id); } });
    card.append(h('div', { class: 'row', style: 'justify-content:space-between;gap:.3rem' }, h('span', { class: 'label', text: k.label + (space === 'team' ? ' · compartido' : '') + (P.folder && !(this.prefs.homeFolder) ? ' · ' + P.folder : '') }), RT.canWrite ? ibtn('more', 'Opciones de «' + P.title + '»', (e) => { e.stopPropagation(); this.projectMenu(e.currentTarget, d, space); }, { class: 'ibtn more' }) : null));
    card.append(h('h3', { text: P.title }));
    if (st.peek) card.append(h('p', { class: 'peek', text: st.peek }));
    if (P.goal) {
      const pct = Math.min(100, Math.round(100 * (st.words || 0) / P.goal));
      card.append(h('div', { class: 'bar', title: pct + '% de la meta' }, h('i', { style: 'width:' + pct + '%' })));
    }
    card.append(h('div', { class: 'meta' },
      h('span', { text: plural(st.words || 0, 'palabra') }),
      h('span', { text: plural((P.chapters || []).length, k.unit.toLowerCase(), k.units.toLowerCase()) }),
      h('span', { text: relTime(P._at || P.createdAt) })));
    return card;
  },
  projectMenu(a, d, space) {
    const items = [{ label: 'Abrir', onClick: () => this.go('p-' + d.id) }, { label: 'Leer como libro', onClick: () => { this.go('p-' + d.id); setTimeout(() => Lectura.open(), 500); } }, { label: 'Maqueta de libro (PDF)', onClick: () => { this.go('p-' + d.id); setTimeout(() => Maqueta.open(), 500); } }];
    if (this.colls.team && this.colls.mine) {
      if (space === 'mine') items.push({ label: 'Compartir con el equipo', onClick: () => this.moveProject(d.id, 'team') });
      else { items.push({ label: 'Hacer una copia privada', onClick: () => this.moveProject(d.id, 'mine', true) }); items.push({ label: 'Mover a mis proyectos', onClick: () => this.moveProject(d.id, 'mine') }); }
    }
    items.push({ label: 'Duplicar', onClick: () => this.moveProject(d.id, space, true) });
    items.push({ sep: true }, { label: 'Carpeta' + (d.data.folder ? ': ' + d.data.folder : '') + '…', onClick: () => setTimeout(() => Collections.folderMenu(a, d), 30) });
    items.push({ label: 'Juntar con otros proyectos…', onClick: () => Collections.joinDialog([d.id]) });
    items.push({ sep: true }, { label: 'Mover a la papelera', danger: true, onClick: () => { d.update(x => { x.trashed = true; }, { now: true }); this.renderHomeSoon(); this.toast('Proyecto en la papelera.', { action: { label: 'Deshacer', fn: () => { d.update(x => { x.trashed = false; }, { now: true }); this.renderHomeSoon(); } } }); } });
    UI.menu(a, items);
  },
  /* Mueve o copia un proyecto completo (capítulos y versiones) entre el espacio privado y el compartido. */
  async moveProject(pid, to, copy) {
    const f = this.findProj(pid); if (!f) return;
    const from = f.space;
    if (!copy && from === to) return;
    const title = f.doc.data.title;
    if (!copy) {
      const msg = to === 'team'
        ? '«' + title + '» pasará a Compartidos: lo verán y podrán editar todas las personas con acceso de colaborador a esta herramienta.'
        : '«' + title + '» pasará a tus proyectos privados. Las demás personas dejarán de verlo.';
      if (!await UI.confirm(to === 'team' ? 'Compartir proyecto' : 'Mover a mis proyectos', msg, to === 'team' ? 'Compartir' : 'Mover')) return;
    }
    Store.flushAll();
    const npid = copy ? uid('p') : pid;
    const src = this.spacePath(from) + '/' + pid, dst = this.spacePath(to) + '/' + npid;
    this.toast(copy ? 'Copiando…' : 'Moviendo…');
    try {
      if (this.pid === pid && !copy) { this.go(''); await new Promise(r => setTimeout(r, 50)); }
      const chs = await RT.db.collection(src + '/chapters').get();
      for (const c of chs.docs) {
        await RT.db.doc(dst + '/chapters/' + c.id).set(Object.assign(c.data(), { _v: uid('v') }));
        const vs = await RT.db.collection(src + '/chapters/' + c.id + '/versions').get();
        for (const v of vs.docs) await RT.db.doc(dst + '/chapters/' + c.id + '/versions/' + v.id).set(v.data());
      }
      const data = clone(f.doc.data);
      Object.keys(data).forEach(k => { if (k[0] === '_') delete data[k]; });
      if (copy) { data.title = data.title + (from === to ? ' (copia)' : ''); data.createdAt = Date.now(); }
      this.colls[to].create(npid, data);
      if (!copy) {
        for (const c of chs.docs) {
          const vs = await RT.db.collection(src + '/chapters/' + c.id + '/versions').get();
          for (const v of vs.docs) await RT.db.doc(src + '/chapters/' + c.id + '/versions/' + v.id).delete();
          await RT.db.doc(src + '/chapters/' + c.id).delete();
        }
        await this.colls[from].remove(pid);
      }
      this.toast(copy ? 'Copia lista.' : (to === 'team' ? 'Ahora es un proyecto compartido.' : 'Ahora está en tus proyectos.'));
      this.renderHomeSoon();
    } catch (e) { this.toast('No se pudo completar. Revisa tu conexión e intenta de nuevo.'); }
  },
  newProject(prefill) {
    prefill = prefill || {};
    let kind = prefill.kind || 'novela';
    let space = prefill.space || 'mine';
    if (!this.colls[space]) space = this.colls.mine ? 'mine' : 'team';
    const title = h('input', { class: 'inp', id: 'np-title', placeholder: 'Por ejemplo: La última carta', value: prefill.title || '' });
    const goal = h('input', { class: 'inp', id: 'np-goal', type: 'number', min: '0', step: '1000', placeholder: 'Opcional, por ejemplo 60000' });
    const kinds = h('div', { class: 'kinds', role: 'radiogroup', 'aria-label': 'Tipo de proyecto' });
    const desc = { novela: 'Capítulos, personajes, línea de tiempo', cuento: 'Partes y personajes', ensayo: 'Secciones, tesis y fuentes', columna: 'Texto breve con fuentes', guion: 'Escenas y locaciones', poesia: 'Poemas y motivos', otro: 'Secciones libres' };
    Object.keys(KINDS).forEach(k => {
      const b = h('button', { class: 'kopt', type: 'button', role: 'radio', 'aria-checked': k === kind ? 'true' : 'false' }, h('b', { text: KINDS[k].label }), h('span', { text: desc[k] }));
      b.addEventListener('click', () => { kind = k; $$('.kopt', kinds).forEach(x => x.setAttribute('aria-checked', 'false')); b.setAttribute('aria-checked', 'true'); });
      kinds.append(b);
    });
    const where = h('div', { class: 'checks' });
    if (this.colls.mine && this.colls.team) {
      [['mine', 'Solo yo'], ['team', 'Compartido con quienes tienen acceso']].forEach(([v, l]) => {
        const r = h('input', { type: 'radio', name: 'np-space', checked: v === space });
        r.addEventListener('change', () => { space = v; });
        where.append(h('label', null, r, l));
      });
    }
    const create = () => {
      const t = title.value.trim() || 'Sin título';
      this.createProject(t, kind, parseInt(goal.value, 10) || 0, null, space);
    };
    UI.modal({
      title: 'Nuevo proyecto',
      body: h('div', { style: 'display:flex;flex-direction:column;gap:.9rem' },
        h('label', { class: 'field' }, h('span', { text: 'Título' }), title),
        h('div', { class: 'field' }, h('span', { text: 'Tipo' }), kinds),
        h('label', { class: 'field' }, h('span', { text: 'Meta de palabras' }), goal),
        where.childNodes.length ? h('div', { class: 'field' }, h('span', { text: 'Quién lo ve' }), where) : null),
      buttons: [{ label: 'Cancelar' }, { label: 'Crear proyecto', cls: 'primary', onClick: create }],
      enter: create
    });
  },
  createProject(title, kind, goal, chapters, space) {
    space = space && this.colls[space] ? space : (this.colls.mine ? 'mine' : 'team');
    const np = newProjectData(title, kind, goal);
    const pid = uid('p');
    np.data.createdBy = RT.me || null;
    let chs = chapters;
    if (chs && chs.length) {
      np.data.chapters = chs.map(c => ({ id: c.id || (c.id = uid('c')), title: c.title }));
    } else {
      chs = [{ id: np.cid, title: np.data.chapters[0].title, paras: [{ id: uid('p'), segs: [] }] }];
    }
    np.data.stats = { words: chs.reduce((n, c) => n + chapterWords(c), 0), chapters: chs.length, peek: '' };
    this.colls[space].create(pid, np.data);
    const base = this.spacePath(space) + '/' + pid;
    chs.forEach(c => { RT.db.doc(base + '/chapters/' + c.id).set({ paras: c.paras && c.paras.length ? c.paras : [{ id: uid('p'), segs: [] }], _v: uid('v') }).catch(() => {}); });
    this.focusOnMount = true;
    setTimeout(() => this.go('p-' + pid + '-c-' + chs[0].id), 60);
    return pid;
  },
  async purgeProject(d, space) {
    const ok = await UI.confirm('Eliminar para siempre', 'Se borrará «' + d.data.title + '» con todos sus capítulos y versiones. No se puede deshacer.', 'Eliminar', true);
    if (!ok) return;
    const base = this.spacePath(space) + '/' + d.id;
    try {
      const chs = await RT.db.collection(base + '/chapters').get();
      for (const c of chs.docs) {
        try { const vs = await RT.db.collection(base + '/chapters/' + c.id + '/versions').get(); for (const v of vs.docs) await RT.db.doc(base + '/chapters/' + c.id + '/versions/' + v.id).delete(); } catch (e) {}
        await RT.db.doc(base + '/chapters/' + c.id).delete();
      }
      const ids = await RT.db.collection(base + '/ideas').get();
      for (const c of ids.docs) await RT.db.doc(base + '/ideas/' + c.id).delete();
    } catch (e) {}
    await this.colls[space].remove(d.id);
    this.renderHomeSoon();
  },

  /* ---------- proyecto ---------- */
  openProject(pid) {
    if (this.pid === pid && this.chapters && this.view === 'project') return;
    if (this.view === 'project' && this.pid !== pid) this.closeProject();
    this.view = 'project'; this.pid = pid;
    this.space = this.findProj(pid).space;
    this.chapters = new Coll(this.ppath(pid) + '/chapters', {
      onChange: () => { this.chaptersChanged(); },
      onDoc: (sd, kind) => this.onChapterDoc(sd, kind)
    });
    this.chaptersPid = pid;
    $('#btn-side').hidden = false; $('#btn-search').hidden = false;
  },
  closeProject() {
    if (window.Editor) Editor.unmount();
    UI.closeDrawer(true);
    if (this.chapters) { this.chapters.close(); this.chapters = null; }
    if (window.Ideas) Ideas.close();
    this.pid = null; this.cid = null;
  },
  onProjectDoc(sd, kind) {
    if (sd.id !== this.pid || this.view !== 'project') return;
    if (kind === 'local') return;
    this.renderSideSoon(); this.renderCrumbs();
    if (this.tab === 'escribir' && window.Editor) Editor.projectChanged();
    else if (this.tab === 'biblia' && window.Bible) Bible.remoteRefresh();
    else if (this.tab === 'diagramas' && window.Diagrams) Diagrams.remoteRefresh();
    else if (this.tab === 'ajustes') this.renderStageSoon();
  },
  onChapterDoc(sd, kind) {
    if (kind === 'local') { this.statsSoon(); this.renderSideSoon(); return; }
    if (this.tab === 'escribir' && sd.id === this.cid && window.Editor) Editor.onRemote(kind);
    this.renderSideSoon();
  },
  chaptersChanged() {
    if (this.tab === 'escribir' && window.Editor && !Editor.root && this.cid && this.ch(this.cid)) this.renderStage();
    this.renderSideSoon();
    this.statsSoon();
  },
  /* Actualiza el conteo del proyecto (para la portada y el registro diario). */
  statsSoon: debounce(function () { App.updateStats(); }, 2500),
  updateStats() {
    const pd = this.proj(); if (!pd || !RT.canWrite || !this.chapters || !this.chapters.ready) return;
    const P = pd.data;
    let words = 0, have = 0;
    (P.chapters || []).forEach(c => { const d = this.ch(c.id); if (d && d.data) { words += chapterWords(d.data); have++; } });
    if (have < (P.chapters || []).length) return;
    const first = P.chapters[0] && this.ch(P.chapters[0].id);
    let peek = '';
    if (first && first.data) peek = first.data.paras.map(parText).join(' ').slice(0, 220);
    const st = P.stats || {}, k = dayKey(), days = P.days || {};
    const day = days[k];
    const needDay = !day || day.e !== words;
    if (st.words === words && st.chapters === P.chapters.length && st.peek === peek && !needDay) return;
    pd.update(x => {
      x.stats = { words: words, chapters: x.chapters.length, peek: peek };
      x.days = x.days || {};
      let before;
      if (!x.days[k]) {
        const prevKeys = Object.keys(x.days).sort();
        const prev = prevKeys.length ? x.days[prevKeys[prevKeys.length - 1]].e : (st.words != null ? st.words : words);
        x.days[k] = { s: prev, e: words }; before = prev;
      } else { before = x.days[k].e; x.days[k].e = words; }
      // a qué hora escribes (palabras agregadas por hora del día)
      const added = words - before;
      if (added > 0 && added < 5000) { const hr = String(new Date().getHours()); x.days[k].h = x.days[k].h || {}; x.days[k].h[hr] = (x.days[k].h[hr] || 0) + added; }
      // quién escribió (para ver tu propio avance en proyectos compartidos)
      if (added) { const me = RT.me || 'local'; x.days[k].by = x.days[k].by || {}; x.days[k].by[me] = (x.days[k].by[me] || 0) + added; }
      // se guardan unos dos años de registro; el detalle por hora, cuatro meses
      const keys = Object.keys(x.days).sort();
      while (keys.length > 730) delete x.days[keys.shift()];
      keys.slice(0, Math.max(0, keys.length - 120)).forEach(z => { if (x.days[z].h) delete x.days[z].h; });
    }, { silent: true });
    this.renderStatus();
  },
  wordsToday() {
    const P = this.P(); if (!P || !P.days) return 0;
    const d = P.days[dayKey()]; return d ? d.e - d.s : 0;
  },

  toggleSide(force) {
    this.sideOpen = force != null ? force : !this.sideOpen;
    const s = $('.side'); if (s) s.classList.toggle('open', this.sideOpen);
    const old = $('.scrim'); if (old) old.remove();
    if (this.sideOpen && window.innerWidth <= 1100) document.body.append(h('div', { class: 'scrim', onclick: () => this.toggleSide(false) }));
  },
  renderProject() {
    const main = $('#main');
    let proj = $('.proj', main);
    if (!proj) {
      main.textContent = '';
      proj = h('div', { class: 'proj' }, h('aside', { class: 'side', id: 'side', 'aria-label': 'Índice del proyecto' }), h('section', { class: 'stage', id: 'stage' }));
      main.append(proj);
    }
    this.renderSide(); this.renderStage(); this.renderCrumbs(); this.renderStatus();
    if (window.Ideas) { Ideas.open(); Ideas.fab(); if (Ideas.panelOpen) Ideas.renderPanel(); }
    if (window.innerWidth <= 1100) this.toggleSide(false);
    if (window.Collab) Collab.setPresence();
  },
  renderSideSoon: debounce(function () { App.renderSide(); }, 150),
  renderSide() {
    const side = $('#side'); const P = this.P();
    if (!side || !P) return;
    const k = kindOf(P);
    const keepScroll = side.scrollTop;
    side.textContent = '';
    side.classList.toggle('open', this.sideOpen);
    side.append(h('div', null, h('p', { class: 'pkind', text: k.label }), h('h2', { class: 'ptitle', text: P.title })));
    const words = (P.stats && P.stats.words) || 0;
    const goal = h('div', { class: 'goal' });
    goal.append(h('div', null, fmtN(words) + ' palabras' + (P.goal ? ' de ' + fmtN(P.goal) : '') + ' · hoy ' + (this.wordsToday() >= 0 ? '+' : '') + fmtN(this.wordsToday())));
    if (P.goal) goal.append(h('div', { class: 'bar' }, h('i', { style: 'width:' + Math.min(100, 100 * words / P.goal) + '%' })));
    side.append(goal);
    const nav = h('nav', { class: 'nav', 'aria-label': 'Secciones del proyecto' });
    const navItem = (tab, label, ic, hash) => {
      const b = h('button', { type: 'button', onclick: () => this.go(hash) }, icon(ic), h('span', { text: label }));
      if (this.tab === tab) b.setAttribute('aria-current', 'page');
      nav.append(b);
    };
    navItem('escribir', 'Escribir', 'pen', this.cid ? this.chHash(this.cid) : 'p-' + this.pid);
    navItem('biblia', 'Biblia', 'book', 'p-' + this.pid + '-biblia');
    if (window.Coherence && RT.canWrite && this.chapters && this.chapters.ready) { try { const n = Coherence.bibleSync(P).length; if (n) nav.lastChild.append(h('span', { class: 'nav-n', title: 'La biblia tiene ' + plural(n, 'cambio', 'cambios') + ' pendientes según el texto', text: String(n) })); } catch (e) {} }
    navItem('ideas', 'Ideas', 'idea', 'p-' + this.pid + '-ideas');
    if (window.Ideas && Ideas.coll && Ideas.pid === this.pid) { const n = Ideas.list().filter(x => !x.done).length; const last = nav.lastChild; if (n && last) last.append(h('span', { class: 'nav-n', text: String(n) })); }
    navItem('diagramas', 'Diagramas', 'graph', 'p-' + this.pid + '-diagramas');
    navItem('estadisticas', 'Estadísticas', 'chart', 'p-' + this.pid + '-estadisticas');
    navItem('ajustes', 'Ajustes', 'gear', 'p-' + this.pid + '-ajustes');
    side.append(nav);

    const sec = h('div', { class: 'side-sec' });
    const hd = h('div', { class: 'hd' }, h('span', { class: 'label', text: k.units }));
    if (RT.canWrite) hd.append(ibtn('plus', 'Agregar ' + k.unit.toLowerCase() + ' o sección', (e) => Pages.addMenu(e.currentTarget)));
    sec.append(hd);
    const list = h('div', { class: 'chlist' });
    let curPart = null;
    (P.chapters || []).forEach((c, i) => {
      if (c.role === 'parte') {
        curPart = c;
        const kids = Collections.children(c.id), col = Collections.collapsed(c.id);
        const words = kids.reduce((n, z) => { const dz = this.ch(z.id); return n + (dz && dz.data ? chapterWords(dz.data) : 0); }, 0);
        const it = h('div', { class: 'chi part' + (this.tab === 'escribir' && this.cid === c.id ? ' cur' : '') + (col ? ' col' : '') });
        it.append(h('button', { type: 'button', class: 'tog', 'aria-expanded': col ? 'false' : 'true', 'aria-label': (col ? 'Mostrar' : 'Ocultar') + ' ' + (c.title || 'parte'), onclick: () => Collections.toggleCollapse(c.id) }, col ? '▸' : '▾'),
          h('button', { class: 'go', type: 'button', onclick: () => { this.go(this.chHash(c.id)); this.toggleSide(false); } }, h('span', { class: 't', text: c.title || Collections.partLabel(c) }), h('span', { class: 'w', text: kids.length + (words ? ' · ' + (words >= 1000 ? (words / 1000).toFixed(1).replace('.', ',') + 'k' : words) : '') })));
        if (RT.canWrite) it.append(ibtn('more', 'Opciones de ' + (c.title || 'la parte'), (e) => this.chapterMenu(e.currentTarget, c.id), { class: 'ibtn more' }));
        list.append(it);
        return;
      }
      if (curPart && Pages.role(c) && !SPECIAL[c.role].front) curPart = null;
      if (curPart && Collections.collapsed(curPart.id)) return;
      const d = this.ch(c.id);
      const w = d && d.data ? chapterWords(d.data) : null;
      const open = d && d.data ? allMarks(d.data).filter(x => !x.m.done && x.m.type !== 'bien').length : 0;
      const role = Pages.role(c), num = role ? null : Pages.number(c.id);
      const item = h('div', { class: 'chi' + (this.tab === 'escribir' && this.cid === c.id ? ' cur' : '') + (role ? ' special' : '') + (curPart ? ' in-part' : '') });
      const go = h('button', { class: 'go', type: 'button', onclick: () => { this.go(this.chHash(c.id)); this.toggleSide(false); } },
        h('span', { class: 'n', text: role ? '§' : String(num).padStart(2, '0'), title: role ? SPECIAL[role].l : '' }), h('span', { class: 't', text: c.title || (role ? SPECIAL[role].l : k.unit + ' ' + num) }),
        w != null ? h('span', { class: 'w', text: w >= 1000 ? (w / 1000).toFixed(1).replace('.', ',') + 'k' : String(w) }) : null);
      if (open) go.title = plural(open, 'nota abierta', 'notas abiertas');
      item.append(go);
      if (RT.canWrite) item.append(ibtn('more', 'Opciones de ' + (c.title || k.unit), (e) => this.chapterMenu(e.currentTarget, c.id), { class: 'ibtn more' }));
      list.append(item);
    });
    sec.append(list);
    if ((P.trash || []).length && RT.canWrite) {
      const tb = h('details', { style: 'margin:.3rem .3rem 0;font-size:.8125rem' }, h('summary', { class: 'muted', style: 'cursor:pointer', text: 'Papelera (' + P.trash.length + ')' }));
      P.trash.forEach(t => tb.append(h('div', { class: 'row', style: 'margin:.35rem 0' }, h('span', { style: 'flex:1;min-width:0', text: t.title }), btn('Restaurar', () => this.restoreChapter(t.id), 'small'))));
      sec.append(tb);
    }
    side.append(sec);
    const io = h('div', { class: 'side-sec' }, h('div', { class: 'hd' }, h('span', { class: 'label', text: 'Archivo' })));
    const ior = h('div', { class: 'row', style: 'padding:0 .3rem' });
    if (RT.canWrite) ior.append(btn('Importar', () => IO.openImport(this.pid), 'small'));
    ior.append(btn('Exportar', () => IO.openExport(this.pid, null), 'small'));
    ior.append(btn('Maqueta', () => Maqueta.open(), 'small'));
    io.append(ior);
    side.append(io);
    side.scrollTop = keepScroll;
  },
  renderStageSoon: debounce(function () { App.renderStage(); }, 120),
  renderStage() {
    const st = $('#stage'); if (!st) return;
    if (this.tab !== 'escribir' && window.Editor) Editor.unmount();
    UI.closeMenu();
    if (this.tab === 'escribir') {
      if (!this.cid) { st.textContent = ''; st.append(h('div', { class: 'empty', text: 'Este proyecto no tiene ' + kindOf(this.P()).units.toLowerCase() + '.' })); return; }
      const d = this.ch(this.cid);
      if (!d || !d.data) {
        if (window.Editor) Editor.unmount();
        st.textContent = '';
        st.append(h('div', { class: 'empty', text: this.chapters && this.chapters.ready ? 'No se encontró este texto.' : 'Abriendo…' }));
        return;
      }
      Editor.mount(st, this.cid);
    } else {
      st.textContent = '';
      if (this.tab === 'biblia') Bible.render(st);
      else if (this.tab === 'ideas') Ideas.render(st);
      else if (this.tab === 'diagramas') Diagrams.render(st);
      else if (this.tab === 'estadisticas') Stats.render(st);
      else if (this.tab === 'ajustes') this.renderSettings(st);
    }
    this.renderStatus();
  },
  renderStatus: rafThrottle(function () {
    const s = $('#status'); if (!s) return;
    s.textContent = '';
    if (App.view !== 'project') { s.append(h('span', { text: RT.local ? 'Modo local: lo que escribas queda en este navegador.' : (RT.canWrite ? 'Todo se guarda solo.' : 'Estás viendo en modo lectura.') })); return; }
    const P = App.P();
    if (App.tab === 'escribir' && window.Editor && Editor.root) {
      const d = App.ch(App.cid);
      s.append(h('span', null, App.unit() + ': ', h('b', { text: fmtN(d && d.data ? chapterWords(d.data) : 0) })));
      if (Editor.selWords) s.append(h('span', null, 'Selección: ', h('b', { text: fmtN(Editor.selWords) })));
      if (window.Pages && Pages.pages.length) s.append(h('button', { type: 'button', class: 'st-page', title: 'Ir a una página (' + keys('mod', 'K') + ')', onclick: () => Pages.palette() }, 'Pág. ', h('b', { text: Pages.cur + ' de ' + Pages.pages.length })));
    }
    if (P) {
      s.append(h('span', { class: 'st-x' }, 'Proyecto: ', h('b', { text: fmtN((P.stats && P.stats.words) || 0) })));
      const t = App.wordsToday();
      s.append(h('span', { class: 'st-x' }, 'Hoy: ', h('b', { text: (t >= 0 ? '+' : '') + fmtN(t) })));
    }
    s.append(h('span', { class: 'grow' }));
    if (window.Review && Review.statusText()) s.append(h('span', { class: 'rv', text: Review.statusText() }));
  }),

  /* ---------- capítulos ---------- */
  addChapter(after) {
    const pd = this.proj(); if (!pd) return;
    const cid = uid('c'), k = kindOf(pd.data);
    const title = k.unit + ' ' + ((pd.data.chapters || []).filter(c => !Pages.role(c)).length + 1);
    this.chapters.create(cid, { paras: [{ id: uid('p'), segs: [] }] });
    pd.update(x => {
      const i = after ? x.chapters.findIndex(c => c.id === after) : -1;
      if (i >= 0) x.chapters.splice(i + 1, 0, { id: cid, title: title });
      else { let j = x.chapters.length; while (j > 0 && Pages.role(x.chapters[j - 1]) && !SPECIAL[x.chapters[j - 1].role].front) j--; x.chapters.splice(j, 0, { id: cid, title: title }); }
    }, { now: true });
    this.go(this.chHash(cid));
    setTimeout(() => { const t = $('.ch-title'); if (t) { t.focus(); t.select(); } }, 120);
  },
  chapterMenu(anchor, cid) {
    const pd = this.proj(); const list = pd.data.chapters; const i = list.findIndex(c => c.id === cid);
    UI.menu(anchor, [
      { label: 'Renombrar', onClick: async () => { const t = await UI.prompt('Renombrar', 'Título', this.chTitle(cid)); if (t != null) pd.update(x => { const c = x.chapters.find(c => c.id === cid); if (c) c.title = t; }, { now: true }); } },
      { label: 'Subir', disabled: i === 0, onClick: () => pd.update(x => { const a = x.chapters; const j = a.findIndex(c => c.id === cid); if (j > 0) a.splice(j - 1, 0, a.splice(j, 1)[0]); }, { now: true }) },
      { label: 'Bajar', disabled: i === list.length - 1, onClick: () => pd.update(x => { const a = x.chapters; const j = a.findIndex(c => c.id === cid); if (j >= 0 && j < a.length - 1) a.splice(j + 1, 0, a.splice(j, 1)[0]); }, { now: true }) },
      { label: 'Agregar después', onClick: () => this.addChapter(cid) },
      list[i].role !== 'parte' ? { label: 'Mover a una parte…', onClick: () => setTimeout(() => Collections.partMenu(anchor, cid), 30) } : null,
      list[i].role !== 'parte' ? { label: 'Mover a otro proyecto…', onClick: () => Collections.chapterTo(cid, true) } : null,
      list[i].role !== 'parte' ? { label: 'Copiar a otro proyecto…', onClick: () => Collections.chapterTo(cid, false) } : null,
      list[i].role !== 'parte' ? { label: 'Tipo: ' + (Pages.role(list[i]) ? SPECIAL[list[i].role].l : 'normal (numerado)') + '…', onClick: () => setTimeout(() => Pages.roleMenu(anchor, cid), 30) } : null,
      { label: 'Duplicar', onClick: () => this.duplicateChapter(cid) },
      { sep: true },
      { label: 'Historial de versiones', onClick: () => { this.go(this.chHash(cid)); setTimeout(() => Versions.open(cid), 80); } },
      { label: 'Exportar', onClick: () => IO.openExport(this.pid, cid) },
      { sep: true },
      { label: 'Mover a la papelera', danger: true, disabled: list.length <= 1, onClick: () => this.trashChapter(cid) }
    ]);
  },
  duplicateChapter(cid) {
    const src = this.ch(cid); if (!src || !src.data) return;
    const ncid = uid('c');
    const data = clone(src.data); delete data.report;
    data.paras.forEach(p => { p.id = uid('p'); });
    this.chapters.create(ncid, { paras: data.paras });
    this.proj().update(x => { const i = x.chapters.findIndex(c => c.id === cid); x.chapters.splice(i + 1, 0, { id: ncid, title: (this.chTitle(cid) || '') + ' (copia)' }); }, { now: true });
    this.toast('Duplicado.');
  },
  trashChapter(cid) {
    const pd = this.proj();
    const t = this.chTitle(cid);
    pd.update(x => {
      const i = x.chapters.findIndex(c => c.id === cid);
      if (i < 0 || x.chapters.length <= 1) return;
      const [c] = x.chapters.splice(i, 1);
      x.trash = x.trash || []; x.trash.push({ id: c.id, title: c.title, at: Date.now() });
    }, { now: true });
    if (this.cid === cid) { const f = pd.data.chapters[0]; this.go(this.chHash(f.id)); }
    this.toast('«' + t + '» quedó en la papelera.', { action: { label: 'Deshacer', fn: () => this.restoreChapter(cid) } });
  },
  restoreChapter(cid) {
    this.proj().update(x => {
      const i = (x.trash || []).findIndex(c => c.id === cid);
      if (i < 0) return;
      const [c] = x.trash.splice(i, 1);
      x.chapters.push({ id: c.id, title: c.title });
    }, { now: true });
  },

  /* ---------- ajustes ---------- */
  renderSettings(st) {
    const pd = this.proj(); const P = pd.data; const k = kindOf(P);
    const wrap = h('div', { class: 'settings' });
    wrap.append(h('div', { class: 'vhead' }, h('div', null, h('h2', { text: 'Ajustes' }), h('p', { text: 'Datos del proyecto y cómo quieres que trabaje el revisor.' }))));
    const ro = !RT.canWrite;
    const title = h('input', { class: 'inp', id: 'set-title', value: P.title, disabled: ro });
    title.addEventListener('input', () => pd.update(x => { x.title = title.value; }, { silent: true }));
    title.addEventListener('change', () => { this.renderSide(); this.renderCrumbs(); });
    const kind = h('select', { class: 'sel', id: 'set-kind', disabled: ro });
    Object.keys(KINDS).forEach(key => kind.append(h('option', { value: key, text: KINDS[key].label })));
    kind.value = P.kind || 'otro';
    kind.addEventListener('change', () => { pd.update(x => { x.kind = kind.value; }, { now: true }); this.renderSide(); });
    const goal = h('input', { class: 'inp', id: 'set-goal', type: 'number', min: '0', step: '1000', value: P.goal || '', disabled: ro });
    goal.addEventListener('input', () => pd.update(x => { x.goal = parseInt(goal.value, 10) || 0; }, { silent: true }));
    const pstyle = h('select', { class: 'sel', id: 'set-pstyle', disabled: ro }, h('option', { value: 'sangria', text: 'Sangría al inicio (novela)' }), h('option', { value: 'bloque', text: 'Espacio entre párrafos (ensayo, web)' }));
    pstyle.value = (P.style && P.style.paragraph) || 'sangria';
    pstyle.addEventListener('change', () => pd.update(x => { x.style = x.style || {}; x.style.paragraph = pstyle.value; }, { now: true }));
    wrap.append(h('div', { class: 'panel' }, h('h3', { text: 'Proyecto' }),
      h('label', { class: 'field' }, h('span', { text: 'Título' }), title),
      h('div', { class: 'two' },
        h('label', { class: 'field' }, h('span', { text: 'Tipo' }), kind),
        h('label', { class: 'field' }, h('span', { text: 'Meta de palabras' }), goal)),
      h('label', { class: 'field' }, h('span', { text: 'Formato de párrafo' }), pstyle)));

    const rv = P.review || { types: [], density: 'normal' };
    const guide = h('textarea', { class: 'area', id: 'set-guide', rows: '5', disabled: ro });
    guide.value = P.guide || '';
    guide.addEventListener('input', () => pd.update(x => { x.guide = guide.value; }, { silent: true }));
    const checks = h('div', { class: 'checks' });
    TKEYS.filter(t => t !== 'pend').forEach(t => {
      const cb = h('input', { type: 'checkbox', checked: (rv.types || []).includes(t), disabled: ro });
      cb.addEventListener('change', () => pd.update(x => { x.review = x.review || { types: [], density: 'normal' }; const s = new Set(x.review.types || []); if (cb.checked) s.add(t); else s.delete(t); x.review.types = TKEYS.filter(z => s.has(z)); }, { now: true }));
      checks.append(h('label', { class: t }, cb, h('span', { text: TYPES[t].g + ' ' + TYPES[t].l })));
    });
    const dens = h('select', { class: 'sel', id: 'set-dens', disabled: ro }, h('option', { value: 'pocas', text: 'Pocas: solo lo importante' }), h('option', { value: 'normal', text: 'Normal' }), h('option', { value: 'muchas', text: 'Muchas: revisión fina' }));
    dens.value = rv.density || 'normal';
    dens.addEventListener('change', () => pd.update(x => { x.review = x.review || {}; x.review.density = dens.value; }, { now: true }));
    wrap.append(h('div', { class: 'panel' }, h('h3', { text: 'Revisor' }),
      h('label', { class: 'field' }, h('span', { text: 'Instrucciones para el revisor' }), guide,
        h('span', { class: 'muted', style: 'font-size:.75rem', text: AI.name(true) + ' las lee en cada revisión. Escribe qué te importa y qué no debe tocar.' })),
      h('div', { class: 'field' }, h('span', { text: 'Qué marca' }), checks),
      h('label', { class: 'field' }, h('span', { text: 'Cantidad de marcas' }), dens),
      (() => { const c = h('input', { type: 'checkbox', checked: rv.integrate !== false, disabled: ro }); c.addEventListener('change', () => pd.update(x => { x.review = x.review || {}; x.review.integrate = c.checked; }, { now: true })); return h('label', { class: 'row', style: 'font-size:.9rem' }, c, h('span', { text: 'La IA confirma, corrige o descarta lo que marca la revisión automática (una sola lista, sin duplicados)' })); })(),
      h('div', { class: 'row' }, btn('Restaurar instrucciones de ' + k.label.toLowerCase(), () => { guide.value = k.guide; pd.update(x => { x.guide = k.guide; }, { now: true }); }, 'small', { disabled: ro }))));

    if (RT.canWrite) {
      wrap.append(h('div', { class: 'panel' }, h('h3', { text: 'Zona delicada' }),
        h('p', { class: 'muted', style: 'margin:0', text: 'Mover el proyecto a la papelera lo saca de tu lista. Puedes restaurarlo desde la portada.' }),
        h('div', { class: 'row' }, btn('Mover proyecto a la papelera', () => { pd.update(x => { x.trashed = true; }, { now: true }); this.go(''); this.toast('Proyecto en la papelera.', { action: { label: 'Deshacer', fn: () => { pd.update(x => { x.trashed = false; }, { now: true }); } } }); }, 'danger'))));
    }
    st.append(wrap);
  },

  /* ---------- teclado global y ayuda ---------- */
  globalKeys(e) {
    const mod = e.metaKey || e.ctrlKey;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    if (e.key === 'Escape') {
      if (UI.menuEl) { UI.closeMenu(); return; }
      if (UI.modalStack.length) return;
      if (this.focus) { Editor.setFocus(false); return; }
      if (UI.drawerState) { UI.closeDrawer(); return; }
      if (window.Editor && Editor.active) { Editor.setActive(null); return; }
      if (this.sideOpen) { this.toggleSide(false); return; }
    }
    if (mod && e.shiftKey && (e.key === 'f' || e.key === 'F') && this.view === 'project') { e.preventDefault(); Search.open(); return; }
    if (mod && !e.shiftKey && (e.key === 's' || e.key === 'S') && this.view === 'project') {
      e.preventDefault();
      if (this.tab === 'escribir' && this.cid && RT.canWrite) Versions.saveVersion(this.cid, 'Guardada a mano').then(ok => { if (ok) this.toast('Versión guardada. El texto ya se guardaba solo; esto deja un punto al que volver.'); });
      else this.toast('Todo se guarda solo.');
      return;
    }
    if (mod && e.shiftKey && (e.code === 'Period' || e.key === '>' || e.key === ':') && this.tab === 'escribir' && window.Editor && Editor.root) { e.preventDefault(); Editor.setUltra(!this.ultra); return; }
    if (mod && !e.shiftKey && (e.key === '.' || e.code === 'Period' || e.code === 'NumpadDecimal') && this.tab === 'escribir' && window.Editor && Editor.root) { e.preventDefault(); Editor.setFocus(!this.focus); return; }
    if (!typing && !mod && e.key === '?') { e.preventDefault(); this.help(); }
  },
  help() {
    const rows = [
      [keys('mod', 'enter'), 'Revisar con IA el párrafo donde estás'],
      [keys('mod', 'shift', 'enter'), 'Revisar todos los párrafos editados'],
      [keys('mod', 'Z') + ' / ' + keys('mod', 'shift', 'Z'), 'Deshacer / rehacer'],
      [keys('mod', 'S'), 'Guardar una versión del capítulo'],
      [keys('mod', 'shift', 'F'), 'Buscar y reemplazar en el proyecto'],
      [keys('mod', 'K'), 'Ir a… (capítulo, sección, página)'],
      [keys('alt', 'pgdn') + ' / ' + keys('alt', 'pgup'), 'Capítulo siguiente / anterior'],
      [keys('mod', '.'), 'Modo foco (máquina de escribir)'],
      [keys('mod', 'shift', '.'), 'Ultra foco: solo escribir, sin marcas ni revisión'],
      [keys('mod', 'shift', 'L'), 'Leer como libro, a una o dos páginas'],
      [keys('alt', '-'), 'Diálogo: abre una línea con raya (—)'],
      [keys('alt', 'I'), 'Diálogo: abre o cierra el inciso del narrador'],
      [keys('alt', 'N'), 'Anotar una idea (va a «Ideas»)'],
      [keys('alt', 'H'), 'Dejar un hueco «por escribir»'],
      [keys('alt', 'S'), 'Separador de escena (* * *)'],
      [keys('alt', 'enter'), 'Salto de página antes de este párrafo'],
      ['Seleccionar texto', RT.web ? 'Marcar a mano' : 'Marcar a mano o llevar al chat con Claude'],
      ['Esc', 'Cerrar paneles o salir del modo foco'],
      ['?', 'Esta ayuda']
    ];
    const keysEl = h('div', { class: 'keys' });
    rows.forEach(r => keysEl.append(h('span', { class: 'kbd', text: r[0] }), h('span', { text: r[1] })));
    UI.modal({
      title: 'Atajos y ayuda',
      body: h('div', { style: 'display:flex;flex-direction:column;gap:1rem' }, keysEl,
        h('p', { class: 'muted', style: 'margin:0;font-size:.8438rem', text: 'Todo se guarda solo. Las marcas automáticas y las de ' + AI.name() + ' se renuevan cada vez que revisa un párrafo; las tuyas, las resueltas, las que respondiste y las ligadas a un cabo suelto se conservan.' })),
      buttons: [{ label: 'Listo', cls: 'primary' }]
    });
  }
};
window.App = App;
