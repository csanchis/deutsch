# «Die leuchtende Hefe» — historia por entregas (1 episodio por unidad)

Fichero por unidad: `data/stories/<unit-id>.json` (build.py lo mete en `course.json` como `unit.story`).

```json
{
  "title": "Título del episodio en alemán",
  "title_es": "Traducción",
  "lines": [
    {"de": "Heidelberg, Montag, acht Uhr.", "es": "Heidelberg, lunes, las ocho."},
    {"who": "Jonas", "de": "Hallo! Ich bin Jonas.", "es": "¡Hola! Soy Jonas."}
  ],
  "gloss": [["die Hefe", "la levadura"], ["leuchten", "brillar"]],
  "q": [ {"t": "mc", "q": "¿Pregunta de comprensión en español?", "o": ["…", "…", "…"], "a": 0, "exp": "…"} ]
}
```
- `lines`: A1 10–14 líneas, A2 12–18. Cada línea = 1–2 frases cortas. `who` solo en diálogo (nombre del personaje).
- Gramática y vocabulario: SOLO lo de esta unidad y las anteriores (ver data/temario.json). Palabras nuevas imprescindibles → `gloss` (4–8).
- `q`: 3 preguntas de comprensión (tipos mc/read/gap/order/tr; normalmente mc en español).
- Cada episodio termina con un pequeño cliffhanger.

## Personajes
- **Lucía García** (29), bióloga de Valencia. Empieza el doctorado en Heidelberg en el laboratorio de la Prof. Wolf. Su proyecto: una levadura que brilla en la oscuridad (*die leuchtende Hefe*). Hace boxeo.
- **Jonas** (31), doctorando en el mismo laboratorio, simpático y caótico, siempre con café. Hace jogging. Aliado de Lucía.
- **Prof. Dr. Helga Wolf**, jefa del laboratorio, seria y estricta, pero justa.
- **Mia**, técnica de laboratorio (Laborassistentin), callada, nerviosa.
- **Herr Brandt**, conserje (Hausmeister) del instituto, mayor, gruñón.
- **Frau Becker**, vecina mayor de Lucía, cotilla y cariñosa. Tiene un gato que se llama **Einstein**.
- **Kai**, entrenador del club de boxeo «Neckar Boxen».
- **Felix** (35), el nieto de Frau Becker. Exdoctorando de la Prof. Wolf; hace años robó datos y se fue a la empresa berlinesa **NovaGen**. Ahora va al club de boxeo de Lucía. Es el culpable.

## Episodios
1. a1-01 — Lucía llega a Heidelberg; se presenta a Jonas y a la Prof. Wolf (heißen, kommen, wohnen; du/Sie). Conoce a Frau Becker. *Final:* en su mesa hay una nota: «Hallo Lucía. Ich kenne dich.»
2. a1-02 — Números: sala 42, código de la puerta, Jonas deletrea su apellido, la edad de Lucía. La nota tiene un número de teléfono. *Final:* llama un número desconocido… y nadie habla.
3. a1-03 — Quién trabaja en el instituto (profesiones: Professorin, Laborassistentin, Hausmeister). Lucía presenta su levadura. ¿Trabaja alguien de noche? Herr Brandt: «Nein.» *Final:* de noche, desde la calle, Lucía ve luz en el laboratorio.
4. a1-04 — Frau Becker enseña fotos de su familia; Lucía habla de la suya. *Final:* en una foto hay un joven con bata en el laboratorio de la Prof. Wolf: «Das ist mein Enkel Felix.»
5. a1-05 — Compras con Jonas en el mercado y la panadería (Akkusativ, möchten, precios). *Final:* de vuelta al laboratorio: falta una muestra de levadura. «Eine Probe ist weg!»
6. a1-06 — Lucía va al club de boxeo; Kai; un socio nuevo, Felix, muy simpático (verbos irregulares, gern/lieber). *Final:* en la bolsa de deporte de Felix hay una bata con el logo del instituto.
7. a1-07 — La rutina de Lucía; decide quedarse tarde. El registro de la puerta (horas). *Final:* alguien abrió la puerta a las 2:15 con el código de Herr Brandt.
8. a1-08 — En el piso de Lucía: descripción, algo ha cambiado; Einstein el gato está dentro. *Final:* su cuaderno de laboratorio (das Laborbuch) ha desaparecido.
9. a1-09 — La Prof. Wolf: «Sie müssen…»; Lucía y Jonas hacen planes y quedan (modales, citas, fechas). *Final:* Herr Brandt: «Ich kann nicht sprechen. Ich darf nicht.»
10. a1-10 — Lucía sigue a Herr Brandt por Heidelberg (Altstadt, puente, Bahnhof; imperativo, mit dem Bus, zum/zur). *Final:* Brandt se encuentra con Felix en una panadería y le da un sobre.
11. a1-11 — Lucía se hace daño en la mano boxeando; va al médico (Mir tut … weh, sollen, dürfen). *Final:* Kai le dice: «Felix fragt immer nach dir.»
12. a1-12 — Lucía cuenta a Jonas lo que hizo y vio el fin de semana (Perfekt); Jonas ha buscado a Felix en internet. *Final:* el incubador está vacío: todas las muestras han desaparecido.
13. a2-01 — La Prof. Wolf cuenta lo que pasó con Felix hace años (Perfekt avanzado). *Final:* Frau Becker: «Felix hat mich gestern besucht und einen Koffer mitgebracht.»
14. a2-02 — Frau Becker le da a Lucía la llave de la maleta (dativo: Ich gebe dir…, gehören). *Final:* dentro hay una nevera portátil vacía y un billete de tren Heidelberg–Berlín para el domingo.
15. a2-03 — Lucía y Jonas registran el laboratorio y ponen una cámara (Wo?/Wohin?, stellen/stehen, legen/liegen). *Final:* en el vídeo de la cámara se ve a Einstein… y una mano.
16. a2-04 — Hipótesis (weil, dass, wenn, ob). Herr Brandt confiesa: dio el código porque Felix dijo que era alumno de la Prof. Wolf. *Final:* «Ich glaube, dass er nicht allein ist.»
17. a2-05 — Sparring en el club: Felix es más grande y más fuerte, Lucía más rápida (comparativos). *Final:* Lucía ve un mensaje en el móvil de Mia para Felix: «Samstag, 8 Uhr».
18. a2-06 — Lucía describe a los sospechosos y la ropa (adjetivos): la chaqueta roja nueva de Mia, una maleta grande y gris. *Final:* Mia llega a la estación con una nevera azul.
19. a2-07 — Mia habla con Lucía: se avergüenza, se interesa por un trabajo en Berlín que Felix le prometió (reflexivos). *Final:* «Er hat die Hefe. Er fährt morgen nach Berlin.»
20. a2-08 — La Prof. Wolf recuerda: «Früher wollte Felix…» (Präteritum de modales); plan para mañana (werden). *Final:* Felix llama a Lucía: «Du solltest nicht nach Berlin kommen.»
21. a2-09 — Lucía escribe un email formal a NovaGen como candidata; entrevista en Berlín (Konjunktiv II: Ich würde gern…, Könnten Sie…). Ve su levadura brillando en una vitrina. *Final:* Felix entra en la sala.
22. a2-10 — Huida en tren, la estación, la policía (preguntas indirectas, vor/seit/ab, warten auf). Final feliz: la levadura vuelve, Felix detenido, Mia pide perdón, la Prof. Wolf orgullosa. Última escena: Einstein durmiendo encima del Laborbuch; hace sol en Heidelberg.
