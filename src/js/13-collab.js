/* ============ colaboración: quién está, nombres y conversación con Claude ============ */
const Collab = {
  names: new Map(), colors: new Map(), avatars: new Map(), pending: new Set(), peers: [], canSendState: false,
  init() {
    if (RT.room) {
      try { RT.room.onPeers((ch) => { this.peers = ch.peers || []; const ids = this.others().map(p => p.by || (p.presence && p.presence.uid)).filter(Boolean); if (ids.length) this.resolve(ids); this.renderPeers(); if (Editor.root) Editor.decorate(); }, () => {}); } catch (e) {}
      this.checkSend();
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this.checkSend(); });
      setInterval(() => this.checkSend(), 60000);
      this.setPresence();
    }
    if (RT.me && RT.user && RT.me !== 'local') this.resolve([RT.me]);
  },
  async checkSend() {
    if (!RT.room || !RT.room.canSendToClaudeSession) { this.canSendState = false; return; }
    try { const s = await RT.room.canSendToClaudeSession(); this.canSendState = s === 'available' || s === 'available_if_opened'; } catch (e) { this.canSendState = false; }
  },
  name(id) {
    if (!id || id === 'local') return 'Tú';
    if (id === 'claude') return 'Claude';
    if (id === RT.me) return 'Tú';
    if (this.names.has(id)) return this.names.get(id) || 'Alguien';
    this.pending.add(id); this.flushSoon();
    return 'Alguien';
  },
  flushSoon: debounce(function () { const ids = Array.from(Collab.pending); Collab.pending.clear(); Collab.resolve(ids); }, 200),
  async resolve(ids) {
    if (!RT.user || !ids.length) return;
    try {
      const ps = await RT.user.profiles(ids);
      let changed = false;
      ids.forEach(id => { const p = ps && ps[id]; if (!p) return; const nm = p.name || ''; if (this.names.get(id) !== nm) changed = true; this.names.set(id, nm); this.colors.set(id, p.color); this.avatars.set(id, p.avatarUrl); });
      if (changed) { if (Editor.root) { Editor.renderNotes(); Editor.decorate(); } this.renderPeers(); }
    } catch (e) {}
  },
  setPresence() {
    if (!RT.room) return;
    const c = Editor.root ? Editor.lastCaret : null;
    const p = { pid: App.view === 'project' ? App.pid : null, cid: App.view === 'project' && App.tab === 'escribir' ? App.cid : null, para: c && App.tab === 'escribir' ? c.pid : null, tab: App.view === 'project' ? App.tab : 'inicio' };
    if (RT.me && RT.me !== 'local') p.uid = RT.me;
    try { RT.room.presence(p).catch(() => {}); } catch (e) {}
  },
  caretSoon: debounce(function () { Collab.setPresence(); }, 450),
  others() { return (this.peers || []).filter(p => !p.sameTab && p.kind === 'viewer'); },
  decorate(root, cid) {
    $$('p[data-peer]', root).forEach(p => { p.removeAttribute('data-peer'); p.style.removeProperty('--peer'); });
    this.others().forEach(pr => {
      const pp = pr.presence || {};
      if (pp.cid !== cid || !pp.para) return;
      const pe = root.querySelector('p[data-id="' + CSS.escape(pp.para) + '"]'); if (!pe) return;
      const id = pr.by || pp.uid;
      pe.setAttribute('data-peer', pr.isMe ? 'Tú, en otra pestaña' : this.name(id));
      const col = this.colors.get(id); if (col) pe.style.setProperty('--peer', col);
    });
  },
  renderPeers() {
    const box = $('#peers'); if (!box) return;
    box.textContent = '';
    const seen = new Set(), list = [];
    this.others().forEach(p => { const id = p.by || (p.presence && p.presence.uid) || p.peer; if (p.isMe || seen.has(id)) return; seen.add(id); list.push({ id: id, p: p }); });
    list.slice(0, 4).forEach(({ id, p }) => {
      const pp = p.presence || {};
      let where = '';
      if (pp.pid && pp.pid === App.pid) where = pp.cid ? ' · en «' + (App.chTitle(pp.cid) || App.unit()) + '»' : ' · en ' + ({ biblia: 'la biblia', diagramas: 'diagramas', estadisticas: 'estadísticas', ajustes: 'ajustes' }[pp.tab] || 'el proyecto');
      const av = this.avatars.get(id);
      const el = h('span', { class: 'peer', title: this.name(id) + (p.guest ? ' (invitado)' : '') + where });
      if (av) el.append(h('img', { src: av, alt: '' }));
      else el.style.background = this.colors.get(id) || 'var(--sunk)';
      box.append(el);
    });
    if (list.length > 4) box.append(h('span', { class: 'peer', style: 'display:grid;place-items:center;font:500 .625rem var(--f-mono)', text: '+' + (list.length - 4) }));
  },
  openPanel() {
    const body = h('div', { style: 'display:flex;flex-direction:column;gap:1rem' });
    body.append(h('div', { class: 'prose' },
      h('h4', { text: 'Invitar a alguien' }),
      h('ol', { style: 'margin:.3rem 0;padding-left:1.2rem' },
        h('li', { text: 'Usa el botón Compartir de claude.ai, arriba a la derecha de esta página.' }),
        h('li', { text: 'Dale acceso de Colaborador si quieres que escriba, marque y responda notas. Como Comentarista o Lector solo podrá leer.' }),
        h('li', { text: 'Todo se ve en vivo: los párrafos que otra persona está editando muestran su nombre al margen, y cada nota y respuesta queda firmada.' })),
      h('p', { class: 'muted', style: 'font-size:.8438rem', text: 'Si dos personas editan a la vez, los cambios en párrafos distintos se combinan solos. Si tocan el mismo párrafo, gana la última edición y la anterior queda en el historial de versiones. La revisión con Claude usa la cuenta de quien la pide.' })));
    const here = this.others().filter(p => !p.isMe);
    const hl = h('div', { style: 'display:flex;flex-direction:column;gap:.35rem' }, h('div', { class: 'label', text: 'Ahora en esta herramienta' }));
    if (!RT.room) hl.append(h('p', { class: 'muted', style: 'margin:0;font-size:.8438rem', text: 'No se puede ver quién está conectado en esta vista.' }));
    else if (!here.length) hl.append(h('p', { class: 'muted', style: 'margin:0;font-size:.8438rem', text: 'Solo tú.' }));
    here.forEach(p => { const id = p.by || (p.presence && p.presence.uid); const pp = p.presence || {}; hl.append(h('div', { class: 'row', style: 'font-size:.875rem' }, h('span', { class: 'peer', style: 'margin:0;background:' + (this.colors.get(id) || 'var(--sunk)') }), h('span', { text: this.name(id) + (pp.pid === App.pid && pp.cid ? ' · en «' + App.chTitle(pp.cid) + '»' : '') }))); });
    body.append(hl);
    if (App.view === 'project') {
      const authors = new Map();
      App.chapterList().forEach(c => { const d = App.ch(c.id); if (d && d.data) allMarks(d.data).forEach(({ m }) => { const add = (by) => { if (by && by !== 'claude' && by !== 'local') authors.set(by, (authors.get(by) || 0) + 1); }; add(m.by); (m.replies || []).forEach(r => add(r.by)); }); });
      if (authors.size) {
        const al = h('div', { style: 'display:flex;flex-direction:column;gap:.35rem' }, h('div', { class: 'label', text: 'Quién ha dejado notas' }));
        authors.forEach((n, id) => al.append(h('div', { style: 'font-size:.875rem', text: this.name(id) + ' · ' + plural(n, 'nota') })));
        body.append(al);
      }
    }
    if (RT.local) body.append(h('p', { class: 'muted', style: 'font-size:.8438rem', text: 'Estás en modo local: abre la herramienta desde claude.ai para guardar en la nube y colaborar.' }));
    const foot = h('div', { class: 'row', style: 'width:100%' });
    if (this.canSendState && App.view === 'project' && App.cid) foot.append(btn([icon('chat'), 'Conversar sobre este texto en el chat'], () => this.sendChapter(App.cid)));
    UI.drawer({ title: 'Colaborar', key: 'collab', body: body, foot: foot.childNodes.length ? foot : null });
  },
  base() { const P = App.P(); return { proyecto: P ? P.title.slice(0, 120) : '', capitulo: (App.chTitle(App.cid) || '').slice(0, 120) }; },
  send(data) {
    if (!RT.room) return;
    try {
      RT.room.sendToClaudeSession(data).then(() => App.toast('Quedó adjunto en tu chat con Claude. Escribe tu pregunta y envía.'), (e) => {
        const c = e && e.code;
        App.toast(c === 'claude_unavailable' ? 'Abre esta herramienta junto a una conversación con Claude para enviarle texto.' : c === 'rate_limited' ? 'Espera un momento antes de volver a enviar.' : 'No se pudo enviar al chat.');
      });
    } catch (e) { App.toast('No se pudo enviar al chat.'); }
  },
  sendSelection(text) {
    const d = this.base();
    d.label = 'Fragmento de «' + (d.capitulo || d.proyecto) + '»';
    d.fragmento = truncBytes(cleanInvisible(text).trim(), 2600);
    this.send(d);
  },
  sendMark(m, ptext) {
    const d = this.base();
    d.label = 'Nota de ' + TYPES[m.type].s;
    d.tipo = TYPES[m.type].l; d.fragmento = truncBytes(cleanInvisible(m.text), 400); d.nota = truncBytes(cleanInvisible(m.note || ''), 600);
    d.parrafo = truncBytes(cleanInvisible(ptext), 1800);
    this.send(d);
  },
  sendChapter(cid) {
    const ch = App.ch(cid); if (!ch || !ch.data) return;
    const d = this.base();
    d.capitulo = (App.chTitle(cid) || '').slice(0, 120);
    d.label = App.unit() + ' «' + d.capitulo + '»';
    d.palabras = chapterWords(ch.data);
    d.texto = truncBytes(cleanInvisible(ch.data.paras.map(parText).filter(Boolean).join('\n\n')), 2800);
    this.send(d);
  }
};
window.Collab = Collab;
