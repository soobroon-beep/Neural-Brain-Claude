const assert = require('assert'), L = require('../brain-learn.js');
const brain = {name: 'Trading', sources: ['vortex'], instructions: 'Ayúdame a no sobreoperar', learned: {text: 'Opera en 1h y 4h'}};
const evs = [{app: 'vortex', act: 'cerró', type: 'operación', title: 'LONG BTCUSDT · 50 USD', text: 'entrada 100', at: 2e12}, {app: 'novahub', act: 'creó', type: 'nota', title: 'Koi', text: 'tatuaje', at: 2e12 + 1}];
const mine = L.brainEvents(brain, evs); assert.strictEqual(mine.length, 1);
const m = L.learnMessages(brain, [{text: 'Nunca sin stop', master: true}, {text: 'Retroceso a la nube', kind: 'estrategia', author: 'Ana'}], mine, 'Payi');
assert(/Payi/.test(m[0].content) && /REGLA MAESTRA\] Nunca sin stop/.test(m[1].content) && /\[Estrategia · Ana\]/.test(m[1].content) && /Cerró operación: LONG BTCUSDT/.test(m[1].content) && /Opera en 1h y 4h/.test(m[1].content));
const sys = L.askSystem(brain, [], [{app: 'vortex', act: 'cerró', type: 'operación', title: 'SHORT ETHUSDT', text: 'perdió', at: 1}, ...Array.from({length: 100}, (_, i) => ({app: 'vortex', act: 'creó', type: 'alerta', title: 'X' + i, text: '', at: 10 + i}))], '¿cómo me fue con ETHUSDT?');
assert(/SHORT ETHUSDT/.test(sys), 'trae el recuerdo relacionado aunque sea viejo');
(async () => {
  let calls = 0; const fake = async (url) => { calls++; if (calls < 2) return {ok: false, status: 429}; return {ok: true, json: async () => ({choices: [{message: {content: 'Hola, ya aprendí.'}}]})}; };
  const r = await L.chat([{role: 'user', content: 'x'}], {fetch: fake}); assert.strictEqual(r.text, 'Hola, ya aprendí.'); assert.strictEqual(calls, 2);
  console.log('brain-learn: OK');
})();
