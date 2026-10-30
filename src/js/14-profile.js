/* ============ perfil y apariencia de cada persona ============ */
const LOOK_KEY = 'mde-look-v1';
const FONT_LIST = {
  text: [
    { n: 'Newsreader', f: '"Newsreader", Georgia, serif', g: 'Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400', d: 'Clásica, cálida' },
    { n: 'Literata', f: '"Literata", Georgia, serif', g: 'Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;1,7..72,400', d: 'Hecha para leer largo' },
    { n: 'Source Serif 4', f: '"Source Serif 4", Georgia, serif', g: 'Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400', d: 'Sobria' },
    { n: 'EB Garamond', f: '"EB Garamond", Garamond, serif', g: 'EB+Garamond:ital,wght@0,400;0,600;1,400', d: 'Libro antiguo' },
    { n: 'Lora', f: '"Lora", Georgia, serif', g: 'Lora:ital,wght@0,400;0,600;1,400', d: 'Redondeada' },
    { n: 'Crimson Pro', f: '"Crimson Pro", Georgia, serif', g: 'Crimson+Pro:ital,wght@0,400;0,600;1,400', d: 'Editorial' },
    { n: 'IBM Plex Serif', f: '"IBM Plex Serif", Georgia, serif', g: 'IBM+Plex+Serif:ital,wght@0,400;0,600;1,400', d: 'Técnica' },
    { n: 'Courier Prime', f: '"Courier Prime", "Courier New", monospace', g: 'Courier+Prime:ital,wght@0,400;0,700;1,400', d: 'Máquina de escribir' },
    { n: 'IBM Plex Mono', f: '"IBM Plex Mono", ui-monospace, monospace', g: 'IBM+Plex+Mono:ital,wght@0,400;0,600;1,400', d: 'Monoespaciada' },
    { n: 'Atkinson Hyperlegible', f: '"Atkinson Hyperlegible", system-ui, sans-serif', g: 'Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400', d: 'Muy legible' },
    { n: 'Hanken Grotesk', f: '"Hanken Grotesk", system-ui, sans-serif', g: null, d: 'Sin serifa' }
  ],
  display: [
    { n: 'Instrument Serif', f: '"Instrument Serif", "Iowan Old Style", Georgia, serif', g: null, d: 'La de tu sitio' },
    { n: 'Fraunces', f: '"Fraunces", Georgia, serif', g: 'Fraunces:ital,opsz,wght@0,9..144,400;1,9..144,400', d: 'Expresiva' },
    { n: 'Playfair Display', f: '"Playfair Display", Georgia, serif', g: 'Playfair+Display:ital,wght@0,400;1,400', d: 'Contraste alto' },
    { n: 'DM Serif Display', f: '"DM Serif Display", Georgia, serif', g: 'DM+Serif+Display:ital@0;1', d: 'Firme' },
    { n: 'Cormorant Garamond', f: '"Cormorant Garamond", Garamond, serif', g: 'Cormorant+Garamond:ital,wght@0,500;1,500', d: 'Fina' },
    { n: 'Courier Prime', f: '"Courier Prime", "Courier New", monospace', g: 'Courier+Prime:ital,wght@0,400;0,700;1,400', d: 'Máquina de escribir' },
    { n: 'Igual que el texto', f: null, g: null, d: '' }
  ],
  ui: [
    { n: 'Hanken Grotesk', f: '"Hanken Grotesk", "Segoe UI", system-ui, sans-serif', g: null, d: '' },
    { n: 'Atkinson Hyperlegible', f: '"Atkinson Hyperlegible", system-ui, sans-serif', g: 'Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400', d: '' },
    { n: 'IBM Plex Sans', f: '"IBM Plex Sans", system-ui, sans-serif', g: 'IBM+Plex+Sans:wght@400;500;600', d: '' },
    { n: 'La del sistema', f: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', g: null, d: '' }
  ]
};
const BASE_L = {
  bg: '#E6DECD', sheet: '#FBF7EF', raised: '#F3ECDF', sunk: '#DED4C1', ink: '#2A221B', soft: '#6B5E4E', faint: '#968873',
  line: 'rgba(42,34,27,.13)', line2: 'rgba(42,34,27,.26)', accent: '#8A5C16', 'accent-ink': '#FFF9EE', 'accent-soft': 'rgba(138,92,22,.12)', sel: 'rgba(138,92,22,.22)',
  'rep-bg': '#F2DD9C', 'rep-fg': '#835500', 'dud-bg': '#F1CDD3', 'dud-fg': '#A12541', 'coh-bg': '#CCD9F3', 'coh-fg': '#2D53A3', 'bien-bg': '#CBE6D2', 'bien-fg': '#22704A',
  'ort-bg': '#F5CFC6', 'ort-fg': '#BC3328', 'rec-bg': '#DFD3F1', 'rec-fg': '#6541AC', 'pend-bg': '#E2DACD', 'pend-fg': '#6B5E4E',
  eco: '#B9770F', find: 'rgba(227,178,98,.55)', 'find-act': '#E3B262', ok: '#22704A', warn: '#A35F00', bad: '#B3261E', 'toast-act': '#E3B262',
  shadow: '0 1px 2px rgba(42,34,27,.07),0 10px 30px rgba(42,34,27,.08)', 'shadow-pop': '0 12px 40px rgba(42,34,27,.22),0 2px 6px rgba(42,34,27,.12)'
};
const BASE_D = {
  bg: '#0E0C0B', sheet: '#171411', raised: '#1F1B17', sunk: '#0A0908', ink: '#EEE6D8', soft: '#B5A893', faint: '#857965',
  line: 'rgba(238,230,216,.12)', line2: 'rgba(238,230,216,.24)', accent: '#E3B262', 'accent-ink': '#1B1408', 'accent-soft': 'rgba(227,178,98,.14)', sel: 'rgba(227,178,98,.38)',
  'rep-bg': 'rgba(227,178,98,.26)', 'rep-fg': '#F0C77A', 'dud-bg': 'rgba(236,104,132,.24)', 'dud-fg': '#F59AAE', 'coh-bg': 'rgba(120,160,240,.25)', 'coh-fg': '#9DB4FF',
  'bien-bg': 'rgba(111,217,191,.20)', 'bien-fg': '#6FD9BF', 'ort-bg': 'rgba(255,128,110,.24)', 'ort-fg': '#FF8D7E', 'rec-bg': 'rgba(170,140,240,.26)', 'rec-fg': '#C3ADF5',
  'pend-bg': 'rgba(181,168,147,.20)', 'pend-fg': '#B5A893', eco: '#E3B262', find: 'rgba(227,178,98,.33)', 'find-act': 'rgba(227,178,98,.7)',
  ok: '#93E39F', warn: '#F0C77A', bad: '#FF8D7E', 'toast-act': '#8A5C16',
  shadow: '0 1px 2px rgba(0,0,0,.4),0 10px 30px rgba(0,0,0,.35)', 'shadow-pop': '0 14px 44px rgba(0,0,0,.6),0 2px 6px rgba(0,0,0,.4)'
};
const PRESETS = {
  papel: { n: 'Papel', l: {}, d: {} },
  sepia: { n: 'Sepia', l: { bg: '#E7DCC4', sheet: '#F5ECD7', raised: '#EFE3CA', sunk: '#DACDB2', ink: '#3A2E21', soft: '#73624C', faint: '#9C8A70', accent: '#8B4A1F', 'accent-soft': 'rgba(139,74,31,.12)', sel: 'rgba(139,74,31,.2)' },
    d: { bg: '#18120C', sheet: '#211910', raised: '#2A2015', sunk: '#120D08', ink: '#EBDCC2', soft: '#C0A986', faint: '#8F7B5E', accent: '#E0A36A', 'accent-ink': '#1E1208', 'accent-soft': 'rgba(224,163,106,.15)', sel: 'rgba(224,163,106,.36)' } },
  niebla: { n: 'Niebla', l: { bg: '#E3E6EA', sheet: '#FBFCFD', raised: '#F1F3F6', sunk: '#D5DAE0', ink: '#1E2329', soft: '#58626E', faint: '#8B95A1', line: 'rgba(30,35,41,.12)', line2: 'rgba(30,35,41,.24)', accent: '#2F5D8A', 'accent-ink': '#FFFFFF', 'accent-soft': 'rgba(47,93,138,.12)', sel: 'rgba(47,93,138,.2)' },
    d: { bg: '#0E1114', sheet: '#161A1F', raised: '#1D2228', sunk: '#090B0D', ink: '#E5E9EE', soft: '#9CA6B2', faint: '#6C7682', line: 'rgba(229,233,238,.12)', line2: 'rgba(229,233,238,.24)', accent: '#8FB4E0', 'accent-ink': '#0B1622', 'accent-soft': 'rgba(143,180,224,.15)', sel: 'rgba(143,180,224,.35)' } },
  bosque: { n: 'Bosque', l: { bg: '#DFE5DA', sheet: '#F8FAF4', raised: '#EEF2E9', sunk: '#D0D8CA', ink: '#1E291F', soft: '#55645A', faint: '#87958A', line: 'rgba(30,41,31,.13)', line2: 'rgba(30,41,31,.25)', accent: '#2F6B45', 'accent-ink': '#FFFFFF', 'accent-soft': 'rgba(47,107,69,.12)', sel: 'rgba(47,107,69,.2)' },
    d: { bg: '#0D120E', sheet: '#141B15', raised: '#1B241C', sunk: '#080B08', ink: '#E2EBE0', soft: '#9DAF9F', faint: '#6E7F71', line: 'rgba(226,235,224,.12)', line2: 'rgba(226,235,224,.24)', accent: '#7FC79A', 'accent-ink': '#0B1A10', 'accent-soft': 'rgba(127,199,154,.15)', sel: 'rgba(127,199,154,.33)' } },
  contraste: { n: 'Alto contraste', l: { bg: '#FFFFFF', sheet: '#FFFFFF', raised: '#F4F4F4', sunk: '#E6E6E6', ink: '#000000', soft: '#2E2E2E', faint: '#5A5A5A', line: 'rgba(0,0,0,.3)', line2: 'rgba(0,0,0,.55)', accent: '#0B4FBF', 'accent-ink': '#FFFFFF', 'accent-soft': 'rgba(11,79,191,.12)', sel: 'rgba(11,79,191,.25)' },
    d: { bg: '#000000', sheet: '#0B0B0B', raised: '#161616', sunk: '#000000', ink: '#FFFFFF', soft: '#E0E0E0', faint: '#B0B0B0', line: 'rgba(255,255,255,.3)', line2: 'rgba(255,255,255,.55)', accent: '#8DB8FF', 'accent-ink': '#00122E', 'accent-soft': 'rgba(141,184,255,.18)', sel: 'rgba(141,184,255,.4)' } }
};
const ACCENTS = ['#8A5C16', '#B3401F', '#2F5D8A', '#2F6B45', '#6541AC', '#A12541', '#1F2328'];
const LOOK_DEFAULT = { preset: 'papel', mode: 'auto', accent: null, textFont: 'Newsreader', titleFont: 'Instrument Serif', uiFont: 'Hanken Grotesk', textSize: 19, leading: 1.78, measure: 46, align: 'left', uiSize: 16, pad: 'normal', notes: 'right', paper: true, marks: 'normal' };

function hexRgb(hx) { const m = /^#?([0-9a-f]{6})$/i.exec(hx || ''); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function rgba(hx, a) { const c = hexRgb(hx); return c ? 'rgba(' + c.join(',') + ',' + a + ')' : hx; }
function mixHex(hx, to, t) { const a = hexRgb(hx), b = hexRgb(to); if (!a || !b) return hx; return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
function inkOn(hx) { const c = hexRgb(hx); if (!c) return '#FFFFFF'; const l = (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255; return l > 0.6 ? '#1B1408' : '#FFFFFF'; }

const Profile = {
  look: null, doc: null, coll: null, me: null, applied: '', saveSoon: null,
  load() {
    let l = {};
    try { l = JSON.parse(localStorage.getItem(LOOK_KEY) || '{}'); } catch (e) {}
    this.look = Object.assign({}, LOOK_DEFAULT, l);
    this.apply();
  },
  attach(coll) {
    this.coll = coll;
    if (RT.user && RT.me && RT.me !== 'local') RT.user.me().then(m => { this.me = m; if (App.view === 'home') App.renderHomeSoon(); }).catch(() => {});
  },
  myName() { const n = this.me && this.me.name; return n ? n.split(/\s+/)[0] : ''; },
  ready() {
    const d = this.coll && this.coll.get('_perfil');
    if (d && d.data) this.fromDoc(d.data);
  },
  onDoc(sd, kind) { if (kind !== 'local' && sd.data) this.fromDoc(sd.data); },
  fromDoc(data) {
    if (data.look) { this.look = Object.assign({}, LOOK_DEFAULT, data.look); try { localStorage.setItem(LOOK_KEY, JSON.stringify(this.look)); } catch (e) {} this.apply(); }
    if (data.prefs) { ['auto', 'ecos', 'hideDone', 'focusDim'].forEach(k => { if (k in data.prefs) App.prefs[k] = data.prefs[k]; }); App.savePrefs(); }
    if (UI.drawerOpen('perfil')) this.open(true);
  },
  persist() {
    try { localStorage.setItem(LOOK_KEY, JSON.stringify(this.look)); } catch (e) {}
    if (!this.coll || !RT.canWrite) return;
    let d = this.coll.get('_perfil');
    const prefs = { auto: !!App.prefs.auto, ecos: !!App.prefs.ecos, hideDone: !!App.prefs.hideDone, focusDim: App.prefs.focusDim !== false };
    if (!d) d = this.coll.create('_perfil', { type: 'perfil', look: clone(this.look), prefs: prefs });
    else d.update(x => { x.type = 'perfil'; x.look = clone(this.look); x.prefs = prefs; }, { silent: true });
  },
  set(k, v) { this.look[k] = v; this.apply(); if (!this.saveSoon) this.saveSoon = debounce(() => this.persist(), 700); this.saveSoon(); },
  ensureFont(spec) {
    if (!spec) return;
    const id = 'gf-' + spec.split(':')[0].replace(/\W/g, '');
    if (document.getElementById(id)) return;
    document.head.append(h('link', { id: id, rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=' + spec + '&display=swap' }));
  },
  font(kind, name) { return FONT_LIST[kind].find(x => x.n === name) || FONT_LIST[kind][0]; },
  apply() {
    const L0 = this.look, P = PRESETS[L0.preset] || PRESETS.papel;
    const L = Object.assign({}, BASE_L, P.l), D = Object.assign({}, BASE_D, P.d);
    if (L0.accent && hexRgb(L0.accent)) {
      const a = L0.accent, da = mixHex(a, '#FFFFFF', 0.38);
      Object.assign(L, { accent: a, 'accent-ink': inkOn(a), 'accent-soft': rgba(a, 0.12), sel: rgba(a, 0.22), 'toast-act': mixHex(a, '#FFFFFF', 0.45) });
      Object.assign(D, { accent: da, 'accent-ink': inkOn(da), 'accent-soft': rgba(da, 0.15), sel: rgba(da, 0.36), 'toast-act': a });
    }
    const vars = (o) => Object.keys(o).map(k => '--' + k + ':' + o[k]).join(';');
    let css = '';
    const custom = L0.preset !== 'papel' || L0.accent || L0.mode !== 'auto';
    if (custom) {
      if (L0.mode === 'claro') css += 'body.look{' + vars(L) + ';color-scheme:light}:root:not(#mde){color-scheme:light}';
      else if (L0.mode === 'oscuro') css += 'body.look{' + vars(D) + ';color-scheme:dark}:root:not(#mde){color-scheme:dark}';
      else css += 'body.look{' + vars(L) + '}@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) body.look{' + vars(D) + ';color-scheme:dark}}:root[data-theme="dark"] body.look{' + vars(D) + ';color-scheme:dark}';
    }
    const tf = this.font('text', L0.textFont), df = this.font('display', L0.titleFont), uf = this.font('ui', L0.uiFont);
    [tf, df, uf].forEach(f => this.ensureFont(f.g));
    const pad = { estrechos: '2rem', normal: '4rem', amplios: '6.5rem' }[L0.pad] || '4rem';
    css += 'body.look{--f-text:' + tf.f + ';--f-display:' + (df.f || tf.f) + ';--f-ui:' + uf.f + ';--text-size:' + (+L0.textSize || 19) + 'px;--leading:' + (+L0.leading || 1.78) + ';--measure:' + (+L0.measure || 46) + 'rem;--pad-x:' + pad + '}';
    let st = document.getElementById('look-css');
    if (!st) { st = h('style', { id: 'look-css' }); document.head.append(st); }
    if (st.textContent !== css) st.textContent = css;
    document.documentElement.style.fontSize = (+L0.uiSize || 16) + 'px';
    const b = document.body;
    b.classList.add('look');
    b.classList.toggle('justify', L0.align === 'justify');
    b.classList.toggle('flat', L0.paper === false);
    b.classList.toggle('notes-left', L0.notes === 'left');
    b.classList.toggle('marks-soft', L0.marks === 'suaves');
    b.classList.toggle('marks-strong', L0.marks === 'intensas');
    if (window.Editor && Editor.root) { Editor.layoutSoon(); setTimeout(() => Editor.layoutSoon(), 400); }
  },

  reviewSection(sec) {
    const chk = (key, label, def) => { const c = h('input', { type: 'checkbox', checked: def ? App.prefs[key] !== false : App.prefs[key] === true }); c.addEventListener('change', () => { App.prefs[key] = c.checked; App.savePrefs(); this.persist(); }); return h('label', { class: 'row', style: 'font-size:.9rem' }, c, h('span', { text: label })); };
    if (!RT.web) return sec('Revisor', chk('autoLocal', 'Revisión rápida (sin IA) mientras escribo', true), chk('auto', 'Revisar con Claude al hacer una pausa', true));
    const st = h('p', { class: 'muted', style: 'margin:0;font-size:.85rem', text: AI.ready() ? 'IA configurada: ' + (AI.cfg().provider === 'anthropic' ? 'Anthropic' : AI.cfg().provider === 'openai' ? 'OpenAI' : 'servicio compatible') + ' · ' + AI.cfg().model + '.' : 'Sin IA configurada. La revisión rápida funciona igual.' });
    return sec('Revisor', chk('autoLocal', 'Revisión rápida (sin IA) mientras escribo', true), chk('autoAI', 'Revisión con IA al hacer una pausa (usa tu clave)', false), h('div', { class: 'row' }, st, btn(AI.ready() ? 'Cambiar IA' : 'Configurar IA', () => AI.open(), 'small')));
  },
  dataSection(sec) {
    const file = h('input', { type: 'file', accept: '.json', class: 'sr', id: 'restore-all' });
    file.addEventListener('change', () => { if (file.files[0]) WebBackup.restore(file.files[0]); });
    const usage = h('p', { class: 'muted', style: 'margin:0;font-size:.82rem' });
    if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(e => { usage.textContent = 'Usando ' + (e.usage / 1048576).toFixed(1).replace('.', ',') + ' MB en este navegador.'; }).catch(() => {});
    return sec('Tus datos',
      h('p', { class: 'muted', style: 'margin:0;font-size:.85rem', text: 'Sin cuenta, tus textos viven solo en este navegador. Descarga un respaldo de vez en cuando; con él puedes llevarlos a otro computador.' }),
      h('div', { class: 'row' }, btn('Descargar respaldo completo', () => WebBackup.download(), 'small'), h('label', { class: 'btn small', for: 'restore-all', text: 'Restaurar respaldo' }), file),
      usage);
  },
  /* ---------- panel ---------- */
  open(keep) {
    const body = h('div', { class: 'look-panel' });
    const L = this.look;
    const seg = (key, opts) => {
      const g = h('div', { class: 'seg', role: 'radiogroup' });
      opts.forEach(([v, l]) => g.append(h('button', { type: 'button', role: 'radio', 'aria-checked': L[key] === v ? 'true' : 'false', text: l, onclick: () => { this.set(key, v); $$('button', g).forEach(x => x.setAttribute('aria-checked', x.textContent === l ? 'true' : 'false')); } })));
      return g;
    };
    const range = (key, min, max, step, fmt) => {
      const out = h('span', { class: 'rv', text: fmt(L[key]) });
      const r = h('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(L[key]), 'aria-label': key });
      r.addEventListener('input', () => { out.textContent = fmt(+r.value); this.set(key, +r.value); });
      return h('div', { class: 'rng' }, r, out);
    };
    const sel = (key, kind) => {
      const s = h('select', { class: 'sel', 'aria-label': key });
      FONT_LIST[kind].forEach(f => s.append(h('option', { value: f.n, text: f.n + (f.d ? ' · ' + f.d : '') })));
      s.value = L[key];
      s.addEventListener('change', () => { this.set(key, s.value); prev(); });
      return s;
    };
    const sample = h('p', { class: 'sample', text: 'Y con eso sellaba la última carta que escribiría. Ya no le quedaban palabras por entregar.' });
    const sampleT = h('p', { class: 'sample-t', text: 'Capítulo uno' });
    const prev = () => { sample.style.fontFamily = this.font('text', this.look.textFont).f; const d = this.font('display', this.look.titleFont); sampleT.style.fontFamily = d.f || this.font('text', this.look.textFont).f; };
    prev();
    const who = h('div', { class: 'who-box' });
    if (this.me) {
      if (this.me.avatarUrl) who.append(h('img', { src: this.me.avatarUrl, alt: '', class: 'av' }));
      who.append(h('div', null, h('b', { text: this.me.name || 'Tu cuenta' }), h('div', { class: 'muted', style: 'font-size:.8rem', text: App.colls.team ? 'Tus proyectos privados solo los ves tú. Esta apariencia se guarda en tu perfil y te sigue en cualquier dispositivo.' : 'Esta apariencia se guarda en este navegador.' })));
    } else who.append(h('div', { class: 'muted', style: 'font-size:.85rem', text: RT.web ? 'Todo se guarda en este navegador: tus proyectos, tu apariencia y tu clave de IA.' : RT.local ? 'Modo local: tu apariencia se guarda en este navegador.' : 'Tu apariencia se guarda en tu perfil.' }));
    body.append(who);

    const presets = h('div', { class: 'presets' });
    Object.keys(PRESETS).forEach(k => {
      const p = PRESETS[k], l = Object.assign({}, BASE_L, p.l), d = Object.assign({}, BASE_D, p.d);
      const b = h('button', { type: 'button', class: 'preset', 'aria-pressed': L.preset === k ? 'true' : 'false', title: p.n, onclick: () => { this.set('preset', k); $$('.preset', presets).forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); } },
        h('span', { class: 'sw', style: 'background:linear-gradient(135deg,' + l.bg + ' 0 50%,' + d.bg + ' 50% 100%)' }, h('i', { style: 'background:' + l.sheet + ';border-color:' + l.accent }), h('i', { style: 'background:' + d.sheet + ';border-color:' + d.accent })),
        h('span', { text: p.n }));
      presets.append(b);
    });
    const acc = h('div', { class: 'accents' });
    const picker = h('input', { type: 'color', value: L.accent || '#8A5C16', 'aria-label': 'Color de acento a elección' });
    picker.addEventListener('input', () => this.set('accent', picker.value));
    ACCENTS.forEach(c => acc.append(h('button', { type: 'button', class: 'acc', style: 'background:' + c, title: c, 'aria-label': 'Acento ' + c, onclick: () => { picker.value = c; this.set('accent', c); } })));
    acc.append(picker, btn('Del tema', () => this.set('accent', null), 'small ghost'));

    const sec = (title, ...kids) => h('section', { class: 'lk' }, h('h4', { text: title }), ...kids);
    const row = (label, ctl) => h('div', { class: 'lrow' }, h('span', { text: label }), ctl);
    body.append(
      sec('Tema', presets, row('Modo', seg('mode', [['auto', 'Automático'], ['claro', 'Claro'], ['oscuro', 'Oscuro']])), row('Acento', acc)),
      sec('Texto', h('div', { class: 'samples' }, sampleT, sample),
        row('Tipografía', sel('textFont', 'text')),
        row('Tamaño', range('textSize', 14, 28, 1, v => v + ' px')),
        row('Interlineado', range('leading', 1.3, 2.3, 0.05, v => (+v).toFixed(2).replace('.', ','))),
        row('Alineación', seg('align', [['left', 'Izquierda'], ['justify', 'Justificado']])),
        row('Títulos', sel('titleFont', 'display'))),
      sec('Diagramación',
        row('Ancho de la hoja', range('measure', 30, 62, 1, v => v < 38 ? 'angosta' : v > 52 ? 'ancha' : 'media')),
        row('Márgenes', seg('pad', [['estrechos', 'Estrechos'], ['normal', 'Normales'], ['amplios', 'Amplios']])),
        row('Hoja', seg('paper', [[true, 'Papel'], [false, 'Sin hoja']])),
        row('Notas', seg('notes', [['right', 'A la derecha'], ['left', 'A la izquierda']])),
        row('Marcas', seg('marks', [['suaves', 'Suaves'], ['normal', 'Normales'], ['intensas', 'Intensas']]))),
      sec('Interfaz',
        row('Tipografía', sel('uiFont', 'ui')),
        row('Tamaño', range('uiSize', 13, 20, 1, v => v + ' px'))),
      this.reviewSection(sec)
    );
    if (RT.web) body.append(this.dataSection(sec));
    const foot = h('div', { class: 'row', style: 'width:100%' }, btn('Restablecer todo', () => { this.look = Object.assign({}, LOOK_DEFAULT); this.apply(); this.persist(); this.open(true); }, 'small'), h('span', { class: 'spacer' }), btn('Listo', () => UI.closeDrawer(), 'primary'));
    if (keep && UI.drawerOpen('perfil')) { const st = UI.drawerState; st.body.textContent = ''; st.body.append(body); return; }
    UI.drawer({ title: 'Tu perfil y apariencia', key: 'perfil', body: body, foot: foot });
  }
};
window.Profile = Profile;
Profile.load();
