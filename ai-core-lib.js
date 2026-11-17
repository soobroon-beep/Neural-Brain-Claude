/* NEURAL BRAIN · IA personal («Mi IA»): la lógica que comparten la app y el servidor nocturno.
   Junta TODO lo que sabe Neural Brain (todos los cerebros, tus recuerdos de Nova Hub y VORTEX, tu memoria propia,
   tu agenda de Google, tus bots) en un solo contexto, y define cómo la IA:
     · responde (con acciones que tú confirmas: vigilar, recordar, enseñar, proponer mejoras a un bot),
     · aprende de cada conversación (hechos que TÚ dijiste, sin repetir) y de cómo calificas sus respuestas,
     · vigila cosas y escribe informes, analiza tus bots y propone mejoras (nunca las aplica sola),
     · crece: nivel, etapa y tamaño según cuánto sabe.
   Funciones puras (se prueban con node tests/ai-core.test.js). La llamada a la IA es BrainLearn.chat. */
(function (root) {
  'use strict';
  const CORE_ID = '_core';             // documento users/{uid}/brains/_core (oculto en la lista de cerebros)
  const TZ = 'America/Mexico_City';
  const DAY = 864e5;

  const clip = (s, n) => { s = String(s == null ? '' : s).trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const words = s => new Set(norm(s).split(/[^a-z0-9ñ]+/).filter(w => w.length > 2));
  function similar(a, b) { const A = words(a), B = words(b); if (!A.size || !B.size) return 0; let n = 0; for (const w of A) if (B.has(w)) n++; return n / (A.size + B.size - n); }
  const tOf = x => (x && (x.at || x.updatedAt || x.createdAt || x.ts)) || 0;

  /* ───────── Fecha en tu zona ───────── */
  function localParts(ms, tz) {
    const p = new Intl.DateTimeFormat('en-US', {timeZone: tz || TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23'}).formatToParts(new Date(ms));
    const g = t => (p.find(x => x.type === t) || {}).value;
    return {date: `${g('year')}-${g('month')}-${g('day')}`, hour: +g('hour') % 24, min: +g('minute'), dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(g('weekday'))};
  }
  const nowLabel = (ms, tz) => new Intl.DateTimeFormat('es-MX', {timeZone: tz || TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'}).format(new Date(ms));

  /* ───────── Cuánto sabe: nivel, etapa y tamaño ───────── */
  const STAGES = [[1, 'Semilla', 'Acaba de nacer: cada cosa que le cuentas la hace crecer.'], [3, 'Chispa', 'Ya reconoce tus apps y tus primeras rutinas.'],
    [5, 'Red naciente', 'Empieza a conectar tus proyectos, tu trading y tu día a día.'], [8, 'Mente en crecimiento', 'Te conoce lo suficiente para darte consejos con tus datos.'],
    [12, 'Mente entrenada', 'Recuerda tus patrones y anticipa lo que necesitas.'], [17, 'Mente experta', 'Sabe cómo trabajas, qué te funciona y qué no.'],
    [24, 'Núcleo maestro', 'Una memoria enorme de ti, tus apps y tus bots.']];
  function knowledge(o) {
    o = o || {}; const notes = o.notes || 0, events = o.events || 0, facts = o.facts || 0, msgs = o.msgs || 0, learned = o.learned || 0, approved = o.approved || 0;
    const xp = notes * 8 + facts * 10 + events + msgs * 2 + learned * 40 + approved * 25;
    const level = Math.floor(Math.sqrt(xp / 15)) + 1, lo = (level - 1) ** 2 * 15, hi = level ** 2 * 15;
    let st = STAGES[0]; for (const s of STAGES) if (level >= s[0]) st = s;
    const total = notes + events + facts + msgs;
    return {xp, level, progress: Math.min(1, (xp - lo) / Math.max(1, hi - lo)), toNext: Math.max(0, hi - xp), total,
      stage: st[1], stageText: st[2], size: Math.min(1, Math.log10(1 + xp) / Math.log10(1 + 60000))}; // 0..1: tamaño del núcleo
  }

  /* ───────── Bots de Nova Bot Lab (desde tus recuerdos de VORTEX) ───────── */
  const BOT_REF = /^(b|br|bx|bv|bp):([^:]+)/;
  const pct = t => { const m = /([+\-\u2212]?\s?\d+(?:[.,]\d+)?)\s?%/.exec(String(t || '')); return m ? parseFloat(m[1].replace(/\s/g, '').replace('\u2212', '-').replace(',', '.')) : null; };
  function botStats(events) {
    const m = new Map(), get = id => { let b = m.get(id); if (!b) m.set(id, b = {id, name: '', versions: [], experiments: [], results: [], paper: [], other: [], last: 0}); return b; };
    for (const e of events || []) {
      if (e.app !== 'vortex') continue; const r = BOT_REF.exec(e.ref || ''); if (!r) continue; const b = get(r[2]);
      b.last = Math.max(b.last, tOf(e));
      if (r[1] === 'b') { if (!b.name || tOf(e) >= b.nameAt) { b.name = e.title || b.name; b.nameAt = tOf(e); } }
      (r[1] === 'bv' ? b.versions : r[1] === 'bx' ? b.experiments : r[1] === 'bp' ? b.paper : r[1] === 'br' ? b.results : b.other).push(e);
    }
    const out = [];
    for (const b of m.values()) {
      for (const k of ['versions', 'experiments', 'results', 'paper']) b[k].sort((p, q) => tOf(q) - tOf(p));
      const nights = b.experiments.map(e => { const ls = String(e.text || '').split('\n').filter(l => /^\s*-\s/.test(l)); return {at: tOf(e), tried: ls.length, won: ls.filter(l => /GANA/i.test(l)).length, proposal: /propuesta:/i.test(e.title || '')}; });
      const tried = nights.reduce((a, x) => a + x.tried, 0), won = nights.reduce((a, x) => a + x.won, 0);
      const series = [...b.paper, ...b.results].map(e => ({at: tOf(e), v: pct(e.title) ?? pct(e.text)})).filter(x => x.v != null).sort((p, q) => p.at - q.at);
      let trend = 'sin datos';
      if (series.length >= 4) { const h = Math.floor(series.length / 2), avg = a => a.reduce((s, x) => s + x.v, 0) / a.length, d = avg(series.slice(h)) - avg(series.slice(0, h)); trend = d > .3 ? 'mejorando' : d < -.3 ? 'empeorando' : 'estable'; }
      else if (nights.length >= 4) { const rate = a => a.reduce((s, x) => s + x.won, 0) / Math.max(1, a.reduce((s, x) => s + x.tried, 0)), h = Math.floor(nights.length / 2), d = rate(nights.slice(0, h)) - rate(nights.slice(h)); trend = d > .05 ? 'mejorando' : d < -.05 ? 'empeorando' : 'estable'; }
      else if (b.versions.length || nights.length) trend = 'aprendiendo';
      out.push({id: b.id, name: b.name || 'Bot ' + b.id, versions: b.versions.length, experiments: nights.length, ideasTried: tried, ideasWon: won, winRate: tried ? won / tried : null,
        proposals: nights.filter(x => x.proposal).length, series: series.slice(-30), last: b.last, trend,
        lastVersion: b.versions[0] ? clip(b.versions[0].title, 120) : '', lastResult: (b.paper[0] || b.results[0]) ? clip((b.paper[0] || b.results[0]).title + ' — ' + String((b.paper[0] || b.results[0]).text || '').replace(/\s+/g, ' '), 260) : '',
        lastExperiment: b.experiments[0] ? clip(b.experiments[0].title + '\n' + (b.experiments[0].text || ''), 900) : ''});
    }
    return out.sort((p, q) => q.last - p.last);
  }
  const fmtPct = x => x == null ? '—' : Math.round(x * 100) + '%';
  function botsBlock(bots, detail) {
    if (!bots || !bots.length) return '(todavía no llegan datos de bots de Nova Bot Lab)';
    return bots.slice(0, 8).map(b => `- ${b.name} [id ${b.id}] · tendencia: ${b.trend} · ${b.versions} versiones · ${b.experiments} noches de experimentos (${b.ideasWon}/${b.ideasTried} ideas ganaron, ${fmtPct(b.winRate)}) · ${b.proposals} propuestas` +
      (b.series.length ? ` · resultados recientes: ${b.series.slice(-6).map(x => (x.v > 0 ? '+' : '') + x.v + '%').join(', ')}` : '') +
      (b.lastVersion ? `\n  versión más reciente: ${b.lastVersion}` : '') + (b.lastResult ? `\n  último resultado: ${b.lastResult}` : '') +
      (detail && b.lastExperiment ? `\n  último experimento: ${b.lastExperiment.replace(/\n/g, ' | ')}` : '')).join('\n');
  }

  /* ───────── Memoria propia (lo que aprende de tus conversaciones) ───────── */
  const CATS = {personal: 'Personal', proyectos: 'Proyectos', trading: 'Trading', tatuaje: 'Tatuaje', preferencias: 'Cómo te gusta', metas: 'Metas', tecnologia: 'IA y tecnología', otros: 'Otros'};
  function factsBlock(facts, q, max) {
    const arr = (facts || []).filter(f => f && String(f.text || '').trim());
    const qs = q ? words(q) : null, score = f => { let s = (f.master ? 3 : 0); if (qs) { const w = words(f.text); for (const x of qs) if (w.has(x)) s += 2; } return s; };
    const sorted = arr.slice().sort((a, b) => score(b) - score(a) || tOf(b) - tOf(a));
    let out = '', used = 0; for (const f of sorted) { const l = `- ${f.cat && CATS[f.cat] ? '[' + CATS[f.cat] + '] ' : ''}${clip(String(f.text).replace(/\s+/g, ' '), 300)}\n`; if (used + l.length > (max || 5000)) break; out += l; used += l.length; }
    return out.trim();
  }
  function factsMessages(userMsg, aiMsg, facts, name) {
    return [{role: 'system', content: `Eres la memoria de la IA personal de ${name || 'el usuario'}. Respondes SOLO con JSON válido.
De la conversación, extrae HECHOS DURADEROS sobre él que ÉL dijo (proyectos, metas, cómo trabaja, cómo opera, preferencias, personas, decisiones, fechas importantes).
NO guardes: lo que propuso la IA (salvo que él lo acepte claramente), saludos, preguntas, cosas pasajeras, ni nada que ya esté en la memoria.
Cada hecho en 1 frase corta en tercera persona («Prefiere…», «Está construyendo…»). Máximo 4. Si no hay nada nuevo: {"hechos":[]}.
Categorías: ${Object.keys(CATS).join(', ')}.
Formato: {"hechos":[{"texto":"","categoria":""}]}`},
    {role: 'user', content: `MEMORIA ACTUAL (no repetir):\n${factsBlock(facts, userMsg, 3500) || '(vacía)'}\n\nÉL DIJO:\n${clip(userMsg, 2500)}\n\nLA IA RESPONDIÓ:\n${clip(aiMsg, 1500)}`}];
  }
  function parseJSON(raw) {
    const t = String(raw || '').replace(/```(?:json)?/g, ''); const a = t.search(/[{[]/); if (a < 0) return null;
    const close = t[a] === '{' ? '}' : ']', b = t.lastIndexOf(close); if (b <= a) return null; const body = t.slice(a, b + 1);
    try { return JSON.parse(body); } catch {} try { return JSON.parse(body.replace(/,\s*([}\]])/g, '$1').replace(/[“”]/g, '"')); } catch { return null; }
  }
  function parseFacts(raw, facts) {
    const j = parseJSON(raw), list = j && Array.isArray(j.hechos) ? j.hechos : Array.isArray(j) ? j : [];
    const out = [];
    for (const h of list) {
      const text = clip(typeof h === 'string' ? h : h && h.texto, 280); if (!text || text.length < 8) continue;
      if ((facts || []).concat(out).some(f => similar(f.text, text) > .6)) continue;
      const cat = h && CATS[norm(h.categoria).replace(/[^a-z]/g, '')] ? norm(h.categoria).replace(/[^a-z]/g, '') : 'otros';
      out.push({text, cat});
    }
    return out.slice(0, 4);
  }

  /* ───────── Google: agenda y correo ───────── */
  function agendaBlock(gcal, now) {
    const ev = gcal && Array.isArray(gcal.events) ? gcal.events.filter(e => !e.endMs || e.endMs >= (now || Date.now()) - 3600e3) : [];
    if (!ev.length) return gcal && gcal.at ? '(sin eventos en los próximos días)' : '(Google Calendar no conectado)';
    return ev.slice(0, 30).map(e => `- ${e.when} · ${clip(e.title, 100)}${e.cal ? ' [' + clip(e.cal, 30) + ']' : ''}${e.where ? ' · ' + clip(e.where, 60) : ''}`).join('\n');
  }
  function mailBlock(gmail) {
    const it = gmail && Array.isArray(gmail.items) ? gmail.items : [];
    if (!it.length) return gmail && gmail.at ? '(sin correos sin leer recientes)' : '(Gmail no conectado)';
    return it.slice(0, 15).map(m => `- ${clip(m.from, 40)}: ${clip(m.subject, 120)}${m.snippet ? ' — ' + clip(m.snippet, 120) : ''}`).join('\n');
  }

  /* ───────── Acciones que la IA propone (tú las confirmas con un toque) ───────── */
  const ACTION_TYPES = ['vigilar', 'recordar', 'ensenar', 'propuesta_bot'];
  const FREQS = {diaria: 'Cada día', semanal: 'Cada semana', cada6h: 'Cada 6 horas', cada12h: 'Cada 12 horas'};
  function parseActions(text) {
    const actions = []; const clean = String(text || '').replace(/\[\[accion\]\]([\s\S]*?)\[\[\/accion\]\]/gi, (_, body) => {
      const j = parseJSON(body); if (j && ACTION_TYPES.includes(norm(j.tipo).replace(/[^a-z_]/g, ''))) { j.tipo = norm(j.tipo).replace(/[^a-z_]/g, ''); actions.push(j); } return '';
    }).replace(/\n{3,}/g, '\n\n').trim();
    return {text: clean, actions: actions.slice(0, 4)};
  }

  /* ───────── El cerebro que responde ───────── */
  function coreSystem(o) {
    o = o || {}; const name = o.name || 'el usuario', ai = o.aiName || 'Neural', now = o.now || Date.now();
    const brains = (o.brains || []).map(b => `• ${b.name}${b.desc ? ' — ' + clip(b.desc, 120) : ''}${b.masters && b.masters.length ? '\n  Reglas maestras: ' + b.masters.map(m => clip(m, 160)).join(' | ') : ''}${b.learned ? '\n  Lo que sabe: ' + clip(String(b.learned).replace(/\s+/g, ' '), 700) : ''}`).join('\n');
    const L = o.L, rel = L && o.events ? L.relevant(o.events, o.q || '', o.nEvents || 45).map(e => L.eventLine(e, 180)).join('\n') : '';
    const watches = (o.watches || []).filter(w => w.on !== false).map(w => `- ${clip(w.text, 140)} (${FREQS[w.freq] || w.freq}${w.hour ? ' ' + w.hour : ''})`).join('\n');
    return `Eres ${ai}, la IA PERSONAL de ${name}. Vives dentro de Neural Brain, su segundo cerebro, y lo conoces por todo lo que guarda ahí: sus cerebros (lo que te enseñó), sus recuerdos de Nova Hub (notas, proyectos, tareas, hábitos, diario) y de VORTEX (trading, bots de Nova Bot Lab, alertas, ideas), tu propia memoria de sus conversaciones, y su agenda y correo de Google si los conectó.
Ahora es ${nowLabel(now, o.tz)} (hora de ${name}).
Respondes SIEMPRE en español de México, directo, cálido y útil, como alguien que de verdad lo conoce y le ayuda a avanzar. Usa sus datos concretos (nombres de proyectos, bots, fechas, números). Si algo no está en tus datos, dilo y da tu mejor criterio marcado como opinión. Nunca inventes datos.
En trading y bots: nunca prometas ganancias, no subas riesgo ni apalancamiento, respeta sus reglas maestras. Los cambios a un bot SIEMPRE los aprueba él.
Formato: markdown breve (viñetas cortas, **negritas** para lo clave). Sin relleno.

ACCIONES: si él te pide (o claramente le conviene) que vigiles algo, que recuerdes algo, que guardes algo en un cerebro o que propongas una mejora a un bot, agrega AL FINAL una línea por acción así (él la confirma con un botón; no digas que ya quedó hecho):
[[accion]]{"tipo":"vigilar","texto":"qué revisar y cuándo avisar","frecuencia":"diaria|semanal|cada6h|cada12h","hora":"08:00"}[[/accion]]
[[accion]]{"tipo":"recordar","texto":"hecho sobre él en una frase","categoria":"${Object.keys(CATS).join('|')}"}[[/accion]]
[[accion]]{"tipo":"ensenar","cerebro":"nombre del cerebro","texto":"regla, estrategia o nota","clase":"nota|regla|estrategia|leccion"}[[/accion]]
[[accion]]{"tipo":"propuesta_bot","bot":"nombre del bot","botId":"id","titulo":"","idea":"cambio concreto a probar","porque":"basado en qué datos"}[[/accion]]
${o.style ? '\nCÓMO LE GUSTA QUE LE RESPONDAS (aprendido de sus calificaciones):\n' + clip(o.style, 900) + '\n' : ''}
LO QUE SABES DE ${name.toUpperCase()} (perfil que vas aprendiendo):
${o.profile ? clip(o.profile, 3200) : '(todavía no escribes su perfil; usa lo de abajo)'}

TU MEMORIA (hechos que él te ha contado):
${factsBlock(o.facts, o.q, 4500) || '(vacía todavía)'}

SUS CEREBROS:
${brains || '(sin cerebros)'}

SUS BOTS (Nova Bot Lab):
${botsBlock(o.bots, false)}

SU AGENDA (Google Calendar, próximos días):
${agendaBlock(o.gcal, now)}

CORREOS SIN LEER (Gmail):
${mailBlock(o.gmail)}

LO QUE YA VIGILAS POR ÉL:
${watches || '(nada todavía)'}

RECUERDOS RELACIONADOS (de sus apps, de lo más viejo a lo más nuevo):
${rel || '(sin recuerdos todavía)'}`;
  }

  /* ───────── Aprender: perfil global + cómo le gusta que le respondas ───────── */
  function coreLearnMessages(o) {
    o = o || {}; const name = o.name || 'el usuario', L = o.L;
    const fb = (o.feedback || []).slice(-30).map(f => `- ${f.good ? '👍' : '👎'} Preguntó: ${clip(f.q, 160)} → respuesta: ${clip(f.a, 220)}`).join('\n');
    return [{role: 'system', content: `Eres la IA personal de ${name}. Respondes SIEMPRE en español. Tu tarea: actualizar tu PERFIL de él con TODO lo que sabes (memoria, cerebros, recuerdos de sus apps, bots, agenda). Conserva lo valioso del perfil anterior y corrígelo si los datos nuevos lo contradicen. Solo afirma lo que se desprende de los datos; las suposiciones márcalas («parece que…»). Números concretos cuando los haya.
FORMATO (markdown, máximo ~450 palabras, viñetas cortas):
### Quién es y qué le importa
### En qué está ahora (proyectos y apps, cómo van)
### Trading y bots (cómo opera, qué bots van mejor)
### Cómo trabaja (horarios, hábitos, herramientas)
### Lo que le funciona / lo que le cuesta
### Cómo le gusta que le respondas (de sus 👍/👎 y de lo que pide)`},
    {role: 'user', content: [
      o.profile ? 'PERFIL ANTERIOR:\n' + clip(o.profile, 3000) : '',
      'MEMORIA (lo que él te contó):\n' + (factsBlock(o.facts, '', 5000) || '(vacía)'),
      'CEREBROS:\n' + ((o.brains || []).map(b => `• ${b.name}: ${clip(String(b.learned || b.desc || '').replace(/\s+/g, ' '), 800)}`).join('\n') || '(nada)'),
      'BOTS:\n' + botsBlock(o.bots, false),
      'AGENDA:\n' + agendaBlock(o.gcal),
      fb ? 'CALIFICACIONES DE TUS RESPUESTAS:\n' + fb : '',
      'RECUERDOS RECIENTES:\n' + (L && o.events ? L.eventsBlock(o.events, 9000) : '(nada)')
    ].filter(Boolean).join('\n\n')}];
  }

  /* ───────── Vigilancias e informes ───────── */
  const SLOT_H = {cada6h: 6, cada12h: 12};
  function watchDue(w, now, tz) {
    if (!w || w.on === false) return false; now = now || Date.now(); const last = w.lastRun || 0;
    if (SLOT_H[w.freq]) return now - last >= SLOT_H[w.freq] * 3600e3 - 5 * 60e3;
    const [hh, mm] = String(w.hour || '08:00').split(':').map(Number), p = localParts(now, tz);
    const minsNow = p.hour * 60 + p.min, minsAt = (hh || 0) * 60 + (mm || 0);
    let daysBack = minsNow >= minsAt ? 0 : 1;              // el último horario que ya pasó
    if (w.freq === 'semanal') { const dow = w.dow == null ? 1 : +w.dow; daysBack = ((p.dow - dow + 7) % 7); if (daysBack === 0 && minsNow < minsAt) daysBack = 7; }
    const slot = now - daysBack * DAY - (minsNow - minsAt) * 60e3;  // ms aproximado de ese horario
    return last < slot - 60e3 && now >= slot;
  }
  function watchMessages(w, system) {
    return [{role: 'system', content: system + `

TAREA DE VIGILANCIA: ${w.text}
Revisa tus datos (recuerdos, bots, agenda, memoria) y escribe un informe breve para él (máximo ~180 palabras, viñetas).
Primera línea: «ALERTA: …» si encontraste algo que requiere su atención ahora; si todo está en orden, «TODO BIEN: …» con la idea principal. No inventes datos: si no tienes información suficiente, dilo. No agregues acciones [[accion]].`},
    {role: 'user', content: 'Haz la revisión ahora.'}];
  }
  function parseWatch(text) {
    const t = String(text || '').replace(/\[\[accion\]\][\s\S]*?\[\[\/accion\]\]/gi, '').trim(), first = (t.split('\n').find(l => l.trim()) || '').replace(/^[#*\s]+/, '');
    const alert = /^ALERTA\b/i.test(first);
    return {alert, title: clip(first.replace(/^(ALERTA|TODO BIEN)\s*:\s*/i, '').replace(/\*\*/g, ''), 120) || 'Informe', text: t};
  }
  function dailyMessages(system, sinceLabel) {
    return [{role: 'system', content: system + `

TAREA: escribe su RESUMEN de cómo van las cosas (${sinceLabel || 'últimas 24 horas'}). Máximo ~260 palabras, markdown con estas secciones (omite las que no tengan datos):
### Lo que avanzaste (proyectos y apps)
### Trading y bots (qué bot mejora, cuál no, números)
### Lo que viene (agenda y pendientes)
### Una sugerencia para hoy
No agregues acciones [[accion]].`}, {role: 'user', content: 'Escríbeme el resumen.'}];
  }

  /* ───────── Bots: análisis y propuestas de mejora ───────── */
  function botsMessages(bots, o) {
    o = o || {};
    return [{role: 'system', content: `Eres el analista de bots de trading de ${o.name || 'el usuario'} (Nova Bot Lab, en VORTEX). Respondes SOLO con JSON válido, en español.
Con los datos de cada bot (versiones, experimentos nocturnos con velas reales, ideas que ganaron fuera de muestra, paper trading) di cuál va mejorando y cuál no, y propone MEJORAS CONCRETAS para probar (salidas, filtros, horarios, confirmaciones, temporalidades).
REGLAS: basa todo en los datos; nunca propongas subir riesgo, tamaño ni apalancamiento; respeta sus reglas maestras; no repitas lo que ya se probó y no funcionó ni las propuestas pendientes. Máximo 3 propuestas.
Formato: {"resumen":"2-3 frases","ranking":[{"bot":"","botId":"","estado":"mejorando|estable|empeorando|sin datos","porque":""}],"propuestas":[{"bot":"","botId":"","titulo":"","idea":"","porque":"","riesgo":"bajo|medio"}]}`},
    {role: 'user', content: `BOTS:\n${botsBlock(bots, true)}\n\nREGLAS MAESTRAS DE TRADING:\n${(o.rules || []).map(r => '- ' + clip(r, 200)).join('\n') || '(ninguna)'}\n\nLO QUE SABE CADA CEREBRO DE BOT:\n${(o.botBrains || []).map(b => `• ${b.name}: ${clip(String(b.learned || '').replace(/\s+/g, ' '), 900)}`).join('\n') || '(nada)'}\n\nPROPUESTAS PENDIENTES O YA DECIDIDAS (no repetir):\n${(o.pending || []).map(p => `- ${p.bot}: ${clip(p.titulo || p.idea, 140)} (${p.status})`).join('\n') || '(ninguna)'}`}];
  }
  function parseBots(raw, bots) {
    const j = parseJSON(raw); if (!j || typeof j !== 'object') return null;
    const byName = n => (bots || []).find(b => norm(b.name) === norm(n)) || (bots || []).find(b => norm(n) && norm(b.name).includes(norm(n)));
    const fix = x => { const b = (bots || []).find(q => q.id === String(x.botId || '')) || byName(x.bot); return Object.assign({}, x, {botId: b ? b.id : String(x.botId || ''), bot: b ? b.name : String(x.bot || '')}); };
    return {resumen: clip(j.resumen, 600), ranking: (Array.isArray(j.ranking) ? j.ranking : []).filter(x => x && x.bot).map(fix).slice(0, 8),
      propuestas: (Array.isArray(j.propuestas) ? j.propuestas : []).filter(x => x && (x.idea || x.titulo)).map(fix).map(x => ({bot: x.bot, botId: x.botId, titulo: clip(x.titulo || x.idea, 90), idea: clip(x.idea, 600), porque: clip(x.porque, 400), riesgo: /medio/i.test(x.riesgo) ? 'medio' : 'bajo'})).slice(0, 3)};
  }
  const approvedNote = p => `[IDEA APROBADA PARA PROBAR] ${p.titulo}: ${p.idea}${p.porque ? ' (por qué: ' + p.porque + ')' : ''}. Pruébala en los próximos experimentos; solo propón la versión si gana fuera de muestra sin más caída.`;

  const api = {CORE_ID, TZ, CATS, FREQS, STAGES, clip, norm, similar, localParts, nowLabel, knowledge, botStats, botsBlock, factsBlock, factsMessages, parseFacts, parseJSON,
    agendaBlock, mailBlock, parseActions, coreSystem, coreLearnMessages, watchDue, watchMessages, parseWatch, dailyMessages, botsMessages, parseBots, approvedNote, pct};
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.AICoreLib = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
