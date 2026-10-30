/* ============ importar y exportar ============ */
const LIBS = {
  jszip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  mammoth: 'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js'
};
const loaded = {};
function loadScript(key) {
  if (loaded[key]) return loaded[key];
  loaded[key] = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = LIBS[key]; s.async = true;
    s.onload = () => res(); s.onerror = () => { loaded[key] = null; rej(new Error('No se pudo cargar ' + key)); };
    document.head.append(s);
  });
  return loaded[key];
}
const xesc = (s) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hesc = xesc;
function b64ToBytes(b64) { const bin = atob(b64.replace(/\s+/g, '')); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
function mcpContent(res) {
  const blocks = (res && res.content) || [];
  for (const b of blocks) {
    if (b && b.type === 'resource' && b.resource) {
      if (b.resource.blob) return { b64: b.resource.blob, mime: b.resource.mimeType || '' };
      if (b.resource.text != null) return { text: b.resource.text, mime: b.resource.mimeType || '' };
    }
  }
  const p = res && res.payload;
  if (p && typeof p === 'object') {
    for (const k of ['base64Content', 'content', 'data', 'blob']) if (typeof p[k] === 'string' && /^[A-Za-z0-9+/=\s]+$/.test(p[k].slice(0, 200))) return { b64: p[k], mime: p.mimeType || '' };
    for (const k of ['text', 'content', 'body']) if (typeof p[k] === 'string') return { text: p[k] };
  }
  if (typeof p === 'string') return { text: p };
  for (const b of blocks) if (b && b.type === 'text' && b.text) return { text: b.text };
  return null;
}

const IO = {
  /* ---------- guardar archivo ---------- */
  async save(filename, data) {
    if (RT.downloads) {
      try { await RT.downloads.save({ filename: filename, data: data }); return true; }
      catch (e) {
        const c = e && e.code;
        if (c === 'declined') return false;
        if (c === 'rate_limited') { App.toast('Ya hay una descarga esperando tu confirmación.'); return false; }
        if (c === 'rejected_extension' || c === 'extension_not_enabled') { App.toast('Este formato no se puede descargar aquí.'); return false; }
      }
    }
    if (typeof data === 'string') { this.showText(filename, data); return false; }
    App.toast('Las descargas no están disponibles en esta vista.');
    return false;
  },
  showText(filename, text) {
    const ta = h('textarea', { class: 'area', rows: '14', readonly: true, style: 'font:400 .7812rem/1.5 var(--f-mono)' }); ta.value = text;
    UI.modal({ title: filename, body: h('div', { style: 'display:flex;flex-direction:column;gap:.6rem' }, h('p', { class: 'muted', style: 'margin:0', text: 'Las descargas no están disponibles en esta vista. Copia el contenido:' }), ta),
      buttons: [{ label: 'Cerrar' }, { label: 'Copiar', cls: 'primary', onClick: () => { navigator.clipboard.writeText(text).then(() => App.toast('Copiado.'), () => { ta.select(); }); return false; } }] });
  },

  /* ---------- reunir contenido ---------- */
  collect(pid, cid) {
    const P = App.P();
    const list = cid ? App.chapterList().filter(c => c.id === cid) : App.chapterList();
    return { P: P, chapters: list.map(c => { const d = App.ch(c.id); return { id: c.id, title: c.title || '', paras: d && d.data ? d.data.paras : [] }; }) };
  },

  /* ---------- exportar ---------- */
  openExport(pid, cid) {
    const one = !!cid;
    let scope = one ? 'chapter' : 'project', fmt = 'docx', notes = false;
    const unit = App.unit().toLowerCase();
    const scopeSel = h('select', { class: 'sel', id: 'ex-scope' }, h('option', { value: 'project', text: 'Todo el proyecto' }));
    if (one || App.cid) scopeSel.append(h('option', { value: 'chapter', text: 'Solo este ' + unit + (cid || App.cid ? ' («' + (App.chTitle(cid || App.cid) || unit) + '»)' : '') }));
    scopeSel.value = scope;
    const opts = [
      ['docx', 'Word (.docx)', 'Formato de manuscrito: Times 12, interlineado 1,5, cada ' + unit + ' en página nueva.'],
      ['md', 'Markdown (.md)', 'Texto plano con títulos; ideal para GitHub o Substack.'],
      ['txt', 'Texto (.txt)', 'Solo el texto.'],
      ['html', 'Página web (.html)', 'Lista para leer en el navegador.'],
      ['json', 'Respaldo completo (.json)', 'Todo el proyecto con biblia y notas; se puede volver a importar.']
    ];
    if (RT.drive) opts.push(['drive', 'Google Docs', 'Crea un documento nuevo en tu Google Drive.']);
    if (RT.docs) opts.push(['claudedocs', 'Claude Docs', 'Crea un documento en Claude Docs (hasta unas 5.000 palabras).']);
    const grid = h('div', { class: 'kinds', role: 'radiogroup', 'aria-label': 'Formato' });
    opts.forEach(([k, l, d]) => {
      const b = h('button', { class: 'kopt', type: 'button', role: 'radio', 'aria-checked': k === fmt ? 'true' : 'false' }, h('b', { text: l, style: 'font-size:1.05rem' }), h('span', { text: d }));
      b.addEventListener('click', () => { fmt = k; $$('.kopt', grid).forEach(x => x.setAttribute('aria-checked', 'false')); b.setAttribute('aria-checked', 'true'); });
      grid.append(b);
    });
    const nb = h('input', { type: 'checkbox', id: 'ex-notes' });
    nb.addEventListener('change', () => { notes = nb.checked; });
    UI.modal({
      title: 'Exportar',
      body: h('div', { style: 'display:flex;flex-direction:column;gap:.9rem' },
        h('label', { class: 'field' }, h('span', { text: 'Qué exportar' }), scopeSel),
        h('div', { class: 'field' }, h('span', { text: 'Formato' }), grid),
        h('label', { class: 'row', style: 'font-size:.875rem' }, nb, h('span', { text: 'Incluir las notas del corrector (en Word, como comentarios)' }))),
      buttons: [{ label: 'Cancelar' }, { label: 'Exportar', cls: 'primary', onClick: () => { scope = scopeSel.value; this.doExport(fmt, scope === 'chapter' ? (cid || App.cid) : null, notes); } }]
    });
  },
  async doExport(fmt, cid, notes) {
    const { P, chapters } = this.collect(App.pid, cid);
    const base = slug(P.title) + (cid ? '-' + slug(chapters[0] && chapters[0].title) : '');
    try {
      if (fmt === 'docx') await this.save(base + '.docx', await this.toDocx(P, chapters, notes, !!cid));
      else if (fmt === 'md') await this.save(base + '.md', this.toMarkdown(P, chapters, notes, !!cid));
      else if (fmt === 'txt') await this.save(base + '.txt', this.toText(P, chapters, !!cid));
      else if (fmt === 'html') await this.save(base + '.html', this.toHtml(P, chapters, notes, !!cid));
      else if (fmt === 'json') await this.save(slug(P.title) + '-respaldo-' + dayKey() + '.json', this.toBackup());
      else if (fmt === 'drive') await this.toDrive(P, chapters, notes, !!cid);
      else if (fmt === 'claudedocs') await this.toClaudeDocs(cid || App.cid);
    } catch (e) { App.toast('No se pudo exportar: ' + ((e && e.message) || 'error') + '.'); }
  },
  noteLabel(m) { return '[' + TYPES[m.type].l + '] ' + (m.note || '') + (m.fix && m.fix.to && !m.fix.applied ? ' → «' + m.fix.to + '»' : ''); },
  toText(P, chs, one) {
    const out = [];
    if (!one) out.push(P.title.toUpperCase(), '');
    chs.forEach(c => { out.push(c.title, ''); c.paras.forEach(p => { const t = parText(p); if (t.trim()) out.push(t, ''); }); out.push(''); });
    return out.join('\n').trim() + '\n';
  },
  toMarkdown(P, chs, notes, one) {
    const out = []; let n = 0; const foot = [];
    if (!one) out.push('# ' + P.title, '');
    chs.forEach(c => {
      out.push((one ? '# ' : '## ') + c.title, '');
      c.paras.forEach(p => {
        let s = '';
        p.segs.forEach(g => { if (g.t != null) s += g.t; else { s += g.m.text; if (notes) { n++; s += '[^' + n + ']'; foot.push('[^' + n + ']: ' + this.noteLabel(g.m).replace(/\n/g, ' ')); } } });
        if (s.trim()) out.push(s, '');
      });
    });
    if (foot.length) out.push('---', '', foot.join('\n'), '');
    return out.join('\n');
  },
  toHtml(P, chs, notes, one) {
    const pst = (P.style && P.style.paragraph) || 'sangria';
    let body = one ? '' : '<h1>' + hesc(P.title) + '</h1>\n';
    let n = 0;
    chs.forEach(c => {
      body += (one ? '<h1>' : '<h2>') + hesc(c.title) + (one ? '</h1>' : '</h2>') + '\n';
      c.paras.forEach(p => {
        if (!parText(p).trim()) return;
        let s = '', asides = '';
        p.segs.forEach(g => {
          if (g.t != null) s += hesc(g.t);
          else if (notes) { n++; s += '<mark>' + hesc(g.m.text) + '</mark><sup>' + n + '</sup>'; asides += '<aside><b>' + n + '.</b> ' + hesc(this.noteLabel(g.m)) + '</aside>'; }
          else s += hesc(g.m.text);
        });
        body += '<p>' + s + '</p>' + asides + '\n';
      });
    });
    return '<!doctype html>\n<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + hesc(one ? chs[0].title : P.title) + '</title><style>body{max-width:42rem;margin:3rem auto;padding:0 1.2rem;font:1.1875rem/1.75 Georgia,"Times New Roman",serif;color:#2a221b;background:#fbf7ef}h1,h2{font-weight:400;text-align:center}h1{font-size:2.4rem;margin:2rem 0 3rem}h2{font-size:1.8rem;margin:4rem 0 2rem}p{margin:0}' + (pst === 'sangria' ? 'p+p{text-indent:1.6em}' : 'p+p{margin-top:.9em}') + 'mark{background:#f2dd9c}sup{font:600 .6em system-ui;color:#8a5c16}aside{font:.875rem/1.5 system-ui,sans-serif;color:#6b5e4e;border-left:3px solid #e2dacd;padding-left:.8rem;margin:.4rem 0 .8rem;text-indent:0}@media (prefers-color-scheme:dark){body{background:#171411;color:#eee6d8}mark{background:#5a4520;color:inherit}aside{color:#b5a893;border-color:#3a332c}}</style></head><body>\n' + body + '</body></html>\n';
  },
  async toDocx(P, chs, notes, one) {
    await loadScript('jszip');
    const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const run = (t) => '<w:r><w:t xml:space="preserve">' + xesc(t) + '</w:t></w:r>';
    const comments = [];
    let body = '';
    const para = (style, inner) => '<w:p>' + (style ? '<w:pPr><w:pStyle w:val="' + style + '"/></w:pPr>' : '') + inner + '</w:p>';
    if (!one) body += para('Title', run(P.title));
    chs.forEach((c, ci) => {
      body += para(ci === 0 && !one ? 'Heading1First' : 'Heading1', run(c.title || ''));
      let first = true;
      c.paras.forEach(p => {
        if (!parText(p).trim()) return;
        let inner = '';
        p.segs.forEach(g => {
          if (g.t != null) { inner += run(g.t); return; }
          if (!notes) { inner += run(g.m.text); return; }
          const id = comments.length;
          const m = g.m;
          const lines = [this.noteLabel(m)].concat((m.replies || []).map(r => Editor.author(r.by) + ': ' + r.text));
          comments.push({ id: id, author: m.by === 'claude' ? 'Claude' : Editor.author(m.by), date: new Date(m.at || Date.now()).toISOString().replace(/\.\d+Z$/, 'Z'), lines: lines });
          inner += '<w:commentRangeStart w:id="' + id + '"/>' + run(m.text) + '<w:commentRangeEnd w:id="' + id + '"/><w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="' + id + '"/></w:r>';
        });
        body += para(first || (P.style && P.style.paragraph === 'bloque') ? 'SinSangria' : null, inner);
        first = false;
      });
    });
    const doc = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="' + W + '"><w:body>' + body +
      '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>';
    const bloque = P.style && P.style.paragraph === 'bloque';
    const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:styles xmlns:w="' + W + '">' +
      '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="es-CL"/></w:rPr></w:rPrDefault>' +
      '<w:pPrDefault><w:pPr><w:spacing w:after="' + (bloque ? '200' : '0') + '" w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr>' + (bloque ? '' : '<w:ind w:firstLine="567"/>') + '<w:jc w:val="both"/></w:pPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="SinSangria"><w:name w:val="Sin sangría"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:firstLine="0"/></w:pPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="2400" w:after="1200"/><w:ind w:firstLine="0"/><w:jc w:val="center"/></w:pPr><w:rPr><w:sz w:val="52"/><w:szCs w:val="52"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="SinSangria"/><w:qFormat/><w:pPr><w:keepNext/><w:pageBreakBefore/><w:spacing w:before="1200" w:after="600"/><w:ind w:firstLine="0"/><w:jc w:val="center"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:sz w:val="34"/><w:szCs w:val="34"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Heading1First"><w:name w:val="Heading 1 first"/><w:basedOn w:val="Heading1"/><w:next w:val="SinSangria"/><w:pPr><w:pageBreakBefore w:val="0"/></w:pPr></w:style>' +
      '<w:style w:type="character" w:styleId="CommentReference"><w:name w:val="annotation reference"/><w:rPr><w:sz w:val="16"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="CommentText"><w:name w:val="annotation text"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:firstLine="0"/><w:jc w:val="left"/><w:spacing w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="20"/></w:rPr></w:style>' +
      '</w:styles>';
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' + (comments.length ? '<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/>' : '') + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>');
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>');
    zip.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' + (comments.length ? '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/>' : '') + '</Relationships>');
    zip.file('word/document.xml', doc);
    zip.file('word/styles.xml', styles);
    if (comments.length) {
      zip.file('word/comments.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:comments xmlns:w="' + W + '">' + comments.map(c =>
        '<w:comment w:id="' + c.id + '" w:author="' + xesc(c.author) + '" w:date="' + c.date + '" w:initials="' + xesc((c.author || 'C').slice(0, 2)) + '">' +
        c.lines.map(l => '<w:p><w:pPr><w:pStyle w:val="CommentText"/></w:pPr><w:r><w:t xml:space="preserve">' + xesc(l) + '</w:t></w:r></w:p>').join('') + '</w:comment>').join('') + '</w:comments>');
    }
    zip.file('docProps/core.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' + xesc(P.title) + '</dc:title><dc:creator>Máquina de escribir</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">' + new Date().toISOString().replace(/\.\d+Z$/, 'Z') + '</dcterms:created></cp:coreProperties>');
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  },
  toBackup() {
    const P = clone(App.P());
    Object.keys(P).forEach(k => { if (k[0] === '_') delete P[k]; });
    const chapters = {};
    App.chapterList().concat(P.trash || []).forEach(c => { const d = App.ch(c.id); if (d && d.data) { const x = clone(d.data); Object.keys(x).forEach(k => { if (k[0] === '_') delete x[k]; }); chapters[c.id] = x; } });
    return JSON.stringify({ format: 'maquina-de-escribir', version: 1, exportedAt: new Date().toISOString(), project: P, chapters: chapters }, null, 1);
  },
  async callMcp(server, tool, input) {
    if (!RT.mcp) throw { code: 'not_granted' };
    return RT.mcp.callTool(server, tool, input);
  },
  mcpError(e, server) {
    const c = e && e.code;
    if (c === 'needs_reauth') return 'Vuelve a conectar ' + server + ' en claude.ai: Configuración, Conectores.';
    if (c === 'server_not_connected' || c === 'selection_required') return 'Agrega o elige ' + server + ' en claude.ai: Configuración, Conectores.';
    if (c === 'not_in_manifest' || c === 'approval_required' || c === 'consent_required') return 'Hace falta tu permiso para usar ' + server + ' desde esta página.';
    if (c === 'blocked_by_policy') return 'Tu organización bloquea esta acción en ' + server + '.';
    if (c === 'server_unavailable' || c === 'upstream_error') return server + ' no respondió. Intenta de nuevo en un momento.';
    if (c === 'tool_error') return server + ' informó un error.';
    return 'No se pudo usar ' + server + '.';
  },
  linkModal(title, text, url) {
    UI.modal({ title: title, body: h('div', { style: 'display:flex;flex-direction:column;gap:.6rem' }, h('p', { style: 'margin:0', text: text }), url ? h('a', { href: url, target: '_blank', rel: 'noopener', class: 'btn', style: 'align-self:flex-start', text: 'Abrir documento' }) : null), buttons: [{ label: 'Listo', cls: 'primary' }] });
  },
  async toDrive(P, chs, notes, one) {
    const html = this.toHtml(P, chs, notes, one);
    const title = one ? P.title + ' · ' + chs[0].title : P.title;
    App.toast('Creando el documento en Google Drive…');
    try {
      const res = await this.callMcp('Google Drive', 'create_file', { title: title, textContent: html, contentMimeType: 'text/html' });
      const p = (res && res.payload) || {};
      const f = p.file || p;
      const url = f.viewUrl || f.webViewLink || f.alternateLink || (f.id ? 'https://docs.google.com/document/d/' + f.id + '/edit' : null);
      this.linkModal('Documento creado', 'Quedó en tu Google Drive como «' + title + '».', url);
    } catch (e) { App.toast(this.mcpError(e, 'Google Drive')); }
  },
  async toClaudeDocs(cid) {
    const { P, chapters } = this.collect(App.pid, cid);
    const c = chapters[0]; if (!c) return;
    let md = this.toMarkdown(P, chapters, false, true);
    if (utf8Bytes(md) >= 32000) { App.toast('Este texto supera el límite de Claude Docs (unas 5.000 palabras). Expórtalo a Word o Google Docs.'); return; }
    const name = cleanInvisible((P.title + ' · ' + c.title).replace(/[\u0000-\u001F\u2028\u2029]/g, ' ')).slice(0, 190) || 'Texto';
    try {
      const res = await this.callMcp('Claude Docs', 'batch', { container: { kind: 'project', create: { name: name, doc: { markdown: md } } }, batch: [] });
      const p = (res && res.payload) || {};
      this.linkModal('Documento creado', 'Se creó «' + name + '» en Claude Docs.', p.url || null);
    } catch (e) {
      const c2 = e && e.code;
      if (c2 === 'approval_required') App.toast('Crear el documento necesita tu aprobación en claude.ai.');
      else if (c2 === 'tool_error' && e.result && e.result.structuredContent && e.result.structuredContent.created === false) App.toast('No se creó el documento (' + (e.result.structuredContent.reason || 'motivo desconocido') + ').');
      else if (c2 === 'tool_error' || c2 === 'server_unavailable' || c2 === 'upstream_error') App.toast('No sé si se creó el documento. Revisa Claude Docs antes de intentar de nuevo.');
      else App.toast(this.mcpError(e, 'Claude Docs'));
    }
  },

  /* ---------- importar ---------- */
  openImport(pid) {
    let parsed = null, mode = pid ? 'add' : 'new';
    const status = h('div', { class: 'muted', style: 'font-size:.8438rem', id: 'im-status' });
    const preview = h('div', { id: 'im-prev', style: 'display:flex;flex-direction:column;gap:.35rem' });
    const file = h('input', { type: 'file', accept: '.docx,.md,.markdown,.txt,.html,.htm,.json', class: 'sr', id: 'im-file' });
    const drop = h('label', { class: 'drop', for: 'im-file' }, h('div', { style: 'font:400 1.3rem/1.2 var(--f-display);color:var(--ink)', text: 'Arrastra un archivo o elígelo' }), h('div', { style: 'font-size:.8125rem;margin-top:.3rem', text: 'Word (.docx), Markdown, texto, HTML o un respaldo .json de esta herramienta' }));
    const onFile = async (f) => {
      if (!f) return;
      status.textContent = 'Leyendo «' + f.name + '»…'; preview.textContent = '';
      try { parsed = await this.parseFile(f); showPrev(); }
      catch (e) { parsed = null; status.textContent = 'No pude leer el archivo: ' + ((e && e.message) || 'formato no reconocido') + '.'; }
    };
    file.addEventListener('change', () => onFile(file.files[0]));
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); onFile(e.dataTransfer.files[0]); });
    const single = h('input', { type: 'checkbox', id: 'im-single' });
    const showPrev = () => {
      preview.textContent = '';
      if (!parsed) return;
      if (parsed.backup) { status.textContent = 'Respaldo de «' + parsed.backup.project.title + '» con ' + plural(Object.keys(parsed.backup.chapters || {}).length, 'texto') + '. Se creará como proyecto nuevo.'; return; }
      const words = parsed.chapters.reduce((n, c) => n + chapterWords(c), 0);
      status.textContent = '«' + parsed.title + '»: ' + plural(parsed.chapters.length, 'parte') + ', ' + plural(words, 'palabra') + '.';
      parsed.chapters.slice(0, 12).forEach((c, i) => preview.append(h('div', { class: 'row', style: 'font-size:.8438rem' }, h('span', { class: 'kbd', text: String(i + 1) }), h('span', { text: c.title + ' · ' + plural(chapterWords(c), 'palabra') }))));
      if (parsed.chapters.length > 12) preview.append(h('div', { class: 'muted', text: '…y ' + (parsed.chapters.length - 12) + ' más.' }));
    };
    const target = h('div', { class: 'checks' });
    if (pid) {
      const r1 = h('input', { type: 'radio', name: 'im-mode', checked: true }), r2 = h('input', { type: 'radio', name: 'im-mode' });
      r1.addEventListener('change', () => { mode = 'add'; }); r2.addEventListener('change', () => { mode = 'new'; });
      target.append(h('label', null, r1, 'Agregar a «' + App.P().title + '»'), h('label', null, r2, 'Crear proyecto nuevo'));
    }
    const drive = h('div', { style: 'display:flex;flex-direction:column;gap:.5rem' });
    if (RT.drive) {
      const q = h('input', { class: 'inp', id: 'im-dq', placeholder: 'Buscar en Google Drive por título…' });
      const res = h('div', { style: 'display:flex;flex-direction:column;gap:.35rem;max-height:220px;overflow:auto' });
      const search = async () => {
        const t = q.value.trim().replace(/'/g, "\\'");
        res.textContent = ''; res.append(h('div', { class: 'muted', style: 'font-size:.8125rem', text: 'Buscando…' }));
        const mimes = "(mimeType = 'application/vnd.google-apps.document' or mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' or mimeType = 'text/plain' or mimeType = 'text/markdown')";
        try {
          const r = await this.callMcp('Google Drive', 'search_files', { query: (t ? "title contains '" + t + "' and " : '') + mimes, pageSize: 12, excludeContentSnippets: true });
          const files = (r && r.payload && r.payload.files) || [];
          res.textContent = '';
          if (!files.length) res.append(h('div', { class: 'muted', style: 'font-size:.8125rem', text: 'Sin resultados.' }));
          files.forEach(f => res.append(h('button', { class: 'res', type: 'button', style: 'text-align:left', onclick: async () => {
            status.textContent = 'Descargando «' + f.title + '»…'; preview.textContent = '';
            try { parsed = await this.fromDrive(f); showPrev(); } catch (e) { parsed = null; status.textContent = (e && e.code) ? this.mcpError(e, 'Google Drive') : 'No pude leer ese documento.'; }
          } }, h('div', { class: 'snip', style: 'font-family:var(--f-ui)', text: f.title }), h('div', { class: 'where', text: (f.mimeType || '').indexOf('google-apps') >= 0 ? 'Google Docs · ' + relTime(Date.parse(f.modifiedTime)) : relTime(Date.parse(f.modifiedTime)) }))));
        } catch (e) { res.textContent = ''; res.append(h('div', { class: 'muted', style: 'font-size:.8125rem', text: this.mcpError(e, 'Google Drive') })); }
      };
      q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } });
      drive.append(h('div', { class: 'label', text: 'O desde Google Drive' }), h('div', { class: 'row' }, h('div', { style: 'flex:1;min-width:0' }, q), btn('Buscar', search)), res);
    }
    UI.modal({
      title: 'Importar',
      body: h('div', { style: 'display:flex;flex-direction:column;gap:.9rem' }, file, drop, drive, status, preview,
        h('label', { class: 'row', style: 'font-size:.875rem' }, single, h('span', { text: 'Todo en un solo ' + (pid ? App.unit().toLowerCase() : 'texto') + ', sin dividir' })), target),
      buttons: [{ label: 'Cancelar' }, { label: 'Importar', cls: 'primary', onClick: () => {
        if (!parsed) { App.toast('Elige primero un archivo.'); return false; }
        this.commitImport(parsed, mode === 'add' ? pid : null, single.checked);
      } }]
    });
  },
  async parseFile(f) {
    const name = f.name.replace(/\.[^.]+$/, '');
    const ext = (f.name.match(/\.([^.]+)$/) || [])[1];
    const e = (ext || '').toLowerCase();
    if (e === 'docx') {
      await loadScript('mammoth');
      const r = await mammoth.convertToHtml({ arrayBuffer: await f.arrayBuffer() }, { styleMap: ["p[style-name='Title'] => p.title:fresh"] });
      return this.parseHtml(r.value, name);
    }
    const text = await f.text();
    if (e === 'json') {
      const j = JSON.parse(text);
      if (j && j.format === 'maquina-de-escribir' && j.project) return { backup: j };
      throw new Error('no es un respaldo de esta herramienta');
    }
    if (e === 'html' || e === 'htm') return this.parseHtml(text, name);
    return this.parseText(text, name, e === 'md' || e === 'markdown');
  },
  async fromDrive(f) {
    const isGdoc = (f.mimeType || '').indexOf('google-apps.document') >= 0;
    const res = await this.callMcp('Google Drive', 'download_file_content', isGdoc ? { fileId: f.id, exportMimeType: 'text/html' } : { fileId: f.id });
    const c = mcpContent(res);
    if (!c) throw new Error('vacío');
    if (f.mimeType && f.mimeType.indexOf('wordprocessingml') >= 0 && c.b64) {
      await loadScript('mammoth');
      const bytes = b64ToBytes(c.b64);
      const r = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer }, { styleMap: ["p[style-name='Title'] => p.title:fresh"] });
      return this.parseHtml(r.value, f.title);
    }
    const text = c.text != null ? c.text : new TextDecoder('utf-8').decode(b64ToBytes(c.b64));
    if (isGdoc || /^\s*</.test(text)) return this.parseHtml(text, f.title);
    return this.parseText(text, f.title, /\.md$/i.test(f.title));
  },
  isHeading(line) {
    const t = line.trim();
    if (/^#{1,3}\s+\S/.test(t)) return t.replace(/^#{1,3}\s+/, '').replace(/[*_]/g, '').trim();
    if (/^(cap[ií]tulo|parte|escena|pr[oó]logo|ep[ií]logo|libro)\b[^.!?]{0,60}$/i.test(t)) return t;
    if (/^[IVXLCDM]{1,7}\.?$/.test(t)) return t.replace(/\.$/, '');
    return null;
  },
  parseText(text, title, md) {
    text = cleanInvisible(text).replace(/\r/g, '').normalize('NFC');
    const blank = /\n[ \t]*\n/.test(text);
    const chs = []; let cur = null, buf = [];
    const flushPara = () => { const t = buf.join(' ').replace(/\s+/g, ' ').trim(); buf = []; if (!t) return; if (!cur) { cur = { title: 'Inicio', paras: [] }; chs.push(cur); } cur.paras.push({ id: uid('p'), segs: [{ t: md ? t.replace(/(\*\*|__)(.+?)\1/g, '$2').replace(/(^|\W)[*_]([^*_]+)[*_](?=\W|$)/g, '$1$2') : t }] }); };
    text.split('\n').forEach(line => {
      const hd = this.isHeading(line);
      if (hd) { flushPara(); cur = { title: hd, paras: [] }; chs.push(cur); return; }
      if (!line.trim()) { flushPara(); return; }
      if (md && /^(-{3,}|\*{3,})$/.test(line.trim())) { flushPara(); return; }
      buf.push(line.trim());
      if (!blank) flushPara();
    });
    flushPara();
    return this.finishParse(chs, title);
  },
  parseHtml(html, title) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const chs = []; let cur = null;
    let docTitle = null;
    const addP = (t) => { t = cleanInvisible(t).replace(/\s+/g, ' ').trim().normalize('NFC'); if (!t) return; if (!cur) { cur = { title: 'Inicio', paras: [] }; chs.push(cur); } cur.paras.push({ id: uid('p'), segs: [{ t: t }] }); };
    const walk = (el) => {
      Array.from(el.children).forEach(c => {
        const tag = c.tagName;
        if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(tag)) return;
        if (/^H[1-3]$/.test(tag)) { const t = c.textContent.replace(/\s+/g, ' ').trim(); if (t) { cur = { title: t, paras: [] }; chs.push(cur); } return; }
        if (tag === 'P' && c.classList.contains('title')) { docTitle = c.textContent.trim() || docTitle; return; }
        if (/^(P|LI|BLOCKQUOTE|H4|H5|H6|PRE)$/.test(tag)) {
          const t = c.textContent;
          const hd = tag === 'P' ? this.isHeading(t) : null;
          if (hd && t.trim().length < 70) { cur = { title: hd, paras: [] }; chs.push(cur); return; }
          addP(t); return;
        }
        if (c.children.length) walk(c); else addP(c.textContent);
      });
    };
    walk(doc.body);
    return this.finishParse(chs, docTitle || title);
  },
  finishParse(chs, title) {
    chs = chs.filter(c => c.paras.length || c.title !== 'Inicio');
    if (!chs.length) chs = [{ title: title || 'Texto', paras: [] }];
    if (chs.length === 1 && chs[0].title === 'Inicio') chs[0].title = title || 'Texto';
    chs.forEach(c => { if (!c.paras.length) c.paras = [{ id: uid('p'), segs: [] }]; });
    return { title: title || 'Texto importado', chapters: chs };
  },
  commitImport(parsed, pid, single) {
    if (parsed.backup) { this.restoreBackup(parsed.backup); return; }
    let chs = parsed.chapters;
    if (single) chs = [{ title: parsed.title, paras: [].concat(...chs.map(c => c.paras.filter(p => parText(p).trim()))) }];
    chs.forEach(c => { c.id = uid('c'); });
    if (pid) {
      chs.forEach(c => App.chapters.create(c.id, { paras: c.paras }));
      App.proj().update(x => { chs.forEach(c => x.chapters.push({ id: c.id, title: c.title })); }, { now: true });
      App.toast(plural(chs.length, 'parte importada', 'partes importadas') + '.');
      App.go(App.chHash(chs[0].id));
    } else {
      App.createProject(parsed.title, 'novela', 0, chs, 'mine');
      App.toast('Proyecto importado. Cambia el tipo en Ajustes si no es una novela.');
    }
  },
  restoreBackup(b) {
    const P = clone(b.project);
    const pid = uid('p');
    P.title = P.title + ' (respaldo)';
    P.trashed = false; P.createdAt = Date.now();
    const space = App.colls.mine ? 'mine' : 'team';
    App.colls[space].create(pid, P);
    Object.keys(b.chapters || {}).forEach(cid => { const d = b.chapters[cid]; RT.db.doc(App.spacePath(space) + '/' + pid + '/chapters/' + cid).set(Object.assign({}, d, { _v: uid('v') })).catch(() => {}); });
    App.toast('Respaldo restaurado como proyecto nuevo.');
    setTimeout(() => App.go('p-' + pid), 80);
  }
};
window.IO = IO;
