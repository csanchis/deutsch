# Deutsch jeden Abend

Curso personal de alemán A1→A2: 22 unidades (clase guiada con preguntas, vocabulario, ejercicios, episodio de historia, práctica oral y test),
~1300 palabras con repetición espaciada, guía de pronunciación para hispanohablantes con reconocimiento de voz,
y barra de progreso con fecha estimada para A2.

- Web estática (GitHub Pages). Instalable en el móvil: «Añadir a pantalla de inicio».
- Progreso: `localStorage` + Supabase (tabla `docs`, fila `deutsch/state`, configuración en `config.js`).
- Historia por entregas «Die leuchtende Hefe»: `data/stories/<unidad>.json` (argumento en `data/stories/README.md`). Textos de boxeo: `data/boxen.json`.
- Contenido: `data/units/*.json` (formato en `data/SCHEMA.md`), `data/words.json`, `data/aussprache.json`, `data/grammar.json`.
- Tras editar unidades: `python3 build.py` (genera `data/course.json` y valida los ejercicios). Si cambian ficheros, sube la versión `C` en `sw.js`.
