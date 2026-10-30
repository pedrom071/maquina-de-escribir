/* ============ modo lectura: el proyecto como libro, a una o dos páginas ============ */
const Lectura = {
  el: null, flow: null, idx: 0, total: 1, spread: 1, stride: 600,
  prefs() { const r = App.prefs.reader || {}; return { spread: r.spread || 'auto', anim: r.anim !== false, font: +r.font || 1 }; },
  /* Agranda o achica la letra solo en la lectura (sin tocar tu apariencia). */
  zoom(dir) {
    const steps = [0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.35, 1.5, 1.7];
    const cur = this.prefs().font; let i = steps.findIndex(x => x >= cur - 0.001); if (i < 0) i = 3;
    const v = dir === 0 ? 1 : steps[Math.max(0, Math.min(steps.length - 1, i + dir))];
    this.setPref('font', v); this.layout(true);
    if (this.zoomLbl) this.zoomLbl.textContent = Math.round(v * 100) + ' %';
  },
  setPref(k, v) { App.prefs.reader = Object.assign(this.prefs(), { [k]: v }); App.savePrefs(); },
  open(startCid, startPid) {
    if (!App.P()) return;
    this.close(true);
    const P = App.P(), k = kindOf(P), pr = this.prefs();
    const poesia = P.kind === 'poesia';
    const ov = h('div', { class: 'reader' + (poesia ? ' poesia' : ''), role: 'dialog', 'aria-label': 'Modo lectura', tabindex: '-1' });
    // barra superior
    const spreadSeg = h('div', { class: 'seg rd-seg', role: 'radiogroup', 'aria-label': 'Páginas' });
    [['auto', 'Auto'], ['1', '1 pág.'], ['2', '2 pág.']].forEach(([v, l]) => spreadSeg.append(h('button', { type: 'button', role: 'radio', 'aria-checked': pr.spread === v ? 'true' : 'false', text: l, onclick: (e) => { this.setPref('spread', v); $$('button', spreadSeg).forEach(b => b.setAttribute('aria-checked', b === e.currentTarget ? 'true' : 'false')); this.layout(true); } })));
    const animBtn = h('button', { type: 'button', class: 'rd-tog', 'aria-pressed': pr.anim ? 'true' : 'false', title: 'Animación al pasar página', onclick: () => { const v = !this.prefs().anim; this.setPref('anim', v); animBtn.setAttribute('aria-pressed', v ? 'true' : 'false'); } }, 'Animación');
    this.where = h('span', { class: 'rd-where' });
    const top = h('div', { class: 'rd-top' },
      h('div', { class: 'rd-ttl' }, h('b', { text: P.title }), this.where),
      h('div', { class: 'rd-ctl' },
        h('div', { class: 'rd-zoom', role: 'group', 'aria-label': 'Tamaño de letra' },
          h('button', { type: 'button', title: 'Letra más chica (−)', 'aria-label': 'Letra más chica', onclick: () => this.zoom(-1) }, h('span', { class: 'a-s', text: 'A' })),
          (this.zoomLbl = h('button', { type: 'button', class: 'rd-zl', title: 'Volver al tamaño de tu apariencia', onclick: () => this.zoom(0), text: Math.round(pr.font * 100) + ' %' })),
          h('button', { type: 'button', title: 'Letra más grande (+)', 'aria-label': 'Letra más grande', onclick: () => this.zoom(1) }, h('span', { class: 'a-l', text: 'A' }))),
        spreadSeg, animBtn,
        btn([icon('pen'), h('span', { class: 'lbl', text: 'Editar aquí' })], () => this.editHere(), 'small'),
        ibtn('close', 'Cerrar lectura (Esc)', () => this.close())));
    // libro
    this.flow = h('div', { class: 'rd-flow' });
    App.chapterList().forEach(c => {
      const d = App.ch(c.id); const paras = d && d.data ? d.data.paras : [];
      const isPart = c.role === 'parte';
      const sec = h('section', { class: 'rd-ch' + (isPart ? ' rd-part' : '') + (c.role && SPECIAL[c.role] ? ' rd-special' : ''), dataset: { cid: c.id } });
      const eyebrow = isPart ? Collections.partLabel(c) : (c.role && SPECIAL[c.role]) ? '' : k.unit + ' ' + (Pages.number(c.id) || '');
      if (eyebrow && c.title && c.title.trim() !== eyebrow.trim()) sec.append(h('div', { class: 'rd-eb', text: eyebrow }));
      if (!(c.role && SPECIAL[c.role] && /dedicatoria|epigrafe/.test(c.role)) || c.title !== SPECIAL[c.role].l) sec.append(h('h2', { text: c.title || eyebrow }));
      paras.forEach(p => { const t = parText(p); sec.append(t.trim() ? h('p', { dataset: { pid: p.id }, text: t }) : h('p', { class: 'rd-blank', dataset: { pid: p.id } }, ' ')); });
      this.flow.append(sec);
    });
    this.clip = h('div', { class: 'rd-clip' }, this.flow);
    this.turn = h('div', { class: 'rd-turn', 'aria-hidden': 'true' });
    this.nums = h('div', { class: 'rd-nums', 'aria-hidden': 'true' });
    this.book = h('div', { class: 'rd-book' }, this.clip, this.turn, this.nums);
    const prev = h('button', { type: 'button', class: 'rd-arrow prev', 'aria-label': 'Página anterior', onclick: () => this.go(-1) }, '‹');
    const next = h('button', { type: 'button', class: 'rd-arrow next', 'aria-label': 'Página siguiente', onclick: () => this.go(1) }, '›');
    this.range = h('input', { type: 'range', min: '1', max: '1', value: '1', 'aria-label': 'Página' });
    this.range.addEventListener('input', () => this.goto(+this.range.value - 1, false));
    this.count = h('span', { class: 'rd-count' });
    const bottom = h('div', { class: 'rd-bottom' }, this.range, this.count, h('span', { class: 'rd-hint', text: 'Doble clic en un párrafo para editarlo · ← → pasar página · + − tamaño de letra' }));
    ov.append(top, h('div', { class: 'rd-stage' }, prev, this.book, next), bottom);
    document.body.append(ov); document.body.classList.add('reading');
    this.el = ov;
    // interacción
    this.book.addEventListener('click', (e) => { if (e.detail > 1) return; const r = this.book.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width; if (x < 0.28) this.go(-1); else if (x > 0.72) this.go(1); });
    this.book.addEventListener('dblclick', (e) => { const p = e.target.closest('p[data-pid]'); const s = e.target.closest('section[data-cid]'); if (s) this.edit(s.dataset.cid, p && p.dataset.pid); });
    let sx = null;
    this.book.addEventListener('pointerdown', (e) => { sx = e.clientX; });
    this.book.addEventListener('pointerup', (e) => { if (sx != null && Math.abs(e.clientX - sx) > 50) this.go(e.clientX < sx ? 1 : -1); sx = null; });
    this.keyH = (e) => {
      if (!this.el || UI.modalStack.length) return;
      const kmap = { ArrowRight: 1, ArrowLeft: -1, PageDown: 1, PageUp: -1, ' ': e.shiftKey ? -1 : 1 };
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.close(); return; }
      if (e.key in kmap) { e.preventDefault(); e.stopPropagation(); this.go(kmap[e.key]); return; }
      if ((e.key === '+' || e.key === '=') && !e.metaKey && !e.ctrlKey) { e.preventDefault(); this.zoom(1); return; }
      if ((e.key === '-' || e.key === '_') && !e.metaKey && !e.ctrlKey) { e.preventDefault(); this.zoom(-1); return; }
      if (e.key === 'Home') { e.preventDefault(); this.goto(0); } else if (e.key === 'End') { e.preventDefault(); this.goto(this.total - 1); }
    };
    document.addEventListener('keydown', this.keyH, true);
    this.resizeH = debounce(() => this.layout(true), 150);
    window.addEventListener('resize', this.resizeH);
    this.layout(false, startCid || App.cid, startPid);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => this.el && this.layout(true));
    ov.focus();
  },
  layout(keep, cid, pid) {
    if (!this.el) return;
    const anchor = keep ? this.anchor() : null;
    const pr = this.prefs();
    const vw = window.innerWidth, vh = window.innerHeight;
    // la hoja y la letra son las de tu apariencia (ancho de hoja, márgenes, tamaño e interlineado);
    // si no caben, se reducen en la misma proporción
    const probe = h('div', { style: 'position:absolute;visibility:hidden;width:var(--measure,46rem);padding-left:var(--pad-x,4rem);font-size:var(--text-size,19px)' });
    document.body.append(probe);
    const pcs = getComputedStyle(probe);
    const sheetW = parseFloat(pcs.width) || 736, padX = parseFloat(pcs.paddingLeft) || 64, fsz = parseFloat(pcs.fontSize) || 19;
    probe.remove();
    // espacio disponible: el cuadernillo usa casi toda la pantalla (las flechas van encima de los costados)
    const narrow = vw < 700;
    const availW = vw - (narrow ? 12 : 96), availH = Math.max(300, vh - (narrow ? 104 : 112));
    // letra: tu tamaño × el ajuste de la lectura (A− / A+); en el celular, un poco menor
    const userF = pr.font;
    const baseF = fsz * userF * (narrow ? 0.9 : 1);
    // ancho de página: lo que permita la pantalla, sin pasar de ~75 letras por línea
    const maxLine = baseF * 36 + 2 * Math.min(padX, 64);
    const fit = (sp) => Math.min(maxLine, availW / sp, availH / (sp === 2 ? 1.02 : 1.08));
    const sp = pr.spread === 'auto' ? (vw > vh && fit(2) >= baseF * 24 ? 2 : 1) : +pr.spread;
    this.spread = sp;
    const pageW = Math.max(240, Math.floor(fit(sp)));
    const sc = baseF / fsz;
    this.scale = sc;
    const H = Math.round(Math.min(availH, pageW * (narrow ? 1.9 : 1.6)));
    const pad = Math.round(Math.max(narrow ? 16 : 26, Math.min(padX * Math.min(1, sc), pageW * 0.08)));
    this.flow.style.fontSize = baseF.toFixed(2) + 'px';
    const cw = pageW - 2 * pad;
    this.stride = pageW;
    this.el.classList.toggle('spread', sp === 2);
    this.book.style.width = (pageW * sp) + 'px'; this.book.style.height = H + 'px';
    this.clip.style.padding = Math.round(pad * 0.9) + 'px ' + pad + 'px ' + Math.round(pad * 1.2) + 'px';
    this.flow.style.height = (H - Math.round(pad * 0.9) - Math.round(pad * 1.2)) + 'px';
    this.flow.style.columnWidth = cw + 'px'; this.flow.style.columnGap = (2 * pad) + 'px';
    this.flow.style.width = (sp * cw + (sp - 1) * 2 * pad) + 'px';
    this.flow.style.transition = 'none';
    this.flow.style.transform = 'translateX(0)';
    const fr = this.flow.getBoundingClientRect();
    let maxRight = 0; $$('section, p', this.flow).forEach(x => { const r = x.getBoundingClientRect(); if (r.width) maxRight = Math.max(maxRight, r.right - fr.left); });
    this.total = Math.max(1, Math.ceil((maxRight + 2 * pad - 1) / pageW));
    this.range.max = String(this.total);
    let target = 0;
    const findPage = (el) => el ? Math.max(0, Math.floor((el.getBoundingClientRect().left - fr.left + 1) / pageW)) : 0;
    if (anchor) target = findPage(this.flow.querySelector('[data-pid="' + anchor + '"]'));
    else if (pid) target = findPage(this.flow.querySelector('[data-pid="' + pid + '"]'));
    else if (cid) target = findPage(this.flow.querySelector('section[data-cid="' + cid + '"]'));
    this.goto(target, false);
  },
  /* Primer párrafo visible: para no perder el lugar al cambiar el tamaño o las páginas. */
  anchor() {
    if (!this.flow) return null;
    const br = this.book.getBoundingClientRect();
    const ps = $$('p[data-pid]', this.flow);
    for (const p of ps) { const r = p.getBoundingClientRect(); if (r.left >= br.left - 2 && r.left < br.right) return p.dataset.pid; }
    return null;
  },
  go(dir) { this.goto(this.idx + dir * this.spread, this.prefs().anim, dir); },
  goto(n, anim, dir) {
    if (!this.flow) return;
    n = Math.max(0, Math.min(this.total - 1, n));
    if (this.spread === 2) n -= n % 2;
    const moved = n !== this.idx;
    this.idx = n;
    this.flow.style.transition = anim && moved ? 'transform .55s cubic-bezier(.25,.75,.25,1)' : 'none';
    this.flow.style.transform = 'translateX(' + (-n * this.stride) + 'px)';
    if (anim && moved) {
      this.turn.className = 'rd-turn ' + ((dir || 1) > 0 ? 'fwd' : 'back');
      void this.turn.offsetWidth; this.turn.classList.add('go');
    }
    const a = n + 1, b = Math.min(this.total, n + this.spread);
    this.nums.textContent = '';
    for (let i = a; i <= b; i++) this.nums.append(h('span', { text: String(i) }));
    this.count.textContent = (a === b ? 'Página ' + a : 'Páginas ' + a + '–' + b) + ' de ' + this.total;
    this.range.value = String(a);
    // capítulo de la página
    setTimeout(() => { const pid = this.anchor(); const p = pid && this.flow.querySelector('[data-pid="' + pid + '"]'); const s = p && p.closest('section'); const c = s && App.chapterList().find(x => x.id === s.dataset.cid); this.where.textContent = c ? ' · ' + (c.title || Pages.label(c)) : ''; }, anim ? 560 : 0);
  },
  edit(cid, pid) {
    this.close();
    App.go(App.chHash(cid));
    setTimeout(() => {
      if (!window.Editor || !Editor.root) return;
      const pe = pid && Editor.root.querySelector('p[data-id="' + pid + '"]');
      if (pe) { pe.scrollIntoView({ block: 'center' }); if (RT.canWrite) { Editor.root.focus(); Editor.setCaret({ pid: pid, off: 0 }); } }
    }, 250);
  },
  editHere() {
    const pid = this.anchor(); const p = pid && this.flow.querySelector('[data-pid="' + pid + '"]');
    const s = p ? p.closest('section') : this.flow.querySelector('section');
    if (s) this.edit(s.dataset.cid, pid);
  },
  close(silent) {
    if (!this.el) return;
    document.removeEventListener('keydown', this.keyH, true);
    window.removeEventListener('resize', this.resizeH);
    this.el.remove(); this.el = null; this.flow = null;
    document.body.classList.remove('reading');
  }
};
window.Lectura = Lectura;
document.addEventListener('keydown', (e) => {
  if (!window.App || App.view !== 'project' || Lectura.el) return;
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey && (e.key === 'l' || e.key === 'L')) { e.preventDefault(); Lectura.open(); }
});
