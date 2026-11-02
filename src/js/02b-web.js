/* ============ versión web: guardado en el navegador, IA con clave propia, descargas ============ */

/* Base en memoria con la misma interfaz que la de claude.ai, persistida en IndexedDB. */
function makeMemDB(store, persist) {
  const listeners = new Set();
  const parent = (p) => p.split('/').slice(0, -1).join('/');
  const snapDoc = (p) => { const d = store.get(p); return { id: p.split('/').pop(), exists: !!d, data: () => (d ? clone(d) : undefined), metadata: { fromCache: false, hasPendingWrites: false } }; };
  const snapColl = (c, q) => {
    let docs = [];
    store.forEach((v, p) => { if (parent(p) === c) docs.push(snapDoc(p)); });
    if (q && q.order) { const [f, dir] = q.order; docs.sort((a, b) => { const x = a.data()[f], y = b.data()[f]; return (x > y ? 1 : x < y ? -1 : 0) * (dir === 'desc' ? -1 : 1); }); }
    if (q && q.lim) docs = docs.slice(0, q.lim);
    return { docs: docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } };
  };
  const notify = (p) => setTimeout(() => listeners.forEach(l => {
    if (l.kind === 'doc' && l.path === p) l.cb(snapDoc(p));
    if (l.kind === 'coll' && parent(p) === l.path) l.cb(snapColl(l.path, l.q));
  }), 0);
  const docRef = (p) => ({
    id: p.split('/').pop(), path: p,
    get: async () => snapDoc(p),
    set: async (d) => { store.set(p, clone(d)); persist(p); notify(p); },
    update: async (d) => { if (!store.has(p)) throw { code: 'invalid_argument', message: 'missing' }; Object.assign(store.get(p), clone(d)); persist(p); notify(p); },
    delete: async () => { store.delete(p); persist(p); notify(p); },
    onSnapshot: (cb) => { const l = { kind: 'doc', path: p, cb }; listeners.add(l); setTimeout(() => cb(snapDoc(p)), 0); return () => listeners.delete(l); },
    collection: (c) => collRef(p + '/' + c)
  });
  const query = (c, q) => ({
    orderBy: (f, dir) => query(c, Object.assign({}, q, { order: [f, dir || 'asc'] })),
    limit: (n) => query(c, Object.assign({}, q, { lim: n })),
    where: () => query(c, q),
    get: async () => snapColl(c, q),
    onSnapshot: (cb) => { const l = { kind: 'coll', path: c, q, cb }; listeners.add(l); setTimeout(() => cb(snapColl(c, q)), 0); return () => listeners.delete(l); }
  });
  const collRef = (c) => Object.assign(query(c, {}), {
    path: c,
    doc: (id) => docRef(c + '/' + (id || uid())),
    add: async (d) => { const r = docRef(c + '/' + uid()); await r.set(d); return r; }
  });
  return { doc: docRef, collection: collRef, _store: store };
}

const IDB = {
  db: null, dirty: new Set(), store: null,
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('maquina-de-escribir', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('docs');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  },
  async load() {
    this.db = await this.open();
    const store = new Map();
    await new Promise((res, rej) => {
      const tx = this.db.transaction('docs', 'readonly'), os = tx.objectStore('docs');
      const c = os.openCursor();
      c.onsuccess = () => { const cur = c.result; if (cur) { store.set(cur.key, cur.value); cur.continue(); } else res(); };
      c.onerror = () => rej(c.error);
    });
    this.store = store;
    if (!store.size) {
      try {
        const old = JSON.parse(localStorage.getItem('mde-localdb-v1') || '{}');
        Object.keys(old).forEach(k => { store.set(k, old[k]); this.dirty.add(k); });
        if (this.dirty.size) this.flush();
      } catch (e) {}
    }
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
    return store;
  },
  mark(p) { this.dirty.add(p); this.flushSoon(); },
  flushSoon: debounce(function () { IDB.flush(); }, 250),
  flush() {
    if (!this.db || !this.dirty.size) return;
    const keys = Array.from(this.dirty); this.dirty.clear();
    try {
      const tx = this.db.transaction('docs', 'readwrite'), os = tx.objectStore('docs');
      keys.forEach(k => { const v = this.store.get(k); if (v === undefined) os.delete(k); else os.put(v, k); });
      tx.onerror = () => { keys.forEach(k => this.dirty.add(k)); App.toast('No se pudo guardar en este navegador. Exporta un respaldo.'); };
    } catch (e) { keys.forEach(k => this.dirty.add(k)); }
  }
};

async function makeIdbDB() {
  const store = await IDB.load();
  return makeMemDB(store, (p) => IDB.mark(p));
}

/* ---------- descargas directas ---------- */
const WebDownloads = {
  async save({ filename, data }) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: /\.html?$/.test(filename) ? 'text/html' : /\.json$/.test(filename) ? 'application/json' : 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: filename, style: 'display:none' });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return { status: 'saved' };
  }
};

/* ---------- IA con la clave de cada persona ---------- */
const AI_KEY = 'mde-ai-v1';
const AI_MODELS = {
  anthropic: [['claude-haiku-5-5', 'Haiku 5.5 · rápido y económico'], ['claude-sonnet-5-5', 'Sonnet 5.5 · equilibrado'], ['claude-opus-5-5', 'Opus 5.5 · el más capaz']]
};
function parseJsonLoose(t) {
  const tries = [t];
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/); if (fence) tries.push(fence[1]);
  const a = Math.min(...['{', '['].map(c => { const i = t.indexOf(c); return i < 0 ? Infinity : i; }));
  const b = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (a !== Infinity && b > a) tries.push(t.slice(a, b + 1));
  for (const x of tries) { try { return JSON.parse(x); } catch (e) {} }
  throw { code: 'invalid_json', message: 'No JSON', text: t };
}

const AI = {
  cfg() { try { return Object.assign({ provider: 'anthropic', key: '', model: 'claude-sonnet-5-5', base: '' }, JSON.parse(localStorage.getItem(AI_KEY) || '{}')); } catch (e) { return { provider: 'anthropic', key: '', model: 'claude-sonnet-5-5', base: '' }; } },
  save(c) { try { localStorage.setItem(AI_KEY, JSON.stringify(c)); } catch (e) {} },
  ready() { const c = this.cfg(); return !!(c.key || (c.provider === 'compat' && c.base)) && !!c.model; },
  /* «Claude» en claude.ai o con clave de Anthropic; «la IA» con otros proveedores. */
  name(cap) { const n = !RT.web || (this.ready() && this.label() === 'Claude') ? 'Claude' : 'la IA'; return cap ? n.charAt(0).toUpperCase() + n.slice(1) : n; },
  label() { const c = this.cfg(); return c.provider === 'anthropic' || /claude/.test(c.model || '') ? 'Claude' : 'IA'; },
  turns(input) {
    const list = typeof input === 'string' ? [{ role: 'user', content: input }] : input.slice();
    const out = [];
    list.forEach(t => { const last = out[out.length - 1]; if (last && last.role === t.role) last.content += '\n\n' + t.content; else out.push({ role: t.role, content: t.content }); });
    return out;
  },
  errFrom(status, body) {
    let msg = ''; try { const j = JSON.parse(body); msg = (j.error && (j.error.message || j.error)) || j.message || ''; } catch (e) { msg = body.slice(0, 200); }
    const code = status === 401 || status === 403 ? 'bad_key' : status === 429 ? 'rate_limited' : status === 400 || status === 404 || status === 413 ? 'invalid_request' : 'upstream_error';
    return { code: code, message: String(msg || ('HTTP ' + status)) };
  },
  async stream(input, opts) {
    opts = opts || {};
    const c = this.cfg();
    if (!this.ready()) throw { code: 'not_configured', message: 'Sin clave' };
    const msgs = this.turns(input);
    let url, headers, body;
    if (c.provider === 'anthropic') {
      url = 'https://api.anthropic.com/v1/messages';
      headers = { 'content-type': 'application/json', 'x-api-key': c.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };
      body = { model: c.model, max_tokens: opts.maxTokens || 4096, messages: msgs, stream: true, temperature: 0 };
    } else {
      const base = (c.provider === 'openai' ? 'https://api.openai.com/v1' : (c.base || '').replace(/\/+$/, ''));
      url = base + '/chat/completions';
      headers = { 'content-type': 'application/json' };
      if (c.key) headers.authorization = 'Bearer ' + c.key;
      body = { model: c.model, messages: msgs, stream: true };
      if (/^(gpt-4|gpt-3|llama|mistral|qwen|gemma|deepseek)/i.test(c.model || '') || c.provider !== 'openai') body.temperature = 0;
    }
    let res;
    try { res = await fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(body), signal: opts.signal }); }
    catch (e) { if (e && e.name === 'AbortError') throw { code: 'cancelled' }; throw { code: 'network', message: String(e && e.message || e) }; }
    if (!res.ok) throw this.errFrom(res.status, await res.text());
    const reader = res.body.getReader(), dec = new TextDecoder();
    let buf = '', text = '', truncated = false;
    const emit = (delta) => { if (!delta) return; text += delta; if (opts.onText) opts.onText({ text: text, delta: delta }); };
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let k;
        while ((k = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, k).trim(); buf = buf.slice(k + 1);
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (!data || data === '[DONE]') continue;
          let j; try { j = JSON.parse(data); } catch (e) { continue; }
          if (c.provider === 'anthropic') {
            if (j.type === 'content_block_delta' && j.delta && j.delta.type === 'text_delta') emit(j.delta.text);
            else if (j.type === 'message_delta' && j.delta && j.delta.stop_reason === 'max_tokens') truncated = true;
            else if (j.type === 'error') throw { code: 'upstream_error', message: (j.error && j.error.message) || 'error', text: text };
          } else {
            const ch = j.choices && j.choices[0];
            if (ch && ch.delta && ch.delta.content) emit(ch.delta.content);
            if (ch && ch.finish_reason === 'length') truncated = true;
          }
        }
      }
    } catch (e) {
      if (e && e.name === 'AbortError') throw { code: 'cancelled', text: text };
      throw Object.assign({ code: 'upstream_error', text: text }, e && e.code ? e : { message: String(e) });
    }
    if (!text.trim()) throw { code: 'empty_completion', message: 'Sin texto' };
    return { text: text, truncated: truncated };
  },
  sampler() {
    const f = (input, opts) => AI.stream(input, opts);
    f.json = async (input, opts) => { const r = await AI.stream(input, Object.assign({}, opts, { onText: null })); return parseJsonLoose(r.text); };
    f.limits = async () => ({ maxPromptBytes: 600000 });
    return f;
  },

  /* ---------- conexión, en pocos pasos ---------- */
  guess(key) {
    if (/^sk-ant-/.test(key)) return 'anthropic';
    if (/^sk-or-/.test(key)) return 'openrouter';
    if (/^sk-(proj|svcacct|admin)-/.test(key) || (/^sk-[A-Za-z0-9]{40,}$/.test(key))) return 'openai';
    return null;
  },
  modelName() { const c = this.cfg(); const m = (AI_MODELS.anthropic.find(x => x[0] === c.model) || [])[1]; return m ? m.split(' · ')[0] : c.model; },
  refreshPill() {
    const b = $('#btn-ai'); if (!b) return;
    b.hidden = !RT.web;
    b.textContent = '';
    const on = this.ready();
    b.className = 'ai-pill ' + (on ? 'on' : 'off');
    b.append(icon('spark'), h('span', { class: 'lbl', text: on ? 'IA · ' + this.modelName() : 'Conectar IA' }));
    b.title = on ? 'IA conectada. Toca para cambiarla.' : 'Conecta tu IA para revisar coherencia, hacer informes y preguntar sobre tu texto';
  },
  open() {
    const c = this.cfg();
    let prov = c.provider === 'compat' && /openrouter/.test(c.base || '') ? 'openrouter' : (c.provider || 'anthropic');
    let tested = this.ready();
    const PROVS = {
      anthropic: { n: 'Claude', d: 'Anthropic · recomendado', url: 'https://console.anthropic.com/settings/keys', site: 'console.anthropic.com',
        steps: ['Abre la consola de Anthropic e inicia sesión. Es una cuenta distinta de tu suscripción a claude.ai, pero puedes usar el mismo correo.', 'En «Billing», carga algunos dólares de saldo. Revisar un párrafo cuesta menos de un centavo.', 'En «API keys», crea una clave y cópiala. Empieza por «sk-ant-».'] },
      openai: { n: 'OpenAI', d: 'ChatGPT y otros', url: 'https://platform.openai.com/api-keys', site: 'platform.openai.com',
        steps: ['Abre la plataforma de OpenAI e inicia sesión.', 'Carga saldo en «Billing».', 'Crea una clave en «API keys» y cópiala.'] },
      openrouter: { n: 'OpenRouter', d: 'Muchos modelos, una clave', url: 'https://openrouter.ai/keys', site: 'openrouter.ai',
        steps: ['Abre OpenRouter e inicia sesión.', 'Carga créditos.', 'Crea una clave y cópiala. Empieza por «sk-or-».'] },
      compat: { n: 'Otro', d: 'Ollama u otro servicio', url: null, site: '',
        steps: ['Escribe la dirección del servicio en «Opciones avanzadas» (para Ollama: http://localhost:11434/v1).', 'Escribe el nombre del modelo.', 'Si el servicio no pide clave, deja el campo vacío.'] }
    };
    const DEF_MODEL = { anthropic: 'claude-sonnet-5-5', openai: '', openrouter: 'anthropic/claude-sonnet-5-5', compat: '' };
    const cards = h('div', { class: 'kinds', role: 'radiogroup', 'aria-label': 'Proveedor' });
    const steps = h('ol', { class: 'ai-steps' });
    const key = h('input', { class: 'inp', id: 'ai-key', type: 'password', autocomplete: 'off', spellcheck: 'false', placeholder: 'Pega aquí tu clave', value: c.key });
    const status = h('p', { class: 'ai-status', role: 'status' });
    const modelSel = h('select', { class: 'sel', id: 'ai-model-sel' });
    AI_MODELS.anthropic.forEach(([v, l]) => modelSel.append(h('option', { value: v, text: l })));
    const modelInp = h('input', { class: 'inp', id: 'ai-model', spellcheck: 'false', placeholder: 'Nombre exacto del modelo' });
    const base = h('input', { class: 'inp', id: 'ai-base', spellcheck: 'false', placeholder: 'http://localhost:11434/v1', value: c.base || '' });
    const selRow = h('label', { class: 'field' }, h('span', { text: 'Modelo' }), modelSel);
    const inpRow = h('label', { class: 'field' }, h('span', { text: 'Modelo' }), modelInp);
    const baseRow = h('label', { class: 'field' }, h('span', { text: 'Dirección del servicio' }), base);
    const adv = h('details', { class: 'ai-adv' }, h('summary', { text: 'Opciones avanzadas' }), h('div', { style: 'display:flex;flex-direction:column;gap:.7rem;margin-top:.7rem' }, selRow, inpRow, baseRow));
    if (prov === 'anthropic') modelSel.value = AI_MODELS.anthropic.some(m => m[0] === c.model) ? c.model : 'claude-sonnet-5-5'; else modelInp.value = c.model || DEF_MODEL[prov];
    const setStatus = (t, kind) => { status.textContent = t; status.dataset.k = kind || ''; };
    const render = () => {
      $$('.kopt', cards).forEach(x => x.setAttribute('aria-checked', x.dataset.p === prov ? 'true' : 'false'));
      const P = PROVS[prov];
      steps.textContent = '';
      P.steps.forEach((t, i) => { const li = h('li', null, h('span', { text: t })); if (i === 0 && P.url) li.append(' ', h('a', { href: P.url, target: '_blank', rel: 'noopener', class: 'btn small', text: 'Abrir ' + P.site })); steps.append(li); });
      steps.append(h('li', null, h('span', { text: prov === 'compat' ? 'Prueba la conexión.' : 'Pégala aquí abajo. Se prueba sola.' })));
      selRow.hidden = prov !== 'anthropic'; inpRow.hidden = prov === 'anthropic'; baseRow.hidden = prov !== 'compat';
      if (prov !== 'anthropic' && !modelInp.value) modelInp.value = DEF_MODEL[prov];
      if (prov === 'openai' || prov === 'compat') adv.open = true;
    };
    Object.keys(PROVS).forEach(k => {
      const b = h('button', { class: 'kopt', type: 'button', role: 'radio', dataset: { p: k } }, h('b', { text: PROVS[k].n }), h('span', { text: PROVS[k].d }));
      b.addEventListener('click', () => { prov = k; tested = false; setStatus(''); render(); });
      cards.append(b);
    });
    const collect = () => ({
      provider: prov === 'openrouter' ? 'compat' : prov,
      key: key.value.trim(),
      model: prov === 'anthropic' ? modelSel.value : modelInp.value.trim(),
      base: prov === 'openrouter' ? 'https://openrouter.ai/api/v1' : prov === 'compat' ? base.value.trim() : ''
    });
    let seq = 0;
    const test = async () => {
      const n = collect();
      if (!n.model) { setStatus('Escribe el nombre del modelo en «Opciones avanzadas».', 'bad'); adv.open = true; return false; }
      if (!n.key && prov !== 'compat') { setStatus('Falta la clave.', 'bad'); return false; }
      const my = ++seq, prev = this.cfg();
      this.save(n); setStatus('Probando la conexión…', 'wait');
      try { await this.stream('Responde solo con la palabra: listo', { maxTokens: 20 }); if (my === seq) { tested = true; setStatus('Conectado. Ya puedes guardar.', 'ok'); } return true; }
      catch (e) { if (my === seq) { tested = false; setStatus(this.explain(e), 'bad'); } this.save(prev); return false; }
    };
    const autoTest = debounce(() => { if (key.value.trim().length > 25) test(); }, 500);
    key.addEventListener('input', () => {
      const g = this.guess(key.value.trim());
      if (g && g !== prov && prov !== 'compat') { prov = g; render(); }
      tested = false; setStatus(''); autoTest();
    });
    render();
    if (tested) setStatus('Conectada: ' + PROVS[prov].n + ' · ' + (collect().model || '') + '.', 'ok');
    const finish = () => {
      const n = collect();
      if (!tested) { test().then(ok => { if (ok) finish(); }); return false; }
      const first = !AI.ready() || prev0 !== JSON.stringify(n);
      this.save(n);
      if (App.prefs.autoAI === undefined || first) App.prefs.autoAI = true;
      App.savePrefs(); Review.disabled = false;
      this.refreshPill();
      App.toast('IA conectada. Revisa sola al hacer una pausa; también con ' + keys('mod', 'enter') + '.');
      if (Editor.root) { Editor.unmount(); App.renderStage(); }
      close();
    };
    const prev0 = JSON.stringify(this.cfg());
    const close = UI.modal({
      title: 'Conectar tu IA',
      body: h('div', { class: 'ai-setup' },
        h('p', { class: 'muted', style: 'margin:0', text: 'Con IA, el revisor lee como un editor: coherencia con la biblia y lo ya escrito, frases ambiguas, informes y preguntas sobre tu texto. Necesitas una clave de API; se configura una sola vez.' }),
        cards, steps, key, status, adv,
        h('p', { class: 'muted', style: 'margin:0;font-size:.78rem', text: 'Tu clave queda solo en este navegador y nunca pasa por otro servidor. Tu texto va directo al proveedor, solo cuando se revisa.' })),
      buttons: [
        { label: this.ready() ? 'Desconectar' : 'Ahora no', onClick: () => { if (this.ready()) { this.save({ provider: prov === 'openrouter' ? 'compat' : prov, key: '', model: '', base: '' }); this.refreshPill(); App.toast('IA desconectada de este navegador.'); if (Editor.root) { Editor.unmount(); App.renderStage(); } } } },
        { label: 'Guardar y activar', cls: 'primary', onClick: finish }
      ]
    });
    setTimeout(() => { if (!key.value) key.focus(); }, 40);
  },
  explain(e) {
    const c = e && e.code;
    if (c === 'bad_key') return 'La clave no fue aceptada. Revisa que esté completa y activa.';
    if (c === 'not_configured') return 'Falta la clave de API.';
    if (c === 'rate_limited') return 'El proveedor pidió esperar un momento (límite de uso o saldo).';
    if (c === 'network') return 'No hubo conexión con el proveedor. Revisa tu internet o la dirección del servicio.';
    if (c === 'invalid_request') return 'El proveedor rechazó la solicitud: ' + (e.message || '') + '. Revisa el nombre del modelo.';
    return 'No se pudo completar: ' + ((e && e.message) || 'error desconocido') + '.';
  }
};
window.AI = AI;

/* ---------- respaldo completo del navegador ---------- */
const WebBackup = {
  async download() {
    const all = {};
    RT.db._store.forEach((v, k) => { if (k.indexOf('projects/') === 0 || k.indexOf('data/') === 0) all[k] = v; });
    const n = Object.keys(all).filter(k => k.split('/').length === 2).length;
    await IO.save('maquina-de-escribir-respaldo-' + dayKey() + '.json', JSON.stringify({ format: 'maquina-de-escribir-todo', version: 1, exportedAt: new Date().toISOString(), docs: all }));
    App.prefs.lastBackup = Date.now(); App.savePrefs();
    App.toast('Respaldo de ' + plural(n, 'proyecto') + ' descargado.');
    if (App.view === 'home') App.renderHomeSoon();
  },
  async restore(file) {
    let j; try { j = JSON.parse(await file.text()); } catch (e) { App.toast('Ese archivo no es un respaldo válido.'); return; }
    if (!j || j.format !== 'maquina-de-escribir-todo' || !j.docs) { App.toast('Ese archivo no es un respaldo completo de esta herramienta.'); return; }
    const ids = new Set(Object.keys(j.docs).filter(k => k.split('/').length === 2).map(k => k.split('/')[1]));
    const exists = Array.from(ids).filter(id => RT.db._store.has('projects/' + id));
    if (exists.length && !await UI.confirm('Restaurar respaldo', exists.length + ' de los proyectos del respaldo ya existen aquí y se reemplazarán por la versión del respaldo.', 'Restaurar')) return;
    for (const k of Object.keys(j.docs)) await RT.db.doc(k).set(j.docs[k]);
    App.toast('Respaldo restaurado: ' + plural(ids.size, 'proyecto') + '.');
    setTimeout(() => location.reload(), 600);
  }
};
window.WebBackup = WebBackup;
