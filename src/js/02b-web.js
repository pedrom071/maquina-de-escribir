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
  label() { const c = this.cfg(); return c.provider === 'anthropic' ? 'Claude' : 'IA'; },
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
      body = { model: c.model, max_tokens: opts.maxTokens || 4096, messages: msgs, stream: true };
    } else {
      const base = (c.provider === 'openai' ? 'https://api.openai.com/v1' : (c.base || '').replace(/\/+$/, ''));
      url = base + '/chat/completions';
      headers = { 'content-type': 'application/json' };
      if (c.key) headers.authorization = 'Bearer ' + c.key;
      body = { model: c.model, messages: msgs, stream: true };
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

  /* ---------- ajustes ---------- */
  open() {
    const c = this.cfg();
    const prov = h('select', { class: 'sel', id: 'ai-prov' },
      h('option', { value: 'anthropic', text: 'Anthropic (Claude)' }),
      h('option', { value: 'openai', text: 'OpenAI' }),
      h('option', { value: 'compat', text: 'Otro compatible con OpenAI (OpenRouter, Ollama…)' }));
    prov.value = c.provider;
    const key = h('input', { class: 'inp', id: 'ai-key', type: 'password', autocomplete: 'off', spellcheck: 'false', placeholder: 'Pega aquí tu clave de API', value: c.key });
    const modelSel = h('select', { class: 'sel', id: 'ai-model-sel' });
    const modelInp = h('input', { class: 'inp', id: 'ai-model', spellcheck: 'false', placeholder: 'Nombre exacto del modelo', value: c.model });
    const base = h('input', { class: 'inp', id: 'ai-base', spellcheck: 'false', placeholder: 'https://openrouter.ai/api/v1 o http://localhost:11434/v1', value: c.base });
    const help = h('p', { class: 'muted', style: 'margin:0;font-size:.82rem' });
    const status = h('p', { class: 'muted', style: 'margin:0;font-size:.85rem;min-height:1.2em', role: 'status' });
    const baseRow = h('label', { class: 'field' }, h('span', { text: 'Dirección del servicio' }), base);
    const selRow = h('label', { class: 'field' }, h('span', { text: 'Modelo' }), modelSel);
    const inpRow = h('label', { class: 'field' }, h('span', { text: 'Modelo' }), modelInp);
    const sync = () => {
      const p = prov.value;
      baseRow.hidden = p !== 'compat';
      selRow.hidden = p !== 'anthropic'; inpRow.hidden = p === 'anthropic';
      modelSel.textContent = '';
      (AI_MODELS[p] || []).forEach(([v, l]) => modelSel.append(h('option', { value: v, text: l })));
      if (p === 'anthropic') { modelSel.value = AI_MODELS.anthropic.some(m => m[0] === modelInp.value) ? modelInp.value : 'claude-sonnet-5-5'; }
      help.textContent = '';
      if (p === 'anthropic') help.append('Crea una clave en ', h('a', { href: 'https://console.anthropic.com/settings/keys', target: '_blank', rel: 'noopener', text: 'console.anthropic.com' }), '. Se paga por uso, aparte de una suscripción a claude.ai. Revisar un párrafo cuesta una fracción de centavo.');
      else if (p === 'openai') help.append('Crea una clave en ', h('a', { href: 'https://platform.openai.com/api-keys', target: '_blank', rel: 'noopener', text: 'platform.openai.com' }), '. Escribe el nombre del modelo tal como aparece en tu cuenta.');
      else help.append('Cualquier servicio con la API de OpenAI. Para Ollama en tu computador, usa http://localhost:11434/v1 sin clave y permite el origen de esta página en Ollama.');
    };
    prov.addEventListener('change', sync); sync();
    const collect = () => ({ provider: prov.value, key: key.value.trim(), model: prov.value === 'anthropic' ? modelSel.value : modelInp.value.trim(), base: base.value.trim() });
    const test = btn('Probar conexión', async () => {
      const prev = this.cfg(); this.save(collect());
      status.textContent = 'Probando…';
      try { const r = await this.stream('Responde solo con la palabra: listo', { maxTokens: 20 }); status.textContent = 'Funciona. Respuesta: «' + r.text.trim().slice(0, 40) + '».'; }
      catch (e) { status.textContent = this.explain(e); this.save(prev); }
    }, 'small');
    UI.modal({
      title: 'Inteligencia artificial',
      body: h('div', { style: 'display:flex;flex-direction:column;gap:.85rem' },
        h('p', { class: 'muted', style: 'margin:0;font-size:.88rem', text: 'La revisión rápida (ortografía, repeticiones, frases largas, puntuación) funciona sin IA. Con tu propia clave, además revisas coherencia y ambigüedades, haces informes, extraes datos a la biblia y preguntas sobre tu texto.' }),
        h('label', { class: 'field' }, h('span', { text: 'Proveedor' }), prov),
        baseRow,
        h('label', { class: 'field' }, h('span', { text: 'Clave de API' }), key),
        selRow, inpRow, help,
        h('div', { class: 'row' }, test, status),
        h('p', { class: 'muted', style: 'margin:0;font-size:.8rem', text: 'Tu clave queda guardada solo en este navegador y nunca pasa por otro servidor. Tu texto se envía directamente al proveedor que elijas, y solo cuando pides una revisión.' })),
      buttons: [
        { label: 'Borrar clave', onClick: () => { this.save({ provider: prov.value, key: '', model: '', base: '' }); App.toast('Clave borrada de este navegador.'); } },
        { label: 'Guardar', cls: 'primary', onClick: () => { const n = collect(); if (!n.model) { status.textContent = 'Falta el nombre del modelo.'; return false; } this.save(n); Review.disabled = false; App.toast(this.ready() ? 'Listo: la revisión con IA está activa.' : 'Guardado.'); if (Editor.root) { Editor.unmount(); App.renderStage(); } } }
      ]
    });
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
    App.toast('Respaldo de ' + plural(n, 'proyecto') + ' descargado.');
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
