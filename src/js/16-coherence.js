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
        out.push({ id: it.id, isChar: isChar, sl: s.label || '', title: title, names: [title].concat(alias), age: edadM ? parseNum(edadM[1]) : null, dead: /\b(muert[oa]|falleci[oó]|fallecid[oa]|murió|difunt[oa])\b/.test(estado) && isChar });
      });
    });
    return out;
  },
  /* Hechos del proyecto completo, en el orden del libro: edades dichas, muertes y formas de escribir cada nombre. */
  projectFacts(P) {
    const chs = App.chapterList();
    const key = chs.map(c => { const d = App.ch(c.id); return c.id + ':' + (d && d.data ? d.data.paras.length + '.' + d.data.paras.reduce((n, q) => n + parText(q).length, 0) : 0); }).join('|') + '#' + JSON.stringify((P.bible && P.bible.sections || []).map(s => (s.items || []).map(i => i.title + (i.fields ? JSON.stringify(i.fields) : ''))));
    if (this._pf && this._pfKey === key) return this._pf;
    const chars = this.chars(P).filter(c => c.isChar);
    const ages = new Map(), deaths = new Map(), after = [], forms = [];
    const counts = new Map();
    const DEATH = (n) => new RegExp('(?:(?<![\\p{L}])' + escRe(n) + '(?:\\s+\\p{L}+){0,3}\\s+(?:murió|falleció|se murió|está muert[oa]|había muerto)(?![\\p{L}])|(?:la muerte|el entierro|el funeral|el velorio|el cadáver|la tumba) de ' + escRe(n) + '(?![\\p{L}]))', 'iu');
    const ACT = (n) => new RegExp('(?<![\\p{L}])' + escRe(n) + '\\s+(?:dijo|respondió|preguntó|sonrió|gritó|llegó|entró|abrió|miró|caminó|llamó|escribió|contestó|susurró)(?![\\p{L}])', 'gu');
    chs.forEach((c, ci) => {
      const d = App.ch(c.id); if (!d || !d.data) return;
      const where = c.title || Pages.label(c);
      d.data.paras.forEach((q, qi) => {
        const t = parText(q); if (!t.trim()) return;
        chars.forEach(ch => {
          ch.names.forEach(n => {
            // edades
            sentences(t).forEach(sn => {
              if (/\b(cuando|hace|de niñ|de joven|tendría|tendrá|cumplirá|cumpliría|antes|después|años atrás)\b/i.test(sn)) return;
              const rr = new RegExp('(?<![\\p{L}])' + escRe(n) + '(?:,\\s*(?:de|con)\\s+|\\s+(?:ya\\s+)?(?:tiene|tenía|cumple|cumplía)\\s+)' + NUM_RE + '\\s+años(?![\\p{L}])', 'gu'); let m;
              while ((m = rr.exec(sn))) { const v = parseNum(m[1]); if (v == null) continue; if (!ages.has(ch.id)) ages.set(ch.id, []); ages.get(ch.id).push({ pid: q.id, v: v, text: m[0], name: ch.title, where: where }); }
            });
            // muertes y lo que pasa después
            if (!deaths.has(ch.id) && DEATH(n).test(t)) deaths.set(ch.id, { ci: ci, qi: qi, where: where });
            const dd = deaths.get(ch.id);
            if (dd && (ci > dd.ci || (ci === dd.ci && qi > dd.qi))) { const ra = ACT(n); let m; while ((m = ra.exec(t))) after.push({ pid: q.id, text: m[0], name: ch.title, where: dd.where }); }
          });
          // formas de escribir los nombres compuestos («Rosa María» / «Rosamaría»)
          ch.names.filter(n => /\s/.test(n)).forEach(n => {
            const joined = n.replace(/\s+/g, '');
            [[n, new RegExp('(?<![\\p{L}])' + escRe(n) + '(?![\\p{L}])', 'gu')], [joined, new RegExp('(?<![\\p{L}])' + escRe(joined) + '(?![\\p{L}])', 'giu')]].forEach(([form, re]) => {
              let m; while ((m = re.exec(t))) { const k = ch.id + '|' + n; if (!counts.has(k)) counts.set(k, { n: n, joined: joined, sep: [], join: [] }); counts.get(k)[form === n ? 'sep' : 'join'].push({ pid: q.id, text: m[0] }); }
            });
          });
        });
      });
    });
    counts.forEach(cn => {
      if (!cn.sep.length || !cn.join.length) return; // el texto es consistente: manda el texto
      const main = cn.sep.length >= cn.join.length ? cn.n : cn.join[0].text;
      (main === cn.n ? cn.join : cn.sep).forEach(x => forms.push({ pid: x.pid, text: x.text, main: main }));
    });
    const allText = chs.map(c => { const d = App.ch(c.id); return d && d.data ? d.data.paras.map(parText).join('\n') : ''; }).join('\n');
    this._pf = { ages: Array.from(ages.values()), after: after, forms: forms, counts: counts, agesBy: ages, deaths: deaths, allText: allText };
    this._pfKey = key;
    return this._pf;
  },
  /* Veces que un nombre aparece en todo el texto. */
  nameCount(P, name) { const t = this.projectFacts(P).allText; return (t.match(new RegExp('(?<![\\p{L}])' + escRe(name) + '(?![\\p{L}])', 'gu')) || []).length; },
  /* Lo que la biblia debería actualizar según el texto (el texto manda). */
  bibleSync(P) {
    const out = [];
    if (!P || !P.bible) return out;
    const pf = this.projectFacts(P);
    const ign = new Set(P.bibleIgnore || []);
    const allText = App.chapterList().map(c => { const d = App.ch(c.id); return d && d.data ? d.data.paras.map(parText).join('\n') : ''; }).join('\n');
    const words = countWords(allText);
    this.chars(P).forEach(c => {
      // edad: el texto dice otra cosa (y es consistente)
      const ag = pf.agesBy.get(c.id);
      if (c.isChar && ag && ag.length) {
        const v = ag[0].v;
        if (c.age !== v && ag.every(x => x.v === v)) out.push({ key: 'age|' + c.id + '|' + v, iid: c.id, kind: 'age', text: 'El texto dice que ' + c.title + ' tiene ' + v + ' años' + (c.age ? '; la ficha dice ' + c.age : '; la ficha no tiene edad') + '.', apply: 'Poner ' + v + ' en la ficha', field: 'Edad', value: String(v) });
      }
      // muerto en la ficha, pero el texto no lo cuenta y aparece actuando
      if (c.dead && !pf.deaths.has(c.id)) {
        const acts = c.names.some(n => new RegExp('(?<![\\p{L}])' + escRe(n) + '\\s+(?:dijo|respondió|preguntó|sonrió|gritó|llegó|entró|abrió|miró|caminó|llamó|escribió)(?![\\p{L}])', 'u').test(allText));
        if (acts) out.push({ key: 'dead|' + c.id, iid: c.id, kind: 'dead', text: 'La ficha dice que ' + c.title + ' está muerto, pero en el texto no muere y aparece actuando.', apply: 'Quitar «muerto» de la ficha', field: 'Estado', value: '' });
      }
      // forma del nombre: el texto usa otra, siempre igual
      c.names.filter(n => /\s/.test(n)).forEach(n => {
        const cn = pf.counts.get(c.id + '|' + n);
        if (cn && cn.join.length && !cn.sep.length && n === c.title) out.push({ key: 'name|' + c.id + '|' + cn.join[0].text, iid: c.id, kind: 'name', text: 'En el texto siempre aparece «' + cn.join[0].text + '»; la ficha dice «' + n + '».', apply: 'Cambiar el nombre de la ficha', title: cn.join[0].text });
      });
      // ya no aparece en el texto
      // solo para fichas que alguna vez aparecieron en el texto (una ficha planificada que aún no escribes no se toca)
      if ((P.bibleSeen || []).includes(c.id) && (c.isChar || /lugar|locaci/i.test(c.sl)) && c.title.split(/\s+/).length <= 4 && !c.names.some(n => new RegExp('(?<![\\p{L}])' + escRe(n) + '(?![\\p{L}])', 'iu').test(allText))) out.push({ key: 'gone|' + c.id, iid: c.id, kind: 'gone', text: '«' + c.title + '» ya no aparece en el texto.', apply: 'Quitar la ficha' });
    });
    return out.filter(x => !ign.has(x.key));
  },
  /* Recuerda qué fichas ya aparecieron alguna vez en el texto. */
  markSeen(P) {
    const t = this.projectFacts(P).allText;
    const seen = new Set(P.bibleSeen || []); let add = false;
    this.chars(P).forEach(c => { if (!seen.has(c.id) && c.names.some(n => new RegExp('(?<![\\p{L}])' + escRe(n) + '(?![\\p{L}])', 'iu').test(t))) { seen.add(c.id); add = true; } });
    if (add && RT.canWrite) App.proj().update(x => { x.bibleSeen = Array.from(seen).slice(-1000); }, { silent: true });
  },
  applySync(sg) {
    App.proj().update(x => {
      (x.bible.sections || []).forEach(s => {
        const i = (s.items || []).findIndex(it => it.id === sg.iid); if (i < 0) return;
        const it = s.items[i];
        if (sg.kind === 'gone') { s.items.splice(i, 1); return; }
        if (sg.kind === 'name') { const old = it.title; it.title = sg.title; it.fields = it.fields || {}; const al = (it.fields['También llamado'] || '').split(',').map(z => z.trim()).filter(Boolean); if (old && !al.includes(old)) al.push(old); it.fields['También llamado'] = al.join(', '); return; }
        it.fields = it.fields || {};
        if (sg.kind === 'dead') { const k = Object.keys(it.fields).find(f => /^estado/i.test(f)) || 'Estado'; it.fields[k] = ''; return; }
        const k = Object.keys(it.fields).find(f => /^edad/i.test(f)) || sg.field; it.fields[k] = sg.value;
      });
    }, { now: true });
  },
  ignoreSync(sg) { App.proj().update(x => { x.bibleIgnore = Array.from(new Set((x.bibleIgnore || []).concat(sg.key))).slice(-300); }, { now: true }); },
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
    // El texto manda: la biblia se ajusta al texto. Solo se marca el texto cuando algo contradice
    // lo que el propio texto ya había establecido antes (en el orden del libro).
    const pf = this.projectFacts(P);
    const here = (x) => x.pid === p.id;
    if (on('age')) pf.ages.forEach(list => {
      const first = list[0];
      list.filter(here).forEach(x => { if (x.v !== first.v && x !== first) add('coh', 'age', x.text, 'Antes, en ' + first.where + ', ' + x.name + ' tiene ' + first.v + ' años. Si pasó el tiempo en la historia, ignóralo.'); });
    });
    if (on('dead')) pf.after.filter(here).forEach(x => add('coh', 'dead', x.text, x.name + ' muere antes en el texto (' + x.where + '). ¿Es un recuerdo o un error?'));
    if (on('name')) pf.forms.filter(here).forEach(x => add('coh', 'name', x.text, 'En el resto del texto se escribe «' + x.main + '».', x.main));
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
