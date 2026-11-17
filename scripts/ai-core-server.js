/* NEURAL BRAIN · «Mi IA» en el servidor (corre dentro del aprendizaje nocturno, scripts/learn.js).
   Para cada cuenta que ya abrió Mi IA (users/{uid}/brains/_core), con la app cerrada:
     1) Actualiza su perfil «Lo que sabe de ti» con TODO (memoria, cerebros, recuerdos, bots, agenda, tus 👍/👎).
     2) Corre las vigilancias que ya tocaban (incluido el resumen diario) y deja los informes en Mi IA → Vigilancias.
     3) Si hubo datos nuevos de los bots, los analiza y deja mejoras propuestas en Mi IA → Bots (tú decides).
     4) Guarda la foto del día de cuánto sabe (gráfica de crecimiento).
   Nunca imprime datos de usuarios (los repos son públicos). */
'use strict';
const A = require('../ai-core-lib.js'), L = require('../brain-learn.js');
const MAX_WATCHES = 4;

async function runCore(u, o) {
  o = o || {}; const core = u.collection('brains').doc(A.CORE_ID), snap = await core.get();
  if (!snap.exists) return {skipped: true};
  const C = snap.data(), sub = n => core.collection(n), now = Date.now(), force = !!o.force, res = {learned: 0, reports: 0, proposals: 0};
  const evs = o.events || [], name = C.owner || o.name || '';
  const get = async (q, map) => { try { return (await q.get()).docs.map(d => map ? map(d) : d.data()); } catch (e) { console.warn('Mi IA: no se pudo leer', String(e.message || e).slice(0, 120)); return []; } };
  const withId = d => Object.assign({id: d.id}, d.data());
  const facts = await get(sub('notes'));
  const watches = await get(sub('watches'), withId);
  const proposals = await get(sub('proposals').orderBy('at', 'desc').limit(40), withId);
  const feedback = (await get(sub('feedback').orderBy('at', 'desc').limit(30))).reverse();
  const chats = await get(sub('chats'));
  const brainDocs = (await u.collection('brains').get()).docs.filter(d => d.id !== A.CORE_ID);
  const brains = [], counts = {notes: 0};
  for (const d of brainDocs) {
    const b = d.data(), notes = await get(d.ref.collection('notes')); counts.notes += notes.length;
    brains.push({id: d.id, kind: b.kind, name: b.name, desc: b.desc, learned: b.learned && b.learned.text, masters: notes.filter(n => n.master).map(n => n.text).slice(0, 8)});
  }
  const bots = A.botStats(evs);
  const ctx = () => ({name, aiName: C.aiName, L, events: evs, facts, bots, brains, watches, profile: C.learned && C.learned.text, style: [C.instructions, C.style].filter(Boolean).join('\n'), gcal: C.gcal, gmail: C.gmail});

  // 1) Perfil
  const since = (C.learned && C.learned.at) || 0;
  const fresh = evs.some(e => (e.sync || e.at || 0) > since) || facts.some(f => (f.updatedAt || f.createdAt || 0) > since) || feedback.some(f => (f.at || 0) > since);
  if (C.autoLearn !== false && (fresh || force) && (facts.length || evs.length)) {
    try {
      const r = await L.chat(A.coreLearnMessages(Object.assign(ctx(), {feedback})), {maxTokens: 1800, timeout: 120000});
      C.learned = {text: r.text, at: Date.now(), by: 'servidor · ' + r.model, facts: facts.length, events: evs.length};
      await core.set({learned: C.learned}, {merge: true}); res.learned = 1;
    } catch (e) { console.warn('Mi IA: el perfil no se pudo actualizar:', String(e.message || e).slice(0, 140)); }
  }

  // 2) Vigilancias que ya tocaban (el resumen diario es una más)
  for (const w of watches.filter(w => A.watchDue(w, now)).slice(0, MAX_WATCHES)) {
    try {
      const sys = A.coreSystem(Object.assign(ctx(), {q: w.text, now}));
      const r = await L.chat(w.kind === 'daily' ? A.dailyMessages(sys, 'desde el último resumen') : A.watchMessages(w, sys), {maxTokens: 1200, timeout: 110000});
      const p = w.kind === 'daily' ? {alert: false, title: 'Tu resumen de ' + new Intl.DateTimeFormat('es-MX', {timeZone: A.TZ, weekday: 'long', day: 'numeric', month: 'long'}).format(new Date()), text: A.parseActions(r.text).text} : A.parseWatch(r.text);
      const at = Date.now();
      await sub('reports').add({watchId: w.id, watch: A.clip(w.text, 90), kind: w.kind || 'watch', alert: p.alert, title: p.title, text: p.text, at, by: 'servidor', read: false, model: r.model});
      await sub('watches').doc(w.id).set({lastRun: at, lastBy: 'servidor'}, {merge: true}); res.reports++;
    } catch (e) { console.warn('Mi IA: una vigilancia falló:', String(e.message || e).slice(0, 140)); }
  }

  // 3) Bots: análisis y propuestas (solo si hubo datos nuevos de bots y no se analizó en las últimas 20 h)
  const lastA = (C.botAnalysis && C.botAnalysis.at) || 0, botFresh = bots.some(b => b.last > lastA);
  if (bots.length && (force || (botFresh && now - lastA > 20 * 3600e3))) {
    try {
      const rules = brains.flatMap(b => b.masters || []), botBrains = brains.filter(b => b.kind === 'bot');
      const r = await L.chat(A.botsMessages(bots, {name, rules, botBrains, pending: proposals.slice(0, 20)}), {maxTokens: 1800, temperature: .35, timeout: 120000});
      const j = A.parseBots(r.text, bots);
      if (j) {
        await core.set({botAnalysis: {at: Date.now(), resumen: j.resumen, ranking: j.ranking, by: 'servidor · ' + r.model}}, {merge: true});
        for (const p of j.propuestas) {
          if (proposals.some(q => q.bot === p.bot && A.similar((q.titulo || '') + ' ' + (q.idea || ''), p.titulo + ' ' + p.idea) > .5)) continue;
          await sub('proposals').add(Object.assign({status: 'pendiente', at: Date.now(), by: 'servidor'}, p)); res.proposals++;
        }
      }
    } catch (e) { console.warn('Mi IA: el análisis de bots falló:', String(e.message || e).slice(0, 140)); }
  }

  // 4) Foto del día
  try {
    const msgs = chats.reduce((a, c) => a + (c.count || 0), 0), learned = brainDocs.filter(d => d.data().learned).length + (C.learned ? 1 : 0);
    const approved = proposals.filter(p => p.status === 'aprobada').length, k = A.knowledge({notes: counts.notes, events: evs.length, facts: facts.length, msgs, learned, approved});
    const day = A.localParts(now).date, prev = await sub('growth').doc(day).get();
    if (!prev.exists || (prev.data().xp || 0) < k.xp) await sub('growth').doc(day).set({date: day, at: now, xp: k.xp, level: k.level, total: k.total, facts: facts.length, notes: counts.notes, events: evs.length, msgs}, {merge: true});
  } catch (e) { console.warn('Mi IA: crecimiento:', String(e.message || e).slice(0, 120)); }
  return res;
}

module.exports = {runCore};
