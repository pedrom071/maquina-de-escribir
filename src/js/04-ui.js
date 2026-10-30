/* ============ piezas de interfaz: íconos, menús, modales, cajón, avisos ============ */
const ICONS = {
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  metro: '<path d="M4 19h16M6 19v-4M9 19v-7M12 19v-4M15 19v-10M18 19v-4"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  pen: '<path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20z"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>',
  grid: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
  leer: '<path d="M12 6.5C10 5 7.5 4.5 4 4.5v13c3.5 0 6 .5 8 2 2-1.5 4.5-2 8-2v-13c-3.5 0-6 .5-8 2zM12 6.5v13"/>',
  book: '<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z"/><path d="M5 17a3 3 0 0 1 3-3h10"/>',
  graph: '<circle cx="6" cy="7" r="2.5"/><circle cx="18" cy="7" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M8.2 8.3l2.6 7.4M15.8 8.3l-2.6 7.4M8.5 7h7"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.6-3.4 3-5.3 6-5.3s5.4 1.9 6 5.3"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14.6c2.5.1 4 1.8 4.5 4.6"/>',
  spark: '<path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  down: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  up: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  eye: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/>',
  chat: '<path d="M4 5h16v11H9l-5 4V5z"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  focus: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.4-.5-.8-.5-1.2 0-.9.8-1.6 1.7-1.6H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="14.5" cy="7" r="1.2"/>'
};
function icon(name) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '1.7'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = ICONS[name] || '';
  return s;
}
function ibtn(name, label, onclick, extra) {
  return h('button', Object.assign({ class: 'ibtn', type: 'button', 'aria-label': label, title: label, onclick: onclick }, extra || {}), icon(name));
}
function btn(label, onclick, cls, extra) {
  return h('button', Object.assign({ class: 'btn ' + (cls || ''), type: 'button', onclick: onclick }, extra || {}), label);
}

const UI = {
  menuEl: null, modalStack: [], drawerState: null,

  toast(text, opts) {
    opts = opts || {};
    const box = $('#toast');
    const item = h('div', null, h('span', { text: text }));
    if (opts.action) item.append(h('button', { type: 'button', text: opts.action.label, onclick: () => { item.remove(); opts.action.fn(); } }));
    box.append(item);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => item.remove(), opts.ms || (opts.action ? 7000 : 3600));
  },

  menu(anchor, items, opts) {
    this.closeMenu();
    const m = h('div', { class: 'menu', role: 'menu' });
    items.forEach(it => {
      if (!it) return;
      if (it.sep) { m.append(h('hr')); return; }
      if (it.header) { m.append(h('div', { class: 'mh', text: it.header })); return; }
      const b = h('button', { type: 'button', role: it.checked != null ? 'menuitemcheckbox' : 'menuitem', class: it.danger ? 'danger' : '', disabled: it.disabled || null });
      if (it.checked != null) b.setAttribute('aria-checked', it.checked ? 'true' : 'false');
      b.append(h('span', { text: it.label }));
      if (it.kbd) b.append(h('span', { class: 'kbd k', text: it.kbd }));
      b.addEventListener('click', (e) => { e.stopPropagation(); if (!it.keep) this.closeMenu(); it.onClick && it.onClick(e); if (it.keep && it.checked != null) { it.checked = !it.checked; b.setAttribute('aria-checked', it.checked ? 'true' : 'false'); } });
      m.append(b);
    });
    document.body.append(m);
    const r = anchor.getBoundingClientRect();
    const w = m.offsetWidth, hh = m.offsetHeight;
    let left = (opts && opts.alignLeft) ? r.left : r.right - w;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    let top = r.bottom + 6;
    if (top + hh > window.innerHeight - 8) top = Math.max(8, r.top - hh - 6);
    m.style.left = left + 'px'; m.style.top = top + 'px';
    this.menuEl = m;
    const first = m.querySelector('button:not([disabled])'); if (first) first.focus();
    m.addEventListener('keydown', (e) => {
      const bs = $$('button:not([disabled])', m), i = bs.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); bs[(i + 1) % bs.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length].focus(); }
      if (e.key === 'Escape') { e.preventDefault(); this.closeMenu(); anchor.focus(); }
    });
    setTimeout(() => {
      this._menuOff = (e) => { if (!m.contains(e.target)) this.closeMenu(); };
      document.addEventListener('pointerdown', this._menuOff, true);
    }, 0);
  },
  closeMenu() {
    if (this.menuEl) { this.menuEl.remove(); this.menuEl = null; }
    if (this._menuOff) { document.removeEventListener('pointerdown', this._menuOff, true); this._menuOff = null; }
  },

  modal(opts) {
    const bg = h('div', { class: 'modal-bg' });
    const box = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title });
    box.append(h('h3', { text: opts.title }));
    if (opts.body) box.append(opts.body);
    const foot = h('div', { class: 'foot' });
    (opts.buttons || []).forEach(b => foot.append(btn(b.label, () => { const r = b.onClick ? b.onClick() : true; if (r !== false) close(); }, b.cls)));
    if (opts.buttons && opts.buttons.length) box.append(foot);
    bg.append(box);
    const prev = document.activeElement;
    const close = () => { bg.remove(); this.modalStack = this.modalStack.filter(x => x !== close); if (opts.onClose) opts.onClose(); if (prev && prev.focus) try { prev.focus(); } catch (e) {} };
    bg.addEventListener('pointerdown', (e) => { if (e.target === bg) close(); });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      if (e.key === 'Enter' && e.target.tagName === 'INPUT' && opts.enter) { e.preventDefault(); const r = opts.enter(); if (r !== false) close(); }
    });
    $('#modal-root').append(bg);
    this.modalStack.push(close);
    setTimeout(() => { const f = box.querySelector('input:not([type=file]),textarea,select,button.primary'); if (f) f.focus(); }, 20);
    return close;
  },
  confirm(title, text, okLabel, danger) {
    return new Promise(res => {
      let ok = false;
      this.modal({
        title: title, body: h('p', { class: 'muted', style: 'margin:0', text: text }),
        buttons: [{ label: 'Cancelar' }, { label: okLabel || 'Aceptar', cls: danger ? 'danger' : 'primary', onClick: () => { ok = true; } }],
        onClose: () => res(ok)
      });
    });
  },
  prompt(title, label, value, okLabel) {
    return new Promise(res => {
      let val = null;
      const inp = h('input', { class: 'inp', id: 'prompt-in', value: value || '' });
      const done = () => { val = inp.value.trim(); };
      this.modal({
        title: title, body: h('label', { class: 'field' }, h('span', { text: label }), inp),
        buttons: [{ label: 'Cancelar' }, { label: okLabel || 'Guardar', cls: 'primary', onClick: done }],
        enter: done, onClose: () => res(val)
      });
      setTimeout(() => inp.select(), 30);
    });
  },

  drawer(opts) {
    this.closeDrawer(true);
    const d = h('aside', { class: 'drawer', role: 'dialog', 'aria-label': opts.title, id: 'drawer' });
    const close = ibtn('close', 'Cerrar', () => this.closeDrawer());
    d.append(h('div', { class: 'dh' }, h('h3', { text: opts.title }), opts.head || null, close));
    const body = h('div', { class: 'db' });
    d.append(body);
    if (opts.body) body.append(opts.body);
    let foot = null;
    if (opts.foot) { foot = h('div', { class: 'df' }); foot.append(opts.foot); d.append(foot); }
    document.body.append(d);
    document.body.classList.add('has-drawer');
    this.drawerState = { el: d, body: body, foot: foot, key: opts.key, onClose: opts.onClose };
    d.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); this.closeDrawer(); } });
    return this.drawerState;
  },
  closeDrawer(silent) {
    const s = this.drawerState;
    if (!s) return;
    s.el.remove(); this.drawerState = null;
    document.body.classList.remove('has-drawer');
    if (s.onClose) s.onClose();
    if (!silent && window.Editor && Editor.root) Editor.layoutSoon();
  },
  drawerOpen(key) { return this.drawerState && this.drawerState.key === key; }
};

/* Mini markdown seguro para informes de Claude. */
function renderProse(text) {
  const root = h('div', { class: 'prose' });
  let list = null;
  const inline = (s, el) => {
    const parts = s.split(/(\*\*[^*]+\*\*|«[^»]+»)/g);
    parts.forEach(p => {
      if (/^\*\*[^*]+\*\*$/.test(p)) el.append(h('b', { text: p.slice(2, -2) }));
      else el.append(p);
    });
    return el;
  };
  text.split('\n').forEach(line => {
    const t = line.trim();
    if (!t) { list = null; return; }
    const hm = t.match(/^#{1,4}\s+(.*)$/);
    if (hm) { list = null; root.append(inline(hm[1].replace(/\*\*/g, ''), h('h4'))); return; }
    const lm = t.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (lm) { if (!list) { list = h('ul'); root.append(list); } list.append(inline(lm[1], h('li'))); return; }
    list = null;
    root.append(inline(t, h('p')));
  });
  return root;
}
