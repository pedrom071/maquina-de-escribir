/* ============ entorno y guardado ============ */
const RT = {
  db: null, user: null, sample: null, downloads: null, room: null, mcp: null,
  me: null, canWrite: true, local: false, ready: false, drive: false, docs: false
};

/* Respaldo local cuando la página no tiene base compartida (por ejemplo, abierta fuera de claude.ai). */
function makeLocalDB() {
  const KEY = 'mde-localdb-v1';
  let store = {};
  try { store = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { store = {}; }
  const listeners = new Set();
  const persist = debounce(() => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }, 400);
  const parent = (p) => p.split('/').slice(0, -1).join('/');
  const snapDoc = (p) => { const d = store[p]; return { id: p.split('/').pop(), exists: !!d, data: () => (d ? clone(d) : undefined), metadata: { fromCache: false, hasPendingWrites: false } }; };
  const snapColl = (c, q) => {
    let docs = Object.keys(store).filter(p => parent(p) === c).map(snapDoc);
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
    set: async (d) => { store[p] = clone(d); persist(); notify(p); },
    update: async (d) => { if (!store[p]) throw { code: 'invalid_argument', message: 'missing' }; Object.assign(store[p], clone(d)); persist(); notify(p); },
    delete: async () => { delete store[p]; persist(); notify(p); },
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
  return { doc: docRef, collection: collRef };
}

const Store = {
  err: null, lastSaved: 0, docs: new Set(),
  pendingCount() { let n = 0; this.docs.forEach(d => { if (d.pending || d.saving) n++; }); return n; },
  setStatus: rafThrottle(() => { if (window.App && App.renderSaveStatus) App.renderSaveStatus(); }),
  flushAll() { this.docs.forEach(d => d.flush()); }
};
const PERMANENT = new Set(['invalid_argument', 'quota_exceeded', 'revoked', 'not_granted', 'capability_disabled', 'capability_removed']);

class SyncDoc {
  constructor(ref, coll) {
    this.ref = ref; this.id = ref.id; this.coll = coll;
    this.data = null; this.base = null; this.baseV = null; this.exists = false;
    this.pending = false; this.saving = false; this.deleted = false;
    this.lastWrittenV = null; this.remoteDuringSave = false; this.timer = null; this.err = null;
    this.states = new Map();
    Store.docs.add(this);
  }
  sig(d) { return d ? JSON.stringify(d, (k, v) => (k && k[0] === '_') ? undefined : v) : ''; }
  remember(v, d) {
    if (!v) return;
    this.states.set(v, d);
    if (this.states.size > 48) this.states.delete(this.states.keys().next().value);
  }
  /* Cada escritura lleva su versión (_v), la versión de la que partió (_pv) y una cadena corta de
     versiones anteriores (_anc). Si llega una versión que no partió de la nuestra, es una edición
     simultánea: se fusiona con el ancestro común más reciente que conocemos, para que nadie pierda su trabajo. */
  ancestorOf(data) {
    const chain = [data._pv].concat(data._anc || []).filter(Boolean);
    for (const id of chain) if (id === this.baseV || id === this.lastWrittenV || this.states.has(id)) return id;
    return null;
  }
  remote(data, meta) {
    if (this.deleted || !data) return;
    if (meta && meta.hasPendingWrites) return;
    this.exists = true;
    const v = data._v || null;
    if (v && v === this.baseV) return;
    this.remember(v, data);
    const s = this.sig(data);
    if (this.data && s === this.sig(this.data)) {
      this.base = data; this.baseV = v;
      if (!this.saving && !this.timer) this.pending = false;
      return;
    }
    if (v && v === this.lastWrittenV) {
      this.base = data; this.baseV = v;
      if (this.saving) this.remoteDuringSave = true;
      if (this.data && this.sig(this.data) !== s) { this.pending = true; this.schedule(); }
      return;
    }
    if (this.saving) this.remoteDuringSave = true;
    const anc = this.ancestorOf(data);
    if (this.trace) this.trace.push('recv ' + v + ' anc=' + anc + ' base=' + this.baseV + ' lw=' + this.lastWrittenV + ' pend=' + this.pending + ' sav=' + this.saving);
    const direct = anc && (anc === this.baseV || anc === this.lastWrittenV);
    if (!this.data || (!this.pending && !this.saving && (direct || (!anc && !this.lastWrittenV)))) {
      this.data = clone(data); this.base = data; this.baseV = v; this.emit('remote'); return;
    }
    const ancState = (anc && (this.states.get(anc) || (anc === this.baseV ? this.base : null))) || this.base || {};
    const merged = merge3(ancState, this.data, clone(data));
    this.data = merged; this.base = data; this.baseV = v;
    if (this.sig(merged) !== s) { this.pending = true; this.schedule(); }
    this.emit('merge');
  }
  update(fn, opts) {
    if (!RT.canWrite) return false;
    if (!this.data) this.data = {};
    fn(this.data);
    this.pending = true;
    this.schedule(opts && opts.now ? 10 : 800);
    if (!(opts && opts.silent)) this.emit('local');
    return true;
  }
  schedule(ms) {
    if (this.deleted) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.save(), ms == null ? 800 : ms);
    Store.setStatus();
  }
  flush() { if (this.timer) { clearTimeout(this.timer); this.timer = null; this.save(); } }
  async save() {
    this.timer = null;
    if (this.deleted || !this.pending) { Store.setStatus(); return; }
    if (this.saving) { this.schedule(400); return; }
    const payload = clone(this.data);
    payload._at = Date.now();
    payload._by = RT.me || null;
    payload._v = uid('v');
    payload._pv = this.baseV || null;
    payload._anc = this.base ? [this.base._pv].concat(this.base._anc || []).filter(Boolean).slice(0, 12) : [];
    const s = this.sig(payload);
    this.lastWrittenV = payload._v;
    this.remember(payload._v, payload);
    this.saving = true; this.remoteDuringSave = false;
    Store.setStatus();
    try {
      await this.ref.set(payload);
      this.exists = true; this.err = null; Store.err = null; Store.lastSaved = Date.now();
      if (!this.remoteDuringSave) { this.base = payload; this.baseV = payload._v; }
      if (this.sig(this.data) === s) this.pending = false; else this.schedule(300);
    } catch (e) {
      const code = (e && e.code) || 'error';
      this.err = code; Store.err = { code: code, doc: this };
      if (!PERMANENT.has(code)) this.schedule(4000 + Math.random() * 2000);
      if (window.App && App.onSaveError) App.onSaveError(this, code, e);
    } finally {
      this.saving = false;
      Store.setStatus();
    }
  }
  emit(kind) { if (this.coll && this.coll.onDoc) this.coll.onDoc(this, kind); }
  dispose() { Store.docs.delete(this); clearTimeout(this.timer); }
}

class Coll {
  constructor(path, opts) {
    this.path = path; this.ref = RT.db.collection(path);
    this.docs = new Map(); this.ready = false;
    this.onChange = opts && opts.onChange; this.onDoc = opts && opts.onDoc;
    this.unsub = this.ref.onSnapshot((snap) => this.onSnap(snap), (err) => {
      this.error = err; if (window.App && App.onSyncError) App.onSyncError(this, err);
    });
  }
  onSnap(snap) {
    const seen = new Set();
    snap.docs.forEach(d => {
      seen.add(d.id);
      let sd = this.docs.get(d.id);
      if (!sd) { sd = new SyncDoc(this.ref.doc(d.id), this); this.docs.set(d.id, sd); }
      sd.remote(d.data(), d.metadata);
    });
    this.docs.forEach((sd, id) => {
      if (!seen.has(id) && sd.exists && !sd.pending && !sd.saving) { sd.dispose(); this.docs.delete(id); }
    });
    this.ready = true;
    if (this.onChange) this.onChange(this);
  }
  get(id) { return this.docs.get(id) || null; }
  list() { return Array.from(this.docs.values()).filter(d => d.data); }
  create(id, data) {
    const sd = new SyncDoc(this.ref.doc(id), this);
    sd.data = data; sd.pending = true;
    this.docs.set(id, sd);
    sd.schedule(10);
    return sd;
  }
  async remove(id) {
    const sd = this.docs.get(id);
    if (sd) { sd.deleted = true; sd.dispose(); }
    this.docs.delete(id);
    try { await this.ref.doc(id).delete(); } catch (e) {}
  }
  close() { if (this.unsub) this.unsub(); this.docs.forEach(d => { d.flush(); }); }
}

async function initRuntime() {
  const C = window.claude;
  const use = (n) => (C && C.use) ? C.use(n).catch(() => null) : Promise.resolve(null);
  const [db, user, sample, downloads, room, mcp] = await Promise.all(['db', 'user', 'sample', 'downloads', 'room', 'mcp'].map(use));
  RT.user = user; RT.sample = sample; RT.downloads = downloads; RT.room = room; RT.mcp = mcp;
  if (db) {
    RT.db = db;
    try { RT.me = user ? await user.id() : null; } catch (e) { RT.me = null; }
    let can = null;
    try { can = user ? await user.can('data.write') : null; } catch (e) { can = null; }
    RT.canWrite = can !== false;
  } else if (window.MDE_WEB && !window.claude && typeof indexedDB !== 'undefined') {
    try { RT.db = await makeIdbDB(); } catch (e) { RT.db = makeLocalDB(); }
    RT.local = true; RT.web = true; RT.canWrite = true; RT.me = 'local';
    RT.sample = AI.sampler(); RT.downloads = WebDownloads;
  } else {
    RT.db = makeLocalDB(); RT.local = true; RT.canWrite = true; RT.me = 'local';
  }
  if (mcp) {
    try {
      const lt = await mcp.listTools();
      (lt.servers || []).forEach(s => {
        if (s.server === 'Google Drive' && (s.tools || []).length) RT.drive = true;
        if (s.server === 'Claude Docs') RT.docs = true;
      });
    } catch (e) {}
  }
  RT.ready = true;
}
