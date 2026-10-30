/* ============ motor de coherencia sin IA: cruza el texto con los datos de la biblia ============ */
const NUM_WORDS = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
  veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50,
  sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100, medio: 0.5, media: 0.5
};
/* Convierte «42», «cuarenta y dos» o «veintisiete» en número. */
function parseNum(s) {
  if (!s) return null;
  const t = fold(s.trim());
  if (/^\d+([.,]\d+)?$/.test(t)) return parseFloat(t.replace(',', '.'));
  const parts = t.split(/\s+y\s+|\s+/).filter(Boolean);
  let n = 0;
  for (const p of parts) { if (!(p in NUM_WORDS)) return null; n += NUM_WORDS[p]; }
  return parts.length ? n : null;
}
const NUM_RE = '(\\d+(?:[.,]\\d+)?|(?:(?:veinti\\p{L}+|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa)(?:\\s+y\\s+(?:un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve))?)|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieci\\p{L}+|cien|medio|media)';
const UNIT_MONTHS = { ano: 12, anos: 12, mes: 1, meses: 1, semana: 0.23, semanas: 0.23, dia: 0.033, dias: 0.033, decada: 120, decadas: 120 };
const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const MESES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const NOT_NAMES = new Set(['dios', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo', 'senor', 'senora', 'don', 'dona', 'capitulo', 'navidad', 'internet'].concat(MESES_L));

const Coherence = {
  cache: new Map(),
  field(it, re) { const f = it.fields || {}; const k = Object.keys(f).find(x => re.test(x)); return k ? (f[k] || '').trim() : ''; },
  chars(P) {
    const out = [];
    ((P && P.bible && P.bible.sections) || []).forEach(s => {
      const isChar = s.graph || /personaj/i.test(s.label);
      (s.items || []).forEach(it => {
        const title = (it.title || '').trim(); if (!title) return;
        const alias = this.field(it, /tambi[eé]n llamado|alias|apodo/i).split(',').map(x => x.trim()).filter(Boolean);
        const edadTxt = this.field(it, /^edad/i);
        const edadM = edadTxt.match(new RegExp(NUM_RE, 'iu'));
        const estado = this.field(it, /^estado/i).toLowerCase();
        out.push({ id: it.id, isChar: isChar, title: title, names: [title].concat(alias), age: edadM ? parseNum(edadM[1]) : null, dead: /\b(muert[oa]|falleci[oó]|fallecid[oa]|murió|difunt[oa])\b/.test(estado) && isChar });
      });
    });
    return out;
  },
  /* Datos del capítulo completo (se calcula una vez por versión del texto). */
  chapterFacts(paras) {
    const key = paras.map(p => p.id + ':' + parText(p).length).join('|');
    const hit = this.cache.get(key); if (hit) return hit;
    const caps = new Map();
    const durs = [];
    paras.forEach(p => {
      const t = parText(p);
      const re = /[\p{L}]+/gu; let m;
      while ((m = re.exec(t))) {
        if (!/^\p{Lu}\p{Ll}+$/u.test(m[0]) || m[0].length < 3) continue;
        const before = t.slice(0, m.index).replace(/[«"“'(—–\-\s]+$/, '');
        const start = !before || /[.!?…:]$/.test(before);
        const k = m[0]; const e = caps.get(k) || { n: 0, mid: 0, pid: null }; e.n++;
        if (!start) { e.mid++; if (!e.pid) e.pid = p.id; }
        caps.set(k, e);
      }
      const rd = new RegExp('(?<![\\p{L}])(?:hace\\s+)?(?:unos\\s+|unas\\s+|casi\\s+|más\\s+de\\s+)?' + NUM_RE + '\\s+(años|año|meses|mes|semanas|semana|días|día|décadas|década)(?![\\p{L}])', 'giu');
      while ((m = rd.exec(t))) {
        const n = parseNum(m[1]); const u = UNIT_MONTHS[fold(m[2])];
        if (n != null && u) durs.push({ pid: p.id, text: m[0].trim(), months: n * u, unit: fold(m[2]).replace(/s$/, ''), at: m.index });
      }
    });
    const res = { caps: caps, durs: durs };
    this.cache.set(key, res);
    if (this.cache.size > 30) this.cache.delete(this.cache.keys().next().value);
    return res;
  },
  check(P, paras, i, text, add, on) {
    const p = paras[i];
    const chars = this.chars(P);
    const allNames = new Set(); chars.forEach(c => c.names.forEach(n => n.split(/\s+/).forEach(w => allNames.add(fold(w)))));
    const sents = sentences(text);
    // edades que no coinciden con la biblia: «Ana, de 40 años» o «Ana tiene 40 años»
    if (on('age')) chars.filter(c => c.isChar && c.age).forEach(c => {
      sents.forEach(s => {
        if (/\b(cuando|hace|de niñ|de joven|tendría|tendrá|cumplirá|cumpliría|antes|después|años atrás)\b/i.test(s)) return;
        c.names.forEach(n => {
          const rr = new RegExp('(?<![\\p{L}])' + escRe(n) + '(?:,\\s*(?:de|con)\\s+|\\s+(?:ya\\s+)?(?:tiene|tenía|cumple|cumplía)\\s+)' + NUM_RE + '\\s+años(?![\\p{L}])', 'gu'); let m;
          while ((m = rr.exec(s))) { const v = parseNum(m[1]); if (v != null && v !== c.age) add('coh', 'age', m[0], 'En la biblia, ' + c.title + ' tiene ' + c.age + ' años. Si es otro momento de la historia, ignóralo.'); }
        });
      });
    });
    // personajes que en la biblia murieron
    if (on('dead')) chars.filter(c => c.dead).forEach(c => {
      c.names.forEach(n => {
        const rr = new RegExp('(?<![\\p{L}])' + escRe(n) + '\\s+(?:dijo|respondió|preguntó|sonrió|gritó|llegó|entró|abrió|miró|caminó|llamó|escribió)(?![\\p{L}])', 'gu'); let m;
        while ((m = rr.exec(text))) add('coh', 'dead', m[0], 'En la biblia, ' + c.title + ' está muerto. ¿Es un recuerdo o un error?');
      });
    });
    // variantes juntas o separadas: «Rosa María» / «Rosamaría»
    if (on('name')) chars.forEach(c => c.names.filter(n => /\s/.test(n)).forEach(n => {
      const joined = n.replace(/\s+/g, '');
      const rr = new RegExp('(?<![\\p{L}])' + escRe(joined) + '(?![\\p{L}])', 'giu'); let m;
      while ((m = rr.exec(text))) if (m[0] !== n) add('coh', 'name', m[0], 'En la biblia se escribe «' + n + '».', n);
    }));
    const facts = this.chapterFacts(paras);
    // personajes que aparecen seguido y no tienen ficha
    const hasChars = ((P.bible && P.bible.sections) || []).some(z => z.graph || /personaj/i.test(z.label));
    if (on('noficha') && hasChars) facts.caps.forEach((e, w) => {
      if (e.pid !== p.id || e.n < 3 || !e.mid) return;
      const f = fold(w);
      if (allNames.has(f) || NOT_NAMES.has(f)) return;
      if (((P.dictionary || []).concat(P.noFicha || [])).includes(w)) return;
      add('coh', 'noficha', w, '«' + w + '» aparece ' + e.n + ' veces y no tiene ficha en la biblia.', '', w);
    });
    // duraciones parecidas pero distintas en el mismo capítulo
    if (on('dur')) {
      const mine = facts.durs.filter(d => d.pid === p.id);
      mine.forEach(d => {
        const other = facts.durs.find(o => o !== d && o.unit !== d.unit && o.months !== d.months && Math.max(o.months, d.months) / Math.min(o.months, d.months) <= 1.5 && (o.pid !== d.pid || o.at < d.at));
        if (other) add('coh', 'dur', d.text, '«' + other.text + '» y «' + d.text + '» no coinciden del todo (' + Math.round(other.months) + ' y ' + Math.round(d.months) + ' meses). ¿Es intencional?');
      });
    }
    // fechas con día de la semana
    if (on('date')) {
      const rr = new RegExp('(?<![\\p{L}])(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo),?\\s+(\\d{1,2})\\s+de\\s+(' + MESES_L.join('|') + ')\\s+(?:de|del)\\s+(\\d{4})', 'giu'); let m;
      while ((m = rr.exec(text))) {
        const d = new Date(+m[4], MESES_L.indexOf(m[3].toLowerCase()), +m[2]);
        const real = DIAS[d.getDay()];
        if (d.getDate() === +m[2] && fold(m[1]) !== real) add('coh', 'date', m[0], 'El ' + m[2] + ' de ' + m[3].toLowerCase() + ' de ' + m[4] + ' fue ' + ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][d.getDay()] + ', no ' + m[1].toLowerCase() + '.');
      }
    }
  },
  /* Crea la ficha de un nombre detectado. */
  addCard(word) {
    let sid = null;
    App.proj().update(x => {
      x.bible = x.bible || { sections: [] };
      let s = x.bible.sections.find(z => z.graph || /personaj/i.test(z.label));
      if (!s) { s = { id: uid('s'), label: 'Personajes', fields: ['Rol', 'Edad', 'Estado', 'También llamado'], graph: true, items: [] }; x.bible.sections.unshift(s); }
      sid = s.id;
      if (!s.items.some(it => (it.title || '') === word)) s.items.push({ id: uid('i'), title: word, fields: {}, body: '' });
    }, { now: true });
    App.chapterList().forEach(c => {
      const d = App.ch(c.id); if (!d || !d.data) return;
      if (allMarks(d.data).some(x => x.m.rule === 'noficha' && x.m.word === word)) d.update(x => { x.paras.forEach(p => { p.segs = normSegs(p.segs.map(s => (s.m && s.m.rule === 'noficha' && s.m.word === word) ? { t: s.m.text } : s)); }); }, { silent: true });
    });
    if (Editor.root) { Editor.render(true); Editor.afterChange(); }
    App.toast('Ficha de «' + word + '» creada en la biblia.', { action: { label: 'Ver', fn: () => App.go('p-' + App.pid + '-biblia') } });
  },
  ignore(word) {
    App.proj().update(x => { x.noFicha = x.noFicha || []; if (!x.noFicha.includes(word)) x.noFicha.push(word); }, { now: true });
    App.chapterList().forEach(c => {
      const d = App.ch(c.id); if (!d || !d.data) return;
      if (allMarks(d.data).some(x => x.m.rule === 'noficha' && x.m.word === word)) d.update(x => { x.paras.forEach(p => { p.segs = normSegs(p.segs.map(s => (s.m && s.m.rule === 'noficha' && s.m.word === word) ? { t: s.m.text } : s)); }); }, { silent: true });
    });
    if (Editor.root) { Editor.render(true); Editor.afterChange(); }
  }
};
window.Coherence = Coherence;
