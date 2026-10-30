/* ============ modelo de texto: párrafos con segmentos y marcas ============ */
const segText = (s) => (s.t != null ? s.t : (s.m ? s.m.text : ''));
const parText = (p) => p.segs.map(segText).join('');
const chText = (c) => (c && c.paras ? c.paras.map(parText).join('\n\n') : '');

function normSegs(segs) {
  const out = [];
  segs.forEach(s => {
    if (s.t != null) {
      if (!s.t) return;
      const last = out[out.length - 1];
      if (last && last.t != null) last.t += s.t; else out.push({ t: s.t });
    } else if (s.m && s.m.text) out.push(s);
  });
  return out;
}
function splitSegs(segs, off) {
  const L = [], R = [];
  let pos = 0;
  segs.forEach(s => {
    const t = segText(s), len = t.length;
    if (pos + len <= off) L.push(s);
    else if (pos >= off) R.push(s);
    else {
      const k = off - pos;
      if (s.t != null) { L.push({ t: t.slice(0, k) }); R.push({ t: t.slice(k) }); }
      else { L.push({ m: Object.assign(clone(s.m), { text: t.slice(0, k) }) }); R.push({ t: t.slice(k) }); }
    }
    pos += len;
  });
  return [normSegs(L), normSegs(R)];
}
function insertTextAt(segs, off, text) {
  const [L, R] = splitSegs(segs, off);
  return normSegs(L.concat([{ t: text }], R));
}
function markRanges(p) {
  const out = []; let pos = 0;
  p.segs.forEach(s => { const len = segText(s).length; if (s.m) out.push({ m: s.m, start: pos, end: pos + len }); pos += len; });
  return out;
}
function wrapMark(p, start, end, mark) {
  if (end <= start) return false;
  if (markRanges(p).some(r => r.start < end && r.end > start)) return false;
  const [L, rest] = splitSegs(p.segs, start);
  const [M, R] = splitSegs(rest, end - start);
  mark.text = M.map(segText).join('');
  p.segs = normSegs(L.concat([{ m: mark }], R));
  return true;
}
function unwrapMark(p, id) {
  let hit = false;
  p.segs = normSegs(p.segs.map(s => { if (s.m && s.m.id === id) { hit = true; return { t: s.m.text }; } return s; }));
  return hit;
}
function findMark(ch, id) {
  if (!ch || !ch.paras) return null;
  for (const p of ch.paras) for (const s of p.segs) if (s.m && s.m.id === id) return { p: p, m: s.m };
  return null;
}
function allMarks(ch) {
  const out = [];
  if (ch && ch.paras) ch.paras.forEach(p => p.segs.forEach(s => { if (s.m) out.push({ p: p, m: s.m }); }));
  return out;
}
function insertMarkByText(p, text, mark) {
  const full = parText(p);
  let from = 0;
  while (true) {
    const k = full.indexOf(text, from);
    if (k < 0) return false;
    if (wrapMark(p, k, k + text.length, mark)) return true;
    from = k + 1;
  }
}
function textToParas(text) {
  return text.replace(/\r/g, '').split(/\n+/).map(s => s.trim()).filter(Boolean).map(s => ({ id: uid('p'), segs: [{ t: s.normalize('NFC') }] }));
}
function chapterWords(ch) { return ch && ch.paras ? ch.paras.reduce((n, p) => n + countWords(parText(p)), 0) : 0; }

/* Marca vieja de Claude que una nueva revisión puede reemplazar. */
function isStale(m, keepIds, who) {
  return m.by === (who || 'claude') && !m.done && !m.keep && !(m.replies && m.replies.length) && !(keepIds && keepIds.has(m.id));
}
function protectedMarkIds(project) {
  const s = new Set();
  ((project && project.threads) || []).forEach(t => { if (t.markId) s.add(t.markId); });
  return s;
}

/* Reemplazo de texto en segmentos (no cruza límites de marcas). */
function buildMatcher(q, opts) {
  if (!q) return null;
  const src = escRe(opts && opts.exact ? q : fold(q));
  const body = (opts && opts.word) ? '(?<![\\p{L}\\p{N}])' + src + '(?![\\p{L}\\p{N}])' : src;
  try { return new RegExp(body, 'gu'); } catch (e) { return null; }
}
function findInText(text, re, opts) {
  const hay = opts && opts.exact ? text : fold(text);
  const out = []; re.lastIndex = 0; let m;
  while ((m = re.exec(hay))) { if (!m[0].length) { re.lastIndex++; continue; } out.push([m.index, m.index + m[0].length]); }
  return out;
}
function replaceInPara(p, re, opts, repl) {
  let n = 0;
  p.segs = normSegs(p.segs.map(s => {
    const t = segText(s);
    const hits = findInText(t, re, opts);
    if (!hits.length) return s;
    let o = '', last = 0;
    hits.forEach(([a, b]) => { o += t.slice(last, a) + repl; last = b; n++; });
    o += t.slice(last);
    if (s.t != null) return { t: o };
    const m = clone(s.m); m.text = o; return { m: m };
  }));
  return n;
}
