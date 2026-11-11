/* NEURA · tu guía dentro de NEURAL BRAIN (como Nexus Pixel en VORTEX y Cortex en Nova Hub).
   Es el icono hecho personaje: dos nubes-cerebro (morada y lila) unidas por sinapsis, con ojos de luz.
   Se asoma escondida en la orilla; al tocarla sale y platica contigo. Te explica qué es cada cosa, cómo se conecta
   todo (Nova Hub, VORTEX, la IA de VORTEX), cómo va cada cerebro y te lleva a donde quieras («llévame a…»).
   Hace un recorrido guiado, da consejos de vez en cuando y entiende la voz. IA gratuita (BrainLearn.chat); sin conexión
   responde con lo que trae aprendido. Datos y navegación vía window.NB (index.html). */
(function () {
  'use strict';
  const NB = () => window.NB; if (!NB()) return;
  const KEY = 'nb3_neura', CHAT = 'nb3_neura_chat';
  const cfg = (() => { try { return Object.assign({on: true, tips: true}, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { return {on: true, tips: true}; } })();
  const saveCfg = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch {} };
  let chat = (() => { try { return JSON.parse(localStorage.getItem(CHAT) || '[]') || []; } catch { return []; } })();
  const saveChat = () => { try { localStorage.setItem(CHAT, JSON.stringify(chat.slice(-40))); } catch {} };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const nrm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ───────── El personaje (SVG) ───────── */
  let uidN = 0;
  function face(size) {
    const i = ++uidN;
    return `<svg class="nr-svg" viewBox="0 0 132 104" width="${size || 74}" height="${(size || 74) * 104 / 132}" aria-hidden="true">
      <defs>
        <linearGradient id="nrL${i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8a5cff"/><stop offset="1" stop-color="#5426d1"/></linearGradient>
        <linearGradient id="nrR${i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d4c4ff"/><stop offset="1" stop-color="#9b7cf6"/></linearGradient>
        <radialGradient id="nrS${i}" cx=".35" cy=".25" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
        <filter id="nrG${i}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <g class="nr-body">
        <g class="nr-right" fill="url(#nrR${i})"><circle cx="78" cy="44" r="17"/><circle cx="96" cy="38" r="16"/><circle cx="111" cy="52" r="15"/><circle cx="106" cy="70" r="14"/><circle cx="86" cy="70" r="15"/><rect x="72" y="44" width="40" height="30" rx="12"/></g>
        <g class="nr-left" fill="url(#nrL${i})"><circle cx="34" cy="40" r="17"/><circle cx="52" cy="34" r="17"/><circle cx="64" cy="50" r="15"/><circle cx="24" cy="58" r="15"/><circle cx="44" cy="70" r="16"/><circle cx="62" cy="68" r="12"/><rect x="24" y="42" width="40" height="32" rx="12"/></g>
        <ellipse cx="44" cy="36" rx="18" ry="9" fill="url(#nrS${i})"/><ellipse cx="92" cy="40" rx="14" ry="7" fill="url(#nrS${i})"/>
        <g class="nr-syn" stroke="#120d33" stroke-width="5" stroke-linecap="round" fill="none" opacity=".9">
          <path class="s1" d="M30 58H70"/><path class="s2" d="M44 67H80q7 0 7-7"/><path class="s3" d="M38 76H62"/>
        </g>
        <g class="nr-eyes" filter="url(#nrG${i})"><rect class="nr-eye l" x="40" y="32" width="10" height="15" rx="5" fill="#fff"/><rect class="nr-eye r" x="86" y="34" width="10" height="15" rx="5" fill="#fff"/></g>
        <path class="nr-mouth" d="M60 47q6 5 12 0" stroke="#fff" stroke-width="2.6" stroke-linecap="round" fill="none" filter="url(#nrG${i})"/>
        <g class="nr-cheek" fill="#ff8ad1" opacity="0"><ellipse cx="34" cy="49" rx="5" ry="2.6"/><ellipse cx="102" cy="50" rx="5" ry="2.6"/></g>
      </g>
      <g class="nr-spark" fill="#e7dcff"><path d="M120 14l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/><path d="M10 18l1.4 3.4 3.4 1.4-3.4 1.4L10 27.6l-1.4-3.4L5.2 22.8l3.4-1.4z"/></g>
    </svg>`;
  }
  window.NeuraFace = face;

  /* ───────── Estilos ───────── */
  const css = `
#nr{position:fixed;z-index:50;right:0;bottom:calc(160px + env(safe-area-inset-bottom));pointer-events:none}
@media(min-width:980px){#nr{bottom:28px}}
#nr .nr-av{pointer-events:auto;position:relative;display:block;padding:6px;transform:translateX(46%) rotate(-14deg);transition:transform .7s cubic-bezier(.34,1.56,.64,1),filter .4s;filter:drop-shadow(0 10px 24px rgba(110,70,255,.55))}
#nr .nr-av:hover{transform:translateX(34%) rotate(-10deg)}
#nr.peek .nr-av{transform:translateX(18%) rotate(-6deg)}
#nr.out .nr-av{transform:translateX(-12px) rotate(0)}
#nr .nr-av::after{content:'';position:absolute;left:18%;right:18%;bottom:2px;height:10px;border-radius:50%;background:radial-gradient(rgba(140,100,255,.55),transparent 70%);filter:blur(3px);animation:nrShadow 4s ease-in-out infinite}
.nr-svg{display:block;overflow:visible}
.nr-body{animation:nrFloat 4s ease-in-out infinite;transform-origin:66px 60px}
.nr-eye{transform-box:fill-box;transform-origin:center;animation:nrBlink 5.2s infinite}
.nr-eyes{transition:transform .4s cubic-bezier(.22,1,.36,1)}
.nr-mouth{opacity:0;transition:opacity .3s}
.nr-spark{opacity:0;transition:opacity .3s}
.nr-syn path{stroke-dasharray:60;stroke-dashoffset:0}
.think .nr-syn path{stroke:#c9b6ff;opacity:1;animation:nrSyn 1.1s linear infinite}.think .nr-syn .s2{animation-delay:.2s}.think .nr-syn .s3{animation-delay:.4s}
.think .nr-eyes{transform:translate(4px,-3px)}
.talk .nr-mouth{opacity:1;animation:nrTalk .32s ease-in-out infinite alternate;transform-box:fill-box;transform-origin:center}
.happy .nr-mouth{opacity:1}.happy .nr-cheek{opacity:.55}.happy .nr-spark{opacity:1;animation:nrTw 1.2s ease-in-out infinite}
.happy .nr-body{animation:nrHop .7s cubic-bezier(.34,1.56,.64,1) 2,nrFloat 4s ease-in-out .9s infinite}
.happy .nr-eye{animation:none;transform:scaleY(.45)}
.look-l .nr-eyes{transform:translate(-4px,1px)}.look-r .nr-eyes{transform:translate(4px,1px)}
@keyframes nrFloat{50%{transform:translateY(-5px) rotate(1.5deg)}}
@keyframes nrShadow{50%{transform:scaleX(.8);opacity:.6}}
@keyframes nrBlink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}
@keyframes nrSyn{0%{stroke-dashoffset:60;opacity:.4}50%{opacity:1}100%{stroke-dashoffset:0;opacity:.4}}
@keyframes nrTalk{to{transform:scaleY(1.9)}}
@keyframes nrHop{40%{transform:translateY(-14px) scale(1.04,.96)}}
@keyframes nrTw{50%{opacity:.3;transform:scale(.8)}}
#nrTip{position:fixed;z-index:51;right:96px;bottom:calc(178px + env(safe-area-inset-bottom));max-width:min(270px,calc(100vw - 120px));padding:12px 14px;border-radius:18px 18px 6px 18px;font-size:13px;line-height:1.45;color:#eef3fb;background:rgba(16,18,34,.86);-webkit-backdrop-filter:blur(18px) saturate(1.5);backdrop-filter:blur(18px) saturate(1.5);border:1px solid rgba(160,130,255,.3);box-shadow:0 14px 40px -12px rgba(0,0,0,.7);cursor:pointer;opacity:0;transform:translateY(8px) scale(.96);transition:all .45s cubic-bezier(.34,1.56,.64,1);pointer-events:none}
#nrTip.on{opacity:1;transform:none;pointer-events:auto}
#nrTip b{color:#cbb8ff}
#nrTip small{display:block;color:#8592a8;font-size:11px;margin-top:5px}
@media(min-width:980px){#nrTip{bottom:52px;right:104px}}
#nrP{position:fixed;z-index:55;right:12px;left:12px;bottom:calc(84px + env(safe-area-inset-bottom));height:min(72dvh,620px);display:flex;flex-direction:column;border-radius:26px;background:rgba(10,12,24,.82);-webkit-backdrop-filter:blur(26px) saturate(1.6);backdrop-filter:blur(26px) saturate(1.6);border:1px solid rgba(255,255,255,.1);box-shadow:0 30px 80px -20px rgba(0,0,0,.85),0 0 0 1px rgba(140,100,255,.08) inset;opacity:0;transform:translateY(24px) scale(.97);transform-origin:bottom right;pointer-events:none;transition:opacity .35s,transform .55s cubic-bezier(.34,1.56,.64,1);overflow:hidden}
#nrP.on{opacity:1;transform:none;pointer-events:auto}
#nrP.nr-mini{height:auto;max-height:46dvh}
@media(min-width:980px){#nrP{left:auto;right:110px;bottom:24px;width:400px;height:min(78dvh,640px)}}
#nrP::before{content:'';position:absolute;inset:-40% -30% auto auto;width:320px;height:320px;border-radius:50%;background:radial-gradient(circle,rgba(130,90,255,.22),transparent 70%);pointer-events:none}
.nrp-h{display:flex;align-items:center;gap:10px;padding:14px 14px 10px;border-bottom:1px solid rgba(255,255,255,.07);position:relative}
.nrp-h .nrp-av{width:46px;flex:0 0 46px}
.nrp-h b{display:block;font-size:15px}.nrp-h small{display:block;color:#8592a8;font-size:11.5px;margin-top:1px}
.nrp-h .grow{flex:1;min-width:0}
.nrp-x{width:36px;height:36px;border-radius:12px;display:grid;place-items:center;color:#8592a8;transition:background .25s,color .25s}.nrp-x:hover{background:rgba(255,255,255,.06);color:#fff}.nrp-x svg{width:18px;height:18px}
.nrp-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;position:relative}
.nrm{max-width:90%;padding:10px 13px;border-radius:17px;font-size:13.5px;line-height:1.55;animation:nrIn .4s cubic-bezier(.22,1,.36,1) both;word-break:break-word}
.nrm.u{align-self:flex-end;background:linear-gradient(140deg,rgba(120,95,255,.4),rgba(160,110,255,.3));border:1px solid rgba(160,130,255,.3);border-bottom-right-radius:6px;white-space:pre-wrap}
.nrm.a{align-self:flex-start;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.07);border-bottom-left-radius:6px}
.nrm.a .md p{margin:5px 0;font-size:13.5px}.nrm.a .md li{font-size:13.5px;margin:3px 0}.nrm.a .md h3{font-size:14px;margin:10px 0 4px}.nrm.a .md h3:first-child{margin-top:0}
.nrm .acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}
@keyframes nrIn{from{opacity:0;transform:translateY(8px)}}
.nrp-chips{display:flex;gap:6px;overflow-x:auto;padding:4px 14px 10px;scrollbar-width:none}.nrp-chips::-webkit-scrollbar{display:none}
.nrp-chips button,.nrm .acts button{flex:0 0 auto;padding:7px 12px;border-radius:999px;font-size:12px;font-weight:600;color:#cdd6e6;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);white-space:nowrap;transition:all .25s}
.nrp-chips button:hover,.nrm .acts button:hover{background:rgba(140,110,255,.18);border-color:rgba(160,130,255,.4);color:#fff}
.nrm .acts .pri{background:linear-gradient(140deg,#5f7dff,#8b6bff);border-color:transparent;color:#fff}
.nrp-f{display:flex;gap:7px;padding:10px 12px 12px;border-top:1px solid rgba(255,255,255,.07)}
.nrp-f textarea{flex:1;resize:none;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:15px;padding:10px 12px;outline:0;font:inherit;font-size:14px;color:#eef3fb;max-height:110px}
.nrp-f textarea:focus{border-color:rgba(140,110,255,.55)}
.nrp-f button{width:42px;height:42px;flex:0 0 42px;border-radius:14px;display:grid;place-items:center;color:#eef3fb;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08)}
.nrp-f button svg{width:19px;height:19px}.nrp-f .send{background:linear-gradient(140deg,#5f7dff,#8b6bff);border:0}
.nrp-f .rec{background:#ff6b81;border-color:transparent;animation:pulse 1.4s infinite}
.nr-step{font-size:10.5px;letter-spacing:1px;text-transform:uppercase;color:#a993ff;font-weight:700;margin-bottom:4px}
body.nr-tour [data-nr-hl]{position:relative;z-index:1;box-shadow:0 0 0 2px rgba(160,130,255,.9),0 0 30px rgba(140,100,255,.5)!important;border-radius:16px;transition:box-shadow .4s}
@media(prefers-reduced-motion:reduce){#nr *,#nrP,#nrTip{animation:none!important}}
`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  /* ───────── DOM ───────── */
  const root = document.createElement('div'); root.id = 'nr'; root.innerHTML = `<button class="nr-av" aria-label="Hablar con Neura, tu guía">${face(78)}</button>`;
  const tipEl = document.createElement('div'); tipEl.id = 'nrTip'; tipEl.setAttribute('role', 'status');
  const panel = document.createElement('section'); panel.id = 'nrP'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Neura, tu guía');
  const ICX = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  const ICMIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
  const ICSEND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const ICTRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';
  panel.innerHTML = `<div class="nrp-h"><span class="nrp-av" id="nrPAv">${face(46)}</span><div class="grow"><b>Neura</b><small id="nrSub">Tu guía en Neural Brain</small></div><button class="nrp-x" id="nrClr" aria-label="Borrar la plática" title="Borrar la plática">${ICTRASH}</button><button class="nrp-x" id="nrX" aria-label="Cerrar">${ICX}</button></div>
    <div class="nrp-log" id="nrLog" aria-live="polite"></div>
    <div class="nrp-chips" id="nrChips"></div>
    <form class="nrp-f" id="nrF"><button type="button" id="nrMic" aria-label="Dictar">${ICMIC}</button><textarea id="nrIn" rows="1" placeholder="Pregúntale a Neura…"></textarea><button class="send" aria-label="Enviar">${ICSEND}</button></form>`;
  document.body.append(root, tipEl, panel);
  const $ = s => panel.querySelector(s), av = root.querySelector('.nr-av');
  const mood = (m, ms) => { for (const el of [av, $('#nrPAv')]) { el.classList.remove('think', 'talk', 'happy', 'look-l', 'look-r'); if (m) el.classList.add(m); } if (ms) setTimeout(() => mood(''), ms); };
  function show() { root.hidden = !cfg.on || !NB().signedIn(); if (root.hidden) { closeP(); hideTip(); } }

  /* ───────── Lo que Neura sabe de la app ───────── */
  const GUIDE = `NEURAL BRAIN (la app donde vives) es el «segundo cerebro» de Payi. Partes:
- CEREBROS: puede tener varios (de inicio: Trading, Vida y proyectos, Tatuaje, IA y tecnología). Cada uno se entrena distinto: elige de qué app aprende (Nova Hub, VORTEX o ninguna) y qué le enseñas. «Nuevo cerebro» crea otro.
- PESTAÑAS de cada cerebro: Evolución (gráficos: nivel, red neuronal, crecimiento de 30 días y «con qué lo alimentas»), Enseñanzas, Recuerdos, Lo que sabe, Preguntar y Ajustes.
- ENSEÑANZAS: lo que él le enseña a mano: Nota, Regla, Estrategia, Trader (puede pegar la transcripción de un video y «Resumir en reglas con IA») y Lección. La estrella la vuelve REGLA MAESTRA: siempre se toma en cuenta y avisa si algo la rompe. Botón + (en el dock o «Enseñar algo»). Se puede dictar por voz.
- RECUERDOS: llegan solos de sus apps. Un conector en el servidor (GitHub Actions, cada 30 min, aunque todo esté cerrado) compara su cuenta y manda lo nuevo. De Nova Hub: notas, proyectos, tareas (creadas, completadas, borradas), hábitos, recordatorios, eventos y diario. De VORTEX: lista de seguimiento, alertas, ideas Long/Short con sus niveles, indicadores activados, scripts Pine, bots de Nova Bot Lab y sus resultados, operaciones del diario de trading y cada actualización publicada de la app. Con la × el cerebro olvida un recuerdo. No agrega nada a esas apps: solo mira.
- LO QUE SABE: la IA resume «Lo que sé de ti» (en qué está, cómo trabaja/opera, lo que le funciona, lo que repite y le cuesta, cómo mejorar). Aprende sola cada noche a las 3:20 a. m. si hubo novedades, o con «Aprender ahora». Ahí también va «Cómo quieres que te ayude este cerebro» (instrucciones).
- PREGUNTAR: chat con un cerebro; responde con lo que sabe, lo que le enseñó y sus recuerdos.
- AJUSTES DEL CEREBRO: nombre, icono, color, de dónde aprende, «Pasárselo a la IA de VORTEX» y «Aprender solo cada noche».
- CONEXIÓN CON VORTEX: los cerebros con «Pasárselo a la IA de VORTEX» mandan sus reglas maestras, estrategias y lo aprendido a «Analizar gráfico» (agrega la sección «Según tu estrategia») y al «Briefing del día» de VORTEX. Nexus Pixel no lo usa. Llega en la siguiente sincronización (máx. 30 min).
- AJUSTES GENERALES: cuenta, conexiones (pausar Nova Hub o VORTEX), icono de la app (16 opciones; el principal es el de fondo blanco con las dos nubes morada y lila), Neura (mostrar y consejos), descargar todo el cerebro, versión anterior.
- CEREBROS DE BOTS: un cerebro puede ser el «cerebro de un bot» de Nova Bot Lab (VORTEX) (Nuevo cerebro → «hazlo el cerebro de un bot», o ya creado: «Bot · Señales v2.7 1H»). Solo ve lo de SU bot: versiones, resultados, experimentos y paper trading. Cada noche (00:17 CDMX) el servidor prueba ideas para mejorar el bot: consejos del entrenador, 1-2 ideas de la IA guiadas por lo que sabe el cerebro y el optimizador. Las prueba con velas reales y solo propone una versión CANDIDATA si gana fuera de muestra (validación y prueba), sin más caída y sin romper las reglas maestras (nunca sube riesgo, tamaño ni apalancamiento; no cambia moneda ni temporalidad). Recuerda lo que falló para no repetirlo. La candidata aparece en VORTEX → Nova Bot Lab → Versiones y él decide si la aprueba; nunca opera con dinero real por su cuenta. En Evolución se ve «Experimentos del bot». En Ajustes del cerebro: «Mejorarlo solo cada noche» y «Desconectar el bot». Sus reglas maestras (p. ej. riesgo máx. 2 %, 5x) son los límites del bot.
- NIVEL: cada enseñanza suma 8 puntos, cada regla maestra 12 más, cada recuerdo 1 y aprender 40.
- Todo se guarda en su cuenta de Google (Firebase). La IA es gratuita.
- TÚ: Neura, el personaje del icono (dos nubes-cerebro unidas). Ayudas en toda la app.`;
  const ACTIONS = `ACCIONES: si conviene llevarlo a algún lado o hacer algo, escribe al FINAL de tu respuesta una o más marcas (no las expliques):
{{ir:home}} {{ir:memories}} {{ir:ask}} {{ir:settings}} · {{cerebro:ID:PESTAÑA}} con PESTAÑA = graph|teach|memories|learned|ask|config · {{enseñar}} (abre «Enseñar algo») · {{aprender:ID}} (aprende ahora) · {{tour}} (recorrido guiado).`;
  function context() {
    const n = NB(), s = n.snapshot();
    return `AHORA: está en «${s.where}». Usuario: ${s.name || 'Payi'}.
Conexiones: Nova Hub ${s.conn.novahub}, VORTEX ${s.conn.vortex}.
Sus cerebros:
${s.brains.map(b => `- ${b.name} (id ${b.id}): nivel ${b.level}, ${b.notes} enseñanzas (${b.masters} reglas maestras), ${b.events} recuerdos, ${b.week} nuevos esta semana; aprende de ${b.sources || 'nada (solo lo que le enseñan)'}${b.toVortex ? '; conectado a la IA de VORTEX' : ''}; aprendió ${b.learnedAgo}. Lo más grande: ${b.top || '—'}.${b.learned ? ' Lo que sabe (resumen): ' + b.learned : ''}`).join('\n')}`;
  }
  const SYS = () => `Eres NEURA, la guía y asistente de la app Neural Brain. Respondes SIEMPRE en español, cálida, clara, breve (máx. ~140 palabras salvo que pida detalle), con markdown sencillo y sin emojis. Explicas qué es cada cosa, cómo se integra todo y cómo va cada cerebro; das ideas concretas para entrenarlos mejor. Si te pregunta por sus datos, usa SOLO el contexto; no inventes. No das asesoría financiera.
${GUIDE}
${context()}
${ACTIONS}`;

  /* Respuestas sin IA (sin conexión o si la IA falla) */
  const LOCAL = [
    [/hola|buenas|hey/, () => `¡Hola${NB().snapshot().name ? ', ' + NB().snapshot().name : ''}! Soy **Neura**, tu guía en Neural Brain. Te explico cualquier cosa de la app, te digo cómo va cada cerebro y te llevo a donde quieras. ¿Empezamos con un recorrido?`, [['Hazme el recorrido', 'tour']]],
    [/recuerd|conector|sincron|llega|nova ?hub/, () => `Los **Recuerdos** llegan solos: un conector en el servidor revisa Nova Hub y VORTEX cada 30 minutos (aunque todo esté cerrado) y te trae lo nuevo: lo que creas, editas, completas o borras. No cambia nada en esas apps, solo mira. Con la **×** el cerebro olvida un recuerdo.`, [['Ver recuerdos', 'go:memories']]],
    [/vortex|ia de vortex|analizar grafico|briefing/, () => `Los cerebros con **«Pasárselo a la IA de VORTEX»** mandan tus reglas maestras, estrategias y lo que aprendieron a «Analizar gráfico» (agrega «Según tu estrategia») y al «Briefing del día». Nexus Pixel no lo usa. Se activa en los **Ajustes** de cada cerebro.`, []],
    [/ensen|regla|estrateg|trader|leccion|maestra/, () => `En **Enseñanzas** le das lo que sabes: notas, reglas, estrategias, traders (pega la transcripción y la resumo en reglas) y lecciones. Con la **estrella** una regla se vuelve **maestra**: siempre la toma en cuenta.`, [['Enseñar algo', 'teach']]],
    [/aprend|lo que sabe|resumen/, () => `En **Lo que sabe** la IA escribe «Lo que sé de ti» con tus enseñanzas y recuerdos. Aprende sola cada noche (3:20 a. m.) si hubo novedades, o cuando pulsas **Aprender ahora**.`, []],
    [/grafic|nivel|red|neurona|evolucion/, () => `En **Evolución** ves el nivel del cerebro, su **red neuronal** (cada punto es algo que le diste y los destellos viajan al núcleo), el crecimiento de 30 días y con qué lo alimentas. Toca un centro de la red para ver sus elementos.`, []],
    [/icono/, () => `En **Ajustes → Icono de la app** eliges entre 16 iconos. El principal es el de fondo blanco con las dos nubes. Si ya la instalaste en el celular, reinstálala para ver el icono nuevo.`, [['Ir a Ajustes', 'go:settings']]],
    [/nuevo cerebro|varios cerebros|crear cerebro/, () => `Puedes tener varios cerebros y entrenarlos distinto: en **Cerebros → Nuevo cerebro** eliges nombre y de qué app aprende. Luego le das sus propias enseñanzas e instrucciones.`, [['Ir a mis cerebros', 'go:home']]],
  ];
  function localAnswer(q) {
    const t = nrm(q); for (const [re, f, acts] of LOCAL) if (re.test(t)) return {text: f(), acts};
    const s = NB().snapshot(); const b = s.brains.find(x => t.includes(nrm(x.name)));
    if (b || /como va|progreso|avance/.test(t)) { const x = b || s.brains.slice().sort((p, q2) => q2.level - p.level)[0]; return {text: `**${x.name}** va en **nivel ${x.level}**: ${x.notes} enseñanzas (${x.masters} reglas maestras) y ${x.events} recuerdos, ${x.week} nuevos esta semana. Lo que más lo alimenta: ${x.top || 'todavía nada'}.`, acts: [['Ver su evolución', `cerebro:${x.id}:graph`]]}; }
    return {text: 'Ahora mismo no pude pensar con la IA, pero puedo explicarte cualquier parte: cerebros, enseñanzas, recuerdos, lo que sabe, la conexión con VORTEX o los gráficos.', acts: [['Hazme el recorrido', 'tour']]};
  }

  /* ───────── Plática ───────── */
  const md = t => NB().md(t);
  function paint() {
    const log = $('#nrLog');
    log.innerHTML = chat.map((m, i) => m.role === 'user' ? `<div class="nrm u">${esc(m.content)}</div>` : `<div class="nrm a">${m.step ? `<div class="nr-step">${esc(m.step)}</div>` : ''}${m.typing ? '<span class="dots"><i></i><i></i><i></i></span>' : md(m.content)}${(m.acts || []).length ? `<div class="acts">${m.acts.map(([l, a], k) => `<button class="${k === 0 ? 'pri' : ''}" data-nra="${esc(a)}">${esc(l)}</button>`).join('')}</div>` : ''}</div>`).join('');
    log.scrollTop = log.scrollHeight;
    const v = NB().snapshot().view;
    const chips = v === 'brain' ? ['¿Qué significa esta pestaña?', '¿Cómo va este cerebro?', '¿Cómo lo entreno mejor?'] : v === 'settings' ? ['¿Qué hace cada ajuste?', '¿Cómo cambio el icono?'] : v === 'memories' ? ['¿De dónde salen los recuerdos?', '¿Cada cuánto llegan?'] : ['Hazme un recorrido', '¿Cómo va mi cerebro de trading?', '¿Cómo se conecta con VORTEX?', '¿Qué es cada cosa?'];
    $('#nrChips').innerHTML = chips.map(c => `<button data-nrq="${esc(c)}">${esc(c)}</button>`).join('');
  }
  function sayLocal(text, acts, step) { chat.push({role: 'assistant', content: text, acts: acts || [], step}); saveChat(); paint(); mood('talk', 1400); }
  let busy = false;
  async function ask(q) {
    q = String(q || '').trim(); if (!q || busy) return; endTour(true);
    if (/^(hazme (un|el) )?recorrido|tour|ensename la app/.test(nrm(q))) { chat.push({role: 'user', content: q}); startTour(); return; }
    chat.push({role: 'user', content: q}); const tm = {role: 'assistant', typing: true, content: ''}; chat.push(tm); busy = true; paint(); mood('think');
    try {
      const hist = chat.filter(m => !m.typing && !m.step).slice(-9, -1).map(m => ({role: m.role, content: m.content}));
      const r = await window.BrainLearn.chat([{role: 'system', content: SYS()}, ...hist, {role: 'user', content: q}], {maxTokens: 700, timeout: 60000, temperature: .5});
      const {text, acts} = parseActs(r.text); Object.assign(tm, {content: text, acts}); delete tm.typing; mood('talk', 1600);
      autoRun(r.text);
    } catch { const l = localAnswer(q); Object.assign(tm, {content: l.text, acts: l.acts}); delete tm.typing; mood('', 0); }
    busy = false; saveChat(); paint();
  }
  const ACT_LABEL = {home: 'Ir a mis cerebros', memories: 'Ver recuerdos', ask: 'Ir a Preguntar', settings: 'Ir a Ajustes'}, TAB_LABEL = {graph: 'Ver su evolución', teach: 'Ver enseñanzas', memories: 'Ver sus recuerdos', learned: 'Ver lo que sabe', ask: 'Preguntarle', config: 'Ajustes del cerebro'};
  function parseActs(raw) {
    const acts = []; const text = String(raw || '').replace(/\{\{\s*([^}]+?)\s*\}\}/g, (m, a) => {
      const [k, x, y] = a.split(':').map(z => z.trim()); const s = NB().snapshot();
      if (k === 'ir' && ACT_LABEL[x]) acts.push([ACT_LABEL[x], 'go:' + x]);
      else if (k === 'cerebro') { const b = s.brains.find(q => q.id === x); if (b) acts.push([`${TAB_LABEL[y] || 'Abrir'} · ${b.name}`, `cerebro:${x}:${y || 'graph'}`]); }
      else if (/^ense/.test(k)) acts.push(['Enseñar algo', 'teach']);
      else if (k === 'aprender') { const b = s.brains.find(q => q.id === x); if (b) acts.push([`Aprender ahora · ${b.name}`, 'learn:' + x]); }
      else if (k === 'tour') acts.push(['Hazme el recorrido', 'tour']);
      return '';
    }).trim();
    return {text, acts: acts.slice(0, 4)};
  }
  function autoRun() {}
  function doAct(a) {
    const n = NB(), [k, x, y] = a.split(':');
    if (k === 'tour') return startTour();
    if (k === 'go') { n.go(x); mood('happy', 1400); if (innerWidth < 980) closeP(); return; }
    if (k === 'cerebro') { n.go('brain', {brain: x, tab: y || 'graph'}); mood('happy', 1400); if (innerWidth < 980) closeP(); return; }
    if (k === 'teach') { closeP(); n.teach(); return; }
    if (k === 'learn') { n.go('brain', {brain: x, tab: 'learned'}); setTimeout(() => n.learn(), 400); sayLocal('Listo, ya estoy aprendiendo. En un momento aparece en **Lo que sabe**.'); return; }
    if (k === 'next') return tourStep(tourI + 1);
    if (k === 'endtour') { endTour(); sayLocal('¡Listo! Ya conoces Neural Brain. Cuando quieras, pregúntame lo que sea.', []); mood('happy', 1800); }
  }

  /* ───────── Recorrido guiado ───────── */
  let tourI = -1;
  const TOUR = [
    {t: 'Bienvenido', go: n => n.go('home'), hl: '.hero', text: 'Esta es tu casa: **tus cerebros**. Arriba ves cuánto les has dado y si **Nova Hub** y **VORTEX** están mandando recuerdos (punto verde = sincronizado).'},
    {t: 'Cerebros', go: n => n.go('home'), hl: '.brains', text: 'Cada tarjeta es un **cerebro** con su propio entrenamiento. La minigráfica es su crecimiento de 14 días. Puedes crear los que quieras con **Nuevo cerebro**.'},
    {t: 'Evolución', go: n => n.go('brain', {brain: n.snapshot().brains[0].id, tab: 'graph'}), hl: '.netcard', text: 'Aquí ves crecer a un cerebro: su **nivel**, la **red neuronal** (cada punto es algo que le diste y los destellos son cómo lo alimentas), su crecimiento y con qué lo alimentas. Toca un centro para ver sus elementos.'},
    {t: 'Enseñanzas', go: n => n.go('brain', {tab: 'teach'}), hl: '.toolbar', text: 'En **Enseñanzas** le das lo que sabes: reglas, estrategias, traders, lecciones o notas. La **estrella** la vuelve **regla maestra**. Si pegas la transcripción de un video, la resumo en reglas.'},
    {t: 'Recuerdos', go: n => n.go('brain', {tab: 'memories'}), hl: '#tabBody', text: 'Los **Recuerdos** llegan solos de tus apps cada 30 minutos: lo que creas, completas o borras en Nova Hub y lo que haces en VORTEX. Con la **×** el cerebro lo olvida.'},
    {t: 'Lo que sabe', go: n => n.go('brain', {tab: 'learned'}), hl: '.learn', text: 'Con todo eso escribe **«Lo que sé de ti»**: en qué estás, cómo operas, lo que repites y cómo mejorar. Aprende solo cada noche o con **Aprender ahora**. Abajo le dices **cómo quieres que te ayude**.'},
    {t: 'Conexión con VORTEX', go: n => n.go('brain', {tab: 'config'}), hl: '#tabBody', text: 'En los **Ajustes del cerebro** eliges de qué app aprende y si se lo pasa a la **IA de VORTEX**: así «Analizar gráfico» y el «Briefing» usan tus reglas y estrategias.'},
    {t: 'Preguntar', go: n => n.go('ask'), hl: '.askbar', text: 'Y en **Preguntar** platicas con cualquier cerebro: «¿qué errores repito?», «¿en qué proyectos me disperso?»… Responde con lo que sabe de ti.'},
    {t: 'Ajustes', go: n => n.go('settings'), hl: '.appicons', text: 'En **Ajustes** pausas las conexiones, eliges el **icono de la app** y me configuras a mí. ¡Eso es todo! Cuando tengas dudas, tócame.'}
  ];
  function tourStep(i) {
    document.querySelectorAll('[data-nr-hl]').forEach(e => e.removeAttribute('data-nr-hl'));
    if (i >= TOUR.length) return doAct('endtour'); tourI = i; const s = TOUR[i], n = NB();
    document.body.classList.add('nr-tour'); panel.classList.add('nr-mini'); s.go(n);
    setTimeout(() => { const el = document.querySelector(s.hl); if (el) { el.setAttribute('data-nr-hl', ''); el.scrollIntoView({behavior: REDUCED ? 'auto' : 'smooth', block: innerWidth < 980 ? 'start' : 'center'}); } }, 420);
    chat.push({role: 'assistant', step: `Recorrido · ${i + 1} de ${TOUR.length} · ${s.t}`, content: s.text, acts: i < TOUR.length - 1 ? [['Siguiente', 'next'], ['Salir', 'endtour']] : [['Terminar', 'endtour']]});
    saveChat(); paint(); mood(i % 2 ? 'look-r' : 'look-l'); setTimeout(() => mood('talk', 1200), 500);
  }
  function startTour() { if (!NB().snapshot().brains.length) return sayLocal('Primero inicia sesión para que te muestre tus cerebros.'); openP(); tourStep(0); }
  function endTour(quiet) { if (tourI < 0) return; tourI = -1; document.body.classList.remove('nr-tour'); panel.classList.remove('nr-mini'); document.querySelectorAll('[data-nr-hl]').forEach(e => e.removeAttribute('data-nr-hl')); if (!quiet) paint(); }

  /* ───────── Abrir / cerrar ───────── */
  function openP() {
    hideTip(); root.classList.add('out'); panel.classList.add('on');
    if (!chat.length) { const s = NB().snapshot(); chat.push({role: 'assistant', content: `¡Hola${s.name ? ', ' + s.name : ''}! Soy **Neura**, el alma de este icono. Te explico qué es cada cosa, cómo se conecta con **Nova Hub** y **VORTEX**, cómo va cada cerebro, y te llevo a donde quieras.`, acts: [['Hazme el recorrido', 'tour'], ['¿Cómo va mi cerebro?', 'q:¿Cómo van mis cerebros?']]}); saveChat(); mood('happy', 1800); }
    paint(); if (innerWidth > 720) setTimeout(() => $('#nrIn').focus(), 350);
  }
  function closeP() { panel.classList.remove('on'); root.classList.remove('out'); endTour(true); stopMic(); }
  av.addEventListener('click', () => { panel.classList.contains('on') ? closeP() : openP(); });
  $('#nrX').addEventListener('click', closeP);
  $('#nrClr').addEventListener('click', () => { chat = []; saveChat(); endTour(true); openP(); });
  panel.addEventListener('click', e => {
    const a = e.target.closest('[data-nra]'); if (a) { const v = a.dataset.nra; if (v.startsWith('q:')) ask(v.slice(2)); else doAct(v); return; }
    const q = e.target.closest('[data-nrq]'); if (q) { if (/recorrido/.test(q.dataset.nrq)) { chat.push({role: 'user', content: q.dataset.nrq}); startTour(); } else ask(q.dataset.nrq); }
  });
  $('#nrF').addEventListener('submit', e => { e.preventDefault(); const i = $('#nrIn'); const q = i.value; i.value = ''; i.style.height = 'auto'; stopMic(); ask(q); });
  $('#nrIn').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && innerWidth > 720) { e.preventDefault(); $('#nrF').requestSubmit(); } });
  $('#nrIn').addEventListener('input', e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(110, e.target.scrollHeight) + 'px'; });
  addEventListener('keydown', e => { if (e.key === 'Escape' && panel.classList.contains('on')) closeP(); });

  /* voz */
  let rec = null;
  function stopMic() { if (rec) { try { rec.stop(); } catch {} rec = null; } $('#nrMic').classList.remove('rec'); }
  $('#nrMic').addEventListener('click', () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) { NB().toast('Tu navegador no permite dictar'); return; }
    if (rec) return stopMic(); const el = $('#nrIn'); rec = new SR(); rec.lang = 'es-MX'; rec.interimResults = true; $('#nrMic').classList.add('rec'); mood('look-r');
    rec.onresult = e => { let t = ''; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; el.value = t; };
    rec.onend = () => { const q = el.value; stopMic(); mood(''); if (q.trim()) { el.value = ''; ask(q); } }; rec.onerror = () => stopMic(); rec.start();
  });

  /* ───────── Consejos (se asoma de vez en cuando) ───────── */
  const TIPS = {
    home: ['¿Sabías que puedes tener varios cerebros y entrenarlos distinto? Prueba uno para **scalping** o para **clientes**.', 'El punto verde en Nova Hub y VORTEX quiere decir que tus recuerdos están llegando bien.'],
    graph: ['Toca un **centro** de la red neuronal para ver qué hay dentro.', 'Las neuronas que brillan más son lo **nuevo de los últimos 2 días**.', 'Cada **regla maestra** suma 20 puntos de nivel: son lo que más pesa.'],
    teach: ['Pega la transcripción de un video de un trader y tócame **Resumir en reglas con IA** dentro de «Enseñar algo».', 'Marca con la estrella tus reglas más importantes: se vuelven **maestras**.'],
    memories: ['Si un recuerdo no te sirve, tócale la **×** y el cerebro lo olvida.', 'Los recuerdos llegan cada 30 minutos, aunque tengas todo cerrado.'],
    learned: ['Escribe abajo **cómo quieres que te ayude** este cerebro: lo usa al aprender y al responderte.'],
    ask: ['Prueba preguntarle «¿qué errores repito?» o «¿qué debería priorizar esta semana?».'],
    settings: ['Aquí eliges el **icono** de la app: hay 16.']
  };
  let tipT = 0, tipShownAt = 0, lastTip = '';
  function hideTip() { tipEl.classList.remove('on'); root.classList.remove('peek'); }
  function tip() {
    if (!cfg.on || !cfg.tips || root.hidden || panel.classList.contains('on') || document.hidden || document.querySelector('.sheet.on')) return;
    const s = NB().snapshot(), list = TIPS[s.view === 'brain' ? s.tab : s.view] || TIPS.home; let t = list[Math.random() * list.length | 0]; if (t === lastTip && list.length > 1) t = list.find(x => x !== t); lastTip = t;
    tipEl.innerHTML = md(t).replace(/^<div class="md">|<\/div>$/g, '') + '<small>Toca para platicar</small>'; root.classList.add('peek'); tipEl.classList.add('on'); mood('happy', 1500); tipShownAt = Date.now();
    clearTimeout(tipT); tipT = setTimeout(hideTip, 9000);
  }
  tipEl.addEventListener('click', () => { hideTip(); openP(); });
  setTimeout(() => { if (root.hidden || panel.classList.contains('on')) return; if (!localStorage.getItem('nb3_neura_hi')) { try { localStorage.setItem('nb3_neura_hi', '1'); } catch {} tipEl.innerHTML = '<b>¡Hola! Soy Neura.</b> Tócame y te explico cómo funciona tu cerebro.<small>Toca para platicar</small>'; root.classList.add('peek'); tipEl.classList.add('on'); clearTimeout(tipT); tipT = setTimeout(hideTip, 10000); } else tip(); }, 9000);
  setInterval(() => { if (Date.now() - tipShownAt > 4 * 6e4) tip(); }, 6e4);
  // mira hacia donde está el puntero (desktop)
  addEventListener('pointermove', e => { if (REDUCED || panel.classList.contains('on')) return; const r = av.getBoundingClientRect(); const dx = e.clientX - (r.left + r.width / 2); const ey = av.querySelector('.nr-eyes'); if (ey && !av.classList.contains('think')) ey.style.transform = `translate(${Math.max(-4, Math.min(4, dx / 120))}px,${Math.max(-3, Math.min(3, (e.clientY - r.top) / 160))}px)`; }, {passive: true});

  window.Neura = {open: openP, close: closeP, tour: startTour, ask, cfg: () => Object.assign({}, cfg), set(o) { Object.assign(cfg, o); saveCfg(); show(); }, refresh: show};
  addEventListener('nb-auth', show); show();
})();
