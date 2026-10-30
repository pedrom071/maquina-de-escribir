/* ============ utilidades ============ */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

function h(tag, attrs) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'style') e.style.cssText = v;
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else if (k === 'value') e.value = v;
    else if (k === 'checked') e.checked = !!v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (let i = 2; i < arguments.length; i++) add(e, arguments[i]);
  return e;
}
function add(e, c) {
  if (c == null || c === false) return;
  if (Array.isArray(c)) { c.forEach(x => add(e, x)); return; }
  e.append(c.nodeType ? c : String(c));
}

const uid = (p) => (p || '') + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 7);
const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
const nf = new Intl.NumberFormat('es-CL');
const fmtN = (n) => nf.format(n || 0);
function dayKey(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.getDate() + ' ' + MESES[d.getMonth()] + ' ' + d.getFullYear() + ', ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
function relTime(ts) {
  if (!ts) return '';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 45) return 'recién';
  if (s < 3600) return 'hace ' + Math.round(s / 60) + ' min';
  if (s < 86400) return 'hace ' + Math.round(s / 3600) + ' h';
  if (s < 86400 * 7) { const d = Math.round(s / 86400); return 'hace ' + d + (d === 1 ? ' día' : ' días'); }
  return fmtDate(ts).split(',')[0];
}
function countWords(s) {
  if (!s) return 0;
  const m = s.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu);
  return m ? m.length : 0;
}
function foldChar(c) { const f = c.normalize('NFD').replace(/\p{M}/gu, ''); return f.length === 1 ? f.toLowerCase() : c.toLowerCase(); }
function fold(s) { let o = ''; for (const c of s) o += foldChar(c); return o; }
function debounce(fn, ms) {
  let t = null;
  const d = function () { const a = arguments, self = this; clearTimeout(t); t = setTimeout(() => { t = null; fn.apply(self, a); }, ms); };
  d.cancel = () => { clearTimeout(t); t = null; };
  d.flush = () => { if (t) { clearTimeout(t); t = null; fn(); } };
  return d;
}
function rafThrottle(fn) {
  let q = false;
  return function () { if (q) return; q = true; requestAnimationFrame(() => { q = false; fn(); }); };
}
function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function plural(n, s, p) { return fmtN(n) + ' ' + (n === 1 ? s : (p || s + 's')); }
function slug(s) { return fold(s || 'texto').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'texto'; }
function cleanInvisible(s) { return (s || '').replace(/[­​-‏‪-‮⁠-⁯﻿]/g, ''); }
function utf8Bytes(s) { return new TextEncoder().encode(s).length; }
function truncBytes(s, max) {
  if (utf8Bytes(s) <= max) return s;
  let lo = 0, hi = s.length;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (utf8Bytes(s.slice(0, mid)) <= max - 3) lo = mid; else hi = mid - 1; }
  return s.slice(0, lo) + '…';
}
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
const MOD = isMac ? '⌘' : 'Ctrl';

const STOP = new Set(('a al algo algun alguna algunas alguno algunos ante antes aquel aquella aquellas aquello aquellos aqui ahi alli ahora asi aun aunque bajo bien cada casi como con contra cual cuales cualquier cuando cuanto de del desde donde dos durante el ella ellas ello ellos en entre era eran eres es esa esas ese eso esos esta estaba estaban estado estamos estan estar estas este esto estos estoy fue fueron fui ha habia habian haber hace hacia han has hasta hay he la las le les lo los mas me mi mia mientras mis mucho muchos muy nada ni no nos nosotros nuestra nuestro o os otra otras otro otros para pero poco por porque pues que quien quienes se sea segun ser si sido siempre sin sino sobre solo son su sus tal tambien tan tanto te tenia tener tiene tienen toda todas todo todos tras tu tus un una unas uno unos usted vez y ya yo ese esa cosa cosas mismo misma luego entonces cuya cuyo menos dijo decir hacer puede podia sus nuestras vosotros donde').split(' '));

/* ============ marcas: tipos ============ */
const TYPES = {
  rep: { g: '↻', l: 'Repetición', s: 'repetición' },
  dud: { g: '?', l: 'No se entiende', s: 'no se entiende' },
  coh: { g: '≠', l: 'Coherencia', s: 'coherencia' },
  bien: { g: '✓', l: 'Funciona', s: 'funciona' },
  ort: { g: '✎', l: 'Ortografía', s: 'ortografía' },
  rec: { g: '◇', l: 'Voz y recurso', s: 'voz y recurso' },
  pend: { g: '…', l: 'Pendiente', s: 'pendiente' }
};
const TKEYS = Object.keys(TYPES);

/* ============ tipos de proyecto ============ */
const KINDS = {
  novela: {
    label: 'Novela', unit: 'Capítulo', units: 'Capítulos', timeline: true,
    sections: [
      { label: 'Personajes', fields: ['Rol', 'Edad', 'Estado', 'Rasgos', 'También llamado'], graph: true },
      { label: 'Lugares', fields: ['Descripción'], graph: false },
      { label: 'Mundo y reglas', fields: [] },
      { label: 'Glosario', fields: [] }
    ],
    guide: 'Soy el autor. Revisa coherencia (hechos, fechas, edades, nombres, quién narra y qué sabe), repeticiones, frases confusas y ortografía, y señala lo que funciona. No propongas tramas, escenas, giros ni reescrituras: el contenido lo decido yo.'
  },
  cuento: {
    label: 'Cuento', unit: 'Parte', units: 'Partes', timeline: true,
    sections: [
      { label: 'Personajes', fields: ['Rol', 'Edad', 'Estado', 'Rasgos'], graph: true },
      { label: 'Lugares', fields: ['Descripción'] },
      { label: 'Motivos', fields: [] }
    ],
    guide: 'Soy el autor. Revisa coherencia, repeticiones, frases confusas y ortografía, y señala lo que funciona. No propongas tramas ni reescrituras.'
  },
  ensayo: {
    label: 'Ensayo', unit: 'Sección', units: 'Secciones', timeline: false,
    sections: [
      { label: 'Tesis y argumentos', fields: ['Tipo'] },
      { label: 'Fuentes', fields: ['Autor', 'Año', 'Enlace'] },
      { label: 'Datos', fields: ['Fuente'] }
    ],
    guide: 'Revisa claridad del argumento, saltos lógicos, datos que necesiten fuente, repeticiones, frases demasiado largas y ortografía. No cambies mi postura ni reescribas el texto.'
  },
  columna: {
    label: 'Columna', unit: 'Sección', units: 'Secciones', timeline: false,
    sections: [
      { label: 'Ideas clave', fields: [] },
      { label: 'Fuentes', fields: ['Autor', 'Enlace'] },
      { label: 'Datos', fields: ['Fuente'] }
    ],
    guide: 'Columna de opinión para prensa. Revisa claridad, datos que necesiten fuente, repeticiones, frases largas y ortografía. No cambies mi postura ni reescribas el texto.'
  },
  guion: {
    label: 'Guion', unit: 'Escena', units: 'Escenas', timeline: true,
    sections: [
      { label: 'Personajes', fields: ['Rol', 'Rasgos'], graph: true },
      { label: 'Locaciones', fields: ['Descripción'] }
    ],
    guide: 'Revisa coherencia entre escenas, repeticiones, diálogos confusos y ortografía. No propongas escenas nuevas ni reescrituras.'
  },
  poesia: {
    label: 'Poesía', unit: 'Poema', units: 'Poemas', timeline: false,
    sections: [{ label: 'Imágenes y motivos', fields: [] }],
    guide: 'Revisa repeticiones no buscadas, ortografía y versos que se entiendan mal. No reescribas versos ni propongas imágenes.'
  },
  otro: {
    label: 'Otro', unit: 'Sección', units: 'Secciones', timeline: false,
    sections: [{ label: 'Notas', fields: [] }],
    guide: 'Revisa claridad, repeticiones y ortografía. No reescribas el contenido.'
  }
};
function kindOf(p) { return KINDS[(p && p.kind) || 'otro'] || KINDS.otro; }

function newProjectData(title, kind, goal) {
  const k = KINDS[kind] || KINDS.otro;
  const cid = uid('c');
  return {
    pid: null,
    data: {
      title: title || 'Sin título', kind: kind, goal: goal || 0, guide: k.guide,
      review: { types: ['rep', 'dud', 'coh', 'bien', 'ort', 'rec'], density: 'normal' },
      style: { paragraph: 'sangria' },
      chapters: [{ id: cid, title: k.unit + ' 1' }],
      trash: [],
      bible: { sections: k.sections.map(s => ({ id: uid('s'), label: s.label, fields: s.fields.slice(), graph: !!s.graph, items: [] })) },
      timeline: [], decisions: [], threads: [],
      relations: { nodes: {}, edges: [] },
      days: {}, stats: { words: 0, chapters: 1 },
      createdAt: Date.now(), createdBy: null, trashed: false
    },
    cid: cid
  };
}

function autoGrow(t) {
  const fit = () => { t.style.height = 'auto'; t.style.height = (t.scrollHeight + 2) + 'px'; };
  fit();
  if (!t._ag) { t._ag = true; t.addEventListener('input', fit); }
}
