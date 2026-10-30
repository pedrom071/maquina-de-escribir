/* ============ ideas: notas sueltas, imágenes y garabatos dentro del proyecto ============
   Cada idea es un documento en <proyecto>/ideas. Se clasifica sola (sin IA) por palabras y por los
   nombres de la biblia; con IA se puede reordenar. Nunca se inventa contenido: solo se ordena. */
const IDEA_CATS = {
  trama: { l: 'Trama y escenas', g: '◆' },
  personaje: { l: 'Personajes', g: '☺' },
  lugar: { l: 'Lugares', g: '⌂' },
  mundo: { l: 'Mundo', g: '◎' },
  tema: { l: 'Temas', g: '✦' },
  dialogo: { l: 'Diálogos y frases', g: '❝' },
  imagen: { l: 'Imágenes', g: '▣' },
  investigar: { l: 'Por investigar', g: '?' },
  otra: { l: 'Otras', g: '·' }
};
const IDEA_WORDS = {
  trama: /\b(escena|cap[ií]tulo|final|comienz|empiez|termina|giro|revela|descubr|muere|mata|huye|vuelve|regresa|encuentr|pelea|se van|llega|despu[eé]s de|antes de|cuando|flashback|conflicto|cl[ií]max|trama)/i,
  mundo: /\b(regla|magia|[eé]poca|siglo|sociedad|pol[ií]tica|religi[oó]n|tecnolog|historia del|leyenda|costumbre|idioma|moneda|guerra|reino|ciudad de)/i,
  tema: /\b(tema|trata (de|sobre)|s[ií]mbolo|met[aá]fora|representa|sentido de|la culpa|el miedo|la memoria|el duelo|la soledad|la identidad|el amor|la muerte)/i,
  investigar: /(investigar|averiguar|buscar|revisar si|chequear|confirmar|dato|fuente|\?$)/i
};

const Ideas = {
  pid: null, coll: null, filter: 'todas', q: '', draft: '', draftImg: null, chFilter: null,
  open() {
    if (this.pid === App.pid && this.coll) return this.coll;
    if (this.coll) { try { this.coll.close(); } catch (e) {} }
    this.pid = App.pid;
    this.coll = new Coll(App.ppath(App.pid) + '/ideas', { onChange: () => this.changed() });
    return this.coll;
  },
  close() { if (this.coll) { try { this.coll.close(); } catch (e) {} } this.coll = null; this.pid = null; },
  list() { const c = this.open(); return c ? c.list().map(d => Object.assign({ id: d.id, doc: d }, d.data)).filter(x => !x.deleted).sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || (b.at || 0) - (a.at || 0)) : []; },
  changed: debounce(function () { if (App.tab === 'ideas' && !Ideas.typing) Ideas.render(); if (window.Editor && Editor.root) Ideas.chapterBadge(); Ideas.fab(); if (App.view === 'project') App.renderSideSoon(); }, 120),
  /* ---------- clasificación sin IA ---------- */
  names() {
    const out = { personaje: [], lugar: [], otro: [] };
    ((App.P() && App.P().bible && App.P().bible.sections) || []).forEach(s => {
      const k = s.graph || /personaj/i.test(s.label) ? 'personaje' : /lugar|locaci/i.test(s.label) ? 'lugar' : 'otro';
      (s.items || []).forEach(it => { if (it.title) out[k].push(it.title.trim()); ((it.fields && it.fields['También llamado']) || '').split(',').forEach(a => { a = a.trim(); if (a) out[k].push(a); }); });
    });
    return out;
  },
  classify(text, hasImg) {
    const t = (text || '').trim();
    if (!t && hasImg) return 'imagen';
    if (/^[—–-]\s*\S/.test(t) || /«[^»]{3,}»/.test(t) || /^"[^"]{3,}"/.test(t)) return 'dialogo';
    if (IDEA_WORDS.investigar.test(t) && t.length < 220) return 'investigar';
    const n = this.names(); const has = (arr) => arr.some(nm => new RegExp('(?<![\\p{L}])' + escRe(nm) + '(?![\\p{L}])', 'iu').test(t));
    if (IDEA_WORDS.trama.test(t)) return 'trama';
    if (has(n.personaje)) return 'personaje';
    if (has(n.lugar)) return 'lugar';
    if (IDEA_WORDS.mundo.test(t)) return 'mundo';
    if (IDEA_WORDS.tema.test(t)) return 'tema';
    if (hasImg) return 'imagen';
    return 'otra';
  },
  mentions(text) {
    const n = this.names(); const all = n.personaje.concat(n.lugar, n.otro);
    return Array.from(new Set(all.filter(nm => nm.split(/\s+/).length <= 4 && new RegExp('(?<![\\p{L}])' + escRe(nm) + '(?![\\p{L}])', 'iu').test(text || ''))));
  },
  /* ---------- guardar ---------- */
  add(o) {
    const c = this.open(); if (!c || !RT.canWrite) return null;
    const id = uid('i');
    const text = (o.text || '').trim();
    const cat = o.cat || this.classify(text, !!o.img);
    c.create(id, { text: text, img: o.img || null, kind: o.kind || (o.img ? 'imagen' : 'texto'), cat: cat, catAuto: !o.cat, cid: o.cid || null, at: Date.now(), by: RT.me || 'local', pin: false, done: false });
    this.changed();
    return id;
  },
  update(id, fn) { const d = this.open().get(id); if (d) { d.update(fn, { now: true }); this.changed(); } },
  remove(id) {
    const d = this.open().get(id); if (!d) return;
    const keep = clone(d.data);
    d.update(x => { x.deleted = true; }, { now: true });
    this.changed();
    App.toast('Idea borrada.', { action: { label: 'Deshacer', fn: () => { d.update(x => { delete x.deleted; Object.assign(x, keep); delete x.deleted; }, { now: true }); this.changed(); } } });
  },
  /* ---------- imágenes ---------- */
  async compress(fileOrUrl, png) {
    const src = typeof fileOrUrl === 'string' ? fileOrUrl : await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(fileOrUrl); });
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    let w = img.naturalWidth, hh = img.naturalHeight; const max = 1280;
    if (w > max || hh > max) { const k = max / Math.max(w, hh); w = Math.round(w * k); hh = Math.round(hh * k); }
    const cv = document.createElement('canvas'); cv.width = w; cv.height = hh;
    const ctx = cv.getContext('2d');
    if (!png) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, hh); }
    ctx.drawImage(img, 0, 0, w, hh);
    let out = png ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.82);
    for (let q = 0.7; out.length > 600000 && q >= 0.35; q -= 0.12) out = cv.toDataURL('image/jpeg', q);
    return out;
  },
  /* ---------- garabatos ---------- */
  sketch(onDone, existing) {
    const W = 900, H = 560;
    const cv = h('canvas', { width: String(W), height: String(H), class: 'sk-canvas', 'aria-label': 'Hoja para dibujar' });
    const ctx = cv.getContext('2d');
    const paper = getComputedStyle(document.body).getPropertyValue('--sheet').trim() || '#fbf8f2';
    const ink = getComputedStyle(document.body).getPropertyValue('--ink').trim() || '#2a221b';
    const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#8a5c16';
    const fill = () => { ctx.fillStyle = paper; ctx.fillRect(0, 0, W, H); };
    fill();
    const undo = [];
    const snap = () => { undo.push(ctx.getImageData(0, 0, W, H)); if (undo.length > 30) undo.shift(); };
    if (existing) { const i = new Image(); i.onload = () => { ctx.drawImage(i, 0, 0, W, H); }; i.src = existing; }
    let color = ink, size = 3, erase = false, drawing = false, last = null;
    const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height, p: e.pressure || 0.5 }; };
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); cv.setPointerCapture(e.pointerId); snap(); drawing = true; last = pos(e); ctx.beginPath(); ctx.arc(last.x, last.y, (erase ? size * 4 : size) / 2, 0, Math.PI * 2); ctx.fillStyle = erase ? paper : color; ctx.fill(); });
    cv.addEventListener('pointermove', (e) => { if (!drawing) return; const p = pos(e); ctx.strokeStyle = erase ? paper : color; ctx.lineWidth = (erase ? size * 4 : size) * (e.pointerType === 'pen' ? 0.6 + p.p : 1); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p; });
    const end = () => { drawing = false; };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    const tools = h('div', { class: 'sk-tools' });
    const colors = [ink, accent, '#b4442f', '#2f6db4', '#3c8a52'];
    colors.forEach((c, i) => tools.append(h('button', { type: 'button', class: 'sk-color' + (i === 0 ? ' on' : ''), style: 'background:' + c, 'aria-label': 'Color', onclick: (e) => { color = c; erase = false; $$('.sk-color,.sk-erase', tools).forEach(b => b.classList.remove('on')); e.currentTarget.classList.add('on'); } })));
    [2, 4, 8].forEach((s, i) => tools.append(h('button', { type: 'button', class: 'sk-size' + (i === 0 ? '' : '') + (s === 4 ? ' on' : ''), 'aria-label': 'Grosor ' + s, onclick: (e) => { size = s; $$('.sk-size', tools).forEach(b => b.classList.remove('on')); e.currentTarget.classList.add('on'); } }, h('i', { style: 'width:' + (s + 2) + 'px;height:' + (s + 2) + 'px' }))));
    size = 4;
    tools.append(h('button', { type: 'button', class: 'sk-erase', onclick: (e) => { erase = true; $$('.sk-color', tools).forEach(b => b.classList.remove('on')); e.currentTarget.classList.add('on'); } }, 'Goma'));
    tools.append(h('span', { class: 'spacer' }));
    tools.append(btn('Deshacer', () => { const d = undo.pop(); if (d) ctx.putImageData(d, 0, 0); }, 'small'));
    tools.append(btn('Limpiar', () => { snap(); fill(); }, 'small'));
    UI.modal({ title: 'Garabato', body: h('div', { class: 'sk' }, tools, cv), buttons: [{ label: 'Cancelar' }, { label: 'Guardar garabato', cls: 'primary', onClick: () => { onDone(cv.toDataURL('image/png')); } }] });
    const m = cv.closest('.modal'); if (m) m.classList.add('wide');
  },
  /* ---------- captura rápida (desde cualquier parte del proyecto) ---------- */
  quick() {
    if (!App.pid || !RT.canWrite) return;
    let img = null;
    const ta = h('textarea', { class: 'inp', rows: '4', placeholder: 'Una idea, una frase, algo que no sabes dónde va…', 'aria-label': 'Idea' });
    const prev = h('div', { class: 'idea-prev' });
    const setImg = (u) => { img = u; prev.textContent = ''; if (u) prev.append(h('img', { src: u, alt: '' }), btn('Quitar', () => setImg(null), 'small ghost')); };
    ta.addEventListener('paste', async (e) => { const f = Array.from(e.clipboardData.files || []).find(x => /^image\//.test(x.type)); if (f) { e.preventDefault(); setImg(await this.compress(f)); } });
    const here = App.tab === 'escribir' && App.cid ? h('input', { type: 'checkbox' }) : null;
    const fi = h('input', { type: 'file', accept: 'image/*', hidden: true });
    fi.addEventListener('change', async () => { if (fi.files[0]) setImg(await this.compress(fi.files[0])); fi.value = ''; });
    const save = () => { if (!ta.value.trim() && !img) return false; this.add({ text: ta.value, img: img, kind: img ? (img.startsWith('data:image/png') ? 'garabato' : 'imagen') : 'texto', cid: here && here.checked ? App.cid : null }); App.toast('Idea guardada en «Ideas».', { action: { label: 'Ver', fn: () => App.go('p-' + App.pid + '-ideas') } }); };
    UI.modal({ title: 'Nueva idea', body: h('div', { class: 'idea-quick' }, ta, prev,
      h('div', { class: 'row', style: 'gap:.4rem' }, btn([icon('plus'), 'Imagen'], () => fi.click(), 'small'), btn([icon('pen'), 'Garabato'], () => this.sketch((u) => setImg(u)), 'small'), fi,
        here ? h('label', { class: 'row', style: 'gap:.35rem;font-size:.85rem;margin-left:auto' }, here, 'Va en este ' + App.unit().toLowerCase()) : null)),
      buttons: [{ label: 'Cancelar' }, { label: 'Guardar idea', cls: 'primary', onClick: save }] });
    ta.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); if (save() !== false) UI.modalStack[UI.modalStack.length - 1](); } });
    setTimeout(() => ta.focus(), 40);
  },
  /* ---------- vista ---------- */
  render(st) {
    st = st || $('#stage'); if (!st || App.tab !== 'ideas') return;
    const P = App.P(); if (!P) return;
    const keepFocus = document.activeElement && document.activeElement.id === 'idea-in';
    const all = this.list();
    st.textContent = '';
    const wrap = h('div', { class: 'ideas' });
    wrap.append(h('div', { class: 'vhead', style: 'margin:0' }, h('div', null, h('h2', { text: 'Ideas' }), h('p', { text: 'Notas sueltas, frases, imágenes y garabatos que todavía no sabes dónde van. Se ordenan solos por tema; tú decides qué hacer con ellos.' })),
      h('div', { class: 'row' },
        h('div', { class: 'seg idea-view', role: 'radiogroup', 'aria-label': 'Vista' },
          h('button', { type: 'button', role: 'radio', 'aria-checked': this.view !== 'board' ? 'true' : 'false', onclick: () => { this.view = 'cards'; this.render(); } }, 'Tarjetas'),
          h('button', { type: 'button', role: 'radio', 'aria-checked': this.view === 'board' ? 'true' : 'false', onclick: () => { this.view = 'board'; this.render(); } }, 'Por capítulo')),
        RT.canWrite && RT.sample && (!RT.web || AI.ready()) ? btn([icon('spark'), 'IA: ordenar y ubicar'], () => this.aiSort(), 'small') : null)));
    // captura
    if (RT.canWrite) {
      const ta = h('textarea', { class: 'inp', id: 'idea-in', rows: '3', placeholder: 'Anota una idea… (' + keys('mod', 'enter') + ' para guardar; también puedes pegar o arrastrar una imagen)', 'aria-label': 'Nueva idea' });
      ta.value = this.draft;
      const prev = h('div', { class: 'idea-prev' });
      const setImg = (u) => { this.draftImg = u; prev.textContent = ''; if (u) prev.append(h('img', { src: u, alt: '' }), btn('Quitar', () => setImg(null), 'small ghost')); };
      setImg(this.draftImg);
      ta.addEventListener('input', () => { this.draft = ta.value; this.typing = true; clearTimeout(this.tt); this.tt = setTimeout(() => { this.typing = false; }, 1500); });
      ta.addEventListener('paste', async (e) => { const f = Array.from(e.clipboardData.files || []).find(x => /^image\//.test(x.type)); if (f) { e.preventDefault(); setImg(await this.compress(f)); } });
      const save = () => {
        if (!ta.value.trim() && !this.draftImg) return;
        this.add({ text: ta.value, img: this.draftImg, kind: this.draftImg ? (this.draftImg.startsWith('data:image/png') ? 'garabato' : 'imagen') : 'texto', cid: this.chFilter || null });
        this.draft = ''; this.draftImg = null; this.typing = false; this.render(); setTimeout(() => { const t = $('#idea-in'); if (t) t.focus(); }, 30);
      };
      ta.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); save(); } });
      const fi = h('input', { type: 'file', accept: 'image/*', hidden: true, multiple: true });
      fi.addEventListener('change', async () => { for (const f of Array.from(fi.files)) this.add({ text: '', img: await this.compress(f), kind: 'imagen', cid: this.chFilter || null }); fi.value = ''; });
      const cap = h('div', { class: 'idea-cap' }, ta, prev, h('div', { class: 'row', style: 'gap:.4rem' },
        btn([icon('plus'), 'Imágenes'], () => fi.click(), 'small'), btn([icon('pen'), 'Garabato'], () => this.sketch((u) => { this.add({ text: ta.value, img: u, kind: 'garabato', cid: this.chFilter || null }); this.draft = ''; this.render(); }), 'small'), fi,
        h('span', { class: 'spacer' }), btn('Guardar idea', save, 'small primary')));
      cap.addEventListener('dragover', (e) => { e.preventDefault(); cap.classList.add('drop'); });
      cap.addEventListener('dragleave', () => cap.classList.remove('drop'));
      cap.addEventListener('drop', async (e) => { e.preventDefault(); cap.classList.remove('drop'); for (const f of Array.from(e.dataTransfer.files || []).filter(x => /^image\//.test(x.type))) this.add({ text: '', img: await this.compress(f), kind: 'imagen', cid: this.chFilter || null }); });
      wrap.append(cap);
    }
    // filtros
    const counts = {}; Object.keys(IDEA_CATS).forEach(k => counts[k] = 0); all.forEach(x => { if (!x.done) counts[x.cat || 'otra'] = (counts[x.cat || 'otra'] || 0) + 1; });
    const fbar = h('div', { class: 'fbar ideas-f' });
    const chip = (key, label, n, g) => h('button', { type: 'button', class: 'fchip' + (this.filter === key ? ' on' : ''), onclick: () => { this.filter = key; this.render(); } }, g ? h('span', { class: 'ig', text: g }) : null, h('span', { text: label }), h('b', { text: String(n) }));
    fbar.append(chip('todas', 'Todas', all.filter(x => !x.done).length));
    Object.keys(IDEA_CATS).forEach(k => { if (counts[k]) fbar.append(chip(k, IDEA_CATS[k].l, counts[k], IDEA_CATS[k].g)); });
    const sinLugar = all.filter(x => !x.done && !x.cid).length; if (sinLugar && sinLugar !== all.filter(x => !x.done).length) fbar.append(chip('sinlugar', 'Sin lugar', sinLugar));
    const usadas = all.filter(x => x.done).length; if (usadas) fbar.append(chip('usadas', 'Usadas', usadas));
    const search = h('input', { class: 'inp idea-q', placeholder: 'Buscar…', value: this.q, 'aria-label': 'Buscar en ideas' });
    search.addEventListener('input', debounce(() => { this.q = search.value; this.render(); const s = $('.idea-q'); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }, 250));
    fbar.append(h('span', { class: 'spacer' }), search);
    if (all.length) wrap.append(fbar);
    if (this.chFilter) { const c = App.chapterList().find(x => x.id === this.chFilter); wrap.append(h('div', { class: 'idea-chf' }, 'Ideas para «' + (c ? c.title || Pages.label(c) : '') + '»', btn('Ver todas', () => { this.chFilter = null; this.render(); }, 'small ghost'))); }
    // tarjetas
    const q = fold(this.q.trim());
    const shown = all.filter(x => (this.filter === 'usadas' ? x.done : !x.done) && (this.filter === 'todas' || this.filter === 'usadas' || (this.filter === 'sinlugar' ? !x.cid : (x.cat || 'otra') === this.filter)) && (!q || fold(x.text || '').includes(q)) && (!this.chFilter || x.cid === this.chFilter));
    this.prepSuggest();
    if (this.view === 'board') { if (all.length) wrap.append(this.board(shown)); st.append(wrap); return; }
    const grid = h('div', { class: 'idea-grid' });
    shown.forEach(x => grid.append(this.card(x)));
    if (!all.length) wrap.append(h('div', { class: 'empty', text: 'Todavía no hay ideas. Anota la primera arriba, o usa ' + keys('alt', 'N') + ' desde cualquier parte del proyecto.' }));
    else if (!shown.length) wrap.append(h('div', { class: 'empty', text: 'No hay ideas con ese filtro.' }));
    wrap.append(grid);
    st.append(wrap);
    if (keepFocus) { const t = $('#idea-in'); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } }
  },
  card(x) {
    const cat = IDEA_CATS[x.cat] || IDEA_CATS.otra;
    const ch = x.cid ? App.chapterList().find(c => c.id === x.cid) : null;
    const el = h('article', { class: 'idea' + (x.pin ? ' pin' : '') + (x.done ? ' done' : '') + (x.img && !x.text ? ' only-img' : ''), dataset: { id: x.id } });
    if (x.img) el.append(h('img', { src: x.img, alt: x.kind === 'garabato' ? 'Garabato' : 'Imagen', loading: 'lazy', onclick: () => this.zoomImg(x.img) }));
    if (x.text) el.append(h('p', { class: 'idea-t', text: x.text }));
    const meta = h('div', { class: 'idea-m' });
    meta.append(h('button', { type: 'button', class: 'idea-cat', title: (x.catAuto ? 'Clasificada sola' : 'Clasificada por ti') + '. Toca para cambiar.', onclick: (e) => RT.canWrite && this.catMenu(e.currentTarget, x) }, h('span', { text: cat.g }), cat.l + (x.catAuto ? '' : ' ✓')));
    this.mentions(x.text).slice(0, 3).forEach(n => meta.append(h('span', { class: 'idea-who', text: n })));
    meta.append(h('button', { type: 'button', class: 'idea-ch', title: 'Dónde va', onclick: (e) => RT.canWrite && this.chMenu(e.currentTarget, x) }, ch ? '→ ' + (ch.title || Pages.label(ch)) : 'Sin lugar'));
    el.append(meta);
    const sg = !x.cid && !x.done && RT.canWrite ? this.suggest(x) : null;
    if (sg) el.append(h('div', { class: 'idea-sug' },
      h('span', null, '¿Va en ', h('b', { text: sg.c.title || Pages.label(sg.c) }), '? ', h('span', { class: 'why', text: sg.why })),
      h('button', { type: 'button', class: 'yes', onclick: () => this.update(x.id, z => { z.cid = sg.c.id; }) }, 'Sí'),
      h('button', { type: 'button', class: 'no', title: 'No sugerir este lugar', onclick: () => this.update(x.id, z => { z.noSug = (z.noSug || []).concat(sg.c.id); delete z.aiSug; }) }, '×')));
    if (RT.canWrite) el.append(h('div', { class: 'idea-a' },
      h('button', { type: 'button', class: 'ia', title: x.pin ? 'Desfijar' : 'Fijar arriba', 'aria-pressed': x.pin ? 'true' : 'false', onclick: () => this.update(x.id, z => { z.pin = !z.pin; }) }, '★'),
      h('button', { type: 'button', class: 'ia', title: x.done ? 'Volver a pendientes' : 'Marcar como usada', onclick: () => this.update(x.id, z => { z.done = !z.done; }) }, x.done ? '↺' : '✓'),
      ibtn('more', 'Opciones', (e) => this.menu(e.currentTarget, x), { class: 'ibtn ia' })));
    el.append(h('time', { class: 'idea-d', text: relTime(x.at) }));
    return el;
  },
  /* ---------- dónde podría ir (sin IA): nombres de la biblia y palabras en común ---------- */
  prepSuggest() {
    const words = (t) => (fold(t).match(/[a-zñ]{5,}/g) || []).filter(w => !STOP.has(w)).map(w => w.slice(0, 6));
    this.chStats = App.chapterList().filter(c => c.role !== 'parte').map(c => {
      const d = App.ch(c.id); const text = d && d.data ? d.data.paras.map(parText).join('\n') : '';
      const tf = new Map(); words(text).forEach(w => tf.set(w, (tf.get(w) || 0) + 1));
      return { c: c, text: text, tf: tf, n: Math.max(1, countWords(text)) };
    }).filter(s => s.n > 20);
    const df = new Map(); this.chStats.forEach(s => s.tf.forEach((v, w) => df.set(w, (df.get(w) || 0) + 1)));
    this.df = df;
  },
  suggest(x) {
    if (x.aiSug && x.aiSug.cid && !(x.noSug || []).includes(x.aiSug.cid)) { const c = App.chapterList().find(z => z.id === x.aiSug.cid); if (c) return { c: c, why: x.aiSug.why || 'sugerencia de la IA' }; }
    if (!this.chStats || this.chStats.length < 2 || !x.text) return null;
    const N = this.chStats.length;
    const ws = Array.from(new Set((fold(x.text).match(/[a-zñ]{5,}/g) || []).filter(w => !STOP.has(w)).map(w => w.slice(0, 6))));
    const names = this.mentions(x.text);
    let best = null, second = 0;
    this.chStats.forEach(s => {
      if ((x.noSug || []).includes(s.c.id)) return;
      let score = 0; const shared = []; const who = [];
      names.forEach(nm => { const k = (s.text.match(new RegExp('(?<![\\p{L}])' + escRe(nm) + '(?![\\p{L}])', 'giu')) || []).length; if (k) { score += 2 + Math.min(4, k) * 0.6; who.push(nm); } });
      ws.forEach(w => { const f = s.tf.get(w); if (f) { const idf = Math.log(1 + N / (this.df.get(w) || 1)); score += idf * Math.min(3, f) * 0.9; if (idf > 0.5) shared.push(w); } });
      score = score / Math.sqrt(1 + ws.length / 6);
      if (!best || score > best.score) { if (best) second = Math.max(second, best.score); best = { c: s.c, score: score, who: who, shared: shared }; }
      else second = Math.max(second, score);
    });
    if (!best || best.score < 1.2 || best.score < second * 1.3) return null;
    const why = best.who.length ? '(ahí aparece ' + best.who.slice(0, 2).join(' y ') + ')' : best.shared.length ? '(comparte «' + best.shared.slice(0, 3).map(st => { const m = (x.text.match(/[\p{L}]{5,}/gu) || []).find(w => fold(w).startsWith(st)); return m ? m.toLowerCase() : st; }).join('», «') + '»)' : '';
    return { c: best.c, why: why };
  },
  /* ---------- tablero: columnas por capítulo, se arrastra para ubicar ---------- */
  board(shown) {
    const cols = [{ id: null, label: 'Sin lugar' }].concat(App.chapterList().map(c => ({ id: c.id, label: c.title || Pages.label(c), part: c.role === 'parte' })));
    const wrap = h('div', { class: 'idea-board' });
    cols.forEach(col => {
      const items = shown.filter(x => (x.cid || null) === col.id);
      if (col.part && !items.length) { wrap.append(h('div', { class: 'ib-part', text: col.label })); return; }
      const box = h('section', { class: 'ib-col' + (col.id ? '' : ' none'), dataset: { cid: col.id || '' } }, h('h4', null, h('span', { text: col.label }), h('b', { text: String(items.length) })));
      const list = h('div', { class: 'ib-list' });
      items.forEach(x => {
        const sg = !x.cid ? this.suggest(x) : null;
        const it = h('div', { class: 'ib-it', draggable: RT.canWrite ? 'true' : 'false', dataset: { id: x.id }, title: 'Arrastra a otro capítulo' },
          x.img ? h('img', { src: x.img, alt: '' }) : null,
          x.text ? h('p', { text: x.text.length > 140 ? x.text.slice(0, 140) + '…' : x.text }) : null,
          h('span', { class: 'ib-cat', text: (IDEA_CATS[x.cat] || IDEA_CATS.otra).g + ' ' + (IDEA_CATS[x.cat] || IDEA_CATS.otra).l }),
          sg ? h('button', { type: 'button', class: 'ib-sug', title: 'Llevar ahí ' + sg.why, onclick: () => this.update(x.id, z => { z.cid = sg.c.id; }) }, '→ ' + (sg.c.title || Pages.label(sg.c)) + '?') : null);
        it.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/idea', x.id); it.classList.add('drag'); });
        it.addEventListener('dragend', () => it.classList.remove('drag'));
        it.addEventListener('click', (e) => { if (e.target.closest('.ib-sug') || !RT.canWrite) return; this.chMenu(it, x); });
        list.append(it);
      });
      if (!items.length) list.append(h('div', { class: 'ib-empty', text: col.id ? 'Arrastra aquí' : 'Todo ubicado' }));
      box.append(list);
      box.addEventListener('dragover', (e) => { if (Array.from(e.dataTransfer.types).includes('text/idea')) { e.preventDefault(); box.classList.add('over'); } });
      box.addEventListener('dragleave', () => box.classList.remove('over'));
      box.addEventListener('drop', (e) => { e.preventDefault(); box.classList.remove('over'); const id = e.dataTransfer.getData('text/idea'); if (id) this.update(id, z => { z.cid = col.id; }); });
      wrap.append(box);
    });
    return wrap;
  },
  /* ---------- botón flotante (en el editor y demás vistas del proyecto) ---------- */
  fab() {
    let b = $('#idea-fab');
    const show = App.view === 'project' && RT.canWrite && !App.focus;
    if (!show) { if (b) b.remove(); return; }
    const n = this.coll ? this.list().filter(x => !x.done && !x.cid).length : 0;
    if (!b) {
      b = h('div', { id: 'idea-fab', class: 'idea-fab' },
        h('button', { type: 'button', class: 'fab-main', title: 'Anotar una idea (' + keys('alt', 'N') + ')', onclick: () => this.quick() }, icon('idea'), h('span', { class: 'lbl', text: 'Idea' })),
        h('button', { type: 'button', class: 'fab-all', title: 'Ver todas las ideas', onclick: () => App.go('p-' + App.pid + '-ideas') }, h('b')));
      document.body.append(b);
    }
    const all = b.querySelector('.fab-all'); all.hidden = !n || App.tab === 'ideas';
    all.querySelector('b').textContent = n > 99 ? '99+' : String(n);
    all.title = plural(n, 'idea sin lugar', 'ideas sin lugar') + ' · ver todas';
  },
  catMenu(a, x) { UI.menu(a, Object.keys(IDEA_CATS).map(k => ({ label: IDEA_CATS[k].g + '  ' + IDEA_CATS[k].l, checked: x.cat === k, onClick: () => this.update(x.id, z => { z.cat = k; z.catAuto = false; }) }))); },
  chMenu(a, x) {
    UI.menu(a, [{ label: 'Sin lugar todavía', checked: !x.cid, onClick: () => this.update(x.id, z => { z.cid = null; }) }, { sep: true }]
      .concat(App.chapterList().map(c => ({ label: c.title || Pages.label(c), checked: x.cid === c.id, onClick: () => this.update(x.id, z => { z.cid = c.id; }) }))));
  },
  menu(a, x) {
    const items = [
      { label: 'Editar texto', onClick: async () => { const t = await UI.prompt('Editar idea', 'Texto', x.text || ''); if (t != null) this.update(x.id, z => { z.text = t.trim(); if (z.catAuto) z.cat = this.classify(z.text, !!z.img); }); } },
      x.img && x.kind === 'garabato' ? { label: 'Seguir el garabato', onClick: () => this.sketch((u) => this.update(x.id, z => { z.img = u; }), x.img) } : null,
      x.cid ? { label: 'Abrir el ' + App.unit().toLowerCase(), onClick: () => App.go(App.chHash(x.cid)) } : null,
      (x.cat === 'personaje' || x.cat === 'lugar' || x.cat === 'mundo') && x.text ? { label: 'Crear ficha en la biblia', onClick: () => this.toBible(x) } : null,
      x.cat === 'investigar' || x.cat === 'trama' ? { label: 'Llevar a cabos sueltos', onClick: () => this.toThread(x) } : null,
      { sep: true },
      { label: 'Borrar', danger: true, onClick: () => this.remove(x.id) }
    ];
    UI.menu(a, items);
  },
  toBible(x) {
    const want = x.cat === 'personaje' ? /personaj/i : x.cat === 'lugar' ? /lugar|locaci/i : /mundo|regla/i;
    const P = App.P();
    // si la idea nombra a alguien que ya tiene ficha, se agrega a sus notas
    let target = null;
    ((P.bible && P.bible.sections) || []).forEach(s => (s.items || []).forEach(it => { if (!target && it.title && new RegExp('(?<![\\p{L}])' + escRe(it.title.trim()) + '(?![\\p{L}])', 'iu').test(x.text)) target = { sid: s.id, iid: it.id, title: it.title }; }));
    if (target) {
      App.proj().update(p => { const s = p.bible.sections.find(z => z.id === target.sid); const it = s && s.items.find(z => z.id === target.iid); if (it) it.body = ((it.body || '').trim() ? it.body.trim() + '\n\n' : '') + x.text; }, { now: true });
      App.toast('Agregada a las notas de la ficha de «' + target.title + '».', { action: { label: 'Ver', fn: () => App.go('p-' + App.pid + '-biblia') } });
      return;
    }
    const first = (x.text.split(/[.:\n,—]/)[0] || '').trim().split(/\s+/).slice(0, 5).join(' ');
    App.proj().update(p => {
      p.bible = p.bible || { sections: [] };
      let s = p.bible.sections.find(z => want.test(z.label) || (x.cat === 'personaje' && z.graph));
      if (!s) { s = { id: uid('s'), label: x.cat === 'personaje' ? 'Personajes' : x.cat === 'lugar' ? 'Lugares' : 'Mundo y reglas', fields: [], graph: x.cat === 'personaje', items: [] }; p.bible.sections.push(s); }
      s.items = s.items || []; s.items.push({ id: uid('i'), title: first, fields: {}, body: x.text });
    }, { now: true });
    App.toast('Ficha creada en la biblia: «' + first + '». Revisa el título.', { action: { label: 'Ver', fn: () => App.go('p-' + App.pid + '-biblia') } });
  },
  toThread(x) {
    App.proj().update(p => { p.threads = p.threads || []; p.threads.push({ id: uid('t'), title: (x.text || '').split('\n')[0].slice(0, 90), body: x.text, status: 'open', cid: x.cid || undefined, at: Date.now() }); }, { now: true });
    App.toast('Quedó en «Cabos sueltos» de la biblia.');
  },
  zoomImg(src) { UI.modal({ title: 'Imagen', body: h('img', { src: src, alt: '', class: 'idea-zoom' }), buttons: [{ label: 'Cerrar', cls: 'primary' }] }); },
  /* Ordenar con IA: solo asigna categorías; no agrega ni cambia el texto. */
  async aiSort() {
    if (!Review.ok()) return;
    const items = this.list().filter(x => x.text && !x.done && (x.catAuto || !x.cid)).slice(0, 60);
    if (!items.length) { App.toast('No hay ideas pendientes de ordenar.'); return; }
    App.toast('Ordenando ' + plural(items.length, 'idea') + '…', { id: 'ais', ms: 10000 });
    const chs = App.chapterList().filter(c => c.role !== 'parte').map((c, i) => { const d = App.ch(c.id); const t = d && d.data ? d.data.paras.map(parText).join(' ') : ''; return { i: i + 1, c: c, t: t.replace(/\s+/g, ' ').slice(0, 700) }; });
    const prompt = 'Ordena las ideas sueltas de un proyecto de escritura. Para cada idea: (1) una categoría entre ' + Object.keys(IDEA_CATS).join(', ') + '; (2) el número del capítulo donde calza mejor según lo que ya está escrito, o 0 si no se puede saber; (3) una razón breve (máximo 12 palabras) basada en el texto existente.\n' +
      'No inventes trama, escenas ni contenido; no reescribas las ideas. Solo clasifica y ubica.\n' +
      'Responde solo JSON: [{"n":número de idea,"cat":"categoría","cap":número de capítulo,"por":"razón"}].\n\nCAPÍTULOS (inicio de cada uno):\n' + chs.map(x => x.i + '. ' + (x.c.title || Pages.label(x.c)) + ': ' + (x.t || '(vacío)')).join('\n') +
      '\n\nIDEAS:\n' + items.map((x, i) => (i + 1) + '. ' + x.text.replace(/\s+/g, ' ').slice(0, 400)).join('\n');
    try {
      const r = await RT.sample(prompt, { modelTier: 'quick' });
      const arr = typeof parseJsonLoose === 'function' ? parseJsonLoose(r.text) : JSON.parse(r.text);
      let nc = 0, ns = 0;
      (Array.isArray(arr) ? arr : []).forEach(o => {
        const x = items[(+o.n) - 1]; if (!x) return;
        const ch = chs[(+o.cap) - 1];
        this.update(x.id, z => {
          if (z.catAuto && IDEA_CATS[o.cat] && o.cat !== z.cat) { z.cat = o.cat; nc++; }
          if (!z.cid && ch && !(z.noSug || []).includes(ch.c.id)) { z.aiSug = { cid: ch.c.id, why: o.por ? '(' + String(o.por).slice(0, 90) + ')' : '' }; ns++; }
        });
      });
      App.toast((nc ? plural(nc, 'idea reclasificada', 'ideas reclasificadas') + '. ' : '') + (ns ? plural(ns, 'sugerencia', 'sugerencias') + ' de lugar: confírmalas en cada tarjeta.' : 'Sin sugerencias de lugar.'), { id: 'ais', ms: 6000 });
    } catch (e) { App.toast('No se pudo ordenar ahora. Intenta de nuevo.', { id: 'ais' }); }
  },
  /* Indicador en el editor: ideas asignadas a este capítulo. */
  chapterBadge() {
    const eb = $('#ch-eyebrow'); if (!eb || !App.cid) return;
    const n = this.list().filter(x => x.cid === App.cid && !x.done).length;
    let b = $('#idea-badge');
    if (!n) { if (b) b.remove(); return; }
    if (!b) { b = h('button', { type: 'button', id: 'idea-badge', class: 'idea-badge', onclick: () => { this.chFilter = App.cid; App.go('p-' + App.pid + '-ideas'); } }); eb.after(b); }
    b.textContent = '✦ ' + plural(n, 'idea', 'ideas') + ' para este ' + App.unit().toLowerCase();
  }
};
window.Ideas = Ideas;
document.addEventListener('keydown', (e) => {
  if (!window.App || App.view !== 'project' || !RT.canWrite) return;
  if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === 'KeyN') { e.preventDefault(); Ideas.quick(); }
});
