/* ============ diálogos: atajos para la raya y revisión a pedido (normas de la RAE) ============ */
const DLG_VERBS = ['dijo', 'dije', 'preguntó', 'pregunté', 'respondió', 'respondí', 'contestó', 'contesté', 'murmuró', 'susurró', 'gritó', 'exclamó', 'añadió', 'agregó', 'repitió', 'comentó', 'insistió', 'explicó', 'replicó', 'pensó', 'suspiró', 'sonrió', 'interrumpió', 'continuó', 'siguió', 'aclaró', 'admitió', 'advirtió', 'ordenó', 'pidió', 'propuso', 'protestó', 'reconoció', 'recordó', 'se rió', 'rio', 'rió', 'masculló', 'balbuceó', 'tartamudeó', 'mintió', 'confesó', 'concluyó', 'dice', 'pregunta', 'responde', 'contesta', 'murmura', 'grita'];
const DLG_VERB_RE = new RegExp('^(' + DLG_VERBS.map(escRe).join('|') + ')(?![\\p{L}])', 'iu');

const Dialogo = {
  /* ---------- atajos ---------- */
  caretPara() {
    const c = Editor.getCaret() || Editor.lastCaret; if (!c || !Editor.cdoc) return null;
    const p = Editor.cdoc.data.paras.find(x => x.id === c.pid); if (!p) return null;
    return { c: c, p: p, t: parText(p) };
  },
  /* Alt + guion: empieza una línea de diálogo con raya (en el párrafo vacío o en uno nuevo). */
  open() {
    if (!RT.canWrite || !Editor.root) return;
    const x = this.caretPara(); if (!x) { Editor.root.focus(); return; }
    Editor.root.focus();
    if (!x.t.trim()) { Editor.setCaret({ pid: x.p.id, off: 0 }); document.execCommand('insertText', false, '—'); return; }
    if (x.c.off === 0 && !/^\s*—/.test(x.t)) { Editor.setCaret({ pid: x.p.id, off: 0 }); document.execCommand('insertText', false, '—'); return; }
    Editor.setCaret({ pid: x.p.id, off: x.t.length });
    Editor.splitAtCaret();
    document.execCommand('insertText', false, '—');
  },
  /* Alt+I: abre o cierra el inciso del narrador según dónde estés (« —dijo» … «—»). */
  inciso() {
    if (!RT.canWrite || !Editor.root) return;
    const x = this.caretPara(); if (!x) return;
    Editor.root.focus();
    const before = x.t.slice(0, x.c.off);
    let n = (before.match(/—/g) || []).length;
    if (/^\s*—/.test(x.t)) n--;
    if (n % 2 === 0) document.execCommand('insertText', false, (!before || /\s$/.test(before) ? '' : ' ') + '—');
    else {
      if (/ $/.test(before)) document.execCommand('delete');
      document.execCommand('insertText', false, '—');
    }
  },
  /* ---------- revisión ---------- */
  /* Devuelve observaciones {type, rule, text, note, fix} para un párrafo. Solo señala. */
  analyze(t) {
    const out = [];
    const add = (text, note, fix) => { if (text && t.indexOf(text) >= 0 && !out.some(o => o.text === text)) out.push({ type: 'ort', rule: 'dlg', text: text, note: note + ' Si es un estilo buscado, ignóralo.', fix: fix }); };
    const isDlg = /^\s*[—–-]/.test(t);
    // guion o semiraya en lugar de raya (al abrir ya lo marca la revisión rápida)
    if (isDlg) { const re = /(\S)\s[-–]\s?([\p{Ll}])/gu; let m; while ((m = re.exec(t))) add(m[0], 'En los incisos del narrador va raya (—), no guion.', m[1] + ' —' + m[2]); }
    // solo se revisan los párrafos de diálogo (los que empiezan con raya)
    if (!isDlg || !/—/.test(t)) return out;
    // raya que abre el diálogo seguida de espacio
    let m = /^\s*(— +)([\p{L}¿¡«]+)/u.exec(t);
    if (m) add(m[1] + m[2], 'Tras la raya que abre el diálogo no va espacio.', '—' + m[2]);
    // rayas de inciso: se alternan apertura y cierre
    const pos = []; for (let i = 0; i < t.length; i++) if (t[i] === '—') pos.push(i);
    const opener = /^\s*—/.test(t) ? pos.shift() : null;
    const word = (i, dir) => { if (dir < 0) { const s = t.slice(0, i); const w = s.match(/(\S+)\s*$/); return w ? w[0] : ''; } const s = t.slice(i + 1); const w = s.match(/^\s*\S+/); return w ? w[0] : ''; };
    pos.forEach((i, k) => {
      const opening = k % 2 === 0;
      const prev = t[i - 1] || '', next = t[i + 1] || '';
      const ctx = word(i, -1) + '—' + word(i, 1);
      if (opening) {
        const last = k === pos.length - 1;
        if (prev && !/\s/.test(prev) && !/[(«"“]/.test(prev)) add(ctx, 'Falta un espacio antes de la raya que abre el inciso.', word(i, -1) + ' —' + word(i, 1));
        else if (/\s/.test(next)) add(word(i, -1) + '—' + word(i, 1), 'Sobra el espacio después de la raya que abre el inciso.', word(i, -1) + '—' + word(i, 1).trimStart());
        const after = t.slice(i + 1).replace(/^\s+/, '');
        const vm = DLG_VERB_RE.exec(after);
        if (vm && /^\p{Lu}/u.test(vm[1])) add('—' + vm[1], 'El verbo del inciso («' + vm[1].toLowerCase() + '») va en minúscula.', '—' + vm[1].toLowerCase());
        const pb = t.slice(0, i).replace(/\s+$/, '');
        const seg = vm ? t.slice(pb.length - 1, i + 1 + (t.slice(i + 1).match(/^\s*/)[0].length) + vm[1].length) : '';
        if (vm && /[,;:]$/.test(pb)) add(seg, 'El signo («' + pb.slice(-1) + '») va después del inciso, tras la raya de cierre: «… —' + vm[1].toLowerCase() + '—' + pb.slice(-1) + '».', '');
        else if (vm && /[^.]\.$/.test(pb)) add(seg, 'Antes de un inciso con verbo de habla no va punto: el punto va después del inciso.', '');
        void last;
      } else {
        if (/\s/.test(prev)) add(word(i, -1) + ' —', 'Sobra el espacio antes de la raya que cierra el inciso.', word(i, -1) + '—');
        const rest = t.slice(i + 1);
        if (/^[\s.…]*$/.test(rest)) add(word(i, -1).replace(/—$/, '') + '—' + rest.trim(), 'Si el inciso termina el párrafo, no se cierra con raya.', word(i, -1).replace(/—$/, '') + (rest.trim() || ''));
        else if (/^[\p{L}¿¡]/u.test(rest)) add(ctx, 'Falta un espacio (o un signo) después de la raya que cierra el inciso.', word(i, -1) + '— ' + word(i, 1));
      }
    });
    return out;
  },
  async check(cid) {
    cid = cid || App.cid;
    const d = App.ch(cid); if (!d || !d.data || !RT.canWrite) return;
    const P = App.P(); const protectedIds = protectedMarkIds(P);
    const res = new Map();
    d.data.paras.forEach(p => { const t = parText(p); res.set(p.id, { text: t, items: this.analyze(t) }); });
    let added = 0;
    Editor.pushUndo && Editor.cid === cid && Editor.pushUndo();
    d.update(x => {
      x.paras.forEach((p, k) => {
        const r = res.get(p.id); if (!r || parText(p) !== r.text) return;
        const np = clone(p);
        np.segs = normSegs(np.segs.map(s => (s.m && s.m.rule === 'dlg' && isStale(s.m, protectedIds, 'revisor')) ? { t: s.m.text } : s));
        r.items.forEach(it => { if (Checker.insert(np, it)) added++; });
        x.paras[k] = np;
      });
    }, { silent: true });
    if (Editor.root && Editor.cid === cid) { Editor.render(true); Editor.afterChange(); }
    const dlgParas = d.data.paras.filter(p => /^\s*[—–-]/.test(parText(p))).length;
    App.toast(added ? plural(added, 'detalle', 'detalles') + ' en los diálogos.' : (dlgParas ? 'Los diálogos siguen las normas de la raya.' : 'No encontré diálogos con raya en este ' + App.unit().toLowerCase() + '.'));
    return added;
  },
  help() {
    const ex = (a, b) => h('div', { class: 'dlg-ex' }, h('span', { class: 'k', text: a }), h('span', { text: b }));
    UI.modal({ title: 'Diálogos con raya', body: h('div', { class: 'dlg-help' },
      h('p', { class: 'muted', text: 'Atajos que solo insertan la raya; no cambian lo que escribes. La revisión de diálogos es a pedido y solo señala.' }),
      h('div', { class: 'dlg-keys' },
        ex(keys('alt', '-'), 'Abre una línea de diálogo: pone la raya al inicio del párrafo (o en uno nuevo).'),
        ex(keys('alt', 'I'), 'Inciso del narrador: la primera vez abre « —», la segunda lo cierra «—».')),
      h('h4', { text: 'Normas básicas (RAE)' }),
      ex('—Hola.', 'La raya de apertura va pegada a la palabra, sin espacio.'),
      ex('—Hola —dijo Ana—. ¿Vienes?', 'El inciso se abre con espacio antes y se cierra sin espacio; el punto va después de la raya de cierre.'),
      ex('—Ya voy —dijo.', 'Si el inciso termina el párrafo, no se cierra con raya.'),
      ex('—¿Vienes? —preguntó.', 'Tras ? o ! no se agrega punto; el verbo del inciso va en minúscula.'),
      ex('—Pasa —dijo Ana, y abrió la puerta.', 'Lo que sigue en el inciso es parte de él hasta la raya de cierre o el fin del párrafo.')),
      buttons: [{ label: 'Revisar diálogos de este ' + App.unit().toLowerCase(), cls: 'primary', onClick: () => { this.check(); } }, { label: 'Cerrar' }] });
  }
};
window.Dialogo = Dialogo;
