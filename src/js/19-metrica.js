/* ============ métrica: medición de versos en español, sin IA ============
   Reglas: sílabas fonológicas, sinalefa, ley del acento final (aguda +1, llana =, esdrújula −1),
   licencias posibles (hiato, diéresis, sinéresis), cesura en versos compuestos, rima consonante y asonante. */
const MET_V = 'aeiouáéíóúü', MET_STRONG = 'aeoáéó', MET_ACC = 'áéíóú', MET_ACCW = 'íú';
const MET_ATONAS = new Set(['el', 'la', 'lo', 'los', 'las', 'al', 'del', 'a', 'ante', 'bajo', 'con', 'contra', 'de', 'desde', 'en', 'entre', 'hacia', 'hasta', 'para', 'por', 'sin', 'so', 'sobre', 'tras', 'y', 'e', 'ni', 'o', 'u', 'que', 'pero', 'mas', 'aunque', 'si', 'porque', 'pues', 'me', 'te', 'se', 'nos', 'os', 'le', 'les', 'mi', 'tu', 'su', 'mis', 'tus', 'sus', 'quien', 'quienes', 'donde', 'cuando', 'como', 'cual', 'cuales', 'cuan', 'cuanto', 'tan']);
const MET_NAMES = { 2: 'bisílabo', 3: 'trisílabo', 4: 'tetrasílabo', 5: 'pentasílabo', 6: 'hexasílabo', 7: 'heptasílabo', 8: 'octosílabo', 9: 'eneasílabo', 10: 'decasílabo', 11: 'endecasílabo', 12: 'dodecasílabo', 13: 'tridecasílabo', 14: 'alejandrino', 15: 'pentadecasílabo', 16: 'hexadecasílabo', 17: 'heptadecasílabo', 18: 'octodecasílabo' };
const MET_ONSET = new Set(['pr', 'br', 'tr', 'dr', 'cr', 'kr', 'gr', 'fr', 'pl', 'bl', 'cl', 'kl', 'gl', 'fl']);

const Metrica = {
  /* ---------- palabra ---------- */
  word(w) {
    const lw = w.toLowerCase();
    // letras que suenan como vocal (y final tras vocal, y sola) y u muda (que, qui, gue, gui)
    const isV = [];
    for (let i = 0; i < lw.length; i++) {
      const c = lw[i];
      if (MET_V.includes(c)) {
        if (c === 'u' && i > 0 && (lw[i - 1] === 'q' || lw[i - 1] === 'g') && 'eiéí'.includes(lw[i + 1] || '')) { isV.push(false); continue; }
        isV.push(true);
      } else if (c === 'y') isV.push(lw.length === 1 || (i === lw.length - 1 && i > 0 && MET_V.includes(lw[i - 1])));
      else isV.push(false);
    }
    const weak = (c) => !MET_STRONG.includes(c);
    const vv = (c) => c === 'y' ? 'i' : c;
    // núcleos: vocales seguidas que forman diptongo o triptongo
    const nuc = []; let cur = null;
    for (let i = 0; i < lw.length; i++) {
      if (!isV[i]) { cur = null; continue; }
      const c = vv(lw[i]);
      if (cur) {
        const p = vv(lw[cur.e]);
        const hiato = (!weak(p) && !weak(c)) || MET_ACCW.includes(p) || MET_ACCW.includes(c) || (p === c);
        if (!hiato) { cur.e = i; continue; }
      }
      cur = { s: i, e: i }; nuc.push(cur);
    }
    if (!nuc.length) return { w: w, syl: [w], n: 1, stress: 0, type: 'aguda', vStart: false, vEnd: false, diph: 0, hiat: 0 };
    // reparto de consonantes entre núcleos
    const cuts = [];
    for (let k = 0; k < nuc.length - 1; k++) {
      const a = nuc[k].e + 1, b = nuc[k + 1].s;
      const units = []; let i = a;
      while (i < b) { const two = lw.slice(i, i + 2); if ((two === 'ch' || two === 'll' || two === 'rr') && i + 1 < b) { units.push([i, i + 2]); i += 2; } else if ((lw[i] === 'q' || lw[i] === 'g') && lw[i + 1] === 'u' && !isV[i + 1] && i + 1 < b) { units.push([i, i + 2]); i += 2; } else { units.push([i, i + 1]); i++; } }
      const key = (u) => lw.slice(u[0], u[1]);
      let cut;
      if (units.length === 0) cut = a;
      else if (units.length === 1) cut = units[0][0];
      else if (units.length === 2) cut = MET_ONSET.has(key(units[0]) + key(units[1])) ? units[0][0] : units[1][0];
      else if (units.length === 3) cut = MET_ONSET.has(key(units[1]) + key(units[2])) ? units[1][0] : units[2][0];
      else cut = units[units.length - 2][0];
      cuts.push(cut);
    }
    const syl = []; let st = 0;
    cuts.forEach(c => { syl.push(w.slice(st, c)); st = c; });
    syl.push(w.slice(st));
    // acento: tilde; si no, llana si termina en vocal, n o s; aguda en el resto
    let stress = -1;
    nuc.forEach((n, k) => { for (let i = n.s; i <= n.e; i++) if (MET_ACC.includes(lw[i])) stress = k; });
    if (stress < 0) {
      const last = lw[lw.length - 1];
      const llana = (MET_V.includes(last) && last !== 'y') || ((last === 'n' || last === 's') && lw.length > 1 && !/[^aeiou]y?[ns]$/.test('') );
      stress = nuc.length === 1 ? 0 : (llana && !(last === 'y') ? nuc.length - 2 : nuc.length - 1);
      if (/[aeiou]y$/.test(lw)) stress = nuc.length - 1;
    }
    const n = nuc.length;
    let diph = 0, hiat = 0;
    nuc.forEach(x => { if (x.e > x.s) diph++; });
    for (let k = 0; k < n - 1; k++) if (nuc[k].e + 1 === nuc[k + 1].s && !MET_ACCW.includes(lw[nuc[k].e]) && !MET_ACCW.includes(lw[nuc[k + 1].s]) && !weak(vv(lw[nuc[k].e])) && !weak(vv(lw[nuc[k + 1].s]))) hiat++;
    const first = lw[0], second = lw[1] || '';
    const hCons = first === 'h' && 'iu'.includes(second) && MET_V.includes(lw[2] || '') && !'iu'.includes(lw[2] || '');
    const vStart = isV[0] || (first === 'h' && MET_V.includes(second) && !hCons) || (first === 'y' && lw.length === 1);
    const vEnd = isV[lw.length - 1];
    return { w: w, syl: syl, n: n, stress: stress, type: stress === n - 1 ? 'aguda' : stress === n - 2 ? 'llana' : 'esdrújula', vStart: vStart, vEnd: vEnd, diph: diph, hiat: hiat, nuc: nuc, lw: lw };
  },
  /* ---------- verso ---------- */
  tokens(text) {
    const out = []; const re = /[\p{L}]+/gu; let m, last = 0;
    while ((m = re.exec(text))) { out.push({ w: m[0], gap: text.slice(last, m.index) }); last = m.index + m[0].length; }
    return out;
  },
  /* Mide una secuencia de palabras como verso simple (o hemistiquio). */
  measure(toks) {
    const W = toks.map(t => Object.assign(this.word(t.w), { gap: t.gap }));
    if (!W.length) return null;
    // «y» entre vocal y vocal se apoya en la palabra siguiente (rosa y azucena: sa·ya·zu)
    const sin = []; const syl = []; let phon = 0;
    W.forEach((x, i) => {
      phon += x.n;
      x.start = syl.length;
      const prev = W[i - 1];
      const yBridge = x.lw === 'y' && W[i + 1] && W[i + 1].vStart && prev && prev.vEnd;
      let merge = false;
      if (prev && prev.vEnd && x.vStart && !prev.yNext) merge = true;
      if (yBridge) { x.yNext = true; merge = false; }
      const parts = x.syl.map((s, k) => ({ t: s, acc: k === x.stress && (!MET_ATONAS.has(x.lw) || i === W.length - 1), wi: i }));
      if (prev && prev.yNext) {
        // la y se pega a la primera sílaba de esta palabra
        const ys = syl.pop(); parts[0] = { t: ys.t + ' ' + parts[0].t, acc: parts[0].acc, wi: i, ybridge: true };
        phon -= 1; x.start = syl.length;
      }
      if (merge) {
        const pause = /[.;:!?—…]/.test(x.gap);
        const a = syl.pop();
        sin.push({ a: a.t, b: parts[0].t, pause: pause, stressed: parts[0].acc || a.acc, at: syl.length });
        parts[0] = { t: a.t + '‿' + parts[0].t, acc: a.acc || parts[0].acc, wi: i, sin: true };
        x.start = syl.length;
      }
      parts.forEach(p => syl.push(p));
    });
    const last = W[W.length - 1];
    const adj = last.type === 'aguda' ? 1 : last.type === 'esdrújula' ? -1 : 0;
    const count = syl.length + adj;
    const accents = []; syl.forEach((s, i) => { if (s.acc) accents.push(i + 1); });
    return { words: W, syl: syl, phon: phon, sin: sin, last: last, adj: adj, count: count, accents: accents };
  },
  verse(text) {
    const toks = this.tokens(text);
    if (!toks.length) return null;
    const v = this.measure(toks);
    v.text = text;
    v.hasDigits = /\d/.test(text);
    v.diph = v.words.reduce((a, x) => a + x.diph, 0);
    v.hiat = v.words.reduce((a, x) => a + x.hiat, 0);
    v.rhyme = this.rhyme(v.last);
    v.min = v.count - v.hiat; v.max = v.count + v.sin.length + v.diph;
    v.toks = toks;
    return v;
  },
  /* Versos compuestos: dos hemistiquios sin sinalefa entre ellos y con ley del acento en cada uno. */
  compound(v, target) {
    const halves = { 14: 7, 12: 6, 16: 8, 10: 5 }[target];
    if (!halves || v.toks.length < 2) return null;
    let best = null;
    for (let k = 1; k < v.toks.length; k++) {
      const a = this.measure(v.toks.slice(0, k)), b = this.measure(v.toks.slice(k));
      if (a && b && a.count === halves && b.count === halves) { const pause = /[,.;:!?—…]/.test(v.toks[k].gap); if (!best || pause) best = { k: k, a: a, b: b, pause: pause }; if (pause) break; }
    }
    return best;
  },
  /* ---------- rima ---------- */
  rhyme(last) {
    if (!last || !last.nuc) return { cons: '', ason: '' };
    const lw = last.lw, st = last.nuc[last.stress];
    // desde la vocal tónica (en un diptongo, la fuerte o la tildada): huerta y cierta riman en «erta»
    let from = st.s;
    for (let i = st.s; i <= st.e; i++) if (MET_ACC.includes(lw[i])) { from = i; break; } else if (MET_STRONG.includes(lw[i])) from = i;
    let tail = lw.slice(from);
    // en el núcleo tónico, la vocal que suena es la fuerte (o la tildada)
    const cons = tail.normalize('NFD').replace(/[́]/g, '').normalize('NFC').replace(/ü/g, 'u').replace(/ch/g, '§').replace(/v/g, 'b').replace(/z/g, 's').replace(/c([ei])/g, 's$1').replace(/qu([ei])/g, 'k$1').replace(/c/g, 'k').replace(/h/g, '').replace(/ll/g, 'y').replace(/g([ei])/g, 'j$1').replace(/gu([ei])/g, 'g$1').replace(/y$/, 'i').replace(/§/g, 'ch');
    const pick = (n) => { const seg = lw.slice(n.s, n.e + 1); const acc = Array.from(seg).find(c => MET_ACC.includes(c)); if (acc) return acc; const strong = Array.from(seg).find(c => MET_STRONG.includes(c)); return strong || seg[seg.length - 1]; };
    const plain = (c) => c.normalize('NFD').replace(/[́̈]/g, '').replace('y', 'i');
    const vs = [plain(pick(st))];
    if (last.stress < last.n - 1) { let lv = plain(pick(last.nuc[last.n - 1])); if (lv === 'i') lv = 'e'; if (lv === 'u') lv = 'o'; vs.push(lv); }
    // en la estrofa de cierre, la «e» y la «i» átonas finales riman entre sí (Venus ~ eo), igual «u» y «o»
    return { cons: cons, ason: vs.join('-') };
  },
  /* ---------- poema ---------- */
  poem(lines) {
    // lines: [{pid, text}] ; las líneas vacías separan estrofas
    const verses = [], stanzas = []; let cur = [];
    lines.forEach(l => {
      const t = (l.text || '').trim();
      if (!t) { if (cur.length) { stanzas.push(cur); cur = []; } return; }
      const v = this.verse(t); if (!v) return;
      v.pid = l.pid; v.idx = verses.length; v.stanza = stanzas.length;
      verses.push(v); cur.push(v);
    });
    if (cur.length) stanzas.push(cur);
    if (!verses.length) return { verses: [], stanzas: [] };
    // medida dominante y medidas admitidas
    const freq = (arr) => { const f = new Map(); arr.forEach(c => f.set(c, (f.get(c) || 0) + 1)); return f; };
    let f = freq(verses.map(v => v.count));
    let dom = Array.from(f.entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
    // versos compuestos (alejandrinos, dodecasílabos…): se miden por hemistiquios
    const longish = verses.filter(v => v.count >= 12).length >= Math.max(1, verses.length * 0.4);
    if (longish) {
      const targets = [14, 12, 16];
      const fit = (t) => verses.filter(v => v.count === t || this.compound(v, t)).length;
      const tBest = targets.map(t => [t, fit(t)]).sort((a, b) => b[1] - a[1])[0];
      if (tBest[1] >= verses.length * 0.4) verses.forEach(v => { if (v.count !== tBest[0]) { const c = this.compound(v, tBest[0]); if (c) { v.comp = c; v.simple = v.count; v.count = tBest[0]; } } else { const c = this.compound(v, tBest[0]); if (c) v.comp = c; } });
      f = freq(verses.map(v => v.count));
      dom = Array.from(f.entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
    }
    const n = verses.length;
    const allowed = Array.from(f.entries()).filter(([c, k]) => k >= Math.max(2, Math.ceil(n * 0.2))).map(([c]) => c);
    if (!allowed.includes(dom)) allowed.push(dom);
    const regular = n >= 3 && (f.get(dom) / n >= 0.5 || allowed.reduce((a, c) => a + f.get(c), 0) / n >= 0.8);
    // licencias que harían calzar los versos desviados
    verses.forEach(v => {
      v.ok = allowed.includes(v.count);
      if (!regular || v.ok) return;
      const t = allowed.slice().sort((a, b) => Math.abs(a - v.count) - Math.abs(b - v.count))[0];
      v.target = t;
      const d = t - v.count;
      if (d > 0 && d <= v.sin.length + v.diph) {
        const hs = v.sin.slice().sort((a, b) => (b.pause - a.pause) || (b.stressed - a.stressed));
        const sug = hs.slice(0, d).map(s => 'hiato en «' + s.a + ' ' + s.b + '»');
        if (sug.length < d) v.words.filter(x => x.diph).slice(0, d - sug.length).forEach(x => sug.push('diéresis en «' + x.w + '»'));
        v.lic = sug;
      } else if (d < 0 && -d <= v.hiat) {
        v.lic = v.words.filter(x => x.hiat).slice(0, -d).map(x => 'sinéresis en «' + x.w + '»');
      }
    });
    this.scheme(verses);
    const forms = stanzas.map(s => this.stanzaForm(s));
    const whole = this.poemForm(verses, stanzas, forms, dom, regular, allowed);
    return { verses: verses, stanzas: stanzas, dom: dom, allowed: allowed, regular: regular, forms: forms, whole: whole, freq: f };
  },
  scheme(verses) {
    // 1) rima consonante: mismos sonidos desde la vocal tónica; 2) los versos que quedan sueltos se agrupan por asonancia
    const groups = [];
    verses.forEach(v => {
      const g = v.rhyme.cons && groups.find(g => g.cons === v.rhyme.cons);
      if (g) g.members.push(v); else groups.push({ cons: v.rhyme.cons, ason: v.rhyme.ason, members: [v], kind: 'consonante' });
    });
    groups.filter(g => g.members.length === 1).forEach(g => {
      if (!groups.includes(g)) return;
      const host = groups.filter(o => o !== g && o.ason === g.ason).sort((a, b) => b.members.length - a.members.length)[0];
      if (host && (host.members.length === 1 || host.kind === 'asonante' || verses.length >= 8)) {
        if (host.members.length > 1 && host.kind === 'consonante' && verses.length < 8) return;
        host.members.push(g.members[0]); host.members.sort((a, b) => a.idx - b.idx); host.kind = 'asonante';
        groups.splice(groups.indexOf(g), 1);
      }
    });
    groups.sort((a, b) => a.members[0].idx - b.members[0].idx);
    let li = 0; const L = 'abcdefghijklmnopqrstuvwxyz';
    groups.forEach(g => { g.letter = g.members.length > 1 ? L[li++ % 26] : null; });
    verses.forEach(v => {
      const g = groups.find(g => g.members.includes(v));
      v.rkind = g.members.length > 1 ? g.kind : null;
      v.letter = g.letter ? (v.count > 8 ? g.letter.toUpperCase() : g.letter) : '–';
    });
    return groups;
  },
  pattern(vs) {
    // reetiqueta las letras dentro de la estrofa: «CDC» → «aba»
    const map = new Map(); let i = 0; const L = 'abcdefghij';
    return vs.map(v => { if (v.letter === '–') return '-'; const k = v.letter.toLowerCase(); if (!map.has(k)) map.set(k, L[i++]); return map.get(k); }).join('');
  },
  stanzaForm(vs) {
    const n = vs.length, p = this.pattern(vs), c = vs.map(v => v.count);
    const all = (x) => c.every(y => y === x), mayor = c.every(y => y >= 9), menor = c.every(y => y <= 8);
    const ason = vs.some(v => v.rkind === 'asonante');
    const F = (name, why) => ({ name: name, why: why, pattern: p });
    if (n === 2 && p === 'aa') return F('Pareado', 'Dos versos que riman entre sí.');
    if (n === 3 && mayor && p === 'aba') return F('Terceto', 'Tres versos de arte mayor; riman el primero y el tercero (ABA).');
    if (n === 3 && menor && p === 'aba') return F('Tercerilla', 'Tres versos de arte menor con rima aba.');
    if (n === 4) {
      if (all(14) && p === 'aaaa') return F('Cuaderna vía', 'Cuatro alejandrinos monorrimos (AAAA).');
      if (mayor && p === 'abba') return F('Cuarteto', 'Cuatro versos de arte mayor, rima abrazada ABBA.');
      if (mayor && p === 'abab') return F('Serventesio', 'Cuatro versos de arte mayor, rima cruzada ABAB.');
      if (menor && p === 'abba') return F('Redondilla', 'Cuatro versos de arte menor, rima abrazada abba.');
      if (menor && p === 'abab') return F('Cuarteta', 'Cuatro versos de arte menor, rima cruzada abab.');
      if (c.join() === '7,5,7,5' && /^-a-a$/.test(p)) return F('Seguidilla', 'Heptasílabos y pentasílabos alternados (7-5-7-5) con rima en los pares.');
      if (menor && /^-a-a$/.test(p)) return F('Copla', 'Cuatro versos de arte menor con rima ' + (ason ? 'asonante' : '') + ' en los pares.');
    }
    if (n === 5) {
      if (c.join() === '7,11,7,7,11' && p === 'abaab') return F('Lira', 'Heptasílabos y endecasílabos (7-11-7-7-11) con rima aBabB.');
      const ok5 = !/(.)\1\1/.test(p) && p[3] !== p[4] && new Set(p).size === 2 && !p.includes('-');
      if (menor && ok5) return F('Quintilla', 'Cinco versos de arte menor con dos rimas, sin tres seguidas iguales ni pareado final.');
      if (mayor && ok5) return F('Quinteto', 'Cinco versos de arte mayor con dos rimas, sin tres seguidas iguales.');
    }
    if (n === 6 && mayor && p === 'ababcc') return F('Sexta rima', 'Seis versos de arte mayor: ABABCC.');
    if (n === 6 && menor && !p.includes('-')) return F('Sextilla', 'Seis versos de arte menor rimados.');
    if (n === 8 && all(11) && p === 'abababcc') return F('Octava real', 'Ocho endecasílabos con rima ABABABCC.');
    if (n === 8 && menor && !p.includes('-')) return F('Octavilla', 'Ocho versos de arte menor rimados.');
    if (n === 10 && all(8) && p === 'abbaaccddc') return F('Décima espinela', 'Diez octosílabos con rima abbaaccddc.');
    if (n === 14 && all(11) && /^abbaabba/.test(p)) return F('Soneto (en una estrofa)', 'Catorce endecasílabos: dos cuartetos ABBA ABBA y dos tercetos.');
    return null;
  },
  poemForm(verses, stanzas, forms, dom, regular, allowed) {
    const n = verses.length;
    const sizes = stanzas.map(s => s.length).join('-');
    if (n === 14 && verses.filter(v => v.count === 11 || v.target === 11 && v.lic).length >= 13 && (sizes === '4-4-3-3' || sizes === '14')) {
      const p = this.pattern(verses);
      if (/^abbaabba/.test(p)) return { name: 'Soneto', why: 'Catorce endecasílabos en dos cuartetos (ABBA ABBA) y dos tercetos' + (p.slice(8) ? ' (' + p.slice(8, 11).toUpperCase() + ' ' + p.slice(11).toUpperCase() + ')' : '') + '.' };
    }
    const even = verses.filter((v, i) => i % 2 === 1), odd = verses.filter((v, i) => i % 2 === 0);
    const evenSame = even.length >= 3 && even.every(v => v.rhyme.ason === even[0].rhyme.ason);
    const oddFree = odd.filter(v => v.rhyme.ason === (even[0] && even[0].rhyme.ason)).length <= 1;
    if (n >= 8 && evenSame && oddFree) {
      if (dom === 8) return { name: 'Romance', why: 'Octosílabos con rima asonante (' + even[0].rhyme.ason + ') en los versos pares; los impares quedan libres.' };
      if (dom === 11) return { name: 'Romance heroico', why: 'Endecasílabos con rima asonante en los pares.' };
      if (dom < 8) return { name: 'Romancillo', why: 'Versos de menos de ocho sílabas con rima asonante en los pares.' };
    }
    if (n >= 6 && allowed.length >= 2 && allowed.every(c => c === 7 || c === 11) && verses.filter(v => v.count === 7 || v.count === 11).length / n >= 0.85) return { name: 'Silva', why: 'Combinación libre de heptasílabos y endecasílabos.' };
    const named = forms.filter(Boolean);
    if (named.length && named.length === stanzas.length) {
      const names = Array.from(new Set(named.map(x => x.name)));
      return { name: names.length === 1 ? (stanzas.length > 1 ? names[0] + 's (' + stanzas.length + ')' : names[0]) : 'Estrofas: ' + names.join(', '), why: '' };
    }
    if (!regular) return { name: 'Verso libre o polimétrico', why: 'No hay una medida que domine: puede ser verso libre. En ese caso, la medida es solo orientación.' };
    return { name: 'Poema en ' + (MET_NAMES[dom] || dom + ' sílabas') + 's', why: '' };
  },
  /* ---------- textos de ayuda ---------- */
  explain(v) {
    const parts = [v.phon + ' sílabas fonológicas'];
    if (v.sin.length) parts.push('− ' + v.sin.length + ' por sinalefa');
    if (v.adj > 0) parts.push('+ 1 por terminar en aguda («' + v.last.w + '»)');
    if (v.adj < 0) parts.push('− 1 por terminar en esdrújula («' + v.last.w + '»)');
    let s = parts.join(' ') + ' = ' + (v.comp ? v.simple : v.count) + '.';
    if (v.comp) s = 'Verso compuesto: ' + v.comp.a.count + ' + ' + v.comp.b.count + ' (cesura después de «' + v.toks[v.comp.k - 1].w + '»; cada hemistiquio se mide aparte, sin sinalefa entre ellos y con su propia ley del acento).';
    return s;
  },
  rhythm(v) {
    if (v.count !== 11 || v.comp) return '';
    const a = new Set(v.accents);
    if (a.has(6)) return a.has(1) && !a.has(2) && !a.has(3) ? 'enfático (1-6-10)' : a.has(2) ? 'heroico (2-6-10)' : a.has(3) ? 'melódico (3-6-10)' : 'a maiore (6-10)';
    if (a.has(4) && a.has(8)) return 'sáfico (4-8-10)';
    if (a.has(4) && a.has(7)) return 'de gaita gallega (4-7-10)';
    return 'sin los acentos clásicos en 6.ª o 4.ª y 8.ª';
  },
  /* ---------- en el editor: sílabas al margen ---------- */
  on() { const P = App.P(); return App.prefs.metric != null ? !!App.prefs.metric : !!(P && P.kind === 'poesia'); },
  decorate() {
    const root = window.Editor && Editor.root; if (!root) return;
    const on = this.on();
    root.classList.toggle('show-met', on);
    if (!on) { $$('p[data-met]', root).forEach(p => p.removeAttribute('data-met')); return; }
    const d = Editor.cdoc && Editor.cdoc.data; if (!d) return;
    const r = this.poem(d.paras.map(p => ({ pid: p.id, text: parText(p) })));
    const by = new Map(r.verses.map(v => [v.pid, v]));
    $$('p', root).forEach(pe => {
      const v = by.get(pe.dataset.id);
      if (!v) { pe.removeAttribute('data-met'); pe.classList.remove('met-off'); return; }
      pe.dataset.met = v.count + (v.letter !== '–' ? ' ' + v.letter : '');
      pe.classList.toggle('met-off', r.regular && !v.ok);
    });
  },
  /* ---------- panel ---------- */
  open() {
    const d = Editor.cdoc && Editor.cdoc.data; if (!d) return;
    const r = this.poem(d.paras.map(p => ({ pid: p.id, text: parText(p) })));
    const body = h('div', { class: 'met-panel' });
    if (!r.verses.length) { body.append(h('p', { class: 'muted', text: 'Escribe un poema (un verso por línea, con una línea en blanco entre estrofas) para medirlo.' })); }
    else {
      const sum = h('div', { class: 'met-sum' });
      const fCount = Array.from(r.freq.entries()).sort((a, b) => b[1] - a[1]).map(([c, k]) => k + ' ' + (MET_NAMES[c] || c + ' s.') + (k > 1 ? 's' : '')).join(' · ');
      sum.append(h('div', { class: 'met-form' }, h('b', { text: r.whole.name }), r.whole.why ? h('span', { text: r.whole.why }) : null));
      sum.append(tipify(h('div', { class: 'met-line' }, h('span', { class: 'k', text: 'Medidas' }), h('span', { text: fCount })), 'Cuántos versos hay de cada medida. Arte menor: hasta 8 sílabas; arte mayor: 9 o más.'));
      sum.append(tipify(h('div', { class: 'met-line' }, h('span', { class: 'k', text: 'Rima' }), h('span', { class: 'mono', text: r.stanzas.map(s => s.map(v => v.letter).join('')).join(' ') })), 'Esquema de rima: cada letra es una rima; mayúscula para versos de arte mayor y minúscula para arte menor. «–» es un verso suelto, sin rima con otro.'));
      body.append(sum);
      body.append(this.guide());
      r.stanzas.forEach((s, si) => {
        const f = r.forms[si];
        const st = h('div', { class: 'met-stanza' });
        if (r.stanzas.length > 1 || f) st.append(h('div', { class: 'met-sh' }, h('span', { text: 'Estrofa ' + (si + 1) }), f ? tipify(h('b', { text: f.name }), f.why) : null));
        s.forEach(v => {
          const line = h('div', { class: 'met-syl' });
          v.syl.forEach((x, i) => { if (i) line.append(h('i', { text: ' · ' })); line.append(h('span', { class: (x.acc ? 'ms-a' : '') + (x.sin ? ' ms-s' : ''), text: x.t.replace(/ /g, '') })); });
          if (v.adj) line.append(h('em', { class: 'ms-adj', text: v.adj > 0 ? ' +1' : ' −1' }));
          const notes = [];
          const rh = this.rhythm(v); if (rh) notes.push('Endecasílabo ' + rh + '.');
          if (v.lic) notes.push('Con ' + v.lic.join(' y ') + ', mediría ' + v.target + '.');
          else if (r.regular && !v.ok) notes.push('Se aparta de la medida del poema (' + r.allowed.map(c => MET_NAMES[c] || c).join(' o ') + ').');
          if (v.hasDigits) notes.push('Tiene cifras: escríbelas con letras para medirlas.');
          const row = h('div', { class: 'met-row' + (r.regular && !v.ok ? ' off' : ''), onclick: (e) => { if (e.target.closest('.has-tip')) return; Editor.setCaret && Editor.setCaret({ pid: v.pid, off: 0 }); const pe = Editor.root.querySelector('p[data-id="' + v.pid + '"]'); if (pe) pe.scrollIntoView({ block: 'center', behavior: 'smooth' }); } },
            tipify(h('span', { class: 'met-n', text: String(v.count) }), this.explain(v) + (v.accents.length ? ' Acentos en las sílabas ' + v.accents.join(', ') + '.' : '')),
            h('div', { class: 'met-txt' }, h('div', { class: 'met-v', text: v.text }), line, notes.length ? h('div', { class: 'met-note', text: notes.join(' ') }) : null),
            tipify(h('span', { class: 'met-r', text: v.letter }), v.letter === '–' ? 'Verso sin rima con otro (suelto).' : 'Rima ' + v.rkind + ' en «' + v.rhyme.cons + '»' + (v.rkind === 'asonante' ? ' (vocales ' + v.rhyme.ason + ')' : '') + '.'));
          st.append(row);
        });
        body.append(st);
      });
    }
    const foot = h('div', { class: 'row', style: 'width:100%' }, h('label', { class: 'row', style: 'gap:.4rem;font-size:.85rem' }, (() => { const c = h('input', { type: 'checkbox', checked: this.on() }); c.addEventListener('change', () => { App.prefs.metric = c.checked; App.savePrefs(); this.decorate(); }); return c; })(), 'Sílabas y rima al margen'), h('span', { class: 'spacer' }), btn('Volver a medir', () => this.open(), 'small'), btn('Cerrar', () => UI.closeDrawer(), 'primary'));
    if (UI.drawerOpen('metrica')) { const st = UI.drawerState; st.body.textContent = ''; st.body.append(body); return; }
    UI.drawer({ title: 'Métrica', key: 'metrica', body: body, foot: foot });
  },
  guide() {
    const d = h('details', { class: 'style-guide' });
    d.append(h('summary', { text: 'Reglas de medición' }));
    const dl = h('dl');
    [
      ['Sílabas fonológicas', 'Se cuentan las sílabas como suenan. Dos vocales fuertes (a, e, o) van en sílabas distintas (po-e-ta); una débil (i, u) sin tilde junto a otra vocal forma diptongo (cie-lo, sua-ve); la débil con tilde rompe el diptongo (rí-o). La u de «que», «qui», «gue», «gui» no suena.'],
      ['Sinalefa', 'Si una palabra termina en vocal y la siguiente empieza con vocal (o con h muda), ambas se unen en una sola sílaba: «pa-ro‿a con-tem-plar». Aquí se marca con ‿. La «y» entre vocales se apoya en la palabra siguiente: «ro-sa y a-zu-ce-na» → ro·sa·ya·zu·ce·na.'],
      ['Ley del acento final', 'La última palabra del verso cambia la cuenta: si es aguda (co-ra-zón) se suma una sílaba; si es llana (ver-de) queda igual; si es esdrújula (cán-ta-ro) se resta una.'],
      ['Licencias', 'Recursos que el poeta puede usar para ajustar la medida: hiato (deshacer una sinalefa, +1), diéresis (separar un diptongo, sü-a-ve, +1) y sinéresis (juntar dos vocales fuertes, poe-ta, −1). Cuando un verso no calza, se indica qué licencia lo haría calzar; decidir si se usa es tuyo.'],
      ['Versos compuestos', 'Los de 12 sílabas o más suelen partirse en dos hemistiquios con una pausa (cesura). Cada mitad se mide aparte, con su propia ley del acento y sin sinalefa entre ellas. El alejandrino es 7 + 7.'],
      ['Arte menor y mayor', 'Hasta 8 sílabas es arte menor (octosílabo, heptasílabo…); desde 9, arte mayor (endecasílabo, alejandrino…). En el esquema de rima, minúsculas para arte menor y mayúsculas para arte mayor.'],
      ['Rima', 'Consonante: coinciden todos los sonidos desde la última vocal acentuada (canción / razón). Asonante: coinciden solo las vocales (luna / bruma: u-a). En la asonancia, la i y la u finales átonas valen como e y o.'],
      ['Acentos del endecasílabo', 'Lleva acento en la 10.ª sílaba y, según dónde caigan los otros, se llama heroico (2-6-10), melódico (3-6-10), enfático (1-6-10) o sáfico (4-8-10). Las palabras átonas (artículos, preposiciones, «que», «mi», «su»…) no cuentan como acento.'],
      ['Límites', 'La medición es automática y aproximada. Las palabras extranjeras, las siglas, las cifras y algunos diptongos dudosos (gui-on o guion) pueden variar en una sílaba. Las licencias dependen de cómo lees el verso.']
    ].forEach(([t, x]) => dl.append(h('dt', { text: t }), h('dd', { text: x })));
    d.append(dl);
    return d;
  }
};
window.Metrica = Metrica;
