/* ============ revisión con Claude ============ */
function bibleDigest(P, max) {
  if (!P) return '';
  const out = [];
  ((P.bible && P.bible.sections) || []).forEach(s => {
    const items = (s.items || []).filter(it => it.title || it.body);
    if (!items.length) return;
    out.push('## ' + s.label);
    items.forEach(it => {
      const f = Object.keys(it.fields || {}).filter(k => (it.fields[k] || '').trim()).map(k => k + ': ' + it.fields[k].trim()).join('; ');
      out.push('- ' + (it.title || '(sin nombre)') + (f ? ' (' + f + ')' : '') + (it.body ? ': ' + it.body.replace(/\s+/g, ' ').trim() : ''));
    });
  });
  const tl = (P.timeline || []).slice().sort((a, b) => (a.chrono || 999) - (b.chrono || 999));
  if (tl.length) { out.push('## Línea de tiempo (orden de la historia)'); tl.forEach(e => out.push('- ' + (e.chrono ? e.chrono + '. ' : '') + e.title + (e.when ? ' (' + e.when + ')' : '') + (e.note ? ': ' + e.note : ''))); }
  const dec = (P.decisions || []).filter(d => d.text);
  if (dec.length) { out.push('## Decisiones del autor'); dec.forEach(d => out.push('- ' + d.text)); }
  const th = (P.threads || []).filter(t => t.status !== 'done');
  if (th.length) { out.push('## Cabos sueltos abiertos'); th.forEach(t => out.push('- ' + t.title)); }
  let s = out.join('\n');
  if (s.length > max) s = s.slice(0, max) + '\n[…]';
  return s;
}
function projectText(P, maxChars, upto) {
  const parts = [];
  for (const c of (P.chapters || [])) {
    const d = App.ch(c.id);
    if (d && d.data) parts.push('### ' + (c.title || '') + '\n' + d.data.paras.map(parText).filter(Boolean).join('\n\n'));
    if (upto && c.id === upto) break;
  }
  let s = parts.join('\n\n');
  if (s.length > maxChars) s = '[…]\n' + s.slice(s.length - maxChars);
  return s;
}
const TYPE_RULES = {
  rep: 'rep: repeticiones de palabras, imágenes o estructuras de frase cercanas que no parecen buscadas.',
  dud: 'dud: frases ambiguas, confusas o que obligan a releer.',
  coh: 'coh: contradicciones con la biblia o con lo ya escrito (fechas, edades, nombres, hechos, quién narra y qué sabe), o datos que conviene fijar.',
  bien: 'bien: algo que funciona especialmente bien y conviene conservar (úsalo con moderación).',
  ort: 'ort: errores de ortografía, tildes, concordancia o puntuación. Incluye "fix" con el fragmento ya corregido y nada más cambiado.',
  rec: 'rec: recursos de voz o estilo que conviene tener presentes (tono, ritmo, registro).'
};
const DENSITY = { pocas: 3, normal: 5, muchas: 8 };

const Review = {
  queue: [], running: null, timers: new Map(), chat: [], disabled: false,

  ok() {
    if (RT.web && !AI.ready()) { AI.open(); App.toast('Configura tu IA para usar esta revisión. La revisión rápida funciona sin IA.'); return false; }
    if (!RT.sample || this.disabled) { App.toast('La revisión con ' + AI.name() + ' no está disponible en esta vista.'); return false; }
    if (!RT.canWrite) { App.toast('Necesitas permiso de edición para revisar.'); return false; }
    return true;
  },
  statusText() {
    if (this.running) return this.running.label + (this.queue.length ? ' · ' + this.queue.length + ' en cola' : '');
    const n = Editor.cid ? (Editor.dirty.get(Editor.cid) || new Set()).size : 0;
    if (n && RT.sample) return (App.prefs.auto ? 'Revisión automática · ' : '') + plural(n, 'párrafo editado', 'párrafos editados');
    return '';
  },
  isReviewing(cid, pid) { return !!(this.running && this.running.cid === cid && (this.running.pid === pid || this.running.all)); },
  onMount() {},
  onEdit(cid, pid) {
    if (window.Checker) Checker.schedule(cid, pid);
    const aiAuto = RT.web ? (App.prefs.autoAI === true && AI.ready()) : App.prefs.auto;
    if (!aiAuto || !RT.sample || this.disabled || !RT.canWrite || App.ultra) return;
    clearTimeout(this.timers.get('auto'));
    this.timers.set('auto', setTimeout(() => {
      const d = App.ch(cid); if (!d || !d.data || Editor.composing) return;
      const dirty = Editor.dirty.get(cid); if (!dirty) return;
      const ids = [pid].concat(d.data.paras.map(p => p.id).filter(id => id !== pid && dirty.has(id)));
      ids.slice(0, 4).forEach(id => {
        const p = d.data.paras.find(x => x.id === id);
        if (p && countWords(parText(p)) >= 8) this.enqueue({ cid: cid, pid: id, force: false });
      });
    }, 4000));
  },
  reviewPara(cid, pid, force) {
    if (!this.ok() || !pid) return;
    clearTimeout(this.timers.get('auto'));
    this.enqueue({ cid: cid, pid: pid, force: !!force });
  },
  reviewDirty(cid) {
    if (!this.ok()) return;
    const s = Editor.dirty.get(cid) || new Set();
    if (!s.size) { App.toast('No hay párrafos editados sin revisar.'); return; }
    const d = App.ch(cid);
    const order = d && d.data ? d.data.paras.map(p => p.id).filter(id => s.has(id)) : Array.from(s);
    order.forEach(pid => this.enqueue({ cid: cid, pid: pid, force: false }));
  },
  enqueue(job) {
    if (this.queue.some(q => q.cid === job.cid && q.pid === job.pid)) return;
    if (this.running && this.running.cid === job.cid && this.running.pid === job.pid && !job.force) return;
    this.queue.push(job);
    App.renderStatus();
    this.pump();
  },
  async pump() {
    if (this.running) return;
    const job = this.queue.shift();
    if (!job) { App.renderStatus(); return; }
    const dirty = Editor.dirty.get(job.cid);
    if (!job.force && !(dirty && dirty.has(job.pid))) { this.pump(); return; }
    await this.runPara(job);
    this.pump();
  },
  afterMarks(cid) {
    if (Editor.root && Editor.cid === cid) { Editor.render(true); Editor.afterChange(); }
    App.renderSideSoon();
  },
  fail(e) {
    const c = e && e.code;
    if (c === 'cancelled') return;
    if (c === 'bad_key' || c === 'not_configured') { this.queue = []; App.toast(AI.explain(e)); AI.open(); return; }
    if (c === 'network' || (RT.web && c === 'invalid_request')) { this.queue = []; App.toast(AI.explain(e)); return; }
    if (c === 'not_granted' || c === 'sampling_disabled' || c === 'not_declared' || c === 'capability_disabled' || c === 'capability_removed') {
      this.disabled = true; this.queue = [];
      App.toast(AI.name(true) + ' no está disponible para revisar en esta vista.'); return;
    }
    if (c === 'rate_limited') { this.queue = []; App.toast('Muchas revisiones seguidas. Espera un momento y vuelve a intentar.'); return; }
    if (c === 'invalid_json') { App.toast('No pude leer la respuesta de ' + AI.name() + '. Intenta de nuevo.'); return; }
    if (c === 'prompt_too_large') { App.toast('El texto es demasiado largo para revisarlo de una vez.'); return; }
    App.toast('La revisión no se completó. Intenta de nuevo.');
  },
  integrate(P) { return !(P && P.review && P.review.integrate === false); },
  /* Marcas de la revisión automática que la IA puede confirmar o descartar. */
  autoObs(p, protectedIds, prefix) {
    const out = [];
    p.segs.forEach(s => { if (s.m && isStale(s.m, protectedIds, 'revisor')) out.push({ id: (prefix || '') + 'A' + (out.length + 1), m: s.m }); });
    return out;
  },
  obsLines(obs) {
    return obs.map(o => o.id + ' · ' + o.m.type + ' · «' + o.m.text + '» · ' + (o.m.note || '') + (o.m.fix && o.m.fix.to ? ' · corrección propuesta: «' + o.m.fix.to + '»' : '')).join('\n');
  },
  integrationRules() {
    return [
      'Antes que tú pasó una revisión automática por reglas (diccionario, puntuación, frases largas, ecos, muletillas, coherencia con la biblia). Sus observaciones vienen etiquetadas (A1, A2…). Son candidatas:',
      '- Si una es correcta, inclúyela en tu lista con el campo "auto" igual a su etiqueta; puedes mejorar la nota, cambiar el tipo o corregir la propuesta en "fix".',
      '- Si es claramente un falso positivo (nombre propio, chilenismo o palabra válida, repetición evidentemente intencional), agrega {"descartar":"A2","por":"razón breve"}. Solo descarta cuando estés seguro.',
      '- Las que no menciones se mantienen tal cual.',
      '- Revisa el texto completo con el mismo detalle que si no hubiera observaciones automáticas, y agrega todo lo que ellas no ven (coherencia, ambigüedad, voz, ritmo, repeticiones, ortografía).'
    ].join('\n');
  },
  /* Reemplaza las marcas viejas de la IA por la lista nueva. De las automáticas, solo se quitan las que la IA confirma (con su versión mejorada) o descarta explícitamente. */
  applyList(x, pid, list, obs, P, protectedIds, integrate) {
    const k = x.paras.findIndex(z => z.id === pid); if (k < 0) return { added: 0, removed: 0 };
    const np = clone(x.paras[k]);
    const findObs = (ref) => { ref = String(ref || '').trim().toUpperCase(); return ref ? obs.find(z => z.id.toUpperCase() === ref || z.id.toUpperCase().endsWith('.' + ref)) : null; };
    const discards = new Set(), confirmed = new Set();
    const marks = [];
    list.forEach(it => {
      if (!it) return;
      if (it.descartar) { const o = findObs(it.descartar); if (o) discards.add(o.m.id); return; }
      const o = typeof it.auto === 'string' ? findObs(it.auto) : null;
      if (o) { confirmed.add(o.m.id); if (!it.text) it.text = o.m.text; if (!it.type) it.type = o.m.type; if (it.fix == null && o.m.fix) it.fix = o.m.fix.to; }
      marks.push({ it: it, o: o });
    });
    const stale = (m) => isStale(m, protectedIds) || (integrate && m.by === 'revisor' && (discards.has(m.id) || confirmed.has(m.id)));
    const removed = np.segs.filter(s => s.m && stale(s.m) && !confirmed.has(s.m.id)).length;
    np.segs = normSegs(np.segs.map(s => (s.m && stale(s.m)) ? { t: s.m.text } : s));
    let added = 0;
    marks.forEach(({ it, o }) => { if (this.insert(np, it, P, o)) added++; });
    if (integrate && discards.size) {
      x.dismiss = x.dismiss || {};
      const prev = x.dismiss[pid] || [];
      const gone = obs.filter(o => discards.has(o.m.id));
      x.dismiss[pid] = prev.concat(gone.map(o => ({ r: o.m.rule || '', t: o.m.text }))).slice(-40);
      const words = gone.filter(o => o.m.rule === 'spell' && o.m.word).map(o => o.m.word);
      if (words.length) x.okWords = Array.from(new Set((x.okWords || []).concat(words))).slice(-300);
    }
    x.paras[k] = np;
    return { added: added, removed: removed };
  },
  /* Vuelve a mostrar las marcas automáticas que la IA descartó en este capítulo. */
  restoreDismissed(cid) {
    const d = App.ch(cid); if (!d || !d.data) return;
    const n = Object.values(d.data.dismiss || {}).reduce((a, v) => a + v.length, 0) + (d.data.okWords || []).length;
    d.update(x => { delete x.dismiss; delete x.okWords; }, { now: true });
    Checker.run(cid).then(r => App.toast(n ? 'Listo: las marcas automáticas vuelven a aparecer' + (r && r.added ? ' (' + plural(r.added, 'marca', 'marcas') + ')' : '') + '.' : 'No había marcas descartadas.'));
  },
  allowed(P) { const t = (P.review && P.review.types) || ['rep', 'dud', 'coh', 'bien', 'ort', 'rec']; return t.filter(x => TYPE_RULES[x]); },
  baseRules(P) {
    const k = kindOf(P);
    return [
      'Eres corrector de continuidad y estilo de un texto en español (' + k.label.toLowerCase() + '). El autor escribe; tú solo señalas. No propongas tramas, escenas, argumentos, giros ni reescrituras de estilo.',
      'El texto manda sobre la biblia: la biblia es un apoyo que se actualiza con el texto. Si el texto difiere de la biblia, no lo marques como error. Marca coherencia solo cuando algo contradice lo que el propio texto ya estableció antes.',
      'Instrucciones del autor: ' + (P.guide || k.guide),
      'Tipos de marca permitidos:',
      this.allowed(P).map(t => '- ' + TYPE_RULES[t]).join('\n'),
      'Cada nota: máximo 30 palabras, en español de Chile, tono sobrio y concreto. Cada "text" debe copiar un fragmento LITERAL y exacto del texto (máximo 14 palabras), sin comillas añadidas.'
    ].join('\n');
  },
  async runPara(job) {
    const d = App.ch(job.cid); const P = App.P();
    if (!d || !d.data || !P || !RT.sample) return;
    const p = d.data.paras.find(x => x.id === job.pid);
    if (!p) return;
    const full = parText(p);
    if (!full.trim()) { const s = Editor.dirty.get(job.cid); if (s) s.delete(job.pid); return; }
    const i = d.data.paras.indexOf(p);
    const prev = d.data.paras.slice(Math.max(0, i - 3), i).map(parText).join('\n\n').slice(-1800);
    const next = d.data.paras.slice(i + 1, i + 2).map(parText).join('\n\n').slice(0, 700);
    const protectedIds = protectedMarkIds(P);
    const integ = this.integrate(P);
    const obs = integ ? this.autoObs(p, protectedIds) : [];
    const kept = p.segs.filter(s => s.m && !isStale(s.m, protectedIds) && !(integ && isStale(s.m, protectedIds, 'revisor'))).map(s => s.m.text);
    const maxN = (DENSITY[(P.review && P.review.density) || 'normal'] || 5) + obs.length;
    const bible = bibleDigest(P, 3500);
    const prompt = [
      this.baseRules(P),
      'Revisa SOLO el párrafo indicado, con detalle. Hasta ' + maxN + ' marcas propias. No repitas estos fragmentos ya marcados por el autor u otras personas: ' + JSON.stringify(kept) + '.',
      obs.length ? this.integrationRules() + '\nObservaciones automáticas:\n' + this.obsLines(obs) : '',
      'Responde solo con un arreglo JSON, por ejemplo: [{"type":"rep","text":"fragmento exacto","note":"nota breve"},{"type":"ort","text":"ordena","note":"Falta una sílaba.","fix":"ordenada","auto":"A1"},{"descartar":"A2","por":"nombre propio"}]. Si no hay nada que marcar, responde [].',
      bible ? '\nBiblia del proyecto (lo ya decidido):\n' + bible : '',
      '\nTexto anterior (contexto):\n' + (prev || '(inicio)'),
      next ? '\nTexto siguiente (contexto):\n' + next : '',
      '\nPÁRRAFO A REVISAR:\n' + full
    ].join('\n');
    this.running = { cid: job.cid, pid: job.pid, label: 'Revisando párrafo ' + (i + 1) + '…' };
    App.renderStatus(); if (Editor.cid === job.cid) Editor.decorate();
    try {
      const res = await RT.sample.json(prompt, { modelTier: 'default' });
      const list = Array.isArray(res) ? res : (res && Array.isArray(res.marcas) ? res.marcas : []);
      const cur = d.data.paras.find(x => x.id === job.pid);
      let added = 0, removed = 0;
      if (cur) {
        const changedMeanwhile = parText(cur) !== full;
        const mk = list.filter(i => i && !i.descartar).slice(0, maxN), ds = list.filter(i => i && i.descartar);
        d.update(x => { const r = this.applyList(x, job.pid, mk.concat(ds), obs, P, protectedIds, integ); added = r.added; removed = r.removed; }, { silent: true });
        if (!changedMeanwhile) { const s = Editor.dirty.get(job.cid); if (s) s.delete(job.pid); }
      }
      this.running = null;
      this.afterMarks(job.cid);
      if (job.force) App.toast('Párrafo ' + (i + 1) + ' revisado: ' + (added ? plural(added, 'marca nueva', 'marcas nuevas') : 'sin observaciones nuevas') + (removed ? '. Reemplacé ' + plural(removed, 'marca anterior', 'marcas anteriores') : '') + '.');
    } catch (e) {
      this.running = null;
      this.afterMarks(job.cid);
      this.fail(e);
    }
    App.renderStatus();
  },
  insert(p, it, P, fromAuto) {
    if (!it || typeof it !== 'object') return false;
    const type = String(it.type || '');
    if (!TYPE_RULES[type] || !this.allowed(P).includes(type)) return false;
    let text = typeof it.text === 'string' ? it.text.replace(/^["«“]|["»”]$/g, '') : '';
    if (text.length < 2) return false;
    const note = typeof it.note === 'string' ? it.note.trim().slice(0, 600) : '';
    const m = { id: uid('m'), type: type, text: '', note: note, by: 'claude', at: Date.now() };
    const fix = typeof it.fix === 'string' ? it.fix : '';
    if ((type === 'ort' || fromAuto) && fix && fix !== text) m.fix = { from: text, to: fix, applied: false };
    if (fromAuto) { m.src = 'auto'; if (fromAuto.m.rule) m.rule = fromAuto.m.rule; if (fromAuto.m.word) m.word = fromAuto.m.word; }
    if (insertMarkByText(p, text, m)) return true;
    const t2 = text.trim();
    if (t2 !== text && t2.length > 1) { if (m.fix) m.fix.from = t2; return insertMarkByText(p, t2, m); }
    return false;
  },

  /* revisión completa del capítulo, en una o pocas llamadas */
  async reviewChapter(cid) {
    if (!this.ok()) return;
    if (this.running) { App.toast('Espera a que termine la revisión en curso.'); return; }
    const d = App.ch(cid), P = App.P(); if (!d || !d.data) return;
    const paras = d.data.paras.filter(p => parText(p).trim());
    if (!paras.length) { App.toast('No hay texto que revisar.'); return; }
    const chunks = []; let cur = [], size = 0;
    // tramos moderados: con textos muy largos de una vez la revisión se vuelve superficial
    paras.forEach(p => { const t = parText(p); if (size + t.length > 12000 && cur.length) { chunks.push(cur); cur = []; size = 0; } cur.push(p); size += t.length; });
    if (cur.length) chunks.push(cur);
    const dens = (P.review && P.review.density) || 'normal';
    const per = { pocas: 0.8, normal: 1.6, muchas: 3 }[dens] || 1.6;
    const protectedIds = protectedMarkIds(P);
    const bible = bibleDigest(P, 5000);
    let added = 0, removed = 0;
    this.running = { cid: cid, all: true, label: 'Revisando el ' + App.unit().toLowerCase() + '…' };
    App.renderStatus(); if (Editor.cid === cid) Editor.decorate();
    if (Editor.cid === cid) Editor.pushUndo();
    try {
      for (let ci = 0; ci < chunks.length; ci++) {
        const ch = chunks[ci];
        const labels = new Map(); ch.forEach((p, i) => labels.set('P' + (i + 1), p.id));
        const integ = this.integrate(P);
        const obsBy = new Map(); let nObs = 0;
        if (integ) ch.forEach((p, i) => { const o = this.autoObs(p, protectedIds, 'P' + (i + 1) + '.'); if (o.length) { obsBy.set(p.id, o); nObs += o.length; } });
        const body = ch.map((p, i) => '[P' + (i + 1) + '] ' + parText(p) + (obsBy.has(p.id) ? '\n  Observaciones automáticas:\n  ' + this.obsLines(obsBy.get(p.id)).replace(/\n/g, '\n  ') : '')).join('\n\n');
        const maxT = Math.min(140, Math.max(6, Math.round(ch.length * per)));
        const prompt = [
          this.baseRules(P),
          'Revisa todo el texto siguiente, párrafo por párrafo y con detalle. Hasta ' + maxT + ' marcas propias (sin contar las automáticas que confirmes o descartes); no es una cuota, pero no omitas nada que de verdad lo merezca. Indica en "p" la etiqueta del párrafo.',
          nObs ? this.integrationRules() + '\nLas etiquetas de las observaciones automáticas llevan el párrafo delante (P3.A1).' : '',
          'Responde solo con un arreglo JSON, por ejemplo: [{"p":"P3","type":"coh","text":"fragmento exacto","note":"nota breve"},{"p":"P5","type":"ort","text":"queria","note":"Falta la tilde.","fix":"quería","auto":"P5.A1"},{"p":"P6","descartar":"P6.A2","por":"nombre propio"}]. Si no hay nada, responde [].',
          bible ? '\nBiblia del proyecto:\n' + bible : '',
          '\nTEXTO (' + (App.chTitle(cid) || App.unit()) + (chunks.length > 1 ? ', parte ' + (ci + 1) + ' de ' + chunks.length : '') + '):\n' + body
        ].join('\n');
        this.running.label = 'Revisando el ' + App.unit().toLowerCase() + (chunks.length > 1 ? ' (' + (ci + 1) + '/' + chunks.length + ')' : '') + '…';
        App.renderStatus();
        const res = await RT.sample.json(prompt, { modelTier: 'default' });
        const list = Array.isArray(res) ? res : [];
        const byPid = new Map();
        list.forEach(it => {
          if (!it) return;
          let lab = String(it.p || '').trim().toUpperCase();
          if (!lab && (it.descartar || it.auto)) lab = String(it.descartar || it.auto).toUpperCase().split('.')[0];
          const pid = labels.get(lab); if (pid) { if (!byPid.has(pid)) byPid.set(pid, []); byPid.get(pid).push(it); }
        });
        d.update(x => {
          ch.forEach(op => {
            const r = this.applyList(x, op.id, byPid.get(op.id) || [], obsBy.get(op.id) || [], P, protectedIds, integ);
            added += r.added; removed += r.removed;
          });
        }, { silent: true });
        this.afterMarks(cid);
      }
      const s = Editor.dirty.get(cid); if (s) s.clear();
      App.toast(App.unit() + ' revisado: ' + plural(added, 'marca', 'marcas') + (removed ? ' (reemplazó ' + removed + ' anteriores)' : '') + '.');
    } catch (e) { this.fail(e); }
    this.running = null;
    this.afterMarks(cid);
    App.renderStatus();
  },

  /* informe del capítulo */
  report(cid) {
    const d = App.ch(cid); if (!d || !d.data) return;
    const body = h('div', { style: 'display:flex;flex-direction:column;gap:.6rem' });
    const out = h('div', { id: 'report-out' });
    const meta = h('p', { class: 'muted', style: 'margin:0;font-size:.7812rem' });
    const show = () => {
      out.textContent = '';
      const r = d.data.report;
      if (r && r.text) { out.append(renderProse(r.text)); meta.textContent = 'Generado ' + relTime(r.at) + (r.by && r.by !== RT.me ? ' por ' + Collab.name(r.by) : '') + '.'; }
      else { out.append(h('p', { class: 'muted', text: 'Todavía no hay un informe de este ' + App.unit().toLowerCase() + '. El informe resume, revisa coherencia con la biblia y con lo anterior, y señala ritmo, muletillas y preguntas abiertas, sin reescribir nada.' })); meta.textContent = ''; }
    };
    show();
    body.append(meta, out);
    const gen = btn('Generar informe', () => this.genReport(cid, out, meta, gen), 'primary');
    if (!RT.sample || !RT.canWrite) gen.disabled = true;
    UI.drawer({ title: 'Informe', key: 'report', body: body, foot: gen });
  },
  async genReport(cid, out, meta, gen) {
    if (!this.ok()) return;
    const d = App.ch(cid), P = App.P();
    const text = d.data.paras.map(parText).filter(Boolean).join('\n\n');
    if (!text.trim()) { App.toast('No hay texto para el informe.'); return; }
    const before = projectText(P, 30000, null);
    const prompt = [
      'Eres corrector editorial de un texto en español (' + kindOf(P).label.toLowerCase() + '). No reescribas ni propongas tramas, escenas o argumentos: solo observa.',
      'Instrucciones del autor: ' + (P.guide || kindOf(P).guide),
      'Escribe un informe breve en español de Chile con estos apartados (usa "## " para cada título y viñetas "- "):',
      '## Qué pasa (3 líneas, sin juzgar)', '## Coherencia (contradicciones con la biblia o con lo anterior; datos que conviene fijar)', '## Ritmo y estructura', '## Repeticiones y muletillas', '## Preguntas abiertas para el autor',
      'Sé concreto y cita fragmentos breves entre «». Máximo 350 palabras.',
      '\nBiblia del proyecto:\n' + (bibleDigest(P, 5000) || '(vacía)'),
      '\nResto del proyecto (contexto):\n' + before.slice(-30000),
      '\nTEXTO A INFORMAR («' + App.chTitle(cid) + '»):\n' + text.slice(0, 80000)
    ].join('\n');
    gen.disabled = true; out.textContent = ''; const live = h('div', { class: 'bubble', text: 'Pensando…' }); out.append(live);
    try {
      const r = await RT.sample(prompt, { onText: ({ text }) => { live.textContent = text; }, modelTier: 'default', cache: false });
      d.update(x => { x.report = { at: Date.now(), by: RT.me || 'local', text: r.text }; }, { now: true });
      out.textContent = ''; out.append(renderProse(r.text)); meta.textContent = 'Generado recién.';
    } catch (e) { live.textContent = e && e.text ? e.text : ''; this.fail(e); }
    gen.disabled = false;
  },

  /* extraer datos a la biblia */
  async extract(cid) {
    if (!this.ok()) return;
    const d = App.ch(cid), P = App.P();
    const text = d.data.paras.map(parText).filter(Boolean).join('\n\n');
    if (!text.trim()) { App.toast('No hay texto para extraer.'); return; }
    const body = h('div', { style: 'display:flex;flex-direction:column;gap:.6rem' }, h('div', { class: 'bubble', text: 'Leyendo el ' + App.unit().toLowerCase() + ' y comparando con la biblia…' }));
    const foot = h('div', { class: 'row', style: 'width:100%' });
    UI.drawer({ title: 'Extraer a la biblia', key: 'extract', body: body, foot: foot });
    const fiction = kindOf(P).timeline;
    const prompt = [
      'Extrae datos FACTUALES que el texto establece (no inventes ni interpretes; no propongas nada creativo). Compara con la biblia y devuelve solo lo nuevo o lo que la complementa. El texto manda: si el texto dice algo distinto de la biblia, propón el cambio en "cambios" para actualizar la biblia.',
      fiction
        ? 'Responde solo con JSON: {"personajes":[{"nombre":"","datos":["dato breve"]}],"lugares":[{"nombre":"","datos":[""]}],"hechos":[{"titulo":"","cuando":"momento según el texto","nota":""}],"cabos":[{"titulo":"pregunta o promesa abierta","detalle":""}],"cambios":[{"nombre":"nombre de la ficha","campo":"campo o Notas","ahora":"lo que dice el texto","antes":"lo que dice la biblia"}]}'
        : 'Responde solo con JSON: {"ideas":[{"nombre":"idea o tesis","datos":[""]}],"fuentes":[{"nombre":"autor o fuente citada","datos":[""]}],"datos":[{"nombre":"dato o cifra","datos":["fuente si se menciona"]}],"cabos":[{"titulo":"afirmación que necesita respaldo","detalle":""}]}',
      'Máximo 8 elementos por lista. Datos de máximo 15 palabras.',
      '\nBiblia actual:\n' + (bibleDigest(P, 6000) || '(vacía)'),
      '\nTEXTO («' + App.chTitle(cid) + '»):\n' + text.slice(0, 90000)
    ].join('\n');
    let res;
    try { res = await RT.sample.json(prompt, { modelTier: 'default' }); }
    catch (e) { body.textContent = ''; body.append(h('p', { class: 'muted', text: 'No se pudo extraer.' })); this.fail(e); return; }
    if (!UI.drawerOpen('extract')) return;
    body.textContent = '';
    const props = [];
    const group = (title, arr, kind) => {
      if (!Array.isArray(arr) || !arr.length) return;
      body.append(h('div', { class: 'label', style: 'margin-top:.4rem', text: title }));
      arr.slice(0, 8).forEach(it => {
        if (!it) return;
        const name = String(it.nombre || it.titulo || '').trim(); if (!name) return;
        const detail = Array.isArray(it.datos) ? it.datos.filter(Boolean).join(' · ') : String(it.cuando ? it.cuando + (it.nota ? ' · ' + it.nota : '') : (it.detalle || it.nota || ''));
        const cb = h('input', { type: 'checkbox', checked: true });
        props.push({ cb: cb, kind: kind, it: it, name: name });
        body.append(h('label', { class: 'prop' }, cb, h('div', null, h('div', { class: 'pt', text: name }), detail ? h('div', { class: 'pd', text: detail }) : null)));
      });
    };
    if (fiction) {
      group('Personajes', res && res.personajes, 'char'); group('Lugares', res && res.lugares, 'place');
      group('Hechos para la línea de tiempo', res && res.hechos, 'event'); group('Cabos sueltos', res && res.cabos, 'thread');
      if (res && Array.isArray(res.cambios)) group('La biblia dice otra cosa: actualizar con lo del texto', res.cambios.map(c => c && ({ nombre: c.nombre, datos: [(c.campo ? c.campo + ': ' : '') + (c.ahora || '') + (c.antes ? ' (antes: ' + c.antes + ')' : '')], campo: c.campo, ahora: c.ahora })), 'change');
    } else {
      group('Ideas y tesis', res && res.ideas, 'idea'); group('Fuentes', res && res.fuentes, 'source');
      group('Datos', res && res.datos, 'data'); group('Afirmaciones por respaldar', res && res.cabos, 'thread');
    }
    if (!props.length) { body.append(h('p', { class: 'muted', text: 'No encontré datos nuevos para la biblia.' })); return; }
    foot.append(btn('Agregar seleccionados', () => { const n = this.applyExtract(cid, props.filter(p => p.cb.checked)); UI.closeDrawer(); App.toast(plural(n, 'elemento agregado', 'elementos agregados') + ' a la biblia.', { action: { label: 'Ver', fn: () => App.go('p-' + App.pid + '-biblia') } }); }, 'primary'));
  },
  applyExtract(cid, sel) {
    const title = App.chTitle(cid);
    let n = 0;
    App.proj().update(x => {
      x.bible = x.bible || { sections: [] };
      const secFor = (re, label, graph) => {
        let s = x.bible.sections.find(s => re.test(s.label));
        if (!s) { s = { id: uid('s'), label: label, fields: [], graph: !!graph, items: [] }; x.bible.sections.push(s); }
        return s;
      };
      sel.forEach(p => {
        const it = p.it;
        const facts = Array.isArray(it.datos) ? it.datos.filter(Boolean) : [];
        if (p.kind === 'event') { x.timeline = x.timeline || []; x.timeline.push({ id: uid('e'), title: p.name, when: it.cuando || '', chrono: 0, cid: cid, note: it.nota || '' }); n++; return; }
        if (p.kind === 'thread') { x.threads = x.threads || []; x.threads.push({ id: uid('t'), title: p.name, body: (it.detalle || '') + ' (' + title + ')', status: 'open', cid: cid, at: Date.now() }); n++; return; }
        if (p.kind === 'change') {
          // el texto manda: se actualiza el campo de la ficha (o se anota en sus notas)
          const key = fold(p.name); let card = null;
          (x.bible.sections || []).forEach(s => (s.items || []).forEach(c => { if (!card && (fold(c.title || '') === key || ((c.fields && c.fields['También llamado']) || '').split(',').map(z => fold(z.trim())).includes(key))) card = c; }));
          if (!card || !it.ahora) return;
          const f = Object.keys(card.fields || {}).find(k => fold(k) === fold(it.campo || ''));
          if (f) card.fields[f] = String(it.ahora); else card.body = (card.body ? card.body + '\n' : '') + '• ' + (it.campo ? it.campo + ': ' : '') + it.ahora + ' (' + title + ')';
          n++; return;
        }
        const map = { char: [/personaj/i, 'Personajes', true], place: [/lugar|locaci/i, 'Lugares', false], idea: [/idea|tesis|argument/i, 'Ideas clave', false], source: [/fuente/i, 'Fuentes', false], data: [/dato/i, 'Datos', false] }[p.kind];
        const s = secFor(map[0], map[1], map[2]);
        const key = fold(p.name);
        let card = s.items.find(c => fold(c.title || '') === key || ((c.fields && c.fields['También llamado']) || '').split(',').map(z => fold(z.trim())).includes(key));
        const lines = facts.map(f => '• ' + f + ' (' + title + ')').join('\n');
        if (card) { card.body = (card.body ? card.body + '\n' : '') + lines; }
        else { card = { id: uid('i'), title: p.name, fields: {}, body: lines }; s.items.push(card); }
        n++;
      });
    }, { now: true });
    return n;
  },

  /* preguntas al revisor sobre el proyecto */
  ask() {
    const P = App.P(); if (!P) return;
    const body = h('div', { style: 'display:flex;flex-direction:column;gap:.6rem', id: 'ask-log' });
    const intro = h('p', { class: 'muted', style: 'margin:0;font-size:.8438rem', text: 'Pregunta sobre lo que llevas escrito: «¿qué edad tiene X según el texto?», «¿dónde dije que vivía?», «¿cuántas veces aparece la carta?». Claude responde con lo que está en el texto y la biblia.' });
    body.append(intro);
    this.chat.forEach(t => body.append(h('div', { class: 'bubble' + (t.role === 'user' ? ' me' : ''), text: t.content })));
    const ta = h('textarea', { class: 'area', rows: '2', placeholder: 'Escribe tu pregunta…', 'aria-label': 'Pregunta', style: 'min-height:3rem' });
    const send = btn('Preguntar', () => this.sendAsk(ta, body, send), 'primary');
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send.click(); } });
    const foot = h('div', { style: 'display:flex;gap:.5rem;width:100%;align-items:flex-end' }, h('div', { style: 'flex:1;min-width:0' }, ta), send);
    UI.drawer({ title: 'Preguntar al revisor', key: 'ask', body: body, foot: foot });
    setTimeout(() => ta.focus(), 30);
  },
  async sendAsk(ta, log, send) {
    if (!this.ok()) return;
    const q = ta.value.trim(); if (!q) return;
    const P = App.P();
    ta.value = '';
    log.append(h('div', { class: 'bubble me', text: q }));
    const live = h('div', { class: 'bubble', text: 'Pensando…' }); log.append(live);
    live.scrollIntoView({ block: 'end' });
    const sys = [
      'Eres el revisor de este proyecto de escritura. Responde en español de Chile, breve y concreto, basándote solo en el texto y la biblia. Si algo no está en el texto, dilo. No propongas tramas ni reescrituras salvo que el autor lo pida explícitamente.',
      'Proyecto: «' + P.title + '» (' + kindOf(P).label.toLowerCase() + ').',
      '\nBiblia:\n' + (bibleDigest(P, 8000) || '(vacía)'),
      '\nTexto completo:\n' + projectText(P, 150000, null)
    ].join('\n');
    this.chat.push({ role: 'user', content: q });
    const turns = [{ role: 'user', content: sys }, { role: 'assistant', content: 'Entendido. ¿Qué quieres saber?' }].concat(this.chat.slice(-10));
    send.disabled = true;
    try {
      const r = await RT.sample(turns, { onText: ({ text }) => { live.textContent = text; }, cache: false });
      this.chat.push({ role: 'assistant', content: r.text });
    } catch (e) { this.chat.pop(); live.textContent = (e && e.text) || 'No se pudo responder.'; this.fail(e); }
    send.disabled = false; ta.focus();
  }
};
window.Review = Review;
