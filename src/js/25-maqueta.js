/* ============ maqueta: cómo se vería como libro impreso (tamaño, márgenes, tipografía) y PDF ============ */
const MQ_SIZES = [
  ['bolsillo', 'Bolsillo · 11 × 18 cm', 11, 18],
  ['a5', 'A5 · 14,8 × 21 cm', 14.8, 21],
  ['15x23', 'Novela · 15 × 23 cm', 15, 23],
  ['6x9', '6 × 9 in · 15,2 × 22,9 cm', 15.24, 22.86],
  ['55x85', '5,5 × 8,5 in · 14 × 21,6 cm', 13.97, 21.59],
  ['17x24', 'Ensayo · 17 × 24 cm', 17, 24],
  ['carta', 'Carta · 21,6 × 27,9 cm', 21.59, 27.94],
  ['a4', 'A4 · 21 × 29,7 cm', 21, 29.7],
  ['custom', 'Personalizado…', 15, 23]
];
const MQ_MARGINS = { compacto: [1.5, 1.8, 1.8, 1.4], clasico: [2, 2.3, 2.2, 1.8], amplio: [2.5, 2.8, 2.6, 2.2] }; // arriba, abajo, interior (lomo), exterior
const MQ_CM = 96 / 2.54, MQ_PT = 96 / 72;

const Maqueta = {
  el: null, idx: 0,
  defaults() {
    return { size: '15x23', w: 15, h: 23, margins: 'clasico', top: 2, bottom: 2.3, inner: 2.2, outer: 1.8, font: (Profile.look && Profile.look.textFont) || 'Newsreader', pt: 11, leading: 1.4, justify: true, indent: 1.2, paper: 'ahuesado', numbers: 'centro', header: true, dropcap: false, sink: true, recto: true, half: true, titlePage: true, copy: true, toc: true, author: (Profile.me && Profile.me.name) || '', view: 'pliego', zoom: 'fit' };
  },
  cfg() { const P = App.P(); return Object.assign(this.defaults(), (P && P.maqueta) || {}); },
  save(patch) { App.proj().update(x => { x.maqueta = Object.assign({}, x.maqueta || {}, patch); }, { now: true }); },
  /* ---------- contenido del libro ---------- */
  sections(c, forPrint) {
    const P = App.P(), k = kindOf(P);
    const out = [];
    const title = P.title || 'Sin título';
    const author = (c.author || '').trim();
    if (c.half) out.push({ cls: 'mq-half front', html: '<p class="mq-ht">' + hesc(title) + '</p>' });
    if (c.titlePage) out.push({ cls: 'mq-title front', html: '<p class="mq-tt">' + hesc(title) + '</p>' + (author ? '<p class="mq-ta">' + hesc(author) + '</p>' : ''), recto: true });
    if (c.copy) out.push({ cls: 'mq-copy front', html: '<p>© ' + new Date().getFullYear() + (author ? ' ' + hesc(author) : '') + '</p><p>Todos los derechos reservados.</p><p class="mq-small">Maqueta de prueba generada con Máquina de escribir.</p>' });
    if (c.toc) out.push({ cls: 'mq-toc front', html: '<h2>Índice</h2><ol class="mq-toc-l">' + App.chapterList().filter(ch => !(ch.role && SPECIAL[ch.role] && SPECIAL[ch.role].front)).map(ch => '<li data-cid="' + ch.id + '"><span>' + hesc(ch.title || Pages.label(ch)) + '</span><b></b></li>').join('') + '</ol>', recto: true });
    App.chapterList().forEach(ch => {
      const d = App.ch(ch.id); const paras = d && d.data ? d.data.paras : [];
      const isPart = ch.role === 'parte', sp = ch.role && SPECIAL[ch.role];
      const eb = isPart ? Collections.partLabel(ch) : sp ? '' : k.unit + ' ' + (Pages.number(ch.id) || '');
      let html = '';
      if (eb && ch.title && ch.title.trim() !== eb.trim()) html += '<p class="mq-eb">' + hesc(eb) + '</p>';
      if (!(sp && /dedicatoria|epigrafe/.test(ch.role) && ch.title === sp.l)) html += '<h2>' + hesc(ch.title || eb) + '</h2>';
      let first = true;
      paras.forEach(p => {
        const t = parText(p);
        if (!t.trim()) { html += '<p class="mq-blank">&nbsp;</p>'; return; }
        const sep = /^\s*(?:(?:\*\s*){3}|⁂|#)\s*$/.test(t);
        html += '<p class="' + (sep ? 'mq-sep' : first ? 'mq-first' : '') + (p.pb ? ' mq-pb' : '') + '">' + hesc(t) + '</p>';
        if (!sep) first = false;
      });
      out.push({ cls: 'mq-ch' + (isPart ? ' mq-part' : '') + (sp ? ' mq-special mq-' + ch.role : ''), html: html, recto: c.recto || isPart, cid: ch.id });
    });
    return out;
  },
  css(c, print) {
    const f = Profile.font('text', c.font);
    const fam = f.f, disp = f.f;
    const paper = c.paper === 'blanco' ? '#ffffff' : '#fbf7ee';
    return [
      '.mq-flow{font-family:' + fam + ';font-size:' + c.pt + 'pt;line-height:' + c.leading + ';color:#1d1a16;text-align:' + (c.justify ? 'justify' : 'left') + ';hyphens:' + (c.justify ? 'auto' : 'manual') + ';-webkit-hyphens:' + (c.justify ? 'auto' : 'manual') + ';font-kerning:normal;font-variant-ligatures:common-ligatures;orphans:2;widows:2}',
      '.mq-flow p{margin:0;text-indent:' + c.indent + 'em}',
      '.mq-flow p.mq-first,.mq-flow p.mq-sep+p,.mq-flow p.mq-blank+p,.mq-flow p.mq-pb{text-indent:0}',
      '.mq-flow p.mq-sep{text-align:center;text-indent:0;letter-spacing:.5em;margin:.8em 0}',
      '.mq-flow p.mq-blank{height:1em}',
      '.mq-flow p.mq-pb{break-before:' + (print ? 'page' : 'column') + '}',
      '.mq-flow section{break-before:' + (print ? 'page' : 'column') + '}',
      '.mq-flow section:first-child{break-before:auto}',
      print ? '.mq-flow section.recto{break-before:right}' : '',
      '.mq-flow h2{font-family:' + disp + ';font-weight:400;font-size:1.75em;line-height:1.15;text-align:center;margin:0 0 2.2em;break-after:avoid;hyphens:manual}',
      '.mq-flow .mq-eb{text-align:center;text-indent:0;font-size:.72em;letter-spacing:.2em;text-transform:uppercase;margin:0 0 .8em}',
      c.sink ? '.mq-flow section.mq-ch>:first-child{margin-top:' + (print ? '22%' : '28%') + '}' : '',
      c.dropcap ? '.mq-flow section.mq-ch:not(.mq-part) p.mq-first::first-letter{float:left;font-size:3.1em;line-height:.85;padding:.06em .08em 0 0;font-family:' + disp + '}' : '',
      '.mq-flow .mq-part{text-align:center}.mq-flow .mq-part h2{font-size:2.3em;margin-top:30%}.mq-flow .mq-part p{text-align:center;text-indent:0;font-style:italic}',
      '.mq-flow .mq-dedicatoria p,.mq-flow .mq-epigrafe p{text-align:right;text-indent:0;font-style:italic}.mq-flow .mq-dedicatoria>:first-child,.mq-flow .mq-epigrafe>:first-child{margin-top:30%}',
      '.mq-flow .mq-half .mq-ht{text-align:center;text-indent:0;font-size:1.2em;letter-spacing:.06em;margin-top:35%}',
      '.mq-flow .mq-title .mq-tt{text-align:center;text-indent:0;font-family:' + disp + ';font-size:2.4em;line-height:1.1;margin-top:28%;hyphens:manual}.mq-flow .mq-title .mq-ta{text-align:center;text-indent:0;font-size:1.1em;letter-spacing:.08em;margin-top:2.5em}',
      '.mq-flow .mq-copy p{text-indent:0;text-align:left;font-size:.78em;line-height:1.5}.mq-flow .mq-copy>:first-child{margin-top:' + (print ? '120%' : '135%') + '}.mq-flow .mq-small{opacity:.7;margin-top:1em}',
      '.mq-flow .mq-toc h2{margin-top:15%}.mq-flow .mq-toc-l{list-style:none;padding:0;margin:0}.mq-flow .mq-toc-l li{display:flex;gap:.4em;align-items:baseline;margin:.35em 0;text-align:left}.mq-flow .mq-toc-l li span{flex:0 1 auto}.mq-flow .mq-toc-l li::after{content:"";flex:1;border-bottom:1px dotted rgba(0,0,0,.35);order:1;transform:translateY(-.25em)}.mq-flow .mq-toc-l li b{order:2;font-weight:400;font-variant-numeric:oldstyle-nums}',
      '.mq-page{background:' + paper + '}'
    ].join('\n');
  },
  /* ---------- vista ---------- */
  open() {
    if (!App.P()) return;
    this.close();
    const c = this.cfg();
    Profile.ensureFont(Profile.font('text', c.font).g);
    const ov = h('div', { class: 'maqueta', role: 'dialog', 'aria-label': 'Maqueta de libro', tabindex: '-1' });
    this.style = h('style');
    this.panel = h('aside', { class: 'mq-panel' });
    this.stage = h('div', { class: 'mq-stage' });
    this.info = h('div', { class: 'mq-info' });
    const top = h('div', { class: 'mq-top' },
      h('div', { class: 'mq-ttl' }, h('b', { text: 'Maqueta' }), h('span', { text: App.P().title })),
      h('div', { class: 'row', style: 'gap:.4rem' },
        btn([icon('download'), h('span', { class: 'lbl', text: 'PDF para imprimir' })], () => this.exportPdf(), 'small primary'),
        btn([h('span', { class: 'lbl', text: 'Word con este formato' })], () => this.exportDocx(), 'small'),
        ibtn('close', 'Cerrar (Esc)', () => this.close())));
    const nav = h('div', { class: 'mq-nav' },
      h('button', { type: 'button', class: 'mq-arrow', 'aria-label': 'Anterior', onclick: () => this.go(-1) }, '‹'),
      (this.range = h('input', { type: 'range', min: '0', max: '0', value: '0', 'aria-label': 'Página' })),
      (this.count = h('span', { class: 'mq-count' })),
      h('button', { type: 'button', class: 'mq-arrow', 'aria-label': 'Siguiente', onclick: () => this.go(1) }, '›'));
    this.range.addEventListener('input', () => { this.idx = +this.range.value; this.show(); });
    ov.append(this.style, top, h('div', { class: 'mq-body' }, this.panel, h('div', { class: 'mq-main' }, this.stage, nav, this.info)));
    document.body.append(ov); document.body.classList.add('reading');
    this.el = ov;
    this.keyH = (e) => {
      if (!this.el || UI.modalStack.length || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) { if (e.key === 'Escape' && this.el && !UI.modalStack.length) { e.preventDefault(); this.close(); } return; }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.close(); }
      else if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); this.go(1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); this.go(-1); }
    };
    document.addEventListener('keydown', this.keyH, true);
    this.resizeH = debounce(() => this.fit(), 150);
    window.addEventListener('resize', this.resizeH);
    this.renderPanel();
    this.layout();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => this.el && this.layout(true));
    ov.focus();
  },
  close() {
    if (!this.el) return;
    document.removeEventListener('keydown', this.keyH, true);
    window.removeEventListener('resize', this.resizeH);
    if (this.master) this.master.remove();
    this.el.remove(); this.el = null; this.master = null;
    document.body.classList.remove('reading');
  },
  renderPanel() {
    const c = this.cfg(), p = this.panel; p.textContent = '';
    const set = (k, v, relayout) => { this.save({ [k]: v }); if (relayout !== false) this.layoutSoon(); else this.show(); };
    const sec = (t, ...kids) => h('section', null, h('h4', { text: t }), ...kids);
    const row = (l, ctl) => h('label', { class: 'mq-row' }, h('span', { text: l }), ctl);
    const sel = (k, opts, val) => { const s = h('select', { class: 'sel' }); opts.forEach(([v, l]) => s.append(h('option', { value: v, text: l }))); s.value = val; s.addEventListener('change', () => { set(k, s.value); }); return s; };
    const num = (k, val, min, max, step, unit) => { const i = h('input', { class: 'inp', type: 'number', value: String(val), min: String(min), max: String(max), step: String(step) }); i.addEventListener('change', () => { const v = Math.max(min, Math.min(max, +i.value || val)); set(k, v); }); return h('span', { class: 'mq-num' }, i, unit ? h('em', { text: unit }) : null); };
    const chk = (k, val, label) => { const i = h('input', { type: 'checkbox', checked: !!val }); i.addEventListener('change', () => set(k, i.checked)); return h('label', { class: 'mq-chk' }, i, label); };
    // tamaño
    const size = sel('size', MQ_SIZES.map(s => [s[0], s[1]]), c.size);
    size.onchange = () => { const s = MQ_SIZES.find(x => x[0] === size.value); const patch = { size: size.value }; if (s && size.value !== 'custom') { patch.w = s[2]; patch.h = s[3]; } this.save(patch); this.renderPanel(); this.layoutSoon(); };
    const kids = [row('Formato', size)];
    if (c.size === 'custom') kids.push(h('div', { class: 'mq-two' }, row('Ancho', num('w', c.w, 8, 30, 0.1, 'cm')), row('Alto', num('h', c.h, 10, 40, 0.1, 'cm'))));
    p.append(sec('Hoja', ...kids,
      row('Márgenes', (() => { const s = h('select', { class: 'sel' }, h('option', { value: 'compacto', text: 'Compactos' }), h('option', { value: 'clasico', text: 'Clásicos' }), h('option', { value: 'amplio', text: 'Amplios' }), h('option', { value: 'custom', text: 'A mano' })); s.value = c.margins; s.onchange = () => { const m = MQ_MARGINS[s.value]; const patch = { margins: s.value }; if (m) Object.assign(patch, { top: m[0], bottom: m[1], inner: m[2], outer: m[3] }); this.save(patch); this.renderPanel(); this.layoutSoon(); }; return s; })()),
      c.margins === 'custom' ? h('div', { class: 'mq-two' }, row('Arriba', num('top', c.top, 0.8, 5, 0.1, 'cm')), row('Abajo', num('bottom', c.bottom, 0.8, 5, 0.1, 'cm')), row('Lomo', num('inner', c.inner, 0.8, 5, 0.1, 'cm')), row('Exterior', num('outer', c.outer, 0.8, 5, 0.1, 'cm'))) : null,
      row('Papel', sel('paper', [['ahuesado', 'Ahuesado (crema)'], ['blanco', 'Blanco']], c.paper))));
    // tipografía
    p.append(sec('Letra',
      row('Tipografía', sel('font', FONT_LIST.text.map(f => [f.n, f.n]), c.font)),
      h('div', { class: 'mq-two' }, row('Tamaño', num('pt', c.pt, 7, 18, 0.5, 'pt')), row('Interlineado', num('leading', c.leading, 1, 2.2, 0.05, ''))),
      row('Sangría', num('indent', c.indent, 0, 4, 0.1, 'em')),
      chk('justify', c.justify, 'Justificado con guiones'),
      chk('dropcap', c.dropcap, 'Letra capital al abrir capítulo')));
    // estructura
    p.append(sec('Libro',
      row('Autor', (() => { const i = h('input', { class: 'inp', value: c.author || '', placeholder: 'Tu nombre' }); i.addEventListener('change', () => set('author', i.value.trim())); return i; })()),
      chk('half', c.half, 'Portadilla'), chk('titlePage', c.titlePage, 'Portada con título y autor'), chk('copy', c.copy, 'Página de créditos'), chk('toc', c.toc, 'Índice'),
      chk('recto', c.recto, 'Capítulos en página impar (derecha)'), chk('sink', c.sink, 'Título de capítulo más abajo'),
      chk('header', c.header, 'Cornisa (autor / título)'),
      row('Números', sel('numbers', [['centro', 'Abajo, al centro'], ['exterior', 'Abajo, al exterior'], ['arriba', 'Arriba, al exterior'], ['no', 'Sin números']], c.numbers))));
    p.append(sec('Vista',
      row('Ver', sel('view', [['pliego', 'Dos páginas'], ['pagina', 'Una página']], c.view)),
      row('Zoom', sel('zoom', [['fit', 'Ajustar a la pantalla'], ['1', 'Tamaño real (aprox.)'], ['0.75', '75 %'], ['0.5', '50 %']], c.zoom))));
    p.append(h('p', { class: 'mq-note', text: 'La maqueta es una simulación: el PDF usa el motor de impresión del navegador y la paginación puede variar en una o dos líneas. «Tamaño real» depende de tu pantalla.' }));
  },
  layoutSoon: debounce(function () { Maqueta.layout(true); }, 220),
  layout(keep) {
    if (!this.el) return;
    const c = this.cfg();
    Profile.ensureFont(Profile.font('text', c.font).g);
    this.style.textContent = this.css(c, false);
    const W = c.w * MQ_CM, H = c.h * MQ_CM;
    const m = { top: c.top * MQ_CM, bottom: c.bottom * MQ_CM, inner: c.inner * MQ_CM, outer: c.outer * MQ_CM };
    const tw = Math.max(80, W - m.inner - m.outer), th = Math.max(80, H - m.top - m.bottom), gap = 40;
    this.dims = { W: W, H: H, m: m, tw: tw, th: th, stride: tw + gap };
    // texto maestro (oculto) en columnas del tamaño del bloque de texto
    if (this.master) this.master.remove();
    const flow = h('div', { class: 'mq-flow' });
    flow.style.cssText = 'position:absolute;left:0;top:0;height:' + th + 'px;width:' + tw + 'px;column-width:' + tw + 'px;column-gap:' + gap + 'px;column-fill:auto';
    this.secs = this.sections(c, false);
    this.secs.forEach(s => { const el = h('section', { class: s.cls }); el.innerHTML = s.html; if (s.cid) el.dataset.cid = s.cid; if (s.recto) el.dataset.recto = '1'; flow.append(el); });
    const host = h('div', { class: 'mq-master', 'aria-hidden': 'true' }, flow);
    this.el.append(host); this.master = host;
    const pageOf = (el) => Math.round((el.getBoundingClientRect().left - flow.getBoundingClientRect().left) / this.dims.stride);
    // capítulos y portada en página impar: se agregan páginas en blanco donde haga falta
    $$('section', flow).forEach(sec => { if (sec.dataset.recto && pageOf(sec) % 2 === 1) { const b = h('div', { class: 'mq-spacer' }); b.style.cssText = 'break-before:column;break-after:column;height:1px'; sec.before(b); } });
    // índice con números de página
    const starts = {}; $$('section[data-cid]', flow).forEach(sec => { starts[sec.dataset.cid] = pageOf(sec) + 1; });
    $$('.mq-toc-l li', flow).forEach(li => { const n = starts[li.dataset.cid]; li.querySelector('b').textContent = n ? String(n) : ''; });
    // páginas: total y metadatos
    let maxRight = 0; const fr = flow.getBoundingClientRect();
    $$('section > *', flow).forEach(x => { const r = x.getBoundingClientRect(); if (r.width) maxRight = Math.max(maxRight, r.right - fr.left); });
    const total = Math.max(1, Math.ceil((maxRight + gap - 1) / this.dims.stride));
    const meta = Array.from({ length: total }, () => ({ blank: true, front: false, start: false, cid: null }));
    $$('section', flow).forEach(sec => {
      const kids = Array.from(sec.children); if (!kids.length) return;
      const a = pageOf(sec), b = Math.max(a, ...kids.map(k => Math.floor((k.getBoundingClientRect().right - fr.left - 1) / this.dims.stride)));
      for (let i = a; i <= b && i < total; i++) { meta[i].blank = false; meta[i].front = sec.classList.contains('front'); meta[i].cid = sec.dataset.cid || null; if (i === a) meta[i].start = true; }
    });
    this.meta = meta; this.total = total; this.flow = flow;
    if (!keep) this.idx = 0;
    this.idx = Math.min(this.idx, total - 1);
    this.range.max = String(total - 1);
    // datos útiles para imprenta
    const words = App.chapterList().reduce((n, ch) => { const d = App.ch(ch.id); return n + (d && d.data ? chapterWords(d.data) : 0); }, 0);
    const textPages = meta.filter(x => !x.blank && !x.front).length || 1;
    const sig = Math.ceil(total / 16) * 16;
    const spine = (total / 2) * 0.01; // ~0,1 mm por hoja (papel de 80 g)
    this.info.innerHTML = '';
    this.info.append(
      h('span', null, h('b', { text: fmtN(total) }), ' páginas'),
      h('span', null, h('b', { text: fmtN(Math.round(words / textPages)) }), ' palabras por página'),
      h('span', { title: 'Las imprentas suelen armar el libro en cuadernillos de 16 páginas' }, 'En cuadernillos de 16: ', h('b', { text: fmtN(sig) }), sig > total ? ' (' + (sig - total) + ' en blanco al final)' : ''),
      h('span', { title: 'Aproximado para papel de 80 g; depende del papel' }, 'Lomo aprox. ', h('b', { text: (spine).toFixed(1).replace('.', ',') + ' cm' })));
    this.fit();
  },
  fit() {
    if (!this.el || !this.dims) return;
    const c = this.cfg(), d = this.dims;
    const two = c.view === 'pliego' && window.innerWidth > 700;
    const sw = this.stage.clientWidth - 24, sh = this.stage.clientHeight - 24;
    const wantW = d.W * (two ? 2 : 1);
    this.zoom = c.zoom === 'fit' ? Math.min(1.4, sw / wantW, sh / d.H) : +c.zoom;
    this.two = two;
    this.show();
  },
  pageEl(i) {
    const c = this.cfg(), d = this.dims, mt = this.meta[i] || { blank: true };
    const recto = i % 2 === 0; // página 1 (índice 0) es impar: derecha
    const pg = h('div', { class: 'mq-page ' + (recto ? 'recto' : 'verso') });
    pg.style.width = d.W + 'px'; pg.style.height = d.H + 'px';
    const clip = h('div', { class: 'mq-clip' });
    clip.style.cssText = 'position:absolute;top:' + d.m.top + 'px;left:' + (recto ? d.m.inner : d.m.outer) + 'px;width:' + d.tw + 'px;height:' + d.th + 'px;overflow:hidden';
    if (!mt.blank) { const f = this.flow.cloneNode(true); f.style.position = 'absolute'; f.style.transform = 'translateX(' + (-i * d.stride) + 'px)'; clip.append(f); }
    pg.append(clip);
    const fsz = Math.max(7, c.pt * 0.78) + 'pt';
    if (!mt.blank && !mt.front && !mt.start && c.header) {
      const P = App.P();
      const txt = recto ? (P.title || '') : (c.author || P.title || '');
      const hd = h('div', { class: 'mq-run', text: txt });
      hd.style.cssText = 'top:' + (d.m.top * 0.45) + 'px;left:' + (recto ? d.m.inner : d.m.outer) + 'px;width:' + d.tw + 'px;font-size:' + fsz + ';font-family:' + Profile.font('text', c.font).f;
      pg.append(hd);
    }
    if (!mt.blank && !mt.front && c.numbers !== 'no') {
      const n = h('div', { class: 'mq-num-p', text: String(i + 1) });
      const up = c.numbers === 'arriba';
      const align = c.numbers === 'centro' && !up ? 'center' : (recto ? 'right' : 'left');
      if (up && mt.start) { /* en la apertura de capítulo no va número arriba */ } else {
        n.style.cssText = (up ? 'top:' + (d.m.top * 0.45) : 'bottom:' + (d.m.bottom * 0.4)) + 'px;left:' + (recto ? d.m.inner : d.m.outer) + 'px;width:' + d.tw + 'px;text-align:' + align + ';font-size:' + fsz + ';font-family:' + Profile.font('text', c.font).f;
        pg.append(n);
      }
    }
    return pg;
  },
  show() {
    if (!this.el || !this.meta) return;
    const d = this.dims, z = this.zoom || 1;
    this.stage.textContent = '';
    const spread = h('div', { class: 'mq-spread' + (this.two ? ' dual' : '') });
    let pages;
    if (this.two) {
      // pliego: izquierda par (verso), derecha impar (recto); la página 1 va sola a la derecha
      const i = this.idx; const right = i % 2 === 0 ? i : i + 1; const left = right - 1;
      this.idx = right;
      pages = [left >= 0 ? left : null, right < this.total ? right : null];
    } else pages = [this.idx];
    pages.forEach(i => spread.append(i == null ? h('div', { class: 'mq-page ghost', style: 'width:' + d.W + 'px;height:' + d.H + 'px' }) : this.pageEl(i)));
    const scaler = h('div', { class: 'mq-scaler' }, spread);
    const sw = d.W * (this.two ? 2 : 1), sh = d.H;
    scaler.style.width = (sw * z) + 'px'; scaler.style.height = (sh * z) + 'px';
    spread.style.transform = 'scale(' + z + ')'; spread.style.transformOrigin = 'top left';
    this.stage.append(scaler);
    this.range.value = String(this.idx);
    const vis = pages.filter(x => x != null).map(x => x + 1);
    this.count.textContent = (vis.length > 1 ? 'Páginas ' + vis.join('–') : 'Página ' + vis[0]) + ' de ' + this.total;
  },
  go(dir) {
    const step = this.two ? 2 : 1;
    this.idx = Math.max(0, Math.min(this.total - 1, this.idx + dir * step));
    if (this.two && dir < 0 && this.idx % 2 === 1) this.idx -= 1;
    this.show();
  },
  /* ---------- exportar ---------- */
  printHtml() {
    const c = this.cfg(), P = App.P();
    const f = Profile.font('text', c.font);
    const secs = this.sections(c, true);
    const num = c.numbers;
    const box = (side) => num === 'no' ? '' : num === 'centro' ? '@bottom-center{content:counter(page);font-size:' + (c.pt * 0.8) + 'pt}' : num === 'exterior' ? '@bottom-' + (side === 'left' ? 'left' : 'right') + '{content:counter(page);font-size:' + (c.pt * 0.8) + 'pt}' : '@top-' + (side === 'left' ? 'left' : 'right') + '{content:counter(page);font-size:' + (c.pt * 0.8) + 'pt}';
    const head = (side) => c.header ? '@top-center{content:"' + String(side === 'left' ? (c.author || P.title || '') : (P.title || '')).replace(/"/g, '\\"') + '";font-size:' + (c.pt * 0.78) + 'pt;font-style:italic}' : '';
    const css = '@page{size:' + c.w + 'cm ' + c.h + 'cm;margin:' + c.top + 'cm ' + c.outer + 'cm ' + c.bottom + 'cm ' + c.inner + 'cm}' +
      '@page :left{margin-left:' + c.outer + 'cm;margin-right:' + c.inner + 'cm;' + box('left') + head('left') + '}' +
      '@page :right{margin-left:' + c.inner + 'cm;margin-right:' + c.outer + 'cm;' + box('right') + head('right') + '}' +
      '@page front{@top-center{content:none}@bottom-center{content:none}@bottom-left{content:none}@bottom-right{content:none}@top-left{content:none}@top-right{content:none}}' +
      'html,body{margin:0;padding:0;background:#fff}body{font-family:' + f.f + '}' +
      '.mq-flow section.front{page:front}' +
      '.aviso{font:14px/1.5 system-ui,sans-serif;background:#fff3d6;border:1px solid #e0c27a;padding:12px 16px;margin:16px;border-radius:8px}@media print{.aviso{display:none}}' +
      this.css(c, true);
    const body = secs.map(s => '<section class="' + s.cls + (s.recto ? ' recto' : '') + '">' + s.html + '</section>').join('\n');
    const gf = f.g ? '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=' + f.g + '&display=swap">' : '';
    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>' + hesc(P.title || 'Libro') + '</title>' + gf + '<style>' + css + '</style></head><body>' +
      '<div class="aviso"><b>Para guardar en PDF:</b> imprime (Ctrl o ⌘ + P), elige «Guardar como PDF», márgenes «Predeterminados» y activa «Gráficos de fondo» si quieres el color del papel. Este aviso no sale en el PDF.</div>' +
      '<div class="mq-flow">' + body + '</div></body></html>';
  },
  async exportPdf() {
    const html = this.printHtml();
    const name = slug(App.P().title || 'libro') + '-maqueta.html';
    if (RT.web) {
      // imprime desde un marco oculto con el formato del libro
      const fr = h('iframe', { style: 'position:fixed;right:0;bottom:0;width:0;height:0;border:0', 'aria-hidden': 'true' });
      document.body.append(fr);
      fr.srcdoc = html;
      fr.onload = () => { setTimeout(() => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { IO.save(name, html); } setTimeout(() => fr.remove(), 60000); }, 600); };
      App.toast('Se abre la ventana de impresión: elige «Guardar como PDF».');
    } else {
      await IO.save(name, html);
      App.toast('Descargué la maqueta. Ábrela en el navegador e imprime → «Guardar como PDF».');
    }
  },
  async exportDocx() {
    const c = this.cfg();
    IO._layout = c;
    try { await IO.doExport('docx', null, false); } finally { IO._layout = null; }
  }
};
window.Maqueta = Maqueta;
