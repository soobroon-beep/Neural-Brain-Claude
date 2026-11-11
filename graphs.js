/* NEURAL BRAIN · gráficos de cada cerebro.
   · Red neuronal (canvas): el núcleo es el cerebro, los «centros» son lo que le das (reglas, estrategias, operaciones, notas…)
     y cada neurona es una enseñanza o un recuerdo. Pulsos de luz viajan de las neuronas al núcleo: así se ve cómo lo alimentas.
   · Nivel, crecimiento de 30 días (SVG), con qué lo alimentas (barras) y minigráfica para las tarjetas.
   Funciones puras (stats, hubs, growth) + render. Sin librerías. */
(function (root) {
  'use strict';
  const DAY = 864e5;
  const KIND_LABEL = {regla: 'Reglas', estrategia: 'Estrategias', trader: 'Traders', leccion: 'Lecciones', nota: 'Notas'};
  const KIND_COLOR = {master: '#f2c46d', regla: '#ff8aa0', estrategia: '#8fb0ff', trader: '#c6a8ff', leccion: '#6fe0c0', nota: '#b8c2d6'};
  const APP_COLOR = {vortex: '#7d8dff', novahub: '#ff9a6a'};
  // tipos de recuerdo agrupados en familias fáciles de leer
  const FAMILY = [
    [/operaci[oó]n/, 'Operaciones', '#4fe0b0'], [/idea de trade/, 'Ideas Long/Short', '#5ad1ff'], [/alerta/, 'Alertas', '#ffb35a'],
    [/resultado de bot|bot|claudio/, 'Bots', '#b48cff'], [/script|indicador/, 'Indicadores', '#7d8dff'], [/seguimiento/, 'Seguimiento', '#8fb0ff'],
    [/riesgo/, 'Riesgo', '#ff8aa0'], [/actualizaci[oó]n/, 'Actualizaciones', '#9aa6bd'], [/dibujo/, 'Dibujos', '#7c87a3'],
    [/tarea/, 'Tareas', '#ffb38a'], [/proyecto/, 'Proyectos', '#ff9a6a'], [/nota/, 'Notas de Nova Hub', '#ffc89a'], [/h[aá]bito/, 'Hábitos', '#6fe0c0'],
    [/diario/, 'Diario', '#e88bff'], [/recordatorio|evento|rutina/, 'Agenda', '#ffd36a']
  ];
  const family = e => { const t = String(e.type || ''); for (const [re, n, c] of FAMILY) if (re.test(t)) return {k: 'ev:' + n, n, c}; return {k: 'ev:Otros', n: 'Otros', c: '#8592a8'}; };
  const noteHub = n => n.master ? {k: 'nt:master', n: 'Reglas maestras', c: KIND_COLOR.master} : {k: 'nt:' + (n.kind || 'nota'), n: KIND_LABEL[n.kind || 'nota'] || 'Notas', c: KIND_COLOR[n.kind || 'nota'] || '#b8c2d6'};
  const tOf = x => x.at || x.updatedAt || x.createdAt || 0;

  function hubs(notes, events) {
    const m = new Map();
    const add = (h, item, src) => { let o = m.get(h.k); if (!o) m.set(h.k, o = {key: h.k, name: h.n, color: h.c, src, items: []}); o.items.push(item); };
    for (const n of notes || []) add(noteHub(n), n, 'nota');
    for (const e of events || []) add(family(e), e, 'evento');
    return [...m.values()].sort((a, b) => b.items.length - a.items.length);
  }
  function stats(notes, events, learned) {
    notes = notes || []; events = events || []; const now = Date.now(), wk = now - 7 * DAY;
    const masters = notes.filter(n => n.master).length;
    const xp = notes.length * 8 + masters * 12 + events.length + (learned && learned.text ? 40 : 0);
    const level = Math.floor(Math.sqrt(xp / 12)) + 1, lo = (level - 1) ** 2 * 12, hi = level ** 2 * 12;
    const hs = hubs(notes, events);
    return {xp, level, progress: Math.min(1, (xp - lo) / Math.max(1, hi - lo)), toNext: Math.max(0, hi - xp), neurons: notes.length + events.length,
      links: notes.length + events.length + hs.length, hubs: hs.length, week: notes.filter(n => tOf(n) >= wk).length + events.filter(e => tOf(e) >= wk).length, masters};
  }
  function growth(notes, events, days) { // acumulado por día (enseñanzas y recuerdos)
    days = days || 30; const end = new Date(); end.setHours(23, 59, 59, 999); const start = end.getTime() - days * DAY;
    const all = (notes || []).map(n => ['n', tOf(n)]).concat((events || []).map(e => ['e', tOf(e)]));
    let bn = all.filter(x => x[0] === 'n' && x[1] < start).length, be = all.filter(x => x[0] === 'e' && x[1] < start).length; const out = [];
    for (let i = 1; i <= days; i++) { const t = start + i * DAY; const dn = all.filter(x => x[0] === 'n' && x[1] >= t - DAY && x[1] < t).length, de = all.filter(x => x[0] === 'e' && x[1] >= t - DAY && x[1] < t).length; bn += dn; be += de; out.push({t, n: bn, e: be, dn, de}); }
    return out;
  }

  /* ── SVG: crecimiento ── */
  function growthSVG(g, color) {
    const W = 640, H = 170, P = 6, max = Math.max(4, ...g.map(x => x.n + x.e)), X = i => P + i * (W - 2 * P) / Math.max(1, g.length - 1), Y = v => H - 22 - v / max * (H - 40);
    const line = f => g.map((x, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(f(x)).toFixed(1)).join(' ');
    const area = f => line(f) + ` L${X(g.length - 1)} ${H - 22} L${X(0)} ${H - 22} Z`;
    const tot = x => x.n + x.e, bars = g.map((x, i) => { const v = x.dn + x.de; if (!v) return ''; const h = Math.min(30, 6 + v * 3); return `<rect x="${(X(i) - 2.5).toFixed(1)}" y="${H - 18}" width="5" height="${Math.min(14, 3 + v)}" rx="2" fill="${color}" opacity=".55"/>`; }).join('');
    const d = new Date(g[0].t - DAY), lab = t => new Date(t).toLocaleDateString('es-MX', {day: 'numeric', month: 'short'});
    return `<svg viewBox="0 0 ${W} ${H}" class="gsvg" preserveAspectRatio="none" role="img" aria-label="Crecimiento de los últimos 30 días">
      <defs><linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".45"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient>
      <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2c46d" stop-opacity=".5"/><stop offset="1" stop-color="#f2c46d" stop-opacity="0"/></linearGradient>
      <filter id="gGlow"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      ${[0.25, .5, .75].map(f => `<line x1="0" x2="${W}" y1="${(Y(max * f)).toFixed(1)}" y2="${(Y(max * f)).toFixed(1)}" stroke="rgba(255,255,255,.05)"/>`).join('')}
      <path d="${area(tot)}" fill="url(#gA)"/><path d="${line(tot)}" fill="none" stroke="${color}" stroke-width="2.4" filter="url(#gGlow)" class="gline"/>
      <path d="${area(x => x.n)}" fill="url(#gB)"/><path d="${line(x => x.n)}" fill="none" stroke="#f2c46d" stroke-width="1.8" stroke-dasharray="4 4" opacity=".9"/>
      <circle cx="${X(g.length - 1)}" cy="${Y(tot(g[g.length - 1]))}" r="4.5" fill="${color}" class="gdot"/>
      ${bars}
      <text x="${P}" y="${H - 3}" class="gtx">${lab(g[0].t)}</text><text x="${W - P}" y="${H - 3}" class="gtx" text-anchor="end">hoy</text></svg>`;
  }
  function spark(notes, events, color) { // minigráfica para las tarjetas de cerebro
    const g = growth(notes, events, 14), max = Math.max(2, ...g.map(x => x.n + x.e)), W = 90, H = 26;
    const pts = g.map((x, i) => `${(i * W / (g.length - 1)).toFixed(1)},${(H - 2 - (x.n + x.e) / max * (H - 4)).toFixed(1)}`).join(' ');
    return `<svg viewBox="0 0 ${W} ${H}" class="spark" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  }
  function ring(p, color, size) { // anillo de nivel
    const r = 44, c = 2 * Math.PI * r;
    return `<svg viewBox="0 0 100 100" width="${size || 92}" height="${size || 92}" class="lvring" aria-hidden="true"><circle cx="50" cy="50" r="${r}" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="7"/>
      <circle cx="50" cy="50" r="${r}" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(c * p).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 50 50)" style="filter:drop-shadow(0 0 6px ${color})"/></svg>`;
  }

  /* ── Red neuronal en canvas ── */
  const live = new Set();
  function hexA(c, a) { const n = parseInt(c.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }
  function mountNet(canvas, data, opts) {
    opts = opts || {}; const ctx = canvas.getContext('2d'), reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const color = data.color || '#6d8dff', hs = data.hubs.slice(0, 9), now = Date.now();
    let W = 0, H = 0, dpr = 1, nodes = [], links = [], pulses = [], raf = 0, last = 0, hover = null, alive = true, rot = 0;
    const tip = opts.tip;
    function layout() {
      const r = canvas.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); W = r.width; H = r.height; canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cx = W / 2, cy = H / 2, R = Math.min(W, H) * .30; nodes = []; links = [];
      const core = {x: cx, y: cy, r: Math.max(16, Math.min(W, H) * .07), core: true, color, label: data.name};
      nodes.push(core);
      const per = Math.max(10, Math.floor(150 / Math.max(1, hs.length)));
      hs.forEach((h, i) => {
        const a = -Math.PI / 2 + i * 2 * Math.PI / Math.max(1, hs.length) + (i % 2 ? .12 : -.08), rr = R * (hs.length < 3 ? .85 : 1);
        const hub = {x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr * .86, r: 6 + Math.min(10, Math.sqrt(h.items.length) * 1.6), hub: true, color: h.color, label: h.name, count: h.items.length, a, key: h.key, src: h.src};
        nodes.push(hub); links.push({a: core, b: hub, w: 1.6 + Math.min(3, h.items.length / 15), color: h.color});
        const items = h.items.slice().sort((p, q) => tOf(q) - tOf(p)).slice(0, per);
        items.forEach((it, j) => {
          const spread = Math.min(1.25, .35 + items.length * .05), aa = a + (j / Math.max(1, items.length - 1) - .5) * spread * (1 + (j % 3) * .08);
          const dist = R * (.32 + ((j * 37) % 23) / 23 * .38) * (hs.length < 3 ? 1.25 : 1);
          const fresh = now - tOf(it) < 2 * DAY;
          const n = {x: hub.x + Math.cos(aa) * dist, y: hub.y + Math.sin(aa) * dist * .9, r: it.master ? 3.6 : fresh ? 3.2 : 2.2, color: h.color, fresh, item: it, hubRef: hub, ph: Math.random() * 6.28};
          n.x = Math.max(8, Math.min(W - 8, n.x)); n.y = Math.max(8, Math.min(H - 8, n.y)); n.bx = n.x; n.by = n.y;
          nodes.push(n); links.push({a: hub, b: n, w: .7, color: h.color, leaf: true});
          if (j > 0 && j % 4 === 0) { const prev = nodes[nodes.length - 3]; if (prev && !prev.hub && !prev.core) links.push({a: prev, b: n, w: .4, color: h.color, leaf: true}); }
        });
      });
      for (let i = 1; i < hs.length; i++) { const A = nodes.find(n => n.key === hs[i - 1].key), B = nodes.find(n => n.key === hs[i].key); if (A && B && i % 2) links.push({a: A, b: B, w: .5, color: '#8892b0', faint: true}); }
      if (reduce) draw(0);
    }
    function spawn() { // un pulso de una neurona hacia su centro y luego al núcleo
      const leaves = nodes.filter(n => n.item); if (!leaves.length) return; const pref = leaves.filter(n => n.fresh), pick = (pref.length && Math.random() < .55 ? pref : leaves)[Math.random() * (pref.length && Math.random() < .55 ? pref.length : leaves.length) | 0] || leaves[0];
      pulses.push({path: [pick, pick.hubRef, nodes[0]], seg: 0, t: 0, color: pick.color, sp: .018 + Math.random() * .014});
    }
    function draw(t) {
      ctx.clearRect(0, 0, W, H); const core = nodes[0]; if (!core) return;
      const g = ctx.createRadialGradient(core.x, core.y, 0, core.x, core.y, Math.min(W, H) * .55); g.addColorStop(0, hexA(color, .16)); g.addColorStop(1, hexA(color, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (const n of nodes) if (n.item && !reduce) { n.x = n.bx + Math.sin(t / 1400 + n.ph) * 1.6; n.y = n.by + Math.cos(t / 1700 + n.ph) * 1.6; }
      for (const l of links) {
        const hi = hover && (l.a === hover || l.b === hover || l.b.hubRef === hover);
        ctx.strokeStyle = hexA(l.color, l.faint ? .12 : l.leaf ? (hi ? .55 : .16) : (hi ? .9 : .42)); ctx.lineWidth = l.w * (hi ? 1.4 : 1);
        ctx.beginPath(); if (l.leaf || l.faint) { ctx.moveTo(l.a.x, l.a.y); ctx.lineTo(l.b.x, l.b.y); } else { const mx = (l.a.x + l.b.x) / 2 + (l.b.y - l.a.y) * .12, my = (l.a.y + l.b.y) / 2 - (l.b.x - l.a.x) * .12; ctx.moveTo(l.a.x, l.a.y); ctx.quadraticCurveTo(mx, my, l.b.x, l.b.y); } ctx.stroke();
      }
      for (const p of pulses) {
        const A = p.path[p.seg], B = p.path[p.seg + 1]; if (!B) continue; const x = A.x + (B.x - A.x) * p.t, y = A.y + (B.y - A.y) * p.t;
        const gg = ctx.createRadialGradient(x, y, 0, x, y, 9); gg.addColorStop(0, hexA(p.color, .95)); gg.addColorStop(1, hexA(p.color, 0)); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 7); ctx.fill();
      }
      for (const n of nodes) {
        if (n.core) continue; const hi = hover === n || (hover && n.hubRef === hover);
        if (n.hub || n.fresh || hi) { const gr = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * (n.hub ? 3.2 : 4)); gr.addColorStop(0, hexA(n.color, n.hub ? .45 : .5)); gr.addColorStop(1, hexA(n.color, 0)); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(n.x, n.y, n.r * (n.hub ? 3.2 : 4), 0, 7); ctx.fill(); }
        ctx.fillStyle = n.hub ? n.color : hexA(n.color, n.fresh || hi ? 1 : .7); ctx.beginPath(); ctx.arc(n.x, n.y, n.r * (hi ? 1.35 : 1), 0, 7); ctx.fill();
        if (n.item && n.item.master) { ctx.strokeStyle = '#f2c46d'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 2.5, 0, 7); ctx.stroke(); }
        if (n.hub) { ctx.fillStyle = 'rgba(238,243,251,.88)'; ctx.font = '600 11px Inter,system-ui,sans-serif'; ctx.textAlign = 'center'; const up = n.y < core.y; ctx.fillText(`${n.label} · ${n.count}`, n.x, n.y + (up ? -n.r - 9 : n.r + 16)); }
      }
      // núcleo: anillos que giran y laten
      const br = 1 + Math.sin(t / 900) * .05; rot += reduce ? 0 : .004;
      const cg = ctx.createRadialGradient(core.x - core.r * .3, core.y - core.r * .35, 1, core.x, core.y, core.r * br * 1.1); cg.addColorStop(0, '#e6ebff'); cg.addColorStop(.35, color); cg.addColorStop(1, '#1b1240');
      ctx.shadowColor = color; ctx.shadowBlur = 28; ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(core.x, core.y, core.r * br, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = hexA(color, .45); ctx.lineWidth = 1; ctx.setLineDash([2, 6]); ctx.beginPath(); ctx.arc(core.x, core.y, core.r * 1.75, rot, rot + 6.28); ctx.stroke(); ctx.setLineDash([]);
      if (data.learned) { ctx.strokeStyle = hexA('#f2c46d', .7); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(core.x, core.y, core.r * 1.4, -rot * 1.6, -rot * 1.6 + Math.PI * 1.3); ctx.stroke(); }
      if (!hs.length) { ctx.fillStyle = 'rgba(133,146,168,.9)'; ctx.font = '500 13px Inter,system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Aún no hay neuronas: enséñale algo y aparecerán aquí', W / 2, H - 24); }
    }
    function step(t) {
      raf = requestAnimationFrame(step); if (t - last < 28) return; last = t;
      if (pulses.length < Math.min(14, 2 + nodes.length / 12) && Math.random() < .22) spawn();
      for (const p of pulses) { p.t += p.sp * (p.seg ? 1.5 : 1); if (p.t >= 1) { p.seg++; p.t = 0; } }
      pulses = pulses.filter(p => p.seg < p.path.length - 1); draw(t);
    }
    function pick(ev) {
      const r = canvas.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top; let best = null, bd = 18;
      for (const n of nodes) { const d = Math.hypot(n.x - x, n.y - y) - n.r; if (d < bd) { bd = d; best = n; } } return {n: best, x, y};
    }
    function showTip(o) {
      if (!tip) return; const n = o.n; if (!n) { tip.hidden = true; return; }
      const it = n.item; tip.innerHTML = n.core ? `<b>${esc(data.name)}</b><span>${data.total} neuronas · nivel ${data.level}</span>` : n.hub ? `<b>${esc(n.label)}</b><span>${n.count} ${n.src === 'nota' ? 'enseñanzas' : 'recuerdos'}</span>` : `<b>${esc(it.title || (it.text || '').slice(0, 70))}</b><span>${esc(it.act ? cap(it.act) + ' ' + it.type : (KIND_LABEL[it.kind] || 'Nota').replace(/s$/, ''))} · ${ago(tOf(it))}</span>`;
      tip.hidden = false; const tw = tip.offsetWidth; tip.style.left = Math.max(6, Math.min(W - tw - 6, o.x - tw / 2)) + 'px'; tip.style.top = Math.max(6, o.y - 58) + 'px';
    }
    const onMove = ev => { const o = pick(ev); hover = o.n && !o.n.core ? o.n : null; canvas.style.cursor = o.n ? 'pointer' : ''; showTip(o); if (reduce) draw(0); };
    const onLeave = () => { hover = null; if (tip) tip.hidden = true; };
    const onClick = ev => { const o = pick(ev); if (o.n && o.n.hub && opts.onHub) opts.onHub(o.n); showTip(o); };
    canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerleave', onLeave); canvas.addEventListener('click', onClick);
    const ro = new ResizeObserver(() => layout()); ro.observe(canvas);
    layout(); if (!reduce) raf = requestAnimationFrame(step);
    const vis = () => { if (document.hidden) cancelAnimationFrame(raf); else if (alive && !reduce) raf = requestAnimationFrame(step); };
    document.addEventListener('visibilitychange', vis);
    const h = {destroy() { alive = false; cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('visibilitychange', vis); live.delete(h); }, alive: () => canvas.isConnected};
    live.add(h); return h;
  }
  function sweep() { for (const h of [...live]) if (!h.alive()) h.destroy(); }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : '';
  function ago(ms) { if (!ms) return ''; const s = (Date.now() - ms) / 1000; if (s < 3600) return `hace ${Math.max(1, Math.round(s / 60))} min`; if (s < 86400) return `hace ${Math.round(s / 3600)} h`; const d = Math.round(s / 86400); return d === 1 ? 'ayer' : `hace ${d} días`; }

  const api = {hubs, stats, growth, growthSVG, spark, ring, mountNet, sweep, family};
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BrainGraphs = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
