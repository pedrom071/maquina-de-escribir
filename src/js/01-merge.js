/* ============ fusión de tres vías (para colaborar sin pisarse) ============ */
function deq(a, b) {
  if (a === b) return true;
  if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') return false;
  const aa = Array.isArray(a), ba = Array.isArray(b);
  if (aa !== ba) return false;
  if (aa) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deq(a[i], b[i])) return false;
    return true;
  }
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!Object.prototype.hasOwnProperty.call(b, k) || !deq(a[k], b[k])) return false;
  return true;
}
const isIdArr = (a) => Array.isArray(a) && a.every(x => x && typeof x === 'object' && !Array.isArray(x) && typeof x.id === 'string');

function merge3(b, l, r) {
  if (deq(l, r)) return l;
  if (deq(l, b)) return r;
  if (deq(r, b)) return l;
  if (isIdArr(l) && isIdArr(r) && (b == null || isIdArr(b))) return mergeList(b || [], l, r);
  if (l && r && typeof l === 'object' && typeof r === 'object' && !Array.isArray(l) && !Array.isArray(r)) {
    const bb = (b && typeof b === 'object' && !Array.isArray(b)) ? b : {};
    const out = {};
    const keys = new Set(Object.keys(l).concat(Object.keys(r), Object.keys(bb)));
    keys.forEach(k => {
      const inL = Object.prototype.hasOwnProperty.call(l, k), inR = Object.prototype.hasOwnProperty.call(r, k), inB = Object.prototype.hasOwnProperty.call(bb, k);
      if (inL && inR) out[k] = merge3(bb[k], l[k], r[k]);
      else if (inL) { if (!inB || !deq(bb[k], l[k])) out[k] = l[k]; }
      else if (inR) { if (!inB || !deq(bb[k], r[k])) out[k] = r[k]; }
    });
    return out;
  }
  return l;
}

function mergeList(b, l, r) {
  const idx = (a) => { const m = new Map(); a.forEach(x => m.set(x.id, x)); return m; };
  const B = idx(b), L = idx(l), R = idx(r);
  const ord = (a) => a.map(x => x.id).join('\u0001');
  const useLocal = ord(l) !== ord(b) && ord(r) === ord(b);
  const primary = useLocal ? l : r, other = useLocal ? r : l;
  const decide = (id) => {
    const bi = B.get(id), li = L.get(id), ri = R.get(id);
    if (li && ri) return bi ? merge3(bi, li, ri) : li;
    if (li) return (!bi || !deq(bi, li)) ? li : null;
    if (ri) return (!bi || !deq(bi, ri)) ? ri : null;
    return null;
  };
  const out = [], placed = new Set();
  primary.forEach(x => { placed.add(x.id); const v = decide(x.id); if (v) out.push(v); });
  other.forEach((x, i) => {
    if (placed.has(x.id)) return;
    placed.add(x.id);
    const v = decide(x.id);
    if (!v) return;
    let pos = 0;
    for (let j = i - 1; j >= 0; j--) { const k = out.findIndex(o => o.id === other[j].id); if (k >= 0) { pos = k + 1; break; } }
    out.splice(pos, 0, v);
  });
  return out;
}
