# Deutsch jeden Abend

Curso personal de alemán A1→A2: 22 unidades (explicación, vocabulario, ejercicios, práctica oral y test),
~1300 palabras con repetición espaciada, guía de pronunciación para hispanohablantes con reconocimiento de voz,
y barra de progreso con fecha estimada para A2.

- Web estática (GitHub Pages). Instalable en el móvil: «Añadir a pantalla de inicio».
- Progreso: `localStorage` + Supabase (tabla `docs`, fila `deutsch/state`, configuración en `config.js`).
- Contenido: `data/units/*.json` (formato en `data/SCHEMA.md`), `data/words.json`, `data/aussprache.json`, `data/grammar.json`.
- Tras editar unidades: `python3 build.py` (genera `data/course.json` y valida los ejercicios). Si cambian ficheros, sube la versión `C` en `sw.js`.
