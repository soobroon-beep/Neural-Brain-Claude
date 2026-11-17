const assert = require('assert'), A = require('../ai-core-lib.js'), L = require('../brain-learn.js');

// nivel y tamaño crecen con lo que sabe
const k0 = A.knowledge({}), k1 = A.knowledge({notes: 20, events: 500, facts: 30, msgs: 40, learned: 1});
assert.strictEqual(k0.level, 1); assert(k1.level > 5 && k1.size > k0.size && k1.size <= 1 && k1.stage !== 'Semilla');

// bots: agrupa por id, cuenta ideas ganadoras y saca tendencia
const H = 3600e3, ev = [
  {app: 'vortex', ref: 'b:42', type: 'bot', title: 'Señales iA 2.7', at: 1e12},
  {app: 'vortex', ref: 'bv:42:3', type: 'versión del bot', title: 'v3 con filtro EMA', at: 1e12 + H},
  ...[0, 1, 2, 3].map(i => ({app: 'vortex', ref: 'bx:42:' + i, type: 'experimento del bot', title: i === 3 ? 'propuesta: salida parcial' : 'noche ' + i, text: `- idea A ${i > 1 ? 'GANA' : 'pierde'}\n- idea B pierde`, at: 1e12 + i * 86400e3})),
  ...[-1.2, -0.4, 0.8, 1.9].map((v, i) => ({app: 'vortex', ref: 'bp:42:' + i, type: 'paper trading', title: `Paper ${v}%`, at: 1e12 + i * 86400e3 + 5})),
  {app: 'novahub', ref: 'b:1', type: 'nota', title: 'no es bot', at: 1}
];
const bots = A.botStats(ev);
assert.strictEqual(bots.length, 1); const b = bots[0];
assert.strictEqual(b.name, 'Señales iA 2.7'); assert.strictEqual(b.experiments, 4); assert.strictEqual(b.ideasTried, 8); assert.strictEqual(b.ideasWon, 2); assert.strictEqual(b.proposals, 1);
assert.strictEqual(b.trend, 'mejorando'); assert(/Señales iA 2.7 \[id 42\]/.test(A.botsBlock(bots)));
assert.strictEqual(A.pct('PnL −2,5 %'), -2.5);

// acciones: se separan del texto y solo las válidas
const pa = A.parseActions('Claro, lo vigilo.\n[[accion]]{"tipo":"vigilar","texto":"bot 2.7 pierde más de 3%","frecuencia":"diaria","hora":"09:00"}[[/accion]]\n[[accion]]{"tipo":"borrar_todo"}[[/accion]]');
assert.strictEqual(pa.text, 'Claro, lo vigilo.'); assert.strictEqual(pa.actions.length, 1); assert.strictEqual(pa.actions[0].tipo, 'vigilar');

// memoria: no repite lo que ya sabe
const facts = [{text: 'Está construyendo Neural Brain como su segundo cerebro', cat: 'proyectos'}];
const nf = A.parseFacts('```json\n{"hechos":[{"texto":"Está construyendo Neural Brain como su segundo cerebro personal","categoria":"proyectos"},{"texto":"Opera en temporalidad de 1 hora","categoria":"Trading"}]}\n```', facts);
assert.strictEqual(nf.length, 1); assert.strictEqual(nf[0].cat, 'trading');

// vigilancias: horario diario, semanal y cada N horas
const at = (d, h, m) => Date.parse(`2026-11-${d}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00-06:00`);
const w = {freq: 'diaria', hour: '08:00', lastRun: at(16, 8, 1)};
assert.strictEqual(A.watchDue(w, at(17, 7, 59)), false, 'antes de las 8 no toca');
assert.strictEqual(A.watchDue(w, at(17, 8, 2)), true, 'a las 8 de hoy toca');
assert.strictEqual(A.watchDue({...w, lastRun: at(17, 8, 3)}, at(17, 20, 0)), false, 'ya corrió hoy');
assert.strictEqual(A.watchDue({freq: 'semanal', dow: 1, hour: '09:00', lastRun: at(9, 9, 5)}, at(17, 10, 0)), true, 'lunes 16 ya pasó');
assert.strictEqual(A.watchDue({freq: 'semanal', dow: 1, hour: '09:00', lastRun: at(16, 9, 5)}, at(17, 10, 0)), false);
assert.strictEqual(A.watchDue({freq: 'cada6h', lastRun: at(17, 1, 0)}, at(17, 7, 1)), true);
assert.strictEqual(A.watchDue({freq: 'diaria', on: false}, at(17, 9, 0)), false);
assert.deepStrictEqual(A.parseWatch('**ALERTA: el bot 2.7 cayó 4%**\n- detalle').alert, true);

// el contexto junta todo y trae el recuerdo relacionado
const sys = A.coreSystem({name: 'Payi', L, q: '¿cómo va el bot 2.7?', events: ev, facts, bots, brains: [{name: 'Trading', masters: ['Nunca sin stop'], learned: 'Opera 1h'}],
  gcal: {at: 1, events: [{when: 'mar 17 nov 12:00', title: 'Cita tatuaje koi', cal: '🔥Tatuajes🔥', endMs: Date.now() + 1e9}]}, watches: [{text: 'Resumen diario', freq: 'diaria', hour: '08:00'}]});
assert(/Nunca sin stop/.test(sys) && /Cita tatuaje koi/.test(sys) && /Señales iA 2\.7/.test(sys) && /Resumen diario/.test(sys) && /segundo cerebro/.test(sys) && /\[\[accion\]\]/.test(sys));

// análisis de bots: arregla ids por nombre
const pb = A.parseBots('{"resumen":"ok","ranking":[{"bot":"señales ia 2.7","estado":"mejorando","porque":"x"}],"propuestas":[{"bot":"Señales iA 2.7","titulo":"Salida parcial","idea":"Cerrar 50% en 1R","porque":"ganó 2 noches","riesgo":"bajo"}]}', bots);
assert.strictEqual(pb.propuestas[0].botId, '42'); assert.strictEqual(pb.ranking[0].botId, '42');
assert(/IDEA APROBADA/.test(A.approvedNote(pb.propuestas[0])));
console.log('ai-core: OK');
