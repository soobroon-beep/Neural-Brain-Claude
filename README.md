# Neural Brain · tu segundo cerebro

Una app (PWA) con varios **cerebros**. Cada uno aprende de:

- **Lo que le enseñas**: notas, reglas (las «maestras» siempre las toma en cuenta), estrategias, traders que sigues (pega su explicación y la IA la resume en reglas) y lecciones.
- **Tus recuerdos**: lo que creas, editas o borras en **Nova Hub** y lo que haces en **VORTEX** (seguimiento, alertas, ideas Long/Short, indicadores, scripts, bots y sus resultados, operaciones del diario y actualizaciones de la app). Llegan solos cada 30 minutos.

Con eso escribe **«Lo que sé de ti»** (cada noche, o con «Aprender ahora») y le puedes **preguntar** lo que quieras. Los cerebros con **«Pasárselo a la IA de VORTEX»** le mandan sus reglas, estrategias y lo aprendido a «Analizar gráfico» y al «Briefing del día» de VORTEX (Nexus Pixel no lo usa).

La IA es gratuita (Pollinations, la misma clave de VORTEX). Los datos viven en Firebase (proyecto `neural-brain-148a4`), por cuenta de Google.

## Cómo se conecta todo

```
Nova Hub (Firestore nova-hub-2a8a0) ──┐  conector cada 30 min (GitHub Actions del repo Nova-HUB)
                                      ├──► Neural Brain (neural-brain-148a4) users/{uid}/events
VORTEX  (Firestore criptochart-bd774)─┘  conector cada 30 min (GitHub Actions del repo de VORTEX)
                                           │  aprendizaje nocturno (este repo) → brains/{id}.learned
VORTEX users/{uid}/data/brain ◄────────────┘  el conector de VORTEX devuelve lo aprendido
```

- El conector **no cambia nada** en Nova Hub ni en VORTEX: compara con la última vez y manda las diferencias.
- Encuentra tu cuenta en cada app por el **mismo correo de Google** con el que entras a Neural Brain.
- En Neural Brain → Ajustes puedes pausar Nova Hub o VORTEX; en cada cerebro eliges de qué app aprende.

## Permisos (ya hechos)

No hay llaves nuevas. Las cuentas de servicio que Nova Hub y VORTEX ya usan en GitHub (`firebase-adminsdk-fbsvc@nova-hub-2a8a0…` y `firebase-adminsdk-fbsvc@criptochart-bd774…`) tienen el rol **Usuario de Cloud Datastore** en el proyecto `neural-brain-148a4` (IAM). Con eso:

- El conector de cada app escribe tus recuerdos en el cerebro.
- El aprendizaje nocturno corre desde el repo de VORTEX (`.github/workflows/brain-learn.yml`), que descarga este repo y ejecuta `scripts/learn.js`.
- Las reglas de `firestore.rules` se publican a mano en Firebase Console → Firestore → Reglas.

Para desconectar todo: quita esas dos cuentas en IAM de `neural-brain-148a4`, o pausa cada app en Neural Brain → Ajustes.

## Archivos

- `index.html` — la app nueva (liquid glass). `legacy.html` — la versión anterior.
- `brain-learn.js` — cómo aprende y responde un cerebro (lo usan la app y el servidor).
- `scripts/learn.js` — aprendizaje nocturno (3:20 a. m.); lo ejecuta el workflow `brain-learn.yml` del repo de VORTEX.
- `firestore.rules` — cada quien solo ve lo suyo; los recuerdos solo los escribe el conector.
- El conector vive en cada app: `scripts/brain-sync.js` + `.github/workflows/brain-sync.yml`.

Pruebas: `node tests/brain-learn.test.js`
