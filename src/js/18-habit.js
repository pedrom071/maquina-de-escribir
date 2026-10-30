/* ============ rachas y seguimiento de la escritura ============ */
const DIAS_L = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const Habit = {
  /* Une los registros diarios de varios proyectos: dayKey → {w, h:[24]} */
  /* En proyectos compartidos (x.shared) y con opts.who, cuenta solo lo que escribió esa persona. */
  merge(list, opts) {
    const who = opts && opts.who;
    const map = new Map();
    list.forEach(x => Object.entries(x.days || {}).forEach(([k, d]) => {
      let w = Math.max(0, (d.e || 0) - (d.s || 0)), f = 1;
      if (who && x.shared) { const tot = w; w = d.by ? Math.max(0, d.by[who] || 0) : 0; f = tot ? Math.min(1, w / tot) : 0; }
      const e = map.get(k) || { w: 0, h: new Array(24).fill(0) };
      e.w += w;
      if (d.h && f) Object.entries(d.h).forEach(([hr, n]) => { e.h[+hr] += n * f; });
      map.set(k, e);
    }));
    return map;
  },
  goal() { return +(App.prefs.dailyGoal || 0); },
  hit(e) { const g = this.goal(); return !!e && e.w > 0 && (!g || e.w >= g); },
  streaks(map) {
    const keys = Array.from(map.keys()).filter(k => this.hit(map.get(k))).sort();
    let best = 0, run = 0, prev = null, bestEnd = null;
    keys.forEach(k => {
      const d = new Date(k + 'T12:00:00');
      run = (prev && (d - prev) / 864e5 < 1.5) ? run + 1 : 1;
      if (run > best) { best = run; bestEnd = k; }
      prev = d;
    });
    // racha actual: cuenta hasta hoy, o hasta ayer si hoy todavía no escribes
    let cur = 0; const d = new Date();
    const todayHit = this.hit(map.get(dayKey(d)));
    if (!todayHit) d.setDate(d.getDate() - 1);
    while (this.hit(map.get(dayKey(d)))) { cur++; d.setDate(d.getDate() - 1); }
    return { cur: cur, best: best, bestEnd: bestEnd, todayHit: todayHit };
  },
  range(map, n) {
    const out = []; for (let i = n - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = dayKey(d); const e = map.get(k); out.push({ k: k, d: d, w: e ? e.w : 0, e: e }); }
    return out;
  },
  summary(map) {
    const last30 = this.range(map, 30), last7 = last30.slice(-7);
    const active = last30.filter(x => x.w > 0);
    const wd = new Array(7).fill(0), wdN = new Array(7).fill(0), hr = new Array(24).fill(0);
    map.forEach((e, k) => { if (!e.w) return; const d = new Date(k + 'T12:00:00'); wd[d.getDay()] += e.w; wdN[d.getDay()]++; e.h.forEach((n, i) => { hr[i] += n; }); });
    const sum = (a) => a.reduce((s, x) => s + x.w, 0);
    return { w30: sum(last30), w7: sum(last7), days30: active.length, days7: last7.filter(x => x.w > 0).length, avgDay: active.length ? Math.round(sum(active) / active.length) : 0, wd: wd, wdN: wdN, hr: hr, bestDay: Math.max(0, ...Array.from(map.values()).map(e => e.w)) };
  },
  moment(hr) {
    const parts = [['madrugada', 0, 6], ['mañana', 6, 12], ['tarde', 12, 19], ['noche', 19, 24]];
    const tot = hr.reduce((a, b) => a + b, 0); if (!tot) return null;
    return parts.map(([l, a, b]) => ({ l: l, v: hr.slice(a, b).reduce((x, y) => x + y, 0) / tot })).sort((x, y) => y.v - x.v);
  },
  /* Mapa de calor de las últimas semanas, al estilo de un calendario. */
  heat(map, weeks) {
    const cs = 13, gap = 3, top = 16, left = 26;
    const end = new Date(); const start = new Date(); start.setDate(end.getDate() - (weeks * 7 - 1));
    // empezar en lunes
    while (start.getDay() !== 1) start.setDate(start.getDate() - 1);
    const days = []; for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) days.push(new Date(d));
    const cols = Math.ceil(days.length / 7);
    const W = left + cols * (cs + gap), H = top + 7 * (cs + gap);
    const vals = days.map(d => { const e = map.get(dayKey(d)); return e ? e.w : 0; });
    const max = Math.max(1, ...vals);
    const g = this.goal();
    const svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'heat', role: 'img', 'aria-label': 'Calendario de días escritos', style: 'width:100%;max-width:' + (W * 1.25) + 'px;height:auto' });
    ['lun', '', 'mié', '', 'vie', '', 'dom'].forEach((t, i) => t && svg.append(sv('text', { x: 0, y: top + i * (cs + gap) + cs - 2 }, t)));
    let lastM = -1;
    days.forEach((d, i) => {
      const c = Math.floor(i / 7), r = (d.getDay() + 6) % 7, v = vals[i];
      if (d.getDate() <= 7 && d.getMonth() !== lastM && r === 0) { lastM = d.getMonth(); svg.append(sv('text', { x: left + c * (cs + gap), y: 10 }, MESES[d.getMonth()])); }
      const lvl = !v ? 0 : g ? (v >= g ? (v >= 2 * g ? 4 : 3) : (v >= g / 2 ? 2 : 1)) : Math.min(4, 1 + Math.floor(3.999 * v / max));
      const rect = sv('rect', { x: left + c * (cs + gap), y: top + r * (cs + gap), width: cs, height: cs, rx: 2, class: 'h' + lvl + (dayKey(d) === dayKey() ? ' today' : '') });
      rect.append(sv('title', null, DIAS_L[d.getDay()] + ' ' + d.getDate() + ' ' + MESES[d.getMonth()] + ': ' + (v ? fmtN(v) + ' palabras' : 'sin escribir')));
      svg.append(rect);
    });
    return svg;
  },
  nudge(s, sm) {
    const g = this.goal();
    if (s.todayHit) return s.cur > 1 ? 'Hoy ya escribiste: van ' + plural(s.cur, 'día seguido', 'días seguidos') + '.' : 'Hoy ya escribiste.';
    if (s.cur) return 'Escribe hoy' + (g ? ' ' + fmtN(g) + ' palabras' : '') + ' para mantener tu racha de ' + plural(s.cur, 'día') + '.';
    if (sm.days30) return 'Hoy es buen día para retomar.' + (s.best > 1 ? ' Tu mejor racha fue de ' + plural(s.best, 'día') + '.' : '');
    return 'Cada día que escribas quedará marcado aquí.';
  },
  /* Panel completo. list: [{id, title, days}]. opts.byProject muestra el desglose y el filtro. */
  panel(list, opts) {
    opts = opts || {};
    const box = h('div', { class: 'panel habit' });
    const sel = opts.byProject && list.length > 1 ? h('select', { class: 'sel', 'aria-label': 'Proyecto', style: 'width:auto;max-width:16rem' }, h('option', { value: '', text: 'Todos los proyectos' }), ...list.map(x => h('option', { value: x.id, text: x.title || 'Sin título' }))) : null;
    const goalInp = h('input', { class: 'inp', type: 'number', min: '0', step: '50', value: String(this.goal() || ''), placeholder: 'sin meta', 'aria-label': 'Meta diaria de palabras', style: 'width:6.5rem' });
    const body = h('div');
    const draw = () => {
      const pick = sel && sel.value ? list.filter(x => x.id === sel.value) : list;
      const map = this.merge(pick, opts);
      const s = this.streaks(map), sm = this.summary(map);
      body.textContent = '';
      const tiles = h('div', { class: 'tiles habit-tiles' });
      const tile = (v, k, cls) => tiles.append(h('div', { class: 'tile ' + (cls || '') }, h('div', { class: 'v', text: v }), h('div', { class: 'k', text: k })));
      tile(fmtN(s.cur), s.cur === 1 ? 'día de racha' : 'días de racha', s.cur ? 'on' : '');
      tile(fmtN(s.best), 'mejor racha');
      tile(fmtN(sm.days30) + '/30', 'días escritos de los últimos 30');
      tile(fmtN(sm.w7), 'palabras en 7 días');
      tile(fmtN(sm.avgDay), 'promedio por día escrito');
      body.append(h('p', { class: 'habit-nudge', text: this.nudge(s, sm) }), tiles);
      body.append(h('div', { class: 'heat-wrap' }, this.heat(map, opts.weeks || 26), h('div', { class: 'heat-legend' }, h('span', { text: 'menos' }), ...[0, 1, 2, 3, 4].map(i => h('i', { class: 'h' + i })), h('span', { text: 'más' + (this.goal() ? ' (meta: ' + fmtN(this.goal()) + ')' : '') }))));
      // cuándo escribes
      const when = h('div', { class: 'two', style: 'margin-top:.8rem' });
      const wdBox = h('div', null, h('h4', { text: 'Qué días escribes' }));
      const order = [1, 2, 3, 4, 5, 6, 0], maxWd = Math.max(1, ...sm.wd);
      order.forEach(i => wdBox.append(h('div', { class: 'row style-hist-row', style: 'gap:.6rem;flex-wrap:nowrap' }, h('span', { class: 'lbl', text: DIAS_L[i].slice(0, 3) }), h('span', { class: 'bar' }, h('span', { style: 'width:' + (100 * sm.wd[i] / maxWd) + '%' })), h('span', { class: 'n', text: sm.wdN[i] ? plural(sm.wdN[i], 'vez', 'veces') : '' }))));
      const mom = this.moment(sm.hr);
      const mBox = h('div', null, h('h4', { text: 'A qué hora' }));
      if (mom) {
        mom.forEach(x => mBox.append(h('div', { class: 'row style-hist-row', style: 'gap:.6rem;flex-wrap:nowrap' }, h('span', { class: 'lbl', text: x.l }), h('span', { class: 'bar' }, h('span', { style: 'width:' + (100 * x.v) + '%' })), h('span', { class: 'n', text: Math.round(100 * x.v) + '%' }))));
        mBox.append(h('p', { class: 'muted', style: 'margin:.4rem 0 0;font-size:.8125rem', text: 'Escribes más en la ' + mom[0].l + '.' }));
      } else mBox.append(h('p', { class: 'muted', text: 'Se irá llenando a medida que escribas.' }));
      when.append(wdBox, mBox);
      body.append(when);
      // desglose por proyecto
      if (opts.byProject && list.length > 1 && !(sel && sel.value)) {
        const rows = list.map(x => { const m = this.merge([x], opts); const r = this.range(m, 30); const last = Array.from(m.keys()).filter(k => m.get(k).w > 0).sort().pop(); return { x: x, w30: r.reduce((a, z) => a + z.w, 0), d30: r.filter(z => z.w > 0).length, cur: this.streaks(m).cur, last: last }; }).sort((a, b) => b.w30 - a.w30 || (b.last || '').localeCompare(a.last || ''));
        const tbl = h('table', { class: 'style-table' }, h('thead', null, h('tr', null, h('th', { text: 'Proyecto' }), h('th', { text: '30 días' }), h('th', { text: 'Días' }), h('th', { text: 'Racha' }), h('th', { text: 'Última vez' }))));
        const tb = h('tbody');
        rows.forEach(r => tb.append(h('tr', { style: 'cursor:pointer', onclick: () => { sel.value = r.x.id; draw(); } }, h('td', { text: r.x.title || 'Sin título' }), h('td', { text: fmtN(r.w30) }), h('td', { text: String(r.d30) }), h('td', { text: r.cur ? plural(r.cur, 'día') : '—' }), h('td', { text: r.last ? this.ago(r.last) : '—' }))));
        tbl.append(tb);
        body.append(h('h4', { style: 'margin-top:1rem', text: 'Por proyecto' }), h('div', { style: 'overflow-x:auto' }, tbl));
      }
    };
    if (sel) sel.addEventListener('change', draw);
    goalInp.addEventListener('change', () => { App.prefs.dailyGoal = Math.max(0, +goalInp.value || 0); App.savePrefs(); draw(); });
    box.append(h('div', { class: 'row', style: 'justify-content:space-between;align-items:flex-start;gap:.6rem;margin-bottom:.4rem' },
      h('h3', { style: 'margin:0', text: opts.title || 'Tu escritura' }),
      h('div', { class: 'row', style: 'gap:.5rem' }, sel, h('label', { class: 'row muted', style: 'gap:.35rem;font-size:.8125rem' }, 'Meta diaria', goalInp))));
    box.append(body);
    draw();
    return box;
  },
  ago(k) {
    const d = new Date(k + 'T12:00:00'), t = new Date(dayKey() + 'T12:00:00');
    const n = Math.round((t - d) / 864e5);
    if (n <= 0) return 'hoy'; if (n === 1) return 'ayer'; if (n < 7) return 'hace ' + n + ' días';
    return d.getDate() + ' ' + MESES[d.getMonth()];
  },
  /* Lista de proyectos con registro (para el inicio). */
  projects() {
    return App.allProjects().filter(x => !x.doc.data.trashed && x.doc.data.days && Object.keys(x.doc.data.days).length).map(x => ({ id: x.doc.id, title: x.doc.data.title, days: x.doc.data.days, shared: x.space === 'team' }));
  },
  me() { return RT.me || 'local'; },
  /* Resumen corto para el perfil: todos tus proyectos. */
  mini() {
    const list = this.projects();
    const box = h('div', { class: 'habit-mini' });
    if (!list.length) { box.append(h('p', { class: 'muted', style: 'margin:0;font-size:.85rem', text: 'Cuando escribas, aquí verás tus rachas y cuánto escribes, sumando todos tus proyectos.' })); return box; }
    const map = this.merge(list, { who: this.me() });
    const s = this.streaks(map), sm = this.summary(map);
    const t = (v, k) => h('div', null, h('b', { text: v }), h('span', { text: k }));
    box.append(h('div', { class: 'habit-mini-row' }, t(fmtN(s.cur), 'racha'), t(fmtN(s.best), 'mejor racha'), t(fmtN(sm.days30) + '/30', 'días'), t(fmtN(sm.w30), 'palabras en 30 días')));
    box.append(h('p', { class: 'muted', style: 'margin:.5rem 0 0;font-size:.8125rem', text: this.nudge(s, sm) }));
    box.append(btn('Ver detalle por proyecto', () => { UI.closeDrawer(); App.go(''); setTimeout(() => { const e = document.querySelector('.habit'); if (e) e.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 250); }, 'small'));
    return box;
  }
};
window.Habit = Habit;
