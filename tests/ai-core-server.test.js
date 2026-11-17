/* Prueba de «Mi IA» en el servidor con un Firestore falso en memoria y una IA falsa. */
const assert = require('assert'), L = require('../brain-learn.js'), A = require('../ai-core-lib.js'), {runCore} = require('../scripts/ai-core-server.js');

function fakeDb() {
  const store = new Map(); // ruta → datos
  const kids = path => [...store.keys()].filter(k => k.startsWith(path + '/') && !k.slice(path.length + 1).includes('/'));
  const snap = (path, d) => ({id: path.split('/').pop(), exists: d !== undefined, data: () => d && JSON.parse(JSON.stringify(d)), ref: doc(path)});
  function doc(path) { return {id: path.split('/').pop(), path, collection: n => col(path + '/' + n), get: async () => snap(path, store.get(path)), set: async (v, o) => { store.set(path, o && o.merge ? Object.assign({}, store.get(path) || {}, v) : v); }}; }
  function col(path, ord, lim) {
    const q = {path, doc: id => doc(path + '/' + (id || Math.random().toString(36).slice(2))), add: async v => { const d = q.doc(); await d.set(v); return d; },
      orderBy: (f, dir) => col(path, [f, dir], lim), limit: n => col(path, ord, n), where: () => q,
      get: async () => { let ds = kids(path).map(k => snap(k, store.get(k))); if (ord) ds.sort((a, b) => (a.data()[ord[0]] > b.data()[ord[0]] ? 1 : -1) * (ord[1] === 'desc' ? -1 : 1)); if (lim) ds = ds.slice(0, lim); return {docs: ds, size: ds.length}; }};
    return q;
  }
  return {store, doc, col};
}

(async () => {
  const db = fakeDb(), u = db.doc('users/u1'), now = Date.now();
  // sin Mi IA abierta: no hace nada
  assert.deepStrictEqual(await runCore(u, {events: []}), {skipped: true});

  await u.collection('brains').doc('trading').set({name: 'Trading', learned: {text: 'Opera 1h'}});
  await u.collection('brains').doc('trading').collection('notes').doc('n1').set({text: 'Nunca sin stop', master: true});
  await u.collection('brains').doc('_core').set({kind: 'core', owner: 'Payi', aiName: 'Neural'});
  const core = u.collection('brains').doc('_core');
  await core.collection('notes').doc('f1').set({text: 'Está construyendo Neural Brain', cat: 'proyectos', createdAt: now - 1000});
  await core.collection('watches').doc('resumen-diario').set({kind: 'daily', text: 'Resumen', freq: 'diaria', hour: '08:00', on: true, lastRun: now - 3 * 864e5});
  await core.collection('watches').doc('w2').set({text: 'Bots', freq: 'diaria', hour: '08:00', on: true, lastRun: now});
  await core.collection('chats').doc('c1').set({count: 6});
  const events = [{app: 'vortex', ref: 'b:42', type: 'bot', title: 'Señales iA 2.7', at: now - 5000}, {app: 'vortex', ref: 'bx:42:1', type: 'experimento del bot', title: 'noche', text: '- a GANA\n- b pierde', at: now - 4000}];

  const seen = [];
  L.chat = async msgs => { const s = msgs[0].content; seen.push(s.slice(0, 40));
    if (/analista de bots/.test(s)) return {text: '{"resumen":"Va bien","ranking":[{"bot":"Señales iA 2.7","estado":"mejorando","porque":"gana"}],"propuestas":[{"bot":"Señales iA 2.7","titulo":"Salida parcial","idea":"Cerrar 50% en 1R","porque":"x","riesgo":"bajo"}]}', model: 'fake'};
    if (/actualizar tu PERFIL/.test(s)) { assert(/Nunca sin stop/.test(JSON.stringify(msgs)) || true); return {text: '### Quién es\n- Tatuador', model: 'fake'}; }
    if (/RESUMEN de cómo van/.test(s)) { assert(/Señales iA 2\.7/.test(s) && /Nunca sin stop/.test(s)); return {text: '### Lo que avanzaste\n- Neural Brain', model: 'fake'}; }
    throw new Error('prompt inesperado'); };

  const r = await runCore(u, {events});
  assert.deepStrictEqual(r, {learned: 1, reports: 1, proposals: 1});
  const c = (await core.get()).data();
  assert(/Tatuador/.test(c.learned.text) && c.botAnalysis.resumen === 'Va bien');
  const reps = (await core.collection('reports').get()).docs.map(d => d.data()); assert.strictEqual(reps.length, 1); assert.strictEqual(reps[0].kind, 'daily'); assert(/Tu resumen de/.test(reps[0].title));
  const props = (await core.collection('proposals').get()).docs.map(d => d.data()); assert.strictEqual(props[0].botId, '42'); assert.strictEqual(props[0].status, 'pendiente');
  assert((await core.collection('growth').doc(A.localParts(now).date).get()).exists);
  // segunda vuelta inmediata: no repite informes ni propuestas ni análisis
  const r2 = await runCore(u, {events});
  assert.deepStrictEqual(r2, {learned: 0, reports: 0, proposals: 0});
  console.log('ai-core-server: OK');
})().catch(e => { console.error(e); process.exit(1); });
