# Neural Brain · tu segundo cerebro

Una app (PWA) con varios **cerebros**. Cada uno aprende de:

- **Lo que le enseñas**: notas, reglas (las «maestras» siempre las toma en cuenta), estrategias, traders que sigues (pega su explicación y la IA la resume en reglas) y lecciones.
- **Tus recuerdos**: lo que creas, editas o borras en **Nova Hub** y lo que haces en **VORTEX** (seguimiento, alertas, ideas Long/Short, indicadores, scripts, bots y sus resultados, operaciones del diario y actualizaciones de la app). Llegan solos cada 30 minutos.

Con eso escribe **«Lo que sé de ti»** (cada noche, o con «Aprender ahora») y le puedes **preguntar** lo que quieras. Los cerebros con **«Pasárselo a la IA de VORTEX»** le mandan sus reglas, estrategias y lo aprendido a «Analizar gráfico» y al «Briefing del día» de VORTEX (Nexus Pixel no lo usa).

La IA es gratuita (Pollinations, la misma clave de VORTEX). Los datos viven en Firebase (proyecto `neural-brain-148a4`), por cuenta de Google.

## Mi IA · tu IA personal

En el dock, **Mi IA** es una IA que te conoce por **todo** lo que guarda Neural Brain a la vez: todos tus cerebros, tus recuerdos de Nova Hub y VORTEX, su propia memoria de tus conversaciones, tu Google Calendar y Gmail (si los conectas) y tus bots de Nova Bot Lab. No se entrena desde cero: usa modelos abiertos gratuitos (la misma cadena de Nova Hub y VORTEX) y lo que **crece es su memoria**.

- **Chat**: conversaciones guardadas. Después de cada respuesta guarda en su memoria lo nuevo que le contaste de ti (sin repetir). Le das 👍/👎 y cada noche aprende cómo te gusta que te responda. Cuando conviene, propone **acciones que tú confirmas**: vigilar algo, recordar algo, enseñarlo a un cerebro o una mejora para un bot.
- **Crecimiento**: un núcleo de neuronas que se hace más grande mientras más sabe, nivel y etapa (Semilla → Núcleo maestro), crecimiento de 45 días, nivel con el tiempo (una foto por día) y su red neuronal (tus cerebros y su memoria).
- **Vigilancias**: lo que vigila por ti (de inicio: resumen diario 8:00 y revisión de bots 21:00) e **informes** con alertas. Corren al abrir la app cuando les toca y el servidor las revisa cada noche.
- **Bots**: cómo va cada bot (versiones, noches de experimentos, % de ideas que ganan, paper trading y tendencia), análisis con IA y **mejoras propuestas**. Al aprobar una, se guarda como lección en el cerebro del bot para que la pruebe en sus experimentos; la versión final la sigues aprobando tú en VORTEX → Nova Bot Lab.
- **Memoria**: su perfil «Lo que sabe de ti» y los hechos que recuerda. Puedes contarle algo o hacer que olvide.
- **Conexiones**: Google Calendar y Gmail (solo lectura), estado de tus apps, avisos, su nombre y cómo quieres que te hable.

Datos: `users/{uid}/brains/_core` (oculto en la lista de cerebros) con `notes` (memoria), `chats`, `msgs`, `watches`, `reports`, `proposals`, `feedback` y `growth`. Las reglas actuales de `firestore.rules` ya lo cubren: no hay que publicar nada.

Por la noche, `scripts/learn.js` llama a `scripts/ai-core-server.js`: actualiza tu perfil, corre las vigilancias pendientes (incluido el resumen), analiza los bots si hubo datos nuevos y guarda la foto del día.

**Google (una sola vez):** en Google Cloud del proyecto `neural-brain-148a4` habilita la [API de Google Calendar](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com?project=neural-brain-148a4) y, si quieres correo, la [API de Gmail](https://console.cloud.google.com/apis/library/gmail.googleapis.com?project=neural-brain-148a4). Si al conectar Google dice «app no verificada», es tu propia app: «Configuración avanzada» → «Ir a Neural Brain».

**Para tus agentes:** un agente se conecta leyendo esta misma memoria y escribiendo sus resultados en `reports` (aparecen en Vigilancias) y sus ideas en `proposals` (aparecen en Bots para que las apruebes).

Archivos: `ai-core-lib.js` (prompts y lógica, compartida con el servidor), `ai-core.js` (la pantalla), `scripts/ai-core-server.js` (la parte nocturna). Pruebas: `node tests/ai-core.test.js && node tests/ai-core-server.test.js`.

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
