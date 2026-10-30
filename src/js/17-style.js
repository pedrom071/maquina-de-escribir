/* ============ métricas de estilo: retrato descriptivo del texto, sin reglas ============ */
const SAY_VERBS = ['dijo', 'preguntó', 'respondió', 'contestó', 'murmuró', 'susurró', 'gritó', 'exclamó', 'añadió', 'repitió', 'comentó', 'insistió', 'explicó', 'replicó', 'agregó', 'pensó', 'dije', 'pregunté', 'respondí', 'contesté'];
const NOT_GERUND = new Set(['cuando', 'mando', 'bando', 'blando', 'comando', 'nefando', 'fernando', 'orlando', 'rolando', 'armando', 'ernando', 'hernando', 'segundo', 'mundo', 'fecundo']);

/* Sílabas de una palabra en español (aproximación: núcleos vocálicos con diptongos e hiatos). */
function syllables(w) {
  w = w.toLowerCase().replace(/ü/g, 'u').replace(/qu(?=[eiéí])/g, 'q').replace(/gu(?=[eiéí])/g, 'g');
  const strong = 'aeoáéó', accWeak = 'íú', vowels = 'aeiouáéíóú';
  let n = 0, prev = null;
  for (const ch of w) {
    if (vowels.includes(ch)) {
      if (prev == null || (strong.includes(prev) && strong.includes(ch)) || accWeak.includes(prev) || accWeak.includes(ch)) n++;
      prev = ch;
    } else prev = null;
  }
  return Math.max(1, n);
}

const Style = {
  /* Calcula las métricas de una lista de párrafos (texto plano). */
  compute(paras) {
    const r = { words: 0, syl: 0, sents: 0, lens: [], paras: 0, dlgParas: 0, mente: 0, gerund: 0, passive: 0, say: {}, types: 0, mattr: 0, longWords: 0 };
    const toks = [];
    paras.forEach(t => {
      if (!t || !t.trim()) return;
      r.paras++;
      if (/^\s*[—–-]/.test(t) || /«[^»]{2,}»/.test(t)) r.dlgParas++;
      sentences(t).forEach(s => { const n = countWords(s); if (n) { r.lens.push(n); r.sents++; } });
      const ws = t.match(/[\p{L}]+/gu) || [];
      ws.forEach(w => {
        const lw = w.toLowerCase();
        r.words++; r.syl += syllables(w); toks.push(lw);
        if (w.length >= 7 && lw.endsWith('mente')) r.mente++;
        if (/(?:ando|iendo|yendo)$/.test(lw) && lw.length >= 5 && !NOT_GERUND.has(lw)) r.gerund++;
        if (syllables(w) >= 4) r.longWords++;
      });
      const pas = t.match(/(?<![\p{L}])(?:fue|fueron|ha sido|han sido|había sido|habían sido|será|serán)\s+[\p{L}]+(?:ado|ada|ados|adas|ido|ida|idos|idas|cho|cha|chos|chas|to|ta|tos|tas)(?![\p{L}])/giu);
      if (pas) r.passive += pas.length;
      const rs = new RegExp('(?<![\\p{L}])(' + SAY_VERBS.join('|') + ')(?![\\p{L}])', 'giu'); let m;
      while ((m = rs.exec(t))) { const k = m[1].toLowerCase(); r.say[k] = (r.say[k] || 0) + 1; }
    });
    r.types = new Set(toks).size;
    // riqueza léxica: proporción de palabras distintas en ventanas móviles de 500 (no depende del largo del texto)
    const W = 500;
    if (toks.length >= W) {
      const cnt = new Map(); let distinct = 0, sum = 0, nWin = 0;
      for (let i = 0; i < toks.length; i++) {
        const a = toks[i]; cnt.set(a, (cnt.get(a) || 0) + 1); if (cnt.get(a) === 1) distinct++;
        if (i >= W) { const b = toks[i - W]; cnt.set(b, cnt.get(b) - 1); if (cnt.get(b) === 0) distinct--; }
        if (i >= W - 1 && (i - W + 1) % 25 === 0) { sum += distinct / W; nWin++; }
      }
      r.mattr = nWin ? sum / nWin : 0; r.mattrExact = true;
    } else r.mattr = toks.length ? r.types / toks.length : 0;
    const mean = r.lens.length ? r.lens.reduce((a, b) => a + b, 0) / r.lens.length : 0;
    const sd = r.lens.length > 1 ? Math.sqrt(r.lens.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (r.lens.length - 1)) : 0;
    r.meanSent = mean; r.cv = mean ? sd / mean : 0;
    const P = r.words ? 100 * r.syl / r.words : 0, F = r.words ? 100 * r.sents / r.words : 0;
    r.legib = r.words ? Math.max(0, Math.min(100, 206.84 - 0.60 * P - 1.02 * F)) : 0;
    r.per1000 = (n) => r.words ? 1000 * n / r.words : 0;
    return r;
  },
  legibLabel(v) {
    if (v >= 90) return 'muy fácil'; if (v >= 80) return 'fácil'; if (v >= 70) return 'algo fácil';
    if (v >= 60) return 'normal'; if (v >= 50) return 'algo difícil'; if (v >= 30) return 'difícil'; return 'muy difícil';
  },
  rhythmLabel(cv) { return cv < 0.35 ? 'frases de largo parejo' : cv < 0.7 ? 'largos variados' : 'contrastes marcados'; },
  num(v, d) { return v.toLocaleString('es-CL', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); },
  render(wrap) {
    const P = App.P(); if (!P) return;
    const chs = App.chapterList().map((c, i) => { const d = App.ch(c.id); return { c: c, i: i, texts: d && d.data ? d.data.paras.map(parText) : [] }; });
    const all = this.compute(chs.reduce((a, x) => a.concat(x.texts), []));
    const panel = h('div', { class: 'panel style-panel' });
    panel.append(h('h3', { text: 'Retrato del estilo' }), h('p', { class: 'muted', style: 'margin:-.4rem 0 .9rem;font-size:.8125rem', text: 'Medidas descriptivas, no reglas: sirven para ver tu voz y comparar ' + kindOf(P).units.toLowerCase() + ' entre sí.' }));
    if (all.words < 60) { panel.append(h('p', { class: 'muted', text: 'Escribe un poco más (unas 60 palabras) para ver el retrato.' })); wrap.append(panel); return; }
    const grid = h('div', { class: 'style-grid' });
    const cell = (k, v, sub, help) => grid.append(h('div', { class: 'style-cell', title: help || '' }, h('div', { class: 'k', text: k }), h('div', { class: 'v', text: v }), sub ? h('div', { class: 's', text: sub }) : null));
    cell('Legibilidad', this.num(all.legib), this.legibLabel(all.legib) + ' (Fernández Huerta)', 'Índice de 0 a 100 para español: más alto, más fácil de leer. Depende del largo de palabras y frases. La literatura suele quedar entre 50 y 80.');
    cell('Palabras por frase', this.num(all.meanSent, 1), this.rhythmLabel(all.cv), 'Promedio de palabras por frase. Debajo, cuánto varía el largo de una frase a otra.');
    cell('Riqueza léxica', this.num(100 * all.mattr) + '%', all.mattrExact ? 'palabras distintas cada 500' : 'palabras distintas (texto corto)', 'Proporción de palabras distintas en tramos de 500 palabras. No depende del largo total.');
    cell('Diálogo', this.num(all.paras ? 100 * all.dlgParas / all.paras : 0) + '%', 'de los párrafos', 'Párrafos que empiezan con raya o que tienen una cita entre comillas.');
    cell('Adverbios en -mente', this.num(all.per1000(all.mente), 1), 'cada mil palabras');
    cell('Gerundios', this.num(all.per1000(all.gerund), 1), 'cada mil palabras');
    cell('Pasiva con «ser»', this.num(all.per1000(all.passive), 1), 'cada mil palabras', '«fue escrito», «han sido vistos»…');
    cell('Palabras largas', this.num(all.words ? 100 * all.longWords / all.words : 0) + '%', 'de cuatro sílabas o más');
    panel.append(grid);
    // largo de frases
    const buckets = [[1, 5], [6, 10], [11, 20], [21, 30], [31, 40], [41, 1e9]];
    const bc = buckets.map(([a, b]) => all.lens.filter(n => n >= a && n <= b).length);
    const maxB = Math.max(1, ...bc);
    const two = h('div', { class: 'two', style: 'margin-top:1rem' });
    const hist = h('div', { class: 'style-hist' });
    buckets.forEach(([a, b], i) => hist.append(h('div', { class: 'row', style: 'gap:.6rem;flex-wrap:nowrap' },
      h('span', { class: 'lbl', text: b > 1e8 ? 'más de 40' : a + '–' + b }),
      h('span', { class: 'bar' }, h('span', { style: 'width:' + (100 * bc[i] / maxB) + '%' })),
      h('span', { class: 'n', text: fmtN(bc[i]) }))));
    two.append(h('div', null, h('h4', { text: 'Largo de las frases (palabras)' }), hist));
    // verbos de decir
    const say = Object.entries(all.say).sort((a, b) => b[1] - a[1]);
    const totalSay = say.reduce((a, x) => a + x[1], 0);
    const sayBox = h('div', null, h('h4', { text: 'Verbos de habla' }));
    if (totalSay) {
      const cloud = h('div', { class: 'wcloud' });
      say.slice(0, 12).forEach(([w, n]) => cloud.append(h('button', { type: 'button', onclick: () => Search.open(w, true) }, w, h('b', { text: String(n) }))));
      const dijo = (all.say['dijo'] || 0) + (all.say['dije'] || 0);
      sayBox.append(cloud, h('p', { class: 'muted', style: 'margin:.5rem 0 0;font-size:.8125rem', text: '«Dijo» es ' + this.num(100 * dijo / totalSay) + '% de los ' + plural(totalSay, 'verbo') + ' de habla.' }));
    } else sayBox.append(h('p', { class: 'muted', text: 'No hay verbos de habla todavía.' }));
    two.append(sayBox);
    panel.append(two);
    // comparación por capítulo
    const rows = chs.map(x => Object.assign({ x: x }, { r: this.compute(x.texts) })).filter(z => z.r.words >= 30);
    if (rows.length >= 2) {
      const tbl = h('table', { class: 'style-table' });
      tbl.append(h('thead', null, h('tr', null, h('th', { text: App.unit() }), h('th', { text: 'Palabras' }), h('th', { text: 'P/frase' }), h('th', { text: 'Legibilidad' }), h('th', { text: 'Diálogo' }), h('th', { text: 'Riqueza' }))));
      const tb = h('tbody');
      const avgL = all.legib, avgS = all.meanSent;
      rows.forEach(({ x, r }) => {
        const off = (v, ref, tol) => Math.abs(v - ref) > tol ? ' off' : '';
        tb.append(h('tr', { onclick: () => App.go(App.chHash(x.c.id)), style: 'cursor:pointer' },
          h('td', { text: (x.i + 1) + '. ' + (x.c.title || App.unit()) }),
          h('td', { text: fmtN(r.words) }),
          h('td', { class: off(r.meanSent, avgS, avgS * 0.35), text: this.num(r.meanSent, 1) }),
          h('td', { class: off(r.legib, avgL, 12), text: this.num(r.legib) }),
          h('td', { text: this.num(r.paras ? 100 * r.dlgParas / r.paras : 0) + '%' }),
          h('td', { text: this.num(100 * r.mattr) + '%' })));
      });
      tbl.append(tb);
      panel.append(h('h4', { style: 'margin-top:1.1rem', text: 'Por ' + App.unit().toLowerCase() }), h('div', { style: 'overflow-x:auto' }, tbl), h('p', { class: 'muted', style: 'margin:.4rem 0 0;font-size:.75rem', text: 'En cursiva, los valores que se alejan bastante del promedio del proyecto. Puede ser intencional.' }));
    }
    wrap.append(panel);
  }
};
window.Style = Style;
window.syllables = syllables;
