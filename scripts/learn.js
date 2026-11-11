#!/usr/bin/env node
/* NEURAL BRAIN · aprendizaje nocturno (GitHub Actions + Admin SDK).
   Para cada cerebro con recuerdos o enseñanzas nuevas desde su último aprendizaje, le pide a la IA gratuita
   que actualice «Lo que sé de ti» y lo guarda en el cerebro. Los cerebros conectados a VORTEX le pasan ese
   aprendizaje a la IA de VORTEX en la siguiente sincronización del conector.
   Sin FIREBASE_SERVICE_ACCOUNT no hace nada. Nunca imprime datos de usuarios (el repo es público). */
'use strict';
const L = require('../brain-learn.js');
const DAYS = 75;

async function run() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) { console.log('Sin FIREBASE_SERVICE_ACCOUNT: nada que hacer.'); return; }
  const admin = require('firebase-admin');
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
  const db = admin.firestore(), force = process.env.FORCE === '1', now = Date.now();
  const users = await db.collection('users').listDocuments(); let done = 0, skipped = 0, failed = 0;
  for (const u of users) {
    const brains = (await u.collection('brains').get()).docs; if (!brains.length) continue;
    const evs = (await u.collection('events').where('at', '>=', now - DAYS * 864e5).orderBy('at', 'desc').limit(2500).get()).docs.map(d => Object.assign({ id: d.id }, d.data()));
    for (const b of brains) {
      const brain = Object.assign({ id: b.id }, b.data()); if (brain.autoLearn === false) { skipped++; continue; }
      const notes = (await b.ref.collection('notes').get()).docs.map(d => d.data());
      const mine = L.brainEvents(brain, evs), since = (brain.learned && brain.learned.at) || 0;
      const fresh = mine.some(e => (e.sync || e.at || 0) > since) || notes.some(n => (n.updatedAt || n.createdAt || 0) > since);
      if (!force && !fresh) { skipped++; continue; }
      if (!notes.length && !mine.length) { skipped++; continue; }
      try {
        const r = await L.chat(L.learnMessages(brain, notes, mine, brain.owner || ''), { maxTokens: 1500, timeout: 120000 });
        await b.ref.set({ learned: { text: r.text, at: Date.now(), by: 'servidor · ' + r.model, events: mine.length, notes: notes.length } }, { merge: true });
        done++;
      } catch (e) { failed++; console.warn('Un cerebro no pudo aprender:', String(e.message || e).slice(0, 160)); }
    }
  }
  console.log(`Aprendizaje: ${done} cerebro(s) actualizados, ${skipped} sin novedades, ${failed} con error.`);
}
run().catch(e => { console.error('Error:', String(e.message || e).slice(0, 300)); process.exit(1); });
