/* ============ revisor propio: reglas sin IA ============ */
const MULETILLAS = ['de repente', 'de pronto', 'en ese momento', 'empezó a', 'comenzó a', 'como que', 'de alguna manera', 'de alguna forma', 'en cierto modo', 'básicamente', 'literalmente', 'realmente', 'simplemente', 'verdaderamente', 'totalmente', 'absolutamente', 'sin duda alguna', 'cabe destacar', 'es importante señalar', 'a nivel de', 'en base a'];
const COMODINES = ['cosa', 'cosas', 'algo', 'bastante', 'muy'];
const USER_DICT_KEY = 'mde-dict-v1';

function lev(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const m = a.length, n = b.length; let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
  return prev[n];
}

const Spell = {
  worker: null, ready: false, failed: false, seq: 0, waits: new Map(), sent: new Set(),
  available() { return !!window.MDE_WEB && typeof Worker !== 'undefined' && !this.failed; },
  init() {
    if (this.worker || !this.available()) return;
    try {
      this.worker = new Worker('spell-worker.js');
      this.worker.onmessage = (e) => { const w = this.waits.get(e.data.id); if (w) { this.waits.delete(e.data.id); e.data.error ? w.rej(e.data.error) : w.res(e.data); } };
      this.worker.onerror = () => { this.failed = true; this.waits.forEach(w => w.rej('worker')); this.waits.clear(); };
      this.call({ type: 'init', base: 'dict/' }).then(() => { this.ready = true; }, () => { this.failed = true; });
    } catch (e) { this.failed = true; }
  },
  call(msg) { const id = ++this.seq; return new Promise((res, rej) => { this.waits.set(id, { res, rej }); this.worker.postMessage(Object.assign({ id: id }, msg)); }); },
  userWords() { try { return JSON.parse(localStorage.getItem(USER_DICT_KEY) || '[]'); } catch (e) { return []; } },
  addUserWord(w) { const s = new Set(this.userWords()); s.add(w); try { localStorage.setItem(USER_DICT_KEY, JSON.stringify(Array.from(s))); } catch (e) {} if (this.worker) this.call({ type: 'add', add: [w] }).catch(() => {}); },
  async check(words, extra) {
    if (!this.available()) return {};
    this.init();
    const add = extra.filter(x => !this.sent.has(x));
    if (add.length) { add.forEach(x => this.sent.add(x)); await this.call({ type: 'add', add: add }); }
    const r = await this.call({ type: 'check', base: 'dict/', words: words });
    return r.bad || {};
  }
};

const Checker = {
  timers: new Map(), runningFor: null,
  bibleNames(P) {
    const out = [];
    ((P && P.bible && P.bible.sections) || []).forEach(s => (s.items || []).forEach(it => {
      if (it.title) out.push(it.title.trim());
      ((it.fields && it.fields['También llamado']) || '').split(',').forEach(x => { x = x.trim(); if (x) out.push(x); });
    }));
    return out.filter(Boolean);
  },
  level(P) { return (P && P.review && P.review.density) || 'normal'; },
  on(P, rule) {
    const lv = this.level(P);
    const types = (P && P.review && P.review.types) || TKEYS;
    const t = { spell: 'ort', dup: 'ort', punct: 'ort', tilde: 'ort', dial: 'ort', dequeismo: 'ort', caps: 'ort', balance: 'ort', long: 'dud', longpar: 'dud', eco: 'rep', starts: 'rep', mul: 'rec', mente: 'rec', gerund: 'rec', name: 'coh', age: 'coh', dead: 'coh', noficha: 'coh', dur: 'coh', date: 'coh', metro: 'rec' }[rule];
    if (!types.includes(t)) return false;
    if (lv === 'pocas') return ['spell', 'dup', 'punct', 'tilde', 'dial', 'caps', 'balance', 'name', 'age', 'dead', 'date'].includes(rule);
    if (lv === 'normal') return !['mul', 'mente', 'gerund'].includes(rule);
    return true;
  },
  /* Devuelve propuestas {type, text, note, fix, rule, word} para un párrafo. */
  async analyze(P, paras, i) {
    const p = paras[i], text = parText(p), out = [];
    if (!text.trim()) return out;
    const add = (type, rule, t, note, fix, word) => { if (t && text.indexOf(t) >= 0) out.push({ type: type, rule: rule, text: t, note: note, fix: fix, word: word }); };
    // palabras repetidas seguidas: «el el»
    if (this.on(P, 'dup')) {
      const re = /(?<![\p{L}\p{N}])([\p{L}]+)(\s+)\1(?![\p{L}\p{N}])/giu; let m;
      while ((m = re.exec(text))) if (m[1].length > 1 || /^[aeoy]$/i.test(m[1])) add('ort', 'dup', m[0], 'Palabra repetida dos veces seguidas.', m[1]);
    }
    // puntuación
    if (this.on(P, 'punct')) {
      let m; const r1 = /([\p{L}\p{N}]+|[^\s\p{L}\p{N}])( +)([,.;:!?…])/gu;
      while ((m = r1.exec(text))) if (!/[¿¡«"“(]/.test(m[1])) add('ort', 'punct', m[0], 'Sobra el espacio antes de «' + m[3] + '».', m[1] + m[3]);
      const r2 = /([\p{Ll}]{2,})([,;:])([\p{L}]+)/gu;
      const r2b = /([\p{Ll}]{3,})([.?!])([\p{Lu}¿¡][\p{Ll}]+)/gu;
      while ((m = r2b.exec(text))) add('ort', 'punct', m[0], 'Falta un espacio después de «' + m[2] + '».', m[1] + m[2] + ' ' + m[3]);
      while ((m = r2.exec(text))) add('ort', 'punct', m[0], 'Falta un espacio después de «' + m[2] + '».', m[1] + m[2] + ' ' + m[3]);
      const r3 = /\S( {2,})\S/g;
      while ((m = r3.exec(text))) add('ort', 'punct', m[0], 'Hay espacios dobles.', m[0].replace(/ {2,}/, ' '));
      sentences(text).forEach(s => {
        const q = s.trim();
        if (/\?["»”)]?$/.test(q) && q.indexOf('¿') < 0) { const w = q.match(/(\S+\s+)?\S+\?["»”)]?$/); if (w) add('ort', 'punct', w[0], 'Falta el signo de apertura «¿».'); }
        if (/![»”")]?$/.test(q) && q.indexOf('¡') < 0) { const w = q.match(/(\S+\s+)?\S+![»”")]?$/); if (w) add('ort', 'punct', w[0], 'Falta el signo de apertura «¡».'); }
      });
    }
    // tildes que el diccionario no ve: interrogativos, pronombres, «sé»
    if (this.on(P, 'tilde')) {
      let m;
      const INT = { que: 'qué', como: 'cómo', donde: 'dónde', cuando: 'cuándo', cual: 'cuál', cuales: 'cuáles', quien: 'quién', quienes: 'quiénes', cuanto: 'cuánto', cuanta: 'cuánta', cuantos: 'cuántos', cuantas: 'cuántas', porque: 'por qué' };
      const r1 = /([¿¡])\s*(que|como|donde|cuando|cual|cuales|quien|quienes|cuanto|cuanta|cuantos|cuantas|porque)(?![\p{L}])/giu;
      while ((m = r1.exec(text))) { const w = m[2], fx = INT[w.toLowerCase()]; const fix = /^\p{Lu}/u.test(w) ? fx[0].toUpperCase() + fx.slice(1) : fx; add('ort', 'tilde', m[0], 'En pregunta o exclamación lleva tilde: «' + fix + '».', m[1] + fix); }
      const r2 = /(?<![\p{L}])([Ee]l)\s+(dijo|era|estaba|fue|tenía|tenia|sabía|quería|pensó|miró|había|habia|es|está|tiene|sabe|quiere|vino|llegó|preguntó|respondió|sonrió|también|mismo)(?![\p{L}])/gu;
      while ((m = r2.exec(text))) { const fix = (m[1] === 'El' ? 'Él' : 'él') + ' ' + m[2]; add('ort', 'tilde', m[0], 'Si es pronombre («él»), lleva tilde.', fix); }
      const r3 = /(?<![\p{L}])([Tt]u)\s+(eres|tienes|sabes|quieres|estás|estabas|eras|dijiste|puedes|vas)(?![\p{L}])/gu;
      while ((m = r3.exec(text))) add('ort', 'tilde', m[0], 'Pronombre personal: «tú».', (m[1] === 'Tu' ? 'Tú' : 'tú') + ' ' + m[2]);
      const r4 = /(?<![\p{L}])((?:[Yy]o|[Nn]o)\s+)se(\s+(?:si|qué|que|cómo|nada|bien|mucho|dónde|cuándo|quién))(?![\p{L}])/gu;
      while ((m = r4.exec(text))) add('ort', 'tilde', m[0], 'Del verbo saber: «sé».', m[1] + 'sé' + m[2]);
    }
    // dequeísmo y queísmo frecuentes
    if (this.on(P, 'dequeismo')) {
      let m;
      const r1 = /(?<![\p{L}])((?:pienso|piensa|pensaba|creo|cree|creía|opino|opina|dijo|dije|digo|considero|supongo|parece|resulta|es obvio|es posible)) de que(?![\p{L}])/giu;
      while ((m = r1.exec(text))) add('ort', 'dequeismo', m[0], 'Dequeísmo: sobra «de».', m[1] + ' que');
      const r2 = /(?<![\p{L}])((?:me di cuenta|se dio cuenta|te diste cuenta|estoy seguro|estaba seguro|está seguro|estoy segura|estaba segura|a pesar|me acuerdo|se acordó|me olvidé|tengo la certeza|con tal|en caso)) que(?![\p{L}])/giu;
      while ((m = r2.exec(text))) add('ort', 'dequeismo', m[0], 'Queísmo: falta «de».', m[1] + ' de que');
    }
    // diálogos con guion corto, mayúscula tras punto, signos sin cerrar
    if (this.on(P, 'dial')) {
      const m = text.match(/^\s*(-{1,2})\s*\S+/);
      if (m) add('ort', 'dial', m[0].trim(), 'En diálogos se usa raya (—), no guion.', m[0].trim().replace(/^-{1,2}\s*/, '—'));
    }
    if (this.on(P, 'caps')) {
      let m; const r = /([.!?…]["»”]?\s+)([\p{Ll}][\p{Ll}]+)/gu;
      while ((m = r.exec(text))) { if (/\b(?:Sr|Sra|Dr|Dra|etc|pág|p)\.\s+$/i.test(text.slice(Math.max(0, m.index - 6), m.index + m[1].length))) continue; if (/…\s+$/.test(m[1])) continue; add('ort', 'caps', m[2], 'Después de punto va mayúscula.', m[2][0].toUpperCase() + m[2].slice(1)); }
      if (/\.{4,}/.test(text)) { const k = text.match(/\S*\.{4,}/)[0]; add('ort', 'caps', k, 'Los puntos suspensivos son tres.', k.replace(/\.{4,}/, '...')); }
    }
    if (this.on(P, 'balance')) {
      const pairs = [['«', '»'], ['(', ')'], ['“', '”']];
      pairs.forEach(([a, b]) => {
        const na = text.split(a).length - 1, nb = text.split(b).length - 1;
        if (na !== nb) { const i2 = na > nb ? text.lastIndexOf(a) : text.lastIndexOf(b); const frag = (text.slice(i2).match(/^\S+(?:\s+\S+)?/) || [a])[0]; add('ort', 'balance', frag, 'Hay un «' + (na > nb ? a : b) + '» sin su pareja «' + (na > nb ? b : a) + '».'); }
      });
      const q = (text.match(/"/g) || []).length;
      if (q % 2) { const i2 = text.lastIndexOf('"'); add('ort', 'balance', (text.slice(i2).match(/^\S+/) || ['"'])[0], 'Hay comillas sin cerrar.'); }
    }
    // inicios de frase repetidos
    if (this.on(P, 'starts')) {
      const ss = sentences(text); let run = 1;
      for (let k = 1; k < ss.length; k++) {
        const a = fold((ss[k - 1].match(/[\p{L}]+/u) || [''])[0]), b = fold((ss[k].match(/[\p{L}]+/u) || [''])[0]);
        if (a && a === b && a.length > 1 && !['y'].includes(a)) { run++; if (run === 3) { const w = ss[k].match(/^\s*[«"“¿¡—]?\s*[\p{L}]+/u); if (w) add('rep', 'starts', w[0].trim(), 'Tres frases seguidas empiezan con «' + (ss[k].match(/[\p{L}]+/u) || [''])[0] + '».'); } }
        else run = 1;
      }
    }
    if (this.on(P, 'gerund')) {
      sentences(text).forEach(s2 => { const g = s2.match(/[\p{L}]+(?:ando|iendo|yendo)\b/gu); if (g && g.length >= 3) add('rec', 'gerund', g[2], g.length + ' gerundios en la misma frase; puede volverse pesada.'); });
    }
    if (this.on(P, 'longpar')) {
      const n = countWords(text);
      if (n > 260) { const head = (text.match(/^\s*(\S+\s+){0,4}\S+/) || [''])[0].trim(); add('dud', 'longpar', head, 'Párrafo de ' + n + ' palabras. Si mezcla varias ideas, podría dividirse.'); }
    }
    // frases largas
    if (this.on(P, 'long')) {
      const lim = this.level(P) === 'muchas' ? 38 : 48;
      sentences(text).forEach(s => {
        const n = countWords(s);
        if (n >= lim) { const head = (s.match(/^\s*(\S+\s+){0,5}\S+/) || [''])[0].trim(); add('dud', 'long', head, 'Esta frase tiene ' + n + ' palabras. Si cuesta seguirla, podría dividirse.'); }
      });
    }
    // muletillas y adverbios en -mente
    if (this.on(P, 'mul')) {
      const ft = fold(text);
      MULETILLAS.forEach(mu => {
        const re = new RegExp('(?<![\\p{L}])' + escRe(fold(mu)) + '(?![\\p{L}])', 'u'); const m = re.exec(ft);
        if (m) add('rec', 'mul', text.substr(m.index, mu.length), 'Muletilla o fórmula frecuente: ¿aporta algo aquí?');
      });
    }
    if (this.on(P, 'mente')) {
      sentences(text).forEach(s => { const ms = s.match(/[\p{L}]+mente\b/gu); if (ms && ms.length >= 2) add('rec', 'mente', ms[1], 'Dos adverbios en «-mente» en la misma frase («' + ms[0] + '», «' + ms[1] + '»).'); });
    }
    // ecos: misma palabra (o raíz) muy cerca, considerando el párrafo anterior
    if (this.on(P, 'eco')) {
      const prev = i > 0 ? paras[i - 1] : null;
      const ctx = prev ? [prev, p] : [p];
      const hits = computeEcos(ctx).filter(t => t.pid === p.id);
      const seen = new Set(); let n = 0;
      const re = /[\p{L}\p{N}]+/gu; const allToks = []; let mm;
      ctx.forEach(q => { const t = parText(q); re.lastIndex = 0; while ((mm = re.exec(t))) allToks.push({ pid: q.id, s: mm.index, w: mm[0] }); });
      hits.forEach(t => {
        if (n >= 3) return;
        const w = text.slice(t.s, t.e), k = fold(w).slice(0, 6);
        if (seen.has(k) || w.length < 4) return;
        const before = allToks.filter(x => (x.pid !== p.id || x.s < t.s) && fold(x.w).slice(0, 6) === k);
        if (!before.length) return;
        seen.add(k); n++;
        add('rep', 'eco', w, '«' + before[before.length - 1].w + '» aparece muy cerca' + (before[before.length - 1].pid !== p.id ? ', en el párrafo anterior' : '') + '.');
      });
      COMODINES.forEach(cw => { const re2 = new RegExp('(?<![\\p{L}])' + cw + '(?![\\p{L}])', 'giu'); const ms = text.match(re2); if (ms && ms.length >= 3) { const k = text.search(re2); add('rec', 'eco', text.substr(k, cw.length), '«' + cw + '» aparece ' + ms.length + ' veces en este párrafo.'); } });
    }
    // métrica: versos que se apartan de la medida del poema (solo poesía)
    if (P.kind === 'poesia' && window.Metrica && this.on(P, 'metro')) {
      const r = Metrica.poem(paras.map(q => ({ pid: q.id, text: parText(q) })));
      const v = r.verses.find(x => x.pid === p.id);
      if (v && r.regular && !v.ok && r.verses.length >= 4 && text.trim().length) add('rec', 'metro', text.trim().length > 60 ? text.trim().slice(0, 60).replace(/\s+\S*$/, '') : text.trim(), 'Este verso mide ' + v.count + ' sílabas; el poema va en ' + r.allowed.map(c => MET_NAMES[c] || c + ' sílabas').join(' o ') + '.' + (v.lic ? ' Con ' + v.lic.join(' y ') + ' mediría ' + v.target + '.' : ''));
    }
    // coherencia con la biblia y dentro del capítulo (16-coherence.js)
    if (window.Coherence) Coherence.check(P, paras, i, text, add, r => this.on(P, r));
    // nombres parecidos a los de la biblia y ortografía
    const names = this.bibleNames(P);
    const nameSet = new Set(); names.forEach(n => n.split(/\s+/).forEach(w => nameSet.add(w)));
    const toks = []; const re = /[\p{L}]+(?:['’-][\p{L}]+)*/gu; let m;
    while ((m = re.exec(text))) {
      const before = text.slice(0, m.index).replace(/[«"“'(—–\-\s]+$/, '');
      const start = !before || /[.!?…:]$/.test(before);
      toks.push({ w: m[0], s: m.index, start: start });
    }
    if (this.on(P, 'name') && nameSet.size) {
      const cands = toks.filter(t => /^\p{Lu}/u.test(t.w) && !t.start && t.w.length >= 4 && !nameSet.has(t.w));
      cands.forEach(t => {
        for (const nm of nameSet) if (nm.length >= 4 && lev(fold(t.w), fold(nm)) === 1) { add('coh', 'name', t.w, '¿Quisiste decir «' + nm + '»? Así está en la biblia.', nm); break; }
      });
    }
    if (this.on(P, 'spell') && Spell.available()) {
      const own = new Set((P.dictionary || []).concat(Spell.userWords(), (this._ok || [])));
      const words = Array.from(new Set(toks.filter(t => {
        if (t.w.length < 2 || own.has(t.w) || own.has(t.w.toLowerCase()) || nameSet.has(t.w)) return false;
        if (/^\p{Lu}/u.test(t.w) && !t.start) return false;
        if (/^\p{Lu}+$/u.test(t.w) && t.w.length <= 5) return false;
        return true;
      }).map(t => t.w)));
      if (words.length) {
        let bad = {};
        try { bad = await Spell.check(words, names); } catch (e) { bad = {}; }
        Object.keys(bad).forEach(w => {
          const sug = bad[w] || [];
          add('ort', 'spell', w, sug.length ? 'No está en el diccionario. ¿' + sug.slice(0, 3).join(', ') + '?' : 'No está en el diccionario.', sug[0] || '', w);
        });
      }
    }
    return out;
  },
  insert(p, it) {
    const m = { id: uid('m'), type: it.type, text: '', note: it.note, by: 'revisor', rule: it.rule, at: Date.now() };
    if (it.word) m.word = it.word;
    if (it.fix && it.fix !== it.text) m.fix = { from: it.text, to: it.fix, applied: false };
    return insertMarkByText(p, it.text, m);
  },
  /* Revisa párrafos y reemplaza las marcas anteriores del revisor propio. */
  async run(cid, pids, quiet) {
    const d = App.ch(cid), P = App.P(); if (!d || !d.data || !P || !RT.canWrite) return 0;
    const paras = d.data.paras;
    const ids = pids || paras.map(p => p.id);
    const protectedIds = protectedMarkIds(P);
    const results = new Map();
    this._ok = d.data.okWords || [];
    const dis = d.data.dismiss || {};
    for (const pid of ids) {
      const i = paras.findIndex(p => p.id === pid); if (i < 0) continue;
      const skip = dis[pid] || [];
      let items = await this.analyze(P, paras, i);
      // si el párrafo tenía observaciones de diálogo, se vuelven a calcular
      if (window.Dialogo && paras[i].segs.some(s => s.m && s.m.rule === 'dlg' && !s.m.done)) items = items.concat(Dialogo.analyze(parText(paras[i])));
      items = items.filter(it => !skip.some(z => z.t === it.text && (!z.r || z.r === it.rule)));
      results.set(pid, { text: parText(paras[i]), items: items });
    }
    let added = 0, removed = 0;
    const cur = App.ch(cid); if (!cur || !cur.data) return 0;
    const undoPushed = !quiet && Editor.cid === cid;
    if (undoPushed) Editor.pushUndo();
    cur.update(x => {
      results.forEach((r, pid) => {
        const k = x.paras.findIndex(z => z.id === pid); if (k < 0) return;
        if (parText(x.paras[k]) !== r.text) return;
        const np = clone(x.paras[k]);
        const stale = (m) => isStale(m, protectedIds, 'revisor');
        removed += np.segs.filter(s => s.m && stale(s.m)).length;
        np.segs = normSegs(np.segs.map(s => (s.m && stale(s.m)) ? { t: s.m.text } : s));
        r.items.forEach(it => { if (this.insert(np, it)) added++; });
        x.paras[k] = np;
      });
    }, { silent: true });
    if (Editor.root && Editor.cid === cid) { Editor.render(true, pids && pids.length <= 20 ? pids : null); Editor.afterChange(); }
    return { added: added, removed: removed };
  },
  schedule(cid, pid) {
    if (!RT.canWrite || App.prefs.autoLocal === false) return;
    clearTimeout(this.timers.get(pid));
    this.timers.set(pid, setTimeout(() => {
      this.timers.delete(pid);
      if (Editor.composing) { this.schedule(cid, pid); return; }
      this.run(cid, [pid], true);
    }, 1400));
  },
  async chapter(cid) {
    App.toast('Revisando sin IA…', { ms: 4000, id: 'chk' });
    const r = await this.run(cid);
    if (r) App.toast('Revisión rápida: ' + (r.added ? plural(r.added, 'marca', 'marcas') : 'sin observaciones') + (Spell.available() ? '' : ' (la ortografía se revisa en la versión web)') + '.', { id: 'chk' });
  },
  addToDictionary(word, scope) {
    if (!word) return;
    if (scope === 'project') App.proj().update(x => { x.dictionary = x.dictionary || []; if (!x.dictionary.includes(word)) x.dictionary.push(word); }, { now: true });
    else Spell.addUserWord(word);
    App.chapterList().forEach(c => {
      const d = App.ch(c.id); if (!d || !d.data) return;
      const has = allMarks(d.data).some(x => x.m.rule === 'spell' && x.m.word === word);
      if (!has) return;
      d.update(x => { x.paras.forEach(p => { p.segs = normSegs(p.segs.map(s => (s.m && s.m.rule === 'spell' && s.m.word === word) ? { t: s.m.text } : s)); }); }, { silent: true });
    });
    if (Editor.root) { Editor.render(true); Editor.afterChange(); }
    App.toast('«' + word + '» quedó en ' + (scope === 'project' ? 'el diccionario del proyecto' : 'tu diccionario') + '.');
  }
};
window.Checker = Checker;
window.Spell = Spell;
