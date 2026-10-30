import nspell from 'nspell';
let sp = null, loading = null;
const extra = new Set();
function fold(s) { return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase(); }
async function load(base) {
  const [aff, dic] = await Promise.all([fetch(base + 'es.aff').then(r => r.text()), fetch(base + 'es.dic').then(r => r.text())]);
  sp = nspell(aff, dic);
}
function ok(w) {
  if (extra.has(w) || extra.has(w.toLowerCase())) return true;
  if (sp.correct(w)) return true;
  const lw = w.toLowerCase();
  if (lw !== w && sp.correct(lw)) return true;
  // adverbios en -mente: válidos si el adjetivo existe
  const m = lw.match(/^(.+)mente$/);
  if (m && m[1].length > 2 && (sp.correct(m[1]) || sp.correct(m[1].replace(/a$/, 'o')))) return true;
  // enclíticos frecuentes: dámelo, diciéndole, etc. Se aceptan si la base sin tilde es verbo válido
  const enc = lw.match(/^(.+?)(selo|sela|selos|selas|melo|mela|telo|tela|nos|les|los|las|lo|la|le|me|te|se)$/);
  if (enc && enc[1].length > 2) { const b = fold(enc[1]); if (sp.correct(b) || sp.correct(enc[1])) return true; }
  return false;
}
function suggest(w) {
  const lw = w.toLowerCase();
  let s = sp.suggest(lw);
  const f = fold(lw);
  s.sort((a, b) => (fold(b) === f) - (fold(a) === f));
  if (w[0] !== lw[0]) s = s.map(x => x[0].toUpperCase() + x.slice(1));
  return s.slice(0, 4);
}
self.onmessage = async (e) => {
  const { id, type, base, words, add } = e.data;
  try {
    if (type === 'init') { if (!loading) loading = load(base); await loading; self.postMessage({ id, ok: true }); return; }
    if (type === 'add') { (add || []).forEach(x => extra.add(x)); self.postMessage({ id, ok: true }); return; }
    if (type === 'check') {
      if (!sp) { if (!loading) loading = load(base); await loading; }
      const bad = {};
      words.forEach(w => { if (!ok(w)) bad[w] = suggest(w); });
      self.postMessage({ id, bad });
    }
  } catch (err) { self.postMessage({ id, error: String(err && err.message || err) }); }
};
