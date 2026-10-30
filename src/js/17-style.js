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


/* Explicaciones al pasar el cursor (o al tocar, en pantallas táctiles). */
function tipify(el, text) {
  if (!text) return el;
  el.classList.add('has-tip');
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
  el.setAttribute('aria-description', text);
  const q = h('span', { class: 'tip-q', 'aria-hidden': 'true', text: '?' });
  const t = h('span', { class: 'tip', role: 'tooltip', text: text });
  el.append(q, t);
  const place = () => {
    t.classList.remove('flip', 'up');
    const r = t.getBoundingClientRect();
    if (r.right > window.innerWidth - 8) t.classList.add('flip');
    if (r.bottom > window.innerHeight - 8 && el.getBoundingClientRect().top > r.height + 16) t.classList.add('up');
  };
  el.addEventListener('mouseenter', place);
  el.addEventListener('focus', place);
  el.addEventListener('click', (e) => { if (e.target.closest('button,a') && e.target.closest('button,a') !== el) return; const on = !el.classList.contains('show'); document.querySelectorAll('.has-tip.show').forEach(x => x.classList.remove('show')); if (on) { el.classList.add('show'); place(); } });
  return el;
}
document.addEventListener('click', (e) => { if (!e.target.closest('.has-tip')) document.querySelectorAll('.has-tip.show').forEach(x => x.classList.remove('show')); });

const STYLE_HELP = {
  legib: 'Qué tan fácil es leer el texto, de 0 a 100: más alto, más fácil. Se calcula con el largo de las palabras (sílabas) y de las frases. Es el índice de Fernández Huerta, la adaptación al español del índice de Flesch. Como referencia aproximada, la narrativa suele quedar entre 60 y 80 y los textos académicos, bajo 50. Mide la forma, no la claridad de las ideas.',
  sent: 'Promedio de palabras entre un punto y el siguiente. Debajo, cuánto cambia el largo de una frase a otra: «parejo» si casi todas miden lo mismo, «contrastes marcados» si alternas frases muy cortas con muy largas. La variación suele dar ritmo; la monotonía puede ser buscada.',
  rich: 'Cuántas palabras distintas usas. Se mide en tramos de 500 palabras y se promedia, para que no dependa del largo total. Más alto: vocabulario más variado. Más bajo: más repetición, que puede ser un recurso (oralidad, insistencia) o un descuido.',
  dlg: 'Porcentaje de párrafos con diálogo: los que empiezan con raya (—) o tienen una cita entre comillas «». Sirve para ver el equilibrio entre escena hablada y narración, y comparar capítulos.',
  mente: 'Adverbios terminados en -mente («lentamente», «realmente») por cada mil palabras. En exceso alargan y suenan explicativos; muchas guías de estilo sugieren cuidarlos.',
  gerund: 'Palabras terminadas en -ando, -iendo o -yendo por cada mil. El gerundio es correcto, pero encadenado vuelve pesada la frase y a veces se usa mal para indicar algo posterior («llegó, saludando después»).',
  passive: 'Construcciones pasivas con «ser» («fue escrito», «han sido vistos») por cada mil palabras. En español son menos naturales que en inglés; suelen preferirse la activa o la pasiva con «se». Útiles cuando no importa quién hace la acción.',
  long: 'Porcentaje de palabras de cuatro sílabas o más. Influye mucho en la legibilidad: más palabras largas, texto más denso o técnico.',
  hist: 'Cuántas frases tienes de cada largo. Una prosa con mucha frase de 1 a 10 palabras se siente rápida y cortada; muchas sobre 30, lenta y envolvente. No hay un óptimo: muestra tu ritmo.',
  say: 'Verbos que introducen lo que alguien dice o piensa, con cuántas veces aparecen. «Dijo» es casi invisible para el lector y suele funcionar bien; la variedad excesiva («espetó», «inquirió») puede llamar la atención sobre sí misma.',
  table: 'Las mismas medidas para cada ' + 'parte del texto. Sirve para notar cambios de voz o de ritmo entre capítulos; en cursiva, lo que se aleja bastante del promedio. Toca una fila para ir a ese capítulo.'
};

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
        const sy = syllables(w);
        r.words++; r.syl += sy; toks.push(lw);
        if (w.length >= 7 && lw.endsWith('mente')) r.mente++;
        if (/(?:ando|iendo|yendo)$/.test(lw) && lw.length >= 5 && !NOT_GERUND.has(lw)) r.gerund++;
        if (sy >= 4) r.longWords++;
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
  /* Guía desplegable: qué es cada medida y cómo leer la legibilidad. */
  guide(all) {
    const d = h('details', { class: 'style-guide' });
    d.append(h('summary', { text: 'Cómo leer estas medidas' }));
    const scale = [[90, 100, 'Muy fácil', 'cuento infantil, cómic'], [80, 90, 'Fácil', 'novela juvenil, diálogo ágil'], [70, 80, 'Algo fácil', 'narrativa general, prensa'], [60, 70, 'Normal', 'novela adulta, columna'], [50, 60, 'Algo difícil', 'ensayo, divulgación'], [30, 50, 'Difícil', 'texto académico'], [0, 30, 'Muy difícil', 'texto técnico, jurídico o científico']];
    const tb = h('tbody');
    scale.forEach(([a, b, l, ej]) => { const me = all.legib >= a && (all.legib < b || b === 100); tb.append(h('tr', { class: me ? 'me' : '' }, h('td', { text: a + '–' + b }), h('td', { text: l }), h('td', { text: ej }), h('td', { text: me ? '← tu texto' : '' }))); });
    d.append(
      h('h5', { text: 'Legibilidad de Fernández Huerta' }),
      h('p', { text: 'En 1948, Rudolf Flesch propuso medir qué tan fácil es leer un texto en inglés contando el largo de sus palabras y de sus frases. En 1959, el pedagogo español José Fernández Huerta adaptó esa fórmula al español, que tiene palabras más largas. Es la medida de legibilidad más usada en nuestro idioma.' }),
      h('p', { class: 'formula', text: 'L = 206,84 − 0,60 × P − 1,02 × F' }),
      h('p', { text: 'P es el número de sílabas cada 100 palabras y F el número de frases cada 100 palabras. Palabras largas y frases largas bajan el puntaje. Las sílabas se cuentan de forma aproximada (diptongos e hiatos incluidos), así que el valor puede variar en uno o dos puntos.' }),
      h('table', { class: 'style-table scale' }, h('thead', null, h('tr', null, h('th', { text: 'Puntaje' }), h('th', { text: 'Lectura' }), h('th', { text: 'Típico de' }), h('th'))), tb),
      h('p', { class: 'muted', text: 'Ojo: mide la forma, no el contenido. Una frase corta y oscura puede puntuar alto, y una larga y clarísima, bajo. Úsala para comparar tus capítulos entre sí más que para compararte con una cifra ideal.' }),
      h('h5', { text: 'Las demás medidas' }),
      h('dl', null, ...[['Palabras por frase', STYLE_HELP.sent], ['Riqueza léxica', STYLE_HELP.rich], ['Diálogo', STYLE_HELP.dlg], ['Adverbios en -mente', STYLE_HELP.mente], ['Gerundios', STYLE_HELP.gerund], ['Pasiva con «ser»', STYLE_HELP.passive], ['Palabras largas', STYLE_HELP.long], ['Verbos de habla', STYLE_HELP.say]].flatMap(([t, x]) => [h('dt', { text: t }), h('dd', { text: x })])),
      h('p', { class: 'muted', text: 'Ninguna de estas cifras es buena o mala por sí sola: dependen del género, la voz y lo que buscas. Pasa el cursor (o toca) sobre cada cuadro para ver su explicación.' })
    );
    return d;
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
    const panel = h('div', { class: 'panel style-panel', id: 'st-estilo' });
    panel.append(h('h3', { text: 'Retrato del estilo' }), h('p', { class: 'muted', style: 'margin:-.4rem 0 .9rem;font-size:.8125rem', text: 'Medidas descriptivas, no reglas: sirven para ver tu voz y comparar ' + kindOf(P).units.toLowerCase() + ' entre sí.' }));
    if (all.words < 60) { panel.append(h('p', { class: 'muted', text: 'Escribe un poco más (unas 60 palabras) para ver el retrato.' })); wrap.append(panel); return; }
    panel.append(this.guide(all));
    const grid = h('div', { class: 'style-grid' });
    const cell = (k, v, sub, help) => grid.append(tipify(h('div', { class: 'style-cell' }, h('div', { class: 'k', text: k }), h('div', { class: 'v', text: v }), sub ? h('div', { class: 's', text: sub }) : null), help));
    const H = STYLE_HELP;
    cell('Legibilidad', this.num(all.legib), this.legibLabel(all.legib) + ' (Fernández Huerta)', H.legib);
    cell('Palabras por frase', this.num(all.meanSent, 1), this.rhythmLabel(all.cv), H.sent);
    cell('Riqueza léxica', this.num(100 * all.mattr) + '%', all.mattrExact ? 'palabras distintas cada 500' : 'palabras distintas (texto corto)', H.rich);
    cell('Diálogo', this.num(all.paras ? 100 * all.dlgParas / all.paras : 0) + '%', 'de los párrafos', H.dlg);
    cell('Adverbios en -mente', this.num(all.per1000(all.mente), 1), 'cada mil palabras', H.mente);
    cell('Gerundios', this.num(all.per1000(all.gerund), 1), 'cada mil palabras', H.gerund);
    cell('Pasiva con «ser»', this.num(all.per1000(all.passive), 1), 'cada mil palabras', H.passive);
    cell('Palabras largas', this.num(all.words ? 100 * all.longWords / all.words : 0) + '%', 'de cuatro sílabas o más', H.long);
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
    two.append(h('div', null, tipify(h('h4', { class: 'tip-h' }, 'Largo de las frases (palabras)'), STYLE_HELP.hist), hist));
    // verbos de decir
    const say = Object.entries(all.say).sort((a, b) => b[1] - a[1]);
    const totalSay = say.reduce((a, x) => a + x[1], 0);
    const sayBox = h('div', null, tipify(h('h4', { class: 'tip-h' }, 'Verbos de habla'), STYLE_HELP.say));
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
      panel.append(tipify(h('h4', { class: 'tip-h', style: 'margin-top:1.1rem' }, 'Por ' + App.unit().toLowerCase()), STYLE_HELP.table.replace('parte del texto', App.unit().toLowerCase()).replace('entre capítulos', 'entre ' + kindOf(P).units.toLowerCase()).replace('ese capítulo', 'esa parte')), h('div', { style: 'overflow-x:auto' }, tbl), h('p', { class: 'muted', style: 'margin:.4rem 0 0;font-size:.75rem', text: 'En cursiva, los valores que se alejan bastante del promedio del proyecto. Puede ser intencional.' }));
    }
    wrap.append(panel);
  }
};
window.Style = Style;
window.syllables = syllables;
