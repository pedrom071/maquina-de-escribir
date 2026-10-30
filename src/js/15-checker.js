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
    const t = { spell: 'ort', dup: 'ort', punct: 'ort', long: 'dud', eco: 'rep', mul: 'rec', mente: 'rec', name: 'coh' }[rule];
    if (!types.includes(t)) return false;
    if (lv === 'pocas') return ['spell', 'dup', 'punct', 'name'].includes(rule);
    if (lv === 'normal') return rule !== 'mul' && rule !== 'mente';
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
      const own = new Set((P.dictionary || []).concat(Spell.userWords()));
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
    for (const pid of ids) {
      const i = paras.findIndex(p => p.id === pid); if (i < 0) continue;
      results.set(pid, { text: parText(paras[i]), items: await this.analyze(P, paras, i) });
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
    if (Editor.root && Editor.cid === cid) { Editor.render(true); Editor.afterChange(); }
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
    App.toast('Revisando sin IA…', { ms: 1500 });
    const r = await this.run(cid);
    if (r) App.toast('Revisión rápida: ' + (r.added ? plural(r.added, 'marca', 'marcas') : 'sin observaciones') + (Spell.available() ? '' : ' (la ortografía se revisa en la versión web)') + '.');
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
