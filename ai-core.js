/* NEURAL BRAIN · «Mi IA»: tu IA personal.
   Un chat que te conoce por TODO lo que guarda Neural Brain (todos tus cerebros, tus recuerdos de Nova Hub y VORTEX,
   su propia memoria de tus conversaciones, tu agenda y correo de Google y tus bots), que aprende de cada conversación
   y de cómo calificas sus respuestas, que vigila lo que le pidas y te escribe informes, que analiza tus bots y te
   propone mejoras (tú las apruebas) y que crece: un núcleo vivo que se hace más grande mientras más sabe.
   Datos en Firestore: users/{uid}/brains/_core (+ notes, chats, msgs, watches, reports, proposals, feedback, growth).
   Lógica pura y prompts: ai-core-lib.js. IA gratuita: BrainLearn.chat. Puente con la app: window.NB.core(). */
(function () {
  'use strict';
  const A = window.AICoreLib; if (!A || !window.NB) return;
  const C = () => window.NB.core();
  const KEY = 'nb_ai';
  const X = {tab: localStorage.getItem(KEY + '_tab') || 'chat', uid: null, core: {}, coreReady: false, facts: [], chats: [], cur: localStorage.getItem(KEY + '_chat') || null,
    msgs: {}, watches: [], reports: [], proposals: [], growth: [], busy: false, running: new Set(), unsubs: [], q: '', cat: 'all', open: new Set(), chatList: false, analyzing: false, learning: false, gsync: false, autoRan: false, burst: 0};
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const ic = (k, sw) => C().ic(k, sw);
  const aiName = () => (X.core.aiName || 'Neural').trim() || 'Neural';
  const coreRef = () => C().U().collection('brains').doc(A.CORE_ID);
  const sub = n => coreRef().collection(n);
  const nid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const toast = t => C().toast(t);
  const live = () => C().S.view === 'ai' && !!$('#aiRoot');

  /* ───────── Datos ───────── */
  function detach() { X.unsubs.forEach(f => { try { f(); } catch {} }); X.unsubs = []; Object.assign(X, {uid: null, core: {}, coreReady: false, facts: [], chats: [], msgs: {}, watches: [], reports: [], proposals: [], growth: [], autoRan: false}); }
  function attach() {
    const S = C().S; if (!S.user) return detach(); if (X.uid === S.user.uid) return; detach(); X.uid = S.user.uid;
    const on = (q, fn) => X.unsubs.push(q.onSnapshot(fn, e => console.warn('Mi IA', e && e.message)));
    on(coreRef(), d => { const first = !X.coreReady; X.core = d.exists ? d.data() : {}; X.coreReady = true; if (!d.exists && !d.metadata.fromCache) createCore(); if (first) afterLoad(); schedule(); });
    on(sub('notes'), s => { const before = X.facts.length; X.facts = s.docs.map(d => Object.assign({id: d.id}, d.data())); if (before && X.facts.length > before) X.burst = Date.now(); schedule(); });
    on(sub('chats').orderBy('updatedAt', 'desc').limit(60), s => { X.chats = s.docs.map(d => Object.assign({id: d.id}, d.data())); schedule(); });
    on(sub('watches'), s => { X.watches = s.docs.map(d => Object.assign({id: d.id}, d.data())).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)); schedule(); autoRun(); });
    on(sub('reports').orderBy('at', 'desc').limit(40), s => { const prev = new Set(X.reports.map(r => r.id)); X.reports = s.docs.map(d => Object.assign({id: d.id}, d.data())); notifyNew(prev); schedule(); badge(); });
    on(sub('proposals').orderBy('at', 'desc').limit(40), s => { X.proposals = s.docs.map(d => Object.assign({id: d.id}, d.data())); schedule(); badge(); });
  }
  async function createCore() {
    const now = Date.now();
    await coreRef().set({kind: 'core', name: 'Mi IA', aiName: 'Neural', sources: ['novahub', 'vortex'], toVortex: false, autoLearn: true, createdAt: now, owner: C().firstName()}, {merge: true});
    const w = [{id: 'resumen-diario', kind: 'daily', text: 'Resumen de cómo van mis proyectos, mis apps y mis bots, y qué viene en mi agenda', freq: 'diaria', hour: '08:00'},
      {id: 'bots-empeoran', text: 'Revisa mis bots de Nova Bot Lab: avísame si alguno empeora, pierde más de lo normal o deja de mandar resultados', freq: 'diaria', hour: '21:00'}];
    for (const x of w) await sub('watches').doc(x.id).set(Object.assign({on: true, createdAt: now, by: 'inicio'}, x), {merge: true});
  }
  function afterLoad() { snapshotGrowth(); if (gTok()) googleSync(true); }

  /* ───────── Contexto: todo lo que sabe ───────── */
  function brainsCtx() {
    const c = C(); return c.S.brains.map(b => ({name: b.name, desc: b.desc, learned: b.learned && b.learned.text, masters: c.notesOf(b.id).filter(n => n.master).map(n => n.text).slice(0, 8)}));
  }
  const bots = () => A.botStats(C().S.events);
  function ctx(q) {
    const c = C();
    return {name: c.firstName() || 'el usuario', aiName: aiName(), L: c.L, q, events: c.S.events, facts: X.facts, bots: bots(), brains: brainsCtx(), watches: X.watches,
      profile: X.core.learned && X.core.learned.text, style: [X.core.instructions, X.core.style].filter(Boolean).join('\n'), gcal: X.core.gcal, gmail: X.core.gmail};
  }
  function stats() {
    const c = C(), notes = Object.values(c.S.notes).reduce((a, x) => a + x.length, 0), msgs = X.chats.reduce((a, x) => a + (x.count || 0), 0);
    const learned = c.S.brains.filter(b => b.learned && b.learned.text).length + (X.core.learned ? 1 : 0), approved = X.proposals.filter(p => p.status === 'aprobada').length;
    return Object.assign(A.knowledge({notes, events: c.S.events.length, facts: X.facts.length, msgs, learned, approved}), {notes, events: c.S.events.length, facts: X.facts.length, msgs, learned, brains: c.S.brains.length});
  }
  async function snapshotGrowth() {
    try {
      const day = A.localParts(Date.now()).date, st = stats();
      if (!X.growthDay) { const s = await sub('growth').orderBy('date', 'desc').limit(120).get(); X.growth = s.docs.map(d => d.data()).reverse(); X.growthDay = day; }
      const last = X.growth[X.growth.length - 1];
      if (!last || last.date !== day || st.xp > (last.xp || 0)) { const doc = {date: day, at: Date.now(), xp: st.xp, level: st.level, total: st.total, facts: st.facts, notes: st.notes, events: st.events, msgs: st.msgs};
        await sub('growth').doc(day).set(doc, {merge: true}); if (last && last.date === day) X.growth[X.growth.length - 1] = doc; else X.growth.push(doc); }
    } catch (e) { console.warn('crecimiento', e.message); }
  }

  /* ───────── Pintar ───────── */
  const TABS = [['chat', 'Chat', 'chat'], ['grow', 'Crecimiento', 'net'], ['watch', 'Vigilancias', 'target'], ['bots', 'Bots', 'bot'], ['mem', 'Memoria', 'brain'], ['conn', 'Conexiones', 'link']];
  let pT = 0; function schedule() { clearTimeout(pT); pT = setTimeout(() => { if (live()) paint(); }, 80); }
  function view() { return `<div id="aiRoot"></div>`; }
  function after() { attach(); paint(true); }
  function unread() { return X.reports.filter(r => !r.read).length + X.proposals.filter(p => p.status === 'pendiente').length; }
  function badge() { document.querySelectorAll('[data-go="ai"]').forEach(b => { let d = b.querySelector('.aibadge'); const n = unread(); if (!n) { if (d) d.remove(); return; } if (!d) { d = document.createElement('i'); d.className = 'aibadge'; b.appendChild(d); } d.textContent = n > 9 ? '9+' : n; }); }

  function paint(full) {
    const root = $('#aiRoot'); if (!root) return; badge();
    if (!X.coreReady) { root.innerHTML = '<div class="skel"></div>'; return; }
    const head = root.querySelector('.ai-head');
    if (!full && head && root.dataset.aitab === X.tab) { // actualizar sin perder lo que escribes
      head.outerHTML = header();
      if (X.tab === 'chat') { paintList(); paintLog(); return; }
      if (X.tab === 'grow' && root.dataset.sig === growSig()) return;
    }
    const y = full ? 0 : scrollY;
    root.dataset.aitab = X.tab;
    root.innerHTML = header() + `<div class="glass seg aiseg"><span class="pill"></span>${TABS.map(([k, t, i]) => `<button class="${X.tab === k ? 'on' : ''}" data-ai="tab" data-k="${k}">${ic(i)}<span>${t}</span>${k === 'watch' && X.reports.some(r => !r.read) ? '<i class="segdot"></i>' : k === 'bots' && X.proposals.some(p => p.status === 'pendiente') ? '<i class="segdot"></i>' : ''}</button>`).join('')}</div>
      <div class="ai-body">${({chat: chatTab, grow: growTab, watch: watchTab, bots: botsTab, mem: memTab, conn: connTab})[X.tab]()}</div>`;
    const seg = root.querySelector('.seg'); if (seg) { const b = seg.querySelector('button.on'), p = seg.querySelector('.pill'); if (b && p) { p.style.left = b.offsetLeft + 'px'; p.style.width = b.offsetWidth + 'px'; } }
    if (X.tab === 'chat') { paintList(); paintLog(true); }
    if (X.tab === 'grow') { root.dataset.sig = growSig(); mountGrow(); }
    if (!full) scrollTo(0, y);
  }
  function header() {
    const st = stats();
    return `<div class="ai-head"><div class="ai-av">${orbMini(st.size)}</div><div class="grow"><h1>${esc(aiName())}</h1><p>Tu IA personal · nivel ${st.level} · ${esc(st.stage)} · ${st.total.toLocaleString('es-MX')} cosas que sabe de ti</p></div>
      ${X.tab === 'chat' ? `<button class="ib" data-ai="newChat" aria-label="Nueva conversación" title="Nueva conversación">${ic('plus', 2.2)}</button><button class="ib ai-listbtn" data-ai="toggleList" aria-label="Conversaciones" title="Conversaciones">${ic('clock')}</button>` : ''}</div>`;
  }
  const orbMini = s => `<svg viewBox="0 0 60 60" width="52" height="52" aria-hidden="true"><defs><radialGradient id="aoG" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#b9a4ff"/><stop offset="1" stop-color="#5426d1" stop-opacity="0"/></radialGradient></defs>
    <circle cx="30" cy="30" r="${(14 + s * 12).toFixed(1)}" fill="url(#aoG)" class="ao-core"/><circle cx="30" cy="30" r="27" fill="none" stroke="rgba(170,150,255,.35)" stroke-dasharray="2 5" class="ao-ring"/></svg>`;

  /* ───────── Chat ───────── */
  const SUG = ['¿Cómo van mis proyectos esta semana?', '¿Cuál de mis bots va mejorando y cuál no?', '¿Qué tengo en mi agenda estos días?', 'Vigila mis bots y avísame si alguno empeora',
    '¿Qué errores repito al operar?', '¿En qué debería enfocarme hoy?', 'Mándame un resumen de cómo van las cosas', '¿Qué sabes de mí?'];
  function chatTab() {
    return `<div class="ai-chatwrap ${X.chatList ? 'list-on' : ''}"><aside class="glass ai-list" id="aiList"></aside><div class="ai-main"><div class="chat ai-log" id="aiLog"></div>
      <div class="sugg" id="aiSugg">${SUG.map(q => `<button class="chip" data-ai="sug" data-text="${esc(q)}">${esc(q)}</button>`).join('')}</div></div></div>
      <form class="askbar" id="aiForm"><button type="button" class="ib" data-act="mic" data-target="aiIn" aria-label="Dictar">${ic('mic')}</button><textarea id="aiIn" rows="1" placeholder="Escríbele a ${esc(aiName())}…"></textarea><button class="ib send" aria-label="Enviar">${ic('send', 2.2)}</button></form>`;
  }
  function paintList() {
    const el = $('#aiList'); if (!el) return;
    el.innerHTML = `<div class="ai-lhead"><b>Conversaciones</b><button class="chip" data-ai="newChat">${ic('plus')}Nueva</button></div>` + (X.chats.length ? X.chats.map(c => `<button class="ai-citem ${c.id === X.cur ? 'on' : ''}" data-ai="openChat" data-id="${esc(c.id)}"><b>${esc(c.title || 'Conversación')}</b><small>${C().ago(c.updatedAt)} · ${c.count || 0} mensajes</small><span class="ai-cdel" data-ai="delChat" data-id="${esc(c.id)}" title="Borrar">${ic('trash')}</span></button>`).join('') : '<p class="hint" style="padding:0 6px">Aquí quedan guardadas tus conversaciones. Todo lo que hablan le sirve para conocerte mejor.</p>');
  }
  async function loadMsgs(id) {
    if (!id || X.msgs[id]) return;
    X.msgs[id] = [];
    try { const s = await sub('msgs').where('chat', '==', id).get(); X.msgs[id] = s.docs.map(d => Object.assign({id: d.id}, d.data())).sort((a, b) => (a.ts || 0) - (b.ts || 0)); } catch (e) { console.warn(e); }
    if (X.cur === id) paintLog(true);
  }
  function paintLog(scroll) {
    const log = $('#aiLog'); if (!log) return; const arr = X.cur ? X.msgs[X.cur] || [] : []; if (X.cur && !X.msgs[X.cur]) loadMsgs(X.cur);
    const sg = $('#aiSugg'); if (sg) sg.hidden = arr.length > 0;
    const md = C().md;
    log.innerHTML = arr.length ? arr.map(m => m.role === 'user' ? `<div class="msg user">${esc(m.content)}</div>` : `<div class="glass msg ai ${m.typing ? 'typing' : ''}" data-mid="${esc(m.id || '')}">${m.typing ? `<span class="dots"><i></i><i></i><i></i></span><small class="ai-think">${esc(m.status || 'Pensando con todo lo que sé de ti…')}</small>` : md(m.content)}
        ${(m.actions || []).map((a, i) => actionCard(m, a, i)).join('')}
        ${!m.typing && m.id ? `<div class="ai-mfoot">${m.learned ? `<span class="chip tiny live" title="${esc((m.learnedText || []).join(' · '))}"><i></i>Aprendí ${m.learned === 1 ? 'algo nuevo' : m.learned + ' cosas nuevas'} de ti</span>` : ''}<span class="sp"></span>
          <button class="mini ${m.fb === 1 ? 'on' : ''}" data-ai="fb" data-v="1" title="Buena respuesta">${thumb(true)}</button><button class="mini ${m.fb === -1 ? 'on' : ''}" data-ai="fb" data-v="-1" title="Mala respuesta">${thumb(false)}</button></div>` : ''}</div>`).join('')
      : `<div class="ai-hello"><div class="ai-hello-orb">${orbMini(stats().size)}</div><b>Hola${C().firstName() ? ', ' + esc(C().firstName()) : ''}. Soy ${esc(aiName())}.</b><span>Conozco tus cerebros, lo que haces en Nova Hub y VORTEX, tus bots${X.core.gcal ? ' y tu agenda' : ''}. Pregúntame lo que quieras, pídeme que vigile algo o que te mande un resumen. Cada conversación me hace conocerte mejor.</span></div>`;
    if (scroll && arr.length) setTimeout(() => scrollTo({top: document.body.scrollHeight, behavior: 'smooth'}), 40);
  }
  const thumb = up => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${up ? '' : 'style="transform:rotate(180deg)"'}><path d="M7 10v11H4V10z"/><path d="M7 10l4-7c1.7 0 2.8 1.3 2.4 3L13 9h6a2 2 0 0 1 2 2.3l-1.3 7.4A2.5 2.5 0 0 1 17.2 21H7"/></svg>`;
  function actionCard(m, a, i) {
    const done = (m.done || []).includes(i), t = a.tipo;
    const label = {vigilar: 'Vigilar', recordar: 'Recordar', ensenar: 'Enseñar a un cerebro', propuesta_bot: 'Mejora para un bot'}[t];
    const body = t === 'vigilar' ? `${esc(a.texto)}<small>${esc(A.FREQS[a.frecuencia] || 'Cada día')}${a.hora && !/cada/.test(a.frecuencia || '') ? ' · ' + esc(a.hora) : ''}</small>`
      : t === 'ensenar' ? `${esc(a.texto)}<small>Cerebro: ${esc(a.cerebro || '—')} · ${esc(a.clase || 'nota')}</small>`
      : t === 'propuesta_bot' ? `<b>${esc(a.bot || '')}</b> · ${esc(a.titulo || '')}<br>${esc(a.idea || '')}<small>${esc(a.porque || '')}</small>` : esc(a.texto);
    return `<div class="ai-act ${done ? 'done' : ''}"><span class="ai-acti">${ic(t === 'vigilar' ? 'target' : t === 'recordar' ? 'brain' : t === 'ensenar' ? 'learn' : 'bot')}</span><div class="bd"><em>${label}</em>${body}</div>
      ${done ? `<span class="chip tiny live"><i></i>Hecho</span>` : `<button class="btn pri sm" data-ai="doAct" data-i="${i}">${ic('check', 2.2)}${t === 'propuesta_bot' ? 'Guardar' : 'Sí'}</button>`}</div>`;
  }

  async function send(q) {
    q = String(q || '').trim(); if (!q || X.busy) return; const c = C(); X.busy = true;
    try {
      if (!X.cur || !X.chats.some(x => x.id === X.cur) && !(X.msgs[X.cur] || []).length) {
        X.cur = nid(); localStorage.setItem(KEY + '_chat', X.cur); X.msgs[X.cur] = [];
        sub('chats').doc(X.cur).set({title: A.clip(q.replace(/\s+/g, ' '), 70), createdAt: Date.now(), updatedAt: Date.now(), count: 0});
      }
      const id = X.cur, arr = X.msgs[id] = X.msgs[id] || [];
      const um = {id: nid(), chat: id, role: 'user', content: q, ts: Date.now()}; arr.push(um); sub('msgs').doc(um.id).set(um).catch(() => {});
      const tm = {role: 'assistant', typing: true, content: ''}; arr.push(tm); paintLog(true);
      const hist = arr.filter(m => !m.typing && m !== um).slice(-10).map(m => ({role: m.role, content: m.content}));
      let r;
      try { r = await c.L.chat([{role: 'system', content: A.coreSystem(ctx(q))}, ...hist, {role: 'user', content: q}], {maxTokens: 1600, timeout: 100000}); }
      catch { arr.splice(arr.indexOf(tm), 1); arr.push({id: '', role: 'assistant', content: '**No pude pensar ahora mismo.** Las IAs gratuitas no respondieron; inténtalo en un momento.', ts: Date.now()}); paintLog(true); return; }
      const pa = A.parseActions(r.text), am = {id: nid(), chat: id, role: 'assistant', content: pa.text || r.text, actions: pa.actions, done: [], ts: Date.now(), model: r.model};
      arr[arr.indexOf(tm)] = am; paintLog(true);
      sub('msgs').doc(am.id).set(am).catch(() => {});
      sub('chats').doc(id).set({updatedAt: Date.now(), count: arr.filter(m => m.id).length}, {merge: true}).catch(() => {});
      learnFrom(q, am);
    } finally { X.busy = false; }
  }
  async function learnFrom(q, am) { // aprende de sí mismo: guarda lo nuevo que le contaste
    if (q.length < 12) return;
    try {
      const r = await C().L.chat(A.factsMessages(q, am.content, X.facts, C().firstName()), {maxTokens: 500, temperature: .2, timeout: 60000});
      const nf = A.parseFacts(r.text, X.facts); if (!nf.length) return;
      for (const f of nf) await sub('notes').doc(nid()).set({text: f.text, cat: f.cat, kind: 'nota', source: 'chat', chat: am.chat, createdAt: Date.now(), updatedAt: Date.now()});
      am.learned = nf.length; am.learnedText = nf.map(f => f.text); sub('msgs').doc(am.id).set({learned: nf.length, learnedText: am.learnedText}, {merge: true}).catch(() => {});
      X.burst = Date.now(); if (live() && X.tab === 'chat') paintLog(); toast(nf.length === 1 ? 'Aprendí algo nuevo de ti' : `Aprendí ${nf.length} cosas nuevas de ti`);
    } catch {}
  }
  async function doAct(mid, i) {
    const m = (X.msgs[X.cur] || []).find(x => x.id === mid); if (!m) return; const a = (m.actions || [])[i]; if (!a) return; const c = C(), now = Date.now();
    try {
      if (a.tipo === 'vigilar') { await sub('watches').doc(nid()).set({text: A.clip(a.texto, 400), freq: A.FREQS[a.frecuencia] ? a.frecuencia : 'diaria', hour: /^\d{1,2}:\d\d$/.test(a.hora || '') ? a.hora.padStart(5, '0') : '09:00', dow: 1, on: true, by: 'chat', createdAt: now}); toast('Listo: lo vigilo y te escribo en Vigilancias'); }
      else if (a.tipo === 'recordar') { await sub('notes').doc(nid()).set({text: A.clip(a.texto, 300), cat: A.CATS[a.categoria] ? a.categoria : 'otros', kind: 'nota', source: 'chat', createdAt: now, updatedAt: now}); toast('Lo recordaré'); }
      else if (a.tipo === 'ensenar') {
        const b = c.S.brains.slice().sort((p, q) => A.similar(q.name, a.cerebro) - A.similar(p.name, a.cerebro))[0]; if (!b) return toast('Primero crea un cerebro');
        const id = nid(), kind = ['nota', 'regla', 'estrategia', 'leccion'].includes(a.clase) ? a.clase : 'nota';
        await c.U().collection('brains').doc(b.id).collection('notes').doc(id).set({id, text: A.clip(a.texto, 2000), kind, master: false, author: '', tags: ['mi-ia'], createdAt: now, updatedAt: now, pinned: false});
        toast('Guardado en el cerebro «' + b.name + '»');
      } else if (a.tipo === 'propuesta_bot') { await addProposals([{bot: a.bot, botId: a.botId, titulo: a.titulo || A.clip(a.idea, 80), idea: a.idea, porque: a.porque, riesgo: 'bajo'}], 'chat'); toast('Propuesta guardada en Bots: apruébala cuando quieras'); }
      m.done = [...new Set([...(m.done || []), i])]; sub('msgs').doc(m.id).set({done: m.done}, {merge: true}); paintLog();
    } catch (e) { toast('No se pudo: ' + (e.message || 'error')); }
  }

  /* ───────── Crecimiento ───────── */
  const growSig = () => { const s = stats(); return [s.xp, X.facts.length, X.growth.length, C().S.brains.length].join('|'); };
  function growTab() {
    const st = stats(), G = window.BrainGraphs, c = C(), allNotes = Object.values(c.S.notes).flat().concat(X.facts.map(f => Object.assign({}, f, {kind: 'nota'}))), gr = G.growth(allNotes, c.S.events, 45);
    const tile = (v, l, i) => `<div class="glass gtile"><span class="gti">${ic(i)}</span><b>${typeof v === 'number' ? v.toLocaleString('es-MX') : v}</b><small>${l}</small></div>`;
    const recent = X.facts.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 6);
    return `<div class="glass ai-orbcard"><canvas id="aiOrb" aria-label="Núcleo de ${esc(aiName())}: crece con lo que sabe de ti"></canvas>
        <div class="ai-orbtx"><span class="chip tiny live"><i></i>${esc(st.stage)}</span><b>Nivel ${st.level}</b><small>${esc(st.stageText)}</small>
        <div class="lvbar"><i style="width:${(st.progress * 100).toFixed(0)}%;background:linear-gradient(90deg,#6d8dff,#b48cff)"></i></div><small>${st.toNext.toLocaleString('es-MX')} puntos para el nivel ${st.level + 1} · tamaño del núcleo ${Math.round(st.size * 100)}%</small></div></div>
      <div class="ai-tiles">${tile(st.total, 'cosas que sabe', 'brain')}${tile(st.facts, 'aprendidas en el chat', 'spark')}${tile(st.msgs, 'mensajes contigo', 'chat')}${tile(st.events, 'recuerdos de tus apps', 'clock')}${tile(st.notes, 'enseñanzas', 'learn')}${tile(bots().length, 'bots que sigue', 'bot')}</div>
      <div class="g2"><div class="glass gcard"><div class="nethead"><div><b>Cómo ha crecido · 45 días</b><small>Todo lo que sabe de ti, acumulado día con día.</small></div></div>${G.growthSVG(gr, '#9a7bff')}
        <div class="gleg"><span><i style="background:#9a7bff"></i>Total</span><span><i class="dash"></i>Enseñanzas y memoria</span></div></div>
        <div class="glass gcard"><div class="nethead"><div><b>Nivel con el tiempo</b><small>Una foto por día de cuánto sabe.</small></div></div>${levelSVG()}</div></div>
      <div class="glass netcard"><div class="nethead"><div><b>Su red neuronal</b><small>Cada nodo grande es un cerebro o una parte de su memoria; los puntos son lo que sabe. Toca uno para ver qué es.</small></div><span class="chip tiny live"><i></i>en vivo</span></div>
        <div class="netbox"><canvas id="aiNet"></canvas><div class="nettip" id="aiNetTip" hidden></div></div></div>
      <div class="eyebrow">Lo último que aprendió de ti</div>
      ${recent.length ? `<div class="glass list">${recent.map(f => `<div class="set"><span class="bicon" style="width:34px;height:34px">${ic('spark')}</span><span class="bd"><b style="font-weight:600">${esc(f.text)}</b><small>${esc(A.CATS[f.cat] || 'Memoria')} · ${C().ago(f.createdAt)}${f.source === 'chat' ? ' · de una conversación' : f.source === 'manual' ? ' · se lo contaste' : ''}</small></span></div>`).join('')}</div>` : `<div class="empty">${ic('spark')}<b>Todavía no aprende de tus conversaciones</b>Platica con ${esc(aiName())} en el Chat: lo que le cuentes de ti lo guarda aquí y lo hace crecer.</div>`}`;
  }
  function levelSVG() {
    const g = X.growth.slice(-60); if (g.length < 2) return `<div class="empty" style="padding:26px 8px">${ic('chart')}<b>Empezó hoy</b>Cada día guarda una foto de su nivel; mañana verás la línea.</div>`;
    const W = 640, H = 170, max = Math.max(...g.map(x => x.xp || 0), 1), min = Math.min(...g.map(x => x.xp || 0)), X_ = i => 6 + i * (W - 12) / (g.length - 1), Y = v => H - 24 - (v - min) / Math.max(1, max - min) * (H - 44);
    const d = g.map((x, i) => (i ? 'L' : 'M') + X_(i).toFixed(1) + ' ' + Y(x.xp || 0).toFixed(1)).join(' ');
    return `<svg viewBox="0 0 ${W} ${H}" class="gsvg" preserveAspectRatio="none"><defs><linearGradient id="lvA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6d8dff" stop-opacity=".45"/><stop offset="1" stop-color="#6d8dff" stop-opacity="0"/></linearGradient></defs>
      <path d="${d} L${X_(g.length - 1)} ${H - 24} L6 ${H - 24}Z" fill="url(#lvA)"/><path d="${d}" fill="none" stroke="#8fa6ff" stroke-width="2.4"/>
      ${g.map((x, i) => i && x.level > g[i - 1].level ? `<circle cx="${X_(i)}" cy="${Y(x.xp)}" r="4" fill="#f2c46d"/><text x="${X_(i)}" y="${Y(x.xp) - 9}" class="gtx" text-anchor="middle">nv ${x.level}</text>` : '').join('')}
      <text x="6" y="${H - 6}" class="gtx">${esc(g[0].date.slice(5).split('-').reverse().join('/'))}</text><text x="${W - 6}" y="${H - 6}" class="gtx" text-anchor="end">nivel ${g[g.length - 1].level}</text></svg>`;
  }
  function mountGrow() {
    const cv = $('#aiOrb'); if (cv) orb(cv);
    const net = $('#aiNet'), G = window.BrainGraphs; if (!net || !G) return;
    const c = C(), hubs = c.S.brains.map(b => ({key: 'b:' + b.id, name: b.name, color: b.color || '#9a7bff', src: 'nota', items: c.notesOf(b.id).concat(c.eventsOf(b))})).filter(h => h.items.length);
    const byCat = {}; for (const f of X.facts) (byCat[f.cat || 'otros'] = byCat[f.cat || 'otros'] || []).push(f);
    const CC = {personal: '#ff9ad1', proyectos: '#ff9a5a', trading: '#6d8dff', tatuaje: '#f2c46d', preferencias: '#2bd4a4', metas: '#e86bff', tecnologia: '#47c6ff', otros: '#b8c2d6'};
    for (const [k, items] of Object.entries(byCat)) hubs.push({key: 'f:' + k, name: 'Memoria · ' + (A.CATS[k] || k), color: CC[k] || '#b8c2d6', src: 'nota', items});
    hubs.sort((a, b) => b.items.length - a.items.length);
    const st = stats();
    G.mountNet(net, {name: aiName(), color: '#9a7bff', hubs: hubs.length ? hubs : [{key: 'x', name: 'Esperando datos', color: '#8592a8', items: []}], learned: !!X.core.learned, total: st.total, level: st.level}, {tip: $('#aiNetTip'), onHub: h => { if (String(h.key).startsWith('b:')) c.go('brain', {brain: h.key.slice(2), tab: 'graph'}); else { X.tab = 'mem'; X.cat = String(h.key).slice(2); paint(true); } }});
  }

  /* El núcleo: una esfera de neuronas que crece con lo que sabe (más puntos, más grande, más conexiones) */
  let orbStop = null;
  function orb(cv) {
    if (orbStop) orbStop();
    const ctx = cv.getContext('2d'), reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, st = stats();
    let W = 0, H = 0, raf = 0, t0 = performance.now(), alive = true, seen = true, pts = [], links = [];
    const N = Math.round(70 + st.size * 640), hue = [[109, 141, 255], [154, 123, 255], [43, 212, 164], [242, 196, 109]];
    function build() {
      const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); W = r.width; H = r.height; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0);
      pts = []; const g = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < N; i++) { const y = 1 - (i / (N - 1)) * 2, rr = Math.sqrt(1 - y * y), th = g * i, j = .82 + ((i * 7919) % 100) / 100 * .3; pts.push({x: Math.cos(th) * rr * j, y: y * j, z: Math.sin(th) * rr * j, c: hue[i % 4], ph: i * .37}); }
      links = []; for (let i = 0; i < N; i++) for (let k = 1; k <= 3; k++) { const j = (i + k * 13) % N, a = pts[i], b = pts[j]; if ((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2 < .16) links.push([i, j]); }
    }
    function frame(now) {
      raf = requestAnimationFrame(frame); if (!seen) return; const t = (now - t0) / 1000, R = Math.min(W, H) * (.17 + .2 * st.size) * (1 + .025 * Math.sin(t * 1.4)) * (1 + Math.max(0, 1 - (Date.now() - X.burst) / 1600) * .18);
      const cx = W / 2, cy = H / 2, ry = t * .22, rx = .35 + Math.sin(t * .13) * .12, cy_ = Math.cos(ry), sy = Math.sin(ry), cX = Math.cos(rx), sX = Math.sin(rx);
      ctx.clearRect(0, 0, W, H);
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.9); glow.addColorStop(0, 'rgba(154,123,255,.30)'); glow.addColorStop(.45, 'rgba(109,141,255,.10)'); glow.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
      const P = pts.map(p => { const x = p.x * cy_ + p.z * sy, z = -p.x * sy + p.z * cy_, y = p.y * cX - z * sX, z2 = p.y * sX + z * cX, s = 1 / (1.9 - z2 * .55); return {x: cx + x * R * s * 1.25, y: cy + y * R * s * 1.25, z: z2, s, p}; });
      ctx.lineWidth = .7;
      for (const [i, j] of links) { const a = P[i], b = P[j], al = Math.max(0, (a.z + b.z + 2) / 4) * .32; if (al < .03) continue; ctx.strokeStyle = `rgba(150,160,255,${al.toFixed(3)})`; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      for (const q of P.sort((a, b) => a.z - b.z)) { const al = .25 + (q.z + 1) / 2 * .75, tw = .6 + .4 * Math.sin(t * 2 + q.p.ph); ctx.fillStyle = `rgba(${q.p.c[0]},${q.p.c[1]},${q.p.c[2]},${(al * tw).toFixed(3)})`; ctx.beginPath(); ctx.arc(q.x, q.y, (1 + q.s * 1.6) * (q.z > .6 ? 1.3 : 1), 0, 7); ctx.fill(); }
      const core = ctx.createRadialGradient(cx - R * .12, cy - R * .14, 0, cx, cy, R * .55); core.addColorStop(0, 'rgba(255,255,255,.95)'); core.addColorStop(.25, 'rgba(200,185,255,.65)'); core.addColorStop(1, 'rgba(110,80,255,0)');
      ctx.fillStyle = core; ctx.beginPath(); ctx.arc(cx, cy, R * .55, 0, 7); ctx.fill();
      for (let k = 0; k < 3; k++) { const a = t * (.6 + k * .25) + k * 2.1, rr = R * (1.25 + k * .16); ctx.fillStyle = 'rgba(214,200,255,.9)'; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * .42, 2.2, 0, 7); ctx.fill(); }
      ctx.strokeStyle = 'rgba(170,150,255,.18)'; ctx.setLineDash([2, 7]); ctx.beginPath(); ctx.ellipse(cx, cy, R * 1.25, R * .52, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      if (reduce) cancelAnimationFrame(raf);
    }
    build(); raf = requestAnimationFrame(frame);
    const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => { seen = es[0].isIntersecting; }) : null; if (io) io.observe(cv);
    const rs = () => build(); addEventListener('resize', rs);
    const chk = setInterval(() => { if (!document.body.contains(cv)) stop(); }, 1500);
    function stop() { if (!alive) return; alive = false; cancelAnimationFrame(raf); clearInterval(chk); removeEventListener('resize', rs); if (io) io.disconnect(); }
    orbStop = stop;
  }

  /* ───────── Vigilancias e informes ───────── */
  function watchTab() {
    const fq = w => w.freq === 'semanal' ? `Cada ${['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][w.dow == null ? 1 : w.dow]} ${w.hour || ''}` : (A.FREQS[w.freq] || 'Cada día') + (/cada/.test(w.freq) ? '' : ' a las ' + (w.hour || '08:00'));
    const perm = 'Notification' in window ? Notification.permission : 'unsupported';
    return `${perm === 'default' ? `<div class="glass vxbanner"><span class="bicon" style="width:34px;height:34px">${ic('bolt')}</span><span><b>Activa los avisos</b> para que ${esc(aiName())} te avise cuando un informe tenga una alerta.</span><button class="btn sm" data-ai="notif">Activar</button></div>` : ''}
      <div class="eyebrow" style="margin-top:4px">Informes ${X.reports.some(r => !r.read) ? `<button class="chip tiny" data-ai="readAll" style="float:right">Marcar leídos</button>` : ''}</div>
      ${X.reports.length ? `<div class="glass tl">${X.reports.map(r => `<div class="ev ai-rep ${r.read ? '' : 'unread'} ${X.open.has(r.id) ? 'open' : ''}" data-ai="openRep" data-id="${esc(r.id)}"><span class="lg" style="background:${r.alert ? 'rgba(255,107,129,.16);color:#ff8fa0' : r.kind === 'daily' ? 'rgba(154,123,255,.16);color:#c6a8ff' : 'rgba(43,212,164,.14);color:#7fe3c4'}">${ic(r.alert ? 'bolt' : r.kind === 'daily' ? 'book' : 'check')}</span>
        <div class="bd"><div class="what"><b>${r.alert ? 'Alerta' : r.kind === 'daily' ? 'Resumen' : 'Todo bien'}</b> · ${esc(r.watch || '')}</div><div class="ttl">${esc(r.title || '')}</div><div class="more md">${C().md(r.text || '')}</div></div><time>${esc(C().ago(r.at))}</time><button class="mini" data-ai="delRep" data-id="${esc(r.id)}" title="Borrar">${ic('x')}</button></div>`).join('')}</div>`
        : `<div class="empty" style="padding:26px 10px">${ic('book')}<b>Sin informes todavía</b>Cuando toque cada vigilancia, ${esc(aiName())} revisa tus datos y te deja aquí su informe. También puedes correrla ahora.</div>`}
      <div class="eyebrow">Lo que vigila por ti <button class="chip tiny" data-ai="newWatch" style="float:right">${ic('plus')}Nueva</button></div>
      <div class="glass list">${X.watches.map(w => `<div class="set ai-watch"><span class="bicon" style="width:36px;height:36px">${ic(w.kind === 'daily' ? 'book' : 'target')}</span><span class="bd"><b style="font-weight:600">${esc(w.text)}</b><small>${esc(fq(w))} · ${w.lastRun ? 'última vez ' + C().ago(w.lastRun) + (w.lastBy ? ' (' + esc(w.lastBy) + ')' : '') : 'todavía no corre'}</small></span>
        <button class="mini" data-ai="runWatch" data-id="${esc(w.id)}" title="Revisar ahora" ${X.running.has(w.id) ? 'disabled' : ''}>${X.running.has(w.id) ? '<span class="spin"></span>' : ic('bolt')}</button><button class="mini" data-ai="editWatch" data-id="${esc(w.id)}" title="Editar">${ic('edit')}</button>
        <button class="toggle-b" data-ai="togWatch" data-id="${esc(w.id)}" aria-label="Activar"><span class="toggle ${w.on !== false ? 'on' : ''}"></span></button></div>`).join('') || `<div class="set"><span class="bd"><small>Pídele en el chat «vigila…» o crea una nueva.</small></span></div>`}</div>
      <p class="hint">${ic('info')}Las vigilancias corren solas cuando abres Neural Brain y les toca, y el servidor las revisa cada noche (junto con tu resumen diario) aunque tengas la app cerrada. Los avisos llegan a tu celular cuando la app está abierta o en segundo plano.</p>`;
  }
  function watchSheet(w) {
    X.ws = w ? Object.assign({}, w) : {text: '', freq: 'diaria', hour: '09:00', dow: 1, on: true};
    const f = X.ws, D = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    C().openSheet(`<h2>${w ? 'Editar vigilancia' : 'Nueva vigilancia'}</h2><div class="sub">Dile qué revisar y cuándo avisarte. Usa todo lo que sabe de ti: tus apps, tus bots, tu agenda y tu memoria.</div>
      <div class="field"><label for="wText">Qué vigilar</label><textarea class="inp" id="wText" rows="4" placeholder="Ej.: Avísame si el bot Señales iA 2.7 pierde más de 3% en la semana, o si dejo un proyecto de Nova Hub sin mover 5 días.">${esc(f.text)}</textarea></div>
      <div class="lbl">Cada cuánto</div><div class="chips">${Object.entries(A.FREQS).map(([k, t]) => `<button class="chip ${f.freq === k ? 'on' : ''}" data-ai="wf" data-k="${k}">${t}</button>`).join('')}</div>
      <div id="wWhen" ${/cada/.test(f.freq) ? 'hidden' : ''}><div class="field"><label for="wHour">A qué hora</label><input class="inp" id="wHour" type="time" value="${esc(f.hour || '09:00')}" style="max-width:160px"></div>
      <div id="wDow" ${f.freq === 'semanal' ? '' : 'hidden'}><div class="lbl">Qué día</div><div class="chips">${D.map((d, i) => `<button class="chip ${+f.dow === i ? 'on' : ''}" data-ai="wd" data-k="${i}">${d}</button>`).join('')}</div></div></div>
      <div class="row" style="margin-top:20px">${w && w.kind !== 'daily' ? `<button class="btn danger" data-ai="delWatch" data-id="${esc(w.id)}">${ic('trash')}</button>` : ''}<button class="btn" data-act="closeSheet">Cancelar</button><button class="btn pri" style="flex:1" data-ai="saveWatch">${ic('check', 2.2)}Guardar</button></div>`);
  }
  async function runWatch(w, by) {
    if (!w || X.running.has(w.id)) return; X.running.add(w.id); if (live() && X.tab === 'watch') paint();
    try {
      const sys = A.coreSystem(ctx(w.text)), msgs = w.kind === 'daily' ? A.dailyMessages(sys, 'desde el último resumen') : A.watchMessages(w, sys);
      const r = await C().L.chat(msgs, {maxTokens: 1200, timeout: 100000}), p = w.kind === 'daily' ? {alert: false, title: 'Tu resumen de ' + new Date().toLocaleDateString('es-MX', {weekday: 'long', day: 'numeric', month: 'long'}), text: A.parseActions(r.text).text} : A.parseWatch(r.text);
      const id = nid(), now = Date.now();
      await sub('reports').doc(id).set({watchId: w.id, watch: A.clip(w.text, 90), kind: w.kind || 'watch', alert: p.alert, title: p.title, text: p.text, at: now, by: by || 'app', read: false, model: r.model});
      await sub('watches').doc(w.id).set({lastRun: now, lastBy: by || 'app'}, {merge: true});
      return true;
    } catch (e) { if (by !== 'auto') toast('La IA no respondió; inténtalo en un momento'); return false; }
    finally { X.running.delete(w.id); if (live()) paint(); }
  }
  async function autoRun() { // al abrir la app: corre lo que ya tocaba (máximo 2 por vez para cuidar el cupo gratis)
    if (X.autoRan || !X.watches.length || document.hidden) return; X.autoRan = true;
    const due = X.watches.filter(w => A.watchDue(w, Date.now())).slice(0, 2);
    for (const w of due) await runWatch(w, 'auto');
  }
  function notifyNew(prev) {
    if (!prev.size) { X.notified = X.notified || Number(localStorage.getItem(KEY + '_notified') || 0); }
    const last = Number(localStorage.getItem(KEY + '_notified') || 0), fresh = X.reports.filter(r => !r.read && r.at > last && (r.alert || r.kind === 'daily'));
    if (!fresh.length) return; localStorage.setItem(KEY + '_notified', String(Math.max(...fresh.map(r => r.at))));
    const r = fresh[0]; notify((r.alert ? 'Alerta · ' : '') + aiName(), r.title || 'Tienes un informe nuevo');
  }
  async function notify(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try { const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration(); const o = {body, icon: 'icon-192.png', badge: 'icon-96.png', tag: 'nb-ai', renotify: true}; if (reg) reg.showNotification(title, o); else new Notification(title, o); } catch {}
  }

  /* ───────── Bots ───────── */
  const TREND = {mejorando: ['#2bd4a4', 'Mejorando'], estable: ['#8fb0ff', 'Estable'], empeorando: ['#ff6b81', 'Empeorando'], aprendiendo: ['#f2c46d', 'Aprendiendo'], 'sin datos': ['#8592a8', 'Sin datos']};
  function spark(series) {
    if (!series || series.length < 2) return ''; const W = 120, H = 34, v = series.map(x => x.v), mx = Math.max(...v, 0), mn = Math.min(...v, 0), Y = x => H - 3 - (x - mn) / Math.max(.01, mx - mn) * (H - 6);
    return `<svg viewBox="0 0 ${W} ${H}" class="spark" style="width:120px;height:34px"><line x1="0" x2="${W}" y1="${Y(0)}" y2="${Y(0)}" stroke="rgba(255,255,255,.12)" stroke-dasharray="3 3"/><polyline points="${v.map((x, i) => `${(i * W / (v.length - 1)).toFixed(1)},${Y(x).toFixed(1)}`).join(' ')}" fill="none" stroke="${v[v.length - 1] >= v[0] ? '#2bd4a4' : '#ff6b81'}" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
  }
  function botsTab() {
    const bs = bots(), an = X.core.botAnalysis, pend = X.proposals.filter(p => p.status === 'pendiente'), done = X.proposals.filter(p => p.status !== 'pendiente');
    const rank = an && Array.isArray(an.ranking) ? an.ranking : [];
    return `<div class="row" style="justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px"><p class="hint" style="margin:0;flex:1;min-width:220px">${ic('info')}Sigue tus bots de Nova Bot Lab por lo que llega de VORTEX: versiones, experimentos nocturnos y paper trading. Te dice cuál va mejorando y te propone mejoras; <b>nada cambia sin tu aprobación</b>.</p>
      <button class="btn pri" data-ai="analyze" ${X.analyzing || !bs.length ? 'disabled' : ''}>${X.analyzing ? '<span class="spin"></span>Analizando…' : ic('wand') + 'Analizar mis bots'}</button></div>
      ${an && an.resumen ? `<div class="glass learn" style="margin-bottom:12px">${C().md(an.resumen)}<div class="lmeta">${ic('clock')}<span>Análisis ${C().ago(an.at)}${an.by ? ' · ' + esc(an.by) : ''}</span></div></div>` : ''}
      ${bs.length ? `<div class="ai-bots">${bs.map(b => { const tr = (rank.find(r => r.botId === b.id) || {}).estado || b.trend, T = TREND[tr] || TREND['sin datos'], why = (rank.find(r => r.botId === b.id) || {}).porque;
        return `<div class="glass ai-bot"><div class="row" style="justify-content:space-between;align-items:flex-start;gap:8px"><div style="min-width:0"><b>${esc(b.name)}</b><small>${b.last ? 'Último dato ' + C().ago(b.last) : ''}</small></div><span class="chip tiny" style="color:${T[0]};border-color:${T[0]}55">${T[1]}</span></div>
          <div class="ai-bstats"><span><b>${b.versions}</b>versiones</span><span><b>${b.experiments}</b>noches</span><span><b>${b.winRate == null ? '—' : Math.round(b.winRate * 100) + '%'}</b>ideas ganan</span><span><b>${b.proposals}</b>propuestas</span></div>
          ${spark(b.series)}${why ? `<p class="ai-why">${esc(why)}</p>` : b.lastResult ? `<p class="ai-why">${esc(b.lastResult)}</p>` : ''}
          ${C().S.brains.some(x => x.kind === 'bot' && x.bot && x.bot.id === b.id) ? `<button class="chip" data-ai="goBot" data-id="${esc(b.id)}">${ic('brain')}Ver su cerebro</button>` : `<button class="chip" data-ai="mkBot" data-id="${esc(b.id)}" data-name="${esc(b.name)}">${ic('plus')}Darle un cerebro</button>`}</div>`; }).join('')}</div>`
        : `<div class="empty">${ic('bot')}<b>Todavía no llegan datos de tus bots</b>En cuanto VORTEX sincronice tus bots de Nova Bot Lab (cada 30 min), aquí verás cómo va cada uno.</div>`}
      <div class="eyebrow">Mejoras propuestas ${pend.length ? `<span class="chip tiny live" style="margin-left:6px"><i></i>${pend.length} por decidir</span>` : ''}</div>
      ${pend.length ? pend.map(p => propCard(p)).join('') : `<div class="empty" style="padding:22px 10px">${ic('check')}<b>Nada por decidir</b>Pulsa «Analizar mis bots» o pídeselo en el chat.</div>`}
      ${done.length ? `<div class="eyebrow">Decididas</div><div class="glass list">${done.slice(0, 12).map(p => `<div class="set"><span class="bicon" style="width:32px;height:32px;color:${p.status === 'aprobada' ? '#7fe3c4' : '#8592a8'}">${ic(p.status === 'aprobada' ? 'check' : 'x')}</span><span class="bd"><b style="font-weight:600">${esc(p.bot)} · ${esc(p.titulo)}</b><small>${p.status === 'aprobada' ? 'Aprobada' : 'Descartada'} ${C().ago(p.decidedAt)}${p.status === 'aprobada' ? ' · el laboratorio la prueba en sus próximos experimentos' : ''}</small></span></div>`).join('')}</div>` : ''}`;
  }
  function propCard(p) {
    return `<div class="glass ai-prop"><div class="row" style="gap:8px;align-items:flex-start"><span class="bicon" style="width:36px;height:36px">${ic('bot')}</span><div style="flex:1;min-width:0"><small>${esc(p.bot)} · riesgo ${esc(p.riesgo || 'bajo')} · ${C().ago(p.at)}</small><b>${esc(p.titulo)}</b><p>${esc(p.idea)}</p>${p.porque ? `<p class="ai-why">Por qué: ${esc(p.porque)}</p>` : ''}</div></div>
      <div class="row" style="gap:8px;margin-top:10px"><button class="btn sm" data-ai="propNo" data-id="${esc(p.id)}">${ic('x')}Descartar</button><button class="btn pri sm" style="flex:1" data-ai="propYes" data-id="${esc(p.id)}">${ic('check', 2.2)}Aprobar para probar</button></div></div>`;
  }
  async function addProposals(list, by) {
    const pend = X.proposals; let n = 0;
    for (const p of list) { if (pend.some(q => q.bot === p.bot && A.similar(q.titulo + ' ' + q.idea, p.titulo + ' ' + p.idea) > .5)) continue; await sub('proposals').doc(nid()).set(Object.assign({status: 'pendiente', at: Date.now(), by}, p)); n++; }
    return n;
  }
  async function analyze() {
    if (X.analyzing) return; X.analyzing = true; paint(); const c = C();
    try {
      const bs = bots(), rules = Object.values(c.S.notes).flat().filter(n => n.master).map(n => n.text), botBrains = c.S.brains.filter(b => b.kind === 'bot').map(b => ({name: b.name, learned: b.learned && b.learned.text}));
      const r = await c.L.chat(A.botsMessages(bs, {name: c.firstName(), rules, botBrains, pending: X.proposals.slice(0, 20)}), {maxTokens: 1800, temperature: .35, timeout: 110000});
      const j = A.parseBots(r.text, bs); if (!j) throw new Error('formato');
      await coreRef().set({botAnalysis: {at: Date.now(), resumen: j.resumen, ranking: j.ranking, by: 'app · ' + r.model}}, {merge: true});
      const n = await addProposals(j.propuestas, 'análisis'); toast(n ? `${n} mejora${n > 1 ? 's' : ''} para decidir` : 'Análisis listo');
    } catch { toast('La IA no pudo analizar ahora; inténtalo en un momento'); }
    X.analyzing = false; paint();
  }
  async function decide(id, yes) {
    const p = X.proposals.find(x => x.id === id); if (!p) return; const c = C(), now = Date.now();
    if (yes) {
      let b = c.S.brains.find(x => x.kind === 'bot' && x.bot && x.bot.id === p.botId);
      if (!b && p.botId) { const bid = 'bot-' + p.botId; await c.saveBrain(bid, {name: 'Bot · ' + p.bot, kind: 'bot', bot: {id: p.botId, name: p.bot, auto: true}, icon: 'bot', color: '#9a7bff', desc: `Cerebro del bot «${p.bot}»: aprende de cada experimento y lo mejora solo cada noche.`, sources: ['vortex'], toVortex: false, autoLearn: true, order: c.S.brains.length, createdAt: now}); b = {id: bid}; }
      if (b) { const nid_ = nid(); await c.U().collection('brains').doc(b.id).collection('notes').doc(nid_).set({id: nid_, text: A.approvedNote(p), kind: 'leccion', master: false, author: '', tags: ['aprobada', 'mi-ia'], createdAt: now, updatedAt: now, pinned: false}); }
      toast(b ? 'Aprobada: el cerebro del bot la prueba en sus próximos experimentos' : 'Aprobada');
    }
    await sub('proposals').doc(id).set({status: yes ? 'aprobada' : 'descartada', decidedAt: now}, {merge: true});
  }

  /* ───────── Memoria ───────── */
  function memTab() {
    const q = A.norm(X.q), list = X.facts.filter(f => (X.cat === 'all' || (f.cat || 'otros') === X.cat) && (!q || A.norm(f.text).includes(q))).sort((a, b) => (b.master ? 1 : 0) - (a.master ? 1 : 0) || (b.createdAt || 0) - (a.createdAt || 0));
    const cnt = k => k === 'all' ? X.facts.length : X.facts.filter(f => (f.cat || 'otros') === k).length, l = X.core.learned || {};
    return `<div class="glass learn"><div class="nethead" style="margin-bottom:6px"><div><b>Lo que sabe de ti</b><small>Su perfil de ti con todo lo que guarda Neural Brain. Se actualiza solo cada noche.</small></div></div>
        ${l.text ? C().md(l.text) : `<div class="empty" style="padding:16px 8px">${ic('learn')}<b>Todavía no escribe tu perfil</b>Pulsa «Aprender ahora» para que lea todo y lo escriba.</div>`}
        <div class="lmeta">${ic('clock')}<span>${l.at ? 'Aprendió ' + C().ago(l.at) : 'Sin aprendizaje todavía'}</span>${l.by ? `<span class="chip tiny">${esc(l.by)}</span>` : ''}</div>
        <div class="row" style="margin-top:12px"><button class="btn pri" data-ai="learn" ${X.learning ? 'disabled' : ''}>${X.learning ? '<span class="spin"></span>Aprendiendo…' : ic('wand') + 'Aprender ahora'}</button></div></div>
      <div class="eyebrow">Su memoria de ti · ${X.facts.length}</div>
      <div class="toolbar"><div class="glass search">${ic('search')}<input id="aiMemQ" placeholder="Buscar en su memoria…" value="${esc(X.q)}" autocomplete="off"></div><button class="btn pri teachbtn" data-ai="addFact">${ic('plus', 2.2)}<span>Contarle algo</span></button></div>
      <div class="chips">${[['all', 'Todo'], ...Object.entries(A.CATS)].map(([k, t]) => cnt(k) || k === 'all' ? `<button class="chip ${X.cat === k ? 'on' : ''}" data-ai="cat" data-k="${k}">${t} <span style="opacity:.6">${cnt(k)}</span></button>` : '').join('')}</div>
      ${list.length ? `<div class="notes">${list.map(f => `<article class="glass note ${f.master ? 'master' : ''}"><div class="meta"><span class="kind">${esc(A.CATS[f.cat] || 'Otros')}</span>${f.master ? '<span class="kind mst">Importante</span>' : ''}</div><div class="txt" style="-webkit-line-clamp:unset">${esc(f.text)}</div>
        <div class="foot"><span>${C().ago(f.createdAt)} · ${f.source === 'chat' ? 'de una conversación' : f.source === 'manual' ? 'se lo contaste' : 'aprendido'}</span><span class="sp"></span><button class="mini ${f.master ? 'gold' : ''}" data-ai="factStar" data-id="${esc(f.id)}" title="Importante">${ic('star')}</button><button class="mini" data-ai="factDel" data-id="${esc(f.id)}" title="Que lo olvide">${ic('trash')}</button></div></article>`).join('')}</div>`
        : `<div class="empty">${ic('brain')}<b>${X.facts.length ? 'Nada con ese filtro' : 'Su memoria está vacía'}</b>${X.facts.length ? '' : 'Platica con ella: lo que le cuentes de ti (proyectos, metas, cómo trabajas) lo guarda aquí sola. También puedes contárselo directo.'}</div>`}`;
  }
  async function learnNow(by) {
    if (X.learning) return; X.learning = true; if (live()) paint(); const c = C();
    try {
      const r = await c.L.chat(A.coreLearnMessages(Object.assign(ctx(''), {feedback: await feedback()})), {maxTokens: 1800, timeout: 120000});
      await coreRef().set({learned: {text: r.text, at: Date.now(), by: 'app · ' + r.model, facts: X.facts.length, events: c.S.events.length}}, {merge: true});
      X.burst = Date.now(); toast('Listo: tu perfil está actualizado');
    } catch { toast('La IA no respondió; inténtalo en un momento'); }
    X.learning = false; if (live()) paint();
  }
  async function feedback() { try { const s = await sub('feedback').orderBy('at', 'desc').limit(30).get(); return s.docs.map(d => d.data()).reverse(); } catch { return []; } }

  /* ───────── Conexiones: Google, apps, avisos, personalidad ───────── */
  const GSC = {cal: 'https://www.googleapis.com/auth/calendar.readonly', mail: 'https://www.googleapis.com/auth/gmail.readonly'};
  const gTok = () => { try { const t = JSON.parse(sessionStorage.getItem('nb_gtok') || 'null'); return t && t.exp > Date.now() ? t : null; } catch { return null; } };
  async function googleConnect(withMail) {
    const u = firebase.auth().currentUser; if (!u) return;
    const p = new firebase.auth.GoogleAuthProvider(); p.addScope(GSC.cal); if (withMail) p.addScope(GSC.mail); p.setCustomParameters({login_hint: u.email || '', prompt: 'consent'});
    try {
      const r = await u.reauthenticateWithPopup(p), tok = r && r.credential && r.credential.accessToken; if (!tok) throw new Error('Google no dio permiso');
      sessionStorage.setItem('nb_gtok', JSON.stringify({tok, exp: Date.now() + 55 * 60e3, mail: !!withMail}));
      await coreRef().set({google: {cal: true, mail: !!withMail, email: u.email, at: Date.now()}}, {merge: true});
      await googleSync();
    } catch (e) { const c = e && e.code; toast(c === 'auth/user-mismatch' ? 'Elige la misma cuenta de Google con la que entraste' : c === 'auth/popup-blocked' ? 'Permite ventanas emergentes para conectar Google' : c === 'auth/popup-closed-by-user' ? 'Conexión cancelada' : 'No se pudo conectar Google (' + (c || e.message) + ')'); }
  }
  async function gget(url, tok) {
    const r = await fetch(url, {headers: {authorization: 'Bearer ' + tok}}); if (r.ok) return r.json();
    let j = {}; try { j = await r.json(); } catch {} const msg = JSON.stringify(j);
    const err = new Error(r.status === 401 ? 'expired' : /SERVICE_DISABLED|accessNotConfigured|has not been used/i.test(msg) ? 'disabled' : r.status === 403 ? 'forbidden' : 'error ' + r.status); err.api = /gmail/.test(url) ? 'gmail' : 'calendar'; throw err;
  }
  async function googleSync(quiet) {
    const t = gTok(); if (!t) { if (!quiet) toast('Conecta Google primero'); return; } if (X.gsync) return; X.gsync = true; if (live()) paint();
    const tz = A.TZ, fmt = ms => new Intl.DateTimeFormat('es-MX', {timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}).format(new Date(ms));
    try {
      if (!quiet || !X.core.gcal || Date.now() - X.core.gcal.at > 30 * 60e3) {
        const cals = (await gget('https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader&maxResults=50', t.tok)).items || [], now = Date.now(), evs = [];
        for (const cal of cals.filter(c => c.selected !== false && !/holiday|#contacts|#weather/.test(c.id)).slice(0, 10)) {
          const q = `timeMin=${new Date(now - 864e5).toISOString()}&timeMax=${new Date(now + 14 * 864e5).toISOString()}&singleEvents=true&orderBy=startTime&maxResults=50`;
          const items = (await gget(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?${q}`, t.tok).catch(() => ({}))).items || [];
          for (const e of items) { if (e.status === 'cancelled') continue; const allDay = !!(e.start && e.start.date), s = Date.parse(allDay ? e.start.date + 'T00:00:00-06:00' : e.start.dateTime), en = Date.parse(allDay ? e.end.date + 'T00:00:00-06:00' : e.end.dateTime);
            evs.push({title: A.clip(e.summary || '(sin título)', 120), startMs: s, endMs: en, when: allDay ? new Intl.DateTimeFormat('es-MX', {timeZone: tz, weekday: 'short', day: 'numeric', month: 'short'}).format(new Date(s)) + ' · todo el día' : fmt(s), cal: A.clip(cal.summaryOverride || cal.summary || '', 40), where: A.clip(e.location || '', 80)}); }
        }
        evs.sort((a, b) => a.startMs - b.startMs);
        await coreRef().set({gcal: {at: Date.now(), events: evs.slice(0, 80), cals: cals.length}}, {merge: true});
      }
      if (t.mail) {
        const list = (await gget('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=12&q=' + encodeURIComponent('is:unread newer_than:4d -category:promotions -category:social'), t.tok)).messages || [], items = [];
        for (const m of list) { const d = await gget(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`, t.tok).catch(() => null); if (!d) continue;
          const h = n => ((d.payload && d.payload.headers || []).find(x => x.name === n) || {}).value || ''; items.push({from: A.clip(h('From').replace(/<.*>/, '').replace(/"/g, ''), 60), subject: A.clip(h('Subject'), 140), snippet: A.clip(d.snippet || '', 160), at: +d.internalDate || 0}); }
        await coreRef().set({gmail: {at: Date.now(), items}}, {merge: true});
      }
      if (!quiet) toast('Google sincronizado');
    } catch (e) {
      if (e.message === 'expired') { sessionStorage.removeItem('nb_gtok'); if (!quiet) toast('La conexión con Google caducó: vuelve a conectar'); }
      else if (e.message === 'disabled') { await coreRef().set({googleError: {api: e.api, at: Date.now()}}, {merge: true}); toast(`Falta activar la API de ${e.api === 'gmail' ? 'Gmail' : 'Google Calendar'} (te dejo el enlace en Conexiones)`); }
      else if (!quiet) toast('No se pudo leer Google (' + e.message + ')');
    }
    X.gsync = false; if (live()) paint();
  }
  function connTab() {
    const S = C().S, g = X.core.google || {}, t = gTok(), gc = X.core.gcal, gm = X.core.gmail, ge = X.core.googleError && Date.now() - X.core.googleError.at < 864e5 ? X.core.googleError : null;
    const st = a => { const s = S.status[a], on = S.conn[a] !== false; return on ? (s ? `Conectado · ${C().ago(s.at)} · ${s.items || 0} cosas vigiladas` : 'Conectado · esperando la primera sincronización') : 'Pausado'; };
    const perm = 'Notification' in window ? Notification.permission : 'unsupported';
    const PRJ = 'neural-brain-148a4', link = api => `https://console.cloud.google.com/apis/library/${api}?project=${PRJ}`;
    return `<div class="eyebrow" style="margin-top:4px">Google</div><div class="glass list">
        <div class="set"><span class="lg ai-g">${gIcon()}</span><span class="bd"><b>Google Calendar</b><small>${gc ? `${gc.events.length} eventos en los próximos 14 días · sincronizado ${C().ago(gc.at)}` : 'Tus citas (como 🔥Tatuajes🔥) y eventos: los usa para tu agenda, resúmenes y vigilancias.'}</small></span>
          ${t ? `<button class="btn sm" data-ai="gsync" ${X.gsync ? 'disabled' : ''}>${X.gsync ? '<span class="spin"></span>' : ic('clock')}Sincronizar</button>` : `<button class="btn pri sm" data-ai="gconn">${g.cal ? 'Reconectar' : 'Conectar'}</button>`}</div>
        <div class="set"><span class="lg ai-g">${ic('chat')}</span><span class="bd"><b>Gmail (solo lectura)</b><small>${gm ? `${gm.items.length} correos sin leer recientes · ${C().ago(gm.at)}` : 'Opcional: lee los asuntos de tus correos sin leer para avisarte de lo importante. Nunca envía ni borra nada.'}</small></span>
          ${t && t.mail ? '<span class="chip tiny live"><i></i>activo</span>' : `<button class="btn sm" data-ai="gconnMail">${g.mail ? 'Reconectar' : 'Activar'}</button>`}</div></div>
      ${ge ? `<div class="glass vxbanner" style="margin-top:10px"><span class="bicon" style="width:34px;height:34px;color:#ff8fa0">${ic('info')}</span><span><b>Falta un paso en Google Cloud (una sola vez):</b> activa la API de ${ge.api === 'gmail' ? 'Gmail' : 'Google Calendar'} en tu proyecto de Neural Brain y vuelve a sincronizar. <a href="${link(ge.api === 'gmail' ? 'gmail.googleapis.com' : 'calendar-json.googleapis.com')}" target="_blank" rel="noopener">Abrir y pulsar «Habilitar»</a></span></div>` : ''}
      <p class="hint">${ic('info')}Por seguridad Google solo deja leer mientras tienes la app abierta (el permiso dura 1 hora). Cada vez que sincroniza, guarda tu agenda en tu cerebro para que ${esc(aiName())} y el servidor nocturno la tengan aunque cierres la app. Si Google muestra «app no verificada», es tu propia app: toca «Configuración avanzada» → «Ir a Neural Brain».</p>
      <div class="eyebrow">Tus apps</div><div class="glass list">
        <div class="set"><span class="lg lg-nh" style="width:34px;height:34px;border-radius:11px;display:grid;place-items:center;font-weight:800;font-size:12px">NH</span><span class="bd"><b>Nova Hub</b><small>${st('novahub')}</small></span></div>
        <div class="set"><span class="lg lg-vx" style="width:34px;height:34px;border-radius:11px;display:grid;place-items:center;font-weight:800;font-size:12px">VX</span><span class="bd"><b>VORTEX y Nova Bot Lab</b><small>${st('vortex')} · ${bots().length} bots</small></span></div>
        <div class="set"><span class="bicon" style="width:34px;height:34px">${ic('brain')}</span><span class="bd"><b>Tus ${S.brains.length} cerebros</b><small>Todo lo que les enseñas y lo que aprenden lo usa ${esc(aiName())}.</small></span></div></div>
      <div class="eyebrow">Avisos</div><div class="glass list"><div class="set"><span class="bicon" style="width:34px;height:34px">${ic('bolt')}</span><span class="bd"><b>Notificaciones</b><small>${perm === 'granted' ? 'Activadas: te avisa de alertas y de tu resumen diario.' : perm === 'denied' ? 'Bloqueadas en el navegador: actívalas en los permisos del sitio.' : perm === 'unsupported' ? 'Este navegador no permite avisos.' : 'Te avisa cuando un informe tiene una alerta.'}</small></span>${perm === 'default' ? '<button class="btn sm" data-ai="notif">Activar</button>' : ''}</div></div>
      <div class="eyebrow">Su personalidad</div>
      <div class="field"><label for="aiNameIn">Cómo se llama tu IA</label><input class="inp" id="aiNameIn" maxlength="24" value="${esc(aiName())}"></div>
      <div class="field"><label for="aiInstr">Cómo quieres que te hable y te ayude</label><textarea class="inp" id="aiInstr" rows="4" maxlength="1500" placeholder="Ej.: Háblame directo y con confianza. Recuérdame terminar lo que empiezo. En trading sé estricto con mis reglas.">${esc(X.core.instructions || '')}</textarea>
        <span class="hint">${ic('info')}Se guarda al salir del cuadro. Además aprende sola de tus 👍 y 👎 en el chat.</span></div>
      ${X.core.style ? `<div class="glass learn" style="margin-top:12px"><b style="font-size:13px">Lo que aprendió de cómo te gusta que te responda</b>${C().md(X.core.style)}</div>` : ''}
      <div class="eyebrow">Agentes</div><div class="glass list"><div class="set"><span class="bicon" style="width:34px;height:34px">${ic('rocket')}</span><span class="bd"><b>Listo para tus agentes de IA</b><small>Los agentes que crees se conectan aquí: leen esta misma memoria y escriben sus informes en Vigilancias y sus propuestas en Bots, siempre con tu aprobación.</small></span></div></div>
      <div class="eyebrow">Tus datos</div><div class="glass list"><button class="set" data-ai="export"><span class="bd"><b>Descargar la memoria de ${esc(aiName())}</b><small>Perfil, memoria, conversaciones, vigilancias, informes y propuestas.</small></span>${ic('down')}</button></div>`;
  }
  const gIcon = () => `<svg width="20" height="20" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;
  async function exportAll() {
    const g = async n => { try { return (await sub(n).get()).docs.map(d => Object.assign({id: d.id}, d.data())); } catch { return []; } };
    const out = {exportado: new Date().toISOString(), ia: X.core, memoria: X.facts, conversaciones: X.chats, mensajes: await g('msgs'), vigilancias: X.watches, informes: X.reports, propuestas: X.proposals, calificaciones: await g('feedback')};
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], {type: 'application/json'})); a.download = 'mi-ia-' + new Date().toISOString().slice(0, 10) + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  /* ───────── Eventos ───────── */
  document.addEventListener('click', async e => {
    const t = e.target.closest('[data-ai]'); if (!t) return; const d = t.dataset, k = d.ai;
    if (k !== 'openRep') e.stopPropagation();
    switch (k) {
      case 'tab': X.tab = d.k; localStorage.setItem(KEY + '_tab', X.tab); X.chatList = false; paint(true); break;
      case 'sug': send(d.text); break;
      case 'newChat': X.cur = null; localStorage.removeItem(KEY + '_chat'); X.chatList = false; if (X.tab !== 'chat') { X.tab = 'chat'; } paint(true); setTimeout(() => { const i = $('#aiIn'); if (i && innerWidth > 720) i.focus(); }, 60); break;
      case 'toggleList': X.chatList = !X.chatList; const w = $('.ai-chatwrap'); if (w) w.classList.toggle('list-on', X.chatList); break;
      case 'openChat': if (e.target.closest('[data-ai="delChat"]')) break; X.cur = d.id; localStorage.setItem(KEY + '_chat', X.cur); X.chatList = false; const w2 = $('.ai-chatwrap'); if (w2) w2.classList.remove('list-on'); paintList(); paintLog(true); break;
      case 'delChat': { e.stopPropagation(); if (!confirm('¿Borrar esta conversación? Lo que aprendió de ella se queda en su memoria.')) break; const s = await sub('msgs').where('chat', '==', d.id).get(), b = C().db().batch(); s.docs.forEach(x => b.delete(x.ref)); b.delete(sub('chats').doc(d.id)); await b.commit(); delete X.msgs[d.id]; if (X.cur === d.id) X.cur = null; paint(); break; }
      case 'doAct': doAct(t.closest('[data-mid]').dataset.mid, +d.i); break;
      case 'fb': { const mid = t.closest('[data-mid]').dataset.mid, arr = X.msgs[X.cur] || [], i = arr.findIndex(m => m.id === mid), m = arr[i]; if (!m) break; const v = +d.v === m.fb ? 0 : +d.v; m.fb = v;
        sub('msgs').doc(mid).set({fb: v}, {merge: true}); const q = (arr.slice(0, i).reverse().find(x => x.role === 'user') || {}).content || '';
        if (v) sub('feedback').doc(mid).set({good: v === 1, q: A.clip(q, 400), a: A.clip(m.content, 600), at: Date.now()}); else sub('feedback').doc(mid).delete().catch(() => {});
        paintLog(); if (v) toast(v === 1 ? 'Anotado: así le gusta' : 'Anotado: aprenderá a responderte mejor'); break; }
      case 'openRep': { if (e.target.closest('[data-ai="delRep"]')) break; const id = d.id; X.open.has(id) ? X.open.delete(id) : X.open.add(id); t.classList.toggle('open'); const r = X.reports.find(x => x.id === id); if (r && !r.read) sub('reports').doc(id).set({read: true}, {merge: true}); break; }
      case 'delRep': sub('reports').doc(d.id).delete(); break;
      case 'readAll': { const b = C().db().batch(); X.reports.filter(r => !r.read).forEach(r => b.set(sub('reports').doc(r.id), {read: true}, {merge: true})); b.commit(); break; }
      case 'newWatch': watchSheet(); break;
      case 'editWatch': watchSheet(X.watches.find(w => w.id === d.id)); break;
      case 'runWatch': { const w = X.watches.find(x => x.id === d.id); if (await runWatch(w, 'app')) toast('Informe listo'); break; }
      case 'togWatch': { const w = X.watches.find(x => x.id === d.id); if (w) sub('watches').doc(w.id).set({on: w.on === false}, {merge: true}); break; }
      case 'wf': X.ws.text = $('#wText').value; X.ws.freq = d.k; document.querySelectorAll('[data-ai="wf"]').forEach(b => b.classList.toggle('on', b === t)); $('#wWhen').hidden = /cada/.test(d.k); $('#wDow').hidden = d.k !== 'semanal'; break;
      case 'wd': X.ws.dow = +d.k; document.querySelectorAll('[data-ai="wd"]').forEach(b => b.classList.toggle('on', b === t)); break;
      case 'saveWatch': { const f = X.ws, text = $('#wText').value.trim(); if (!text) { toast('Escribe qué vigilar'); break; } const id = f.id || nid();
        await sub('watches').doc(id).set({text, freq: f.freq, hour: ($('#wHour') || {}).value || '09:00', dow: f.dow == null ? 1 : f.dow, on: f.on !== false, createdAt: f.createdAt || Date.now(), kind: f.kind || null}, {merge: true}); C().closeSheet(); toast('Guardado'); break; }
      case 'delWatch': if (confirm('¿Dejar de vigilar esto?')) { await sub('watches').doc(d.id).delete(); C().closeSheet(); } break;
      case 'notif': if ('Notification' in window) { const p = await Notification.requestPermission(); toast(p === 'granted' ? 'Avisos activados' : 'No se activaron los avisos'); if (p === 'granted') notify(aiName(), 'Así te voy a avisar cuando algo importe.'); paint(); } break;
      case 'analyze': analyze(); break;
      case 'propYes': decide(d.id, true); break;
      case 'propNo': decide(d.id, false); break;
      case 'goBot': { const b = C().S.brains.find(x => x.kind === 'bot' && x.bot && x.bot.id === d.id); if (b) C().go('brain', {brain: b.id, tab: 'graph'}); break; }
      case 'mkBot': { const id = 'bot-' + d.id; await C().saveBrain(id, {name: 'Bot · ' + d.name, kind: 'bot', bot: {id: d.id, name: d.name, auto: true}, icon: 'bot', color: '#9a7bff', desc: `Cerebro del bot «${d.name}»: aprende de cada experimento y lo mejora solo cada noche.`, sources: ['vortex'], toVortex: false, autoLearn: true, order: C().S.brains.length, createdAt: Date.now()}); toast('Cerebro del bot creado'); break; }
      case 'learn': learnNow(); break;
      case 'cat': X.cat = d.k; paint(); break;
      case 'addFact': C().openSheet(`<h2>Cuéntale algo de ti</h2><div class="sub">Lo guarda en su memoria y lo usa siempre que te ayude.</div><div class="field"><label for="fText">Qué quieres que sepa</label><textarea class="inp" id="fText" rows="4" placeholder="Ej.: Los martes y jueves tatúo todo el día; no me programes nada de trading esos días."></textarea></div>
          <div class="lbl">De qué trata</div><div class="chips">${Object.entries(A.CATS).map(([k, t], i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-ai="fcat" data-k="${k}">${t}</button>`).join('')}</div>
          <div class="row" style="margin-top:10px"><button class="chip" data-act="mic" data-target="fText">${ic('mic')}Dictar</button></div>
          <div class="row" style="margin-top:18px"><button class="btn" data-act="closeSheet">Cancelar</button><button class="btn pri" style="flex:1" data-ai="saveFact">${ic('check', 2.2)}Guardar</button></div>`); X.fcat = 'personal'; break;
      case 'fcat': X.fcat = d.k; document.querySelectorAll('[data-ai="fcat"]').forEach(b => b.classList.toggle('on', b === t)); break;
      case 'saveFact': { const text = $('#fText').value.trim(); if (!text) break; await sub('notes').doc(nid()).set({text: A.clip(text, 600), cat: X.fcat || 'otros', kind: 'nota', source: 'manual', createdAt: Date.now(), updatedAt: Date.now()}); C().closeSheet(); toast('Lo recordaré'); break; }
      case 'factDel': if (confirm('¿Que lo olvide?')) sub('notes').doc(d.id).delete(); break;
      case 'factStar': { const f = X.facts.find(x => x.id === d.id); if (f) sub('notes').doc(f.id).set({master: !f.master, updatedAt: Date.now()}, {merge: true}); break; }
      case 'gconn': googleConnect(!!(X.core.google && X.core.google.mail)); break;
      case 'gconnMail': googleConnect(true); break;
      case 'gsync': googleSync(); break;
      case 'export': exportAll(); break;
    }
  }, true);
  document.addEventListener('submit', e => { if (e.target.id === 'aiForm') { e.preventDefault(); const i = $('#aiIn'), q = i.value; i.value = ''; i.style.height = 'auto'; send(q); } });
  document.addEventListener('keydown', e => { if (e.target.id === 'aiIn' && e.key === 'Enter' && !e.shiftKey && innerWidth > 720) { e.preventDefault(); $('#aiForm').requestSubmit(); } });
  document.addEventListener('input', e => {
    if (e.target.id === 'aiIn') { e.target.style.height = 'auto'; e.target.style.height = Math.min(140, e.target.scrollHeight) + 'px'; }
    if (e.target.id === 'aiMemQ') { X.q = e.target.value; clearTimeout(X.qT); X.qT = setTimeout(() => { paint(); const i = $('#aiMemQ'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 200); }
  });
  document.addEventListener('change', e => {
    if (e.target.id === 'aiNameIn' && e.target.value.trim()) { coreRef().set({aiName: e.target.value.trim().slice(0, 24)}, {merge: true}); toast('Ahora se llama ' + e.target.value.trim()); }
    if (e.target.id === 'aiInstr') { coreRef().set({instructions: e.target.value.trim()}, {merge: true}); toast('Guardado'); }
  });
  addEventListener('nb-auth', () => { const S = C().S; if (S.user) attach(); else detach(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && X.uid) { X.autoRan = false; autoRun(); if (gTok()) googleSync(true); } });

  /* ───────── Estilos ───────── */
  const css = `
.ai-head{display:flex;align-items:center;gap:12px;margin-bottom:16px}.ai-head h1{font-size:24px;letter-spacing:-.6px;margin:0}.ai-head p{margin:3px 0 0;color:var(--muted);font-size:12.5px}.ai-head .grow{flex:1;min-width:0}
.ai-av{width:52px;height:52px;flex:0 0 52px;filter:drop-shadow(0 6px 18px rgba(130,100,255,.55))}
.ao-core{animation:aoPulse 3.6s ease-in-out infinite;transform-origin:30px 30px}.ao-ring{animation:aoSpin 14s linear infinite;transform-origin:30px 30px}
@keyframes aoPulse{50%{transform:scale(1.08)}}@keyframes aoSpin{to{transform:rotate(360deg)}}
.aiseg .segdot{position:absolute;top:7px;right:7px;width:7px;height:7px;border-radius:50%;background:#ff6b81;box-shadow:0 0 8px #ff6b81}
.aibadge{position:absolute;top:4px;left:calc(50% + 6px);min-width:16px;height:16px;padding:0 4px;border-radius:9px;background:#ff6b81;color:#fff;font:700 10px/16px Inter,sans-serif;font-style:normal;text-align:center;box-shadow:0 0 10px rgba(255,107,129,.6)}
#dock button,.side-nav{position:relative}
.side-nav .aibadge{left:auto;right:14px;top:50%;transform:translateY(-50%)}
.ai-chatwrap{display:grid;grid-template-columns:1fr;gap:14px}
.ai-list{display:none;padding:10px;max-height:62vh;overflow:auto;border-radius:20px}
.ai-chatwrap.list-on .ai-list{display:block}.ai-chatwrap.list-on .ai-main{display:none}
@media(min-width:1180px){.ai-chatwrap{grid-template-columns:250px 1fr}.ai-list{display:block;position:sticky;top:16px;align-self:start}.ai-chatwrap.list-on .ai-main{display:block}.ai-listbtn{display:none}}
.ai-lhead{display:flex;justify-content:space-between;align-items:center;padding:4px 6px 10px}.ai-lhead b{font-size:13px}
.ai-citem{position:relative;display:block;width:100%;text-align:left;padding:10px 34px 10px 12px;border-radius:14px;transition:background .25s}.ai-citem:hover,.ai-citem.on{background:rgba(255,255,255,.06)}
.ai-citem b{display:block;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ai-citem small{color:var(--muted);font-size:11px}
.ai-cdel{position:absolute;right:8px;top:50%;transform:translateY(-50%);opacity:.0;color:var(--muted);transition:opacity .2s}.ai-citem:hover .ai-cdel,.ai-citem.on .ai-cdel{opacity:.8}.ai-cdel svg{width:15px;height:15px}
.ai-log .msg.ai{max-width:94%}
.ai-think{display:block;color:var(--muted);font-size:11.5px;margin-top:6px}
.ai-hello{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:30px 12px 10px;color:var(--muted);line-height:1.6;font-size:14px;max-width:520px;margin:0 auto}
.ai-hello b{color:var(--text);font-size:18px}.ai-hello-orb svg{width:96px;height:96px;filter:drop-shadow(0 10px 30px rgba(130,100,255,.6))}
.ai-mfoot{display:flex;align-items:center;gap:4px;margin-top:10px;padding-top:8px;border-top:1px solid var(--line)}.ai-mfoot .sp{flex:1}
.ai-mfoot .mini.on{color:#c6a8ff;background:rgba(154,123,255,.15)}
.ai-act{display:flex;align-items:center;gap:10px;margin-top:10px;padding:10px 12px;border-radius:15px;background:rgba(154,123,255,.08);border:1px solid rgba(154,123,255,.25)}
.ai-act.done{opacity:.7;background:rgba(43,212,164,.06);border-color:rgba(43,212,164,.25)}
.ai-act .bd{flex:1;min-width:0;font-size:13px;line-height:1.45}.ai-act em{display:block;font-style:normal;font-size:10.5px;letter-spacing:1px;text-transform:uppercase;color:#c6a8ff;font-weight:700;margin-bottom:2px}
.ai-act small{display:block;color:var(--muted);font-size:11.5px;margin-top:2px}.ai-acti svg{width:20px;height:20px;color:#c6a8ff}
.btn.sm{height:36px;padding:0 13px;font-size:12.5px;border-radius:12px}.btn.sm svg{width:15px;height:15px}
.ai-orbcard{position:relative;height:380px;overflow:hidden;margin-bottom:12px;background:radial-gradient(circle at 50% 45%,rgba(120,90,255,.10),transparent 65%),var(--glass)}
.ai-orbcard canvas{position:absolute;inset:0;width:100%;height:100%}
.ai-orbtx{position:absolute;left:18px;bottom:16px;right:18px;display:flex;flex-direction:column;gap:4px;max-width:360px}
.ai-orbtx b{font-size:28px;letter-spacing:-1px}.ai-orbtx small{color:var(--muted);font-size:12px;line-height:1.45}.ai-orbtx .chip{align-self:flex-start}
.ai-tiles{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:12px}
@media(max-width:860px){.ai-tiles{grid-template-columns:repeat(3,1fr)}.ai-orbcard{height:330px}}
.ai-rep.unread .ttl{font-weight:700}.ai-rep.unread::before{content:'';position:absolute;left:6px;top:50%;width:6px;height:6px;margin-top:-3px;border-radius:50%;background:#9a7bff;box-shadow:0 0 8px #9a7bff}
.ai-rep{position:relative;cursor:pointer}.ai-rep .more.md{white-space:normal}
.ai-watch .mini[disabled]{opacity:.6}.toggle-b{padding:4px;flex:0 0 auto}.toggle-b .toggle{display:block}
.ai-main .sugg{padding-bottom:92px}
.spin{display:inline-block;width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,.25);border-top-color:#fff;animation:aoSpin .8s linear infinite;vertical-align:-2px}
.ai-bots{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}
.ai-bot{padding:14px 15px;display:flex;flex-direction:column;gap:9px}.ai-bot b{font-size:15px}.ai-bot small{display:block;color:var(--muted);font-size:11.5px}
.ai-bstats{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}.ai-bstats span{font-size:10.5px;color:var(--muted);display:flex;flex-direction:column}.ai-bstats b{font-size:17px;color:var(--text);font-variant-numeric:tabular-nums}
.ai-why{margin:0;color:var(--muted);font-size:12.5px;line-height:1.5}.ai-bot .chip{align-self:flex-start}
.ai-prop{padding:14px 15px;margin-bottom:10px}.ai-prop small{color:var(--muted);font-size:11px}.ai-prop b{display:block;font-size:15px;margin:2px 0}.ai-prop p{margin:4px 0 0;font-size:13.5px;line-height:1.5}
.lg.ai-g{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:rgba(255,255,255,.08);flex:0 0 34px}.lg.ai-g svg{width:18px;height:18px}
.vxbanner a{color:#9db4ff;font-weight:600}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  window.AICore = {view, after, paint: () => schedule(), badge, attach, stats: () => stats(), send, open: () => C().go('ai')};
  if (C().S.user) attach();
})();
