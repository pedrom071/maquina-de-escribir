/* ============ historial de versiones por capítulo ============ */
function lcsPairs(a, b, eq) {
  const n = a.length, m = b.length;
  if (n * m > 400000) return null;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = eq(a[i], b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = []; let i = 0, j = 0;
  while (i < n && j < m) {
    if (eq(a[i], b[j])) { out.push(['=', a[i], b[j]]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push(['-', a[i], null]); i++; }
    else { out.push(['+', null, b[j]]); j++; }
  }
  while (i < n) out.push(['-', a[i++], null]);
  while (j < m) out.push(['+', null, b[j++]]);
  return out;
}
function wordDiff(oldT, newT, el) {
  const A = oldT.split(/(\s+)/), B = newT.split(/(\s+)/);
  const pairs = lcsPairs(A, B, (x, y) => x === y);
  if (!pairs) { el.append(h('del', { text: oldT }), ' ', h('ins', { text: newT })); return; }
  pairs.forEach(([k, x, y]) => {
    if (k === '=') el.append(x);
    else if (k === '-') el.append(h('del', { text: x, style: 'color:var(--bad)' }));
    else el.append(h('ins', { text: y, style: 'color:var(--ok);text-decoration:none;background:var(--bien-bg)' }));
  });
}

const Versions = {
  last: new Map(),
  coll(cid) { return RT.db.collection(App.ppath(App.pid) + '/chapters/' + cid + '/versions'); },
  async prime(cid) {
    if (this.last.has(cid)) return;
    this.last.set(cid, 0);
    try { const s = await this.coll(cid).orderBy('at', 'desc').limit(1).get(); this.last.set(cid, s.docs[0] ? (s.docs[0].data().at || 0) : 0); } catch (e) {}
  },
  async sessionVersion(cid, paras) {
    if (!RT.canWrite) return;
    await this.prime(cid);
    if (Date.now() - (this.last.get(cid) || 0) < 45 * 60 * 1000) return;
    if (!paras || !paras.some(p => parText(p).trim())) return;
    this.last.set(cid, Date.now());
    await this.saveVersion(cid, 'Antes de editar', paras, true);
  },
  async saveVersion(cid, label, paras, auto) {
    if (!RT.canWrite) return false;
    const d = App.ch(cid); if (!d || !d.data) return false;
    const ps = clone(paras || d.data.paras);
    const data = { at: Date.now(), by: RT.me || 'local', label: label || 'Versión', auto: !!auto, title: App.chTitle(cid), paras: ps, words: chapterWords({ paras: ps }) };
    try { await this.coll(cid).doc(uid('v')).set(data); this.last.set(cid, data.at); this.prune(cid); return true; }
    catch (e) { App.toast('No se pudo guardar la versión.'); return false; }
  },
  async prune(cid) {
    try {
      const s = await this.coll(cid).orderBy('at', 'desc').limit(400).get();
      const docs = s.docs.slice(60);
      for (const v of docs) await this.coll(cid).doc(v.id).delete();
    } catch (e) {}
  },
  async open(cid) {
    if (!cid) return;
    const body = h('div', { style: 'display:flex;flex-direction:column;gap:.6rem' }, h('p', { class: 'muted', text: 'Cargando versiones…' }));
    const foot = h('div', { class: 'row', style: 'width:100%' });
    UI.drawer({ title: 'Historial', key: 'history', body: body, foot: foot });
    let list = [];
    try { const s = await this.coll(cid).orderBy('at', 'desc').limit(60).get(); list = s.docs.map(d => Object.assign({ id: d.id }, d.data())); } catch (e) {}
    if (!UI.drawerOpen('history')) return;
    body.textContent = '';
    const cur = App.ch(cid);
    body.append(h('p', { class: 'muted', style: 'margin:0;font-size:.8438rem', text: 'Cada vez que vuelves a editar un ' + App.unit().toLowerCase() + ' después de un rato, antes de reemplazar y cuando presionas ' + MOD + '+S, queda una versión. Elige una para ver qué cambió.' }));
    const preview = h('div', { class: 'diff', id: 'hist-diff' });
    const lst = h('div', { style: 'display:flex;flex-direction:column;gap:.4rem' });
    if (!list.length) lst.append(h('div', { class: 'empty', style: 'padding:1rem', text: 'Todavía no hay versiones guardadas de este texto.' }));
    let sel = null;
    const restore = btn('Restaurar esta versión', async () => {
      if (!sel || !cur) return;
      if (!await UI.confirm('Restaurar versión', 'El texto actual se reemplazará por la versión «' + sel.label + '» del ' + fmtDate(sel.at) + '. Antes se guarda una versión del texto actual.', 'Restaurar')) return;
      await this.saveVersion(cid, 'Antes de restaurar');
      if (Editor.cid === cid) Editor.pushUndo();
      cur.update(x => { x.paras = clone(sel.paras); }, { now: true, silent: true });
      if (Editor.cid === cid) { Editor.render(); Editor.afterChange(); }
      UI.closeDrawer(); App.toast('Versión restaurada.');
    }, 'primary', { disabled: true });
    list.forEach(v => {
      const el = h('div', { class: 'ver', tabindex: '0', role: 'button' },
        h('div', { class: 'vt', text: v.label || 'Versión' }),
        h('div', { class: 'vm', text: fmtDate(v.at) + ' · ' + fmtN(v.words) + ' palabras' + (v.by && v.by !== RT.me && v.by !== 'local' ? ' · ' + Collab.name(v.by) : '') }));
      const pick = () => {
        sel = v; $$('.ver', lst).forEach(x => x.classList.toggle('sel', x === el));
        restore.disabled = !RT.canWrite;
        this.diff(preview, v.paras, cur && cur.data ? cur.data.paras : []);
      };
      el.addEventListener('click', pick);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
      lst.append(el);
    });
    body.append(lst, h('div', { class: 'label', style: 'margin-top:.4rem', text: 'Cambios desde esa versión hasta hoy' }), preview);
    const saveNow = btn('Guardar versión ahora', async () => { const l = await UI.prompt('Guardar versión', 'Nombre (opcional)', ''); if (l == null) return; if (await this.saveVersion(cid, l || 'Guardada a mano')) { App.toast('Versión guardada.'); this.open(cid); } }, '', { disabled: !RT.canWrite });
    foot.append(saveNow, h('span', { class: 'spacer' }), restore);
    preview.append(h('p', { class: 'muted', text: 'Elige una versión.' }));
  },
  diff(el, oldP, newP) {
    el.textContent = '';
    const pairs = lcsPairs(oldP, newP, (a, b) => a.id === b.id);
    if (!pairs) { el.append(h('p', { class: 'muted', text: 'El texto es muy largo para comparar aquí.' })); return; }
    let changes = 0, sameRun = 0;
    const flushSame = () => { if (sameRun) { el.append(h('p', { class: 'same', text: '… ' + plural(sameRun, 'párrafo sin cambios', 'párrafos sin cambios') + ' …' })); sameRun = 0; } };
    pairs.forEach(([k, a, b]) => {
      if (k === '=') {
        const ta = parText(a), tb = parText(b);
        if (ta === tb) { sameRun++; return; }
        flushSame(); changes++;
        const p = h('p', { class: 'chg' }); wordDiff(ta, tb, p); el.append(p);
      } else if (k === '-') { flushSame(); changes++; el.append(h('p', { class: 'del', text: parText(a) })); }
      else { flushSame(); changes++; el.append(h('p', { class: 'add', text: parText(b) })); }
    });
    flushSame();
    if (!changes) { el.textContent = ''; el.append(h('p', { class: 'muted', text: 'Sin cambios de texto desde esa versión.' })); }
  }
};
window.Versions = Versions;
