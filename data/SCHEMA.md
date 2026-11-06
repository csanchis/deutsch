# Formato de una unidad (data/units/<id>.json)

Alumna: Claudia, hispanohablante (España), adulta, científica; aprende alemán con clases + autoestudio por la noche.
Intereses para los ejemplos: boxeo, gimnasio/ejercicio, compras, cocina, ciencia/laboratorio, viajes (Heidelberg, Berlín, Madrid, Valencia).
Todo el texto explicativo en **español**; los ejemplos en alemán estándar correcto (Hochdeutsch). Nivel MCER estricto: no uses estructuras de unidades posteriores en ejercicios.

```json
{
  "id": "a1-03",
  "level": "A1",
  "n": 3,
  "title": "Título en alemán",
  "title_es": "Título en español",
  "goals": ["Objetivo 1 en español (puedo…)", "..."],
  "lessons": [
    {"h": "Encabezado", "html": "<p>Explicación clara…</p><table>…</table>"}
  ],
  "vocab": [ {"de": "Küche", "art": "die", "pl": "Küchen", "es": "cocina", "ex": "Die Küche ist klein."} ],
  "exercises": [ ...ejercicios... ],
  "speak": [ {"de": "Ich komme aus Spanien.", "es": "Soy de España.", "tip": "«ch» de «ich» suave, como un gato que bufa"} ],
  "test": [ ...ejercicios... ]
}
```

## lessons
3–5 bloques. Cada bloque puede llevar además, para la clase guiada (#leccion):
- `"pre"`: una pregunta `mc` «¿Qué crees?» antes del bloque (no puntúa; su `exp` revela la regla).
- `"check"`: 2–3 ítems (cualquier tipo de ejercicio) después del bloque, solo sobre lo explicado en él.
El HTML del bloque se trocea solo en diapositivas (por párrafos/tablas).

3–5 bloques. HTML permitido: `p b i em strong ul ol li table thead tbody tr th td br`, y `<span class="de">…</span>` para marcar alemán dentro del texto (se podrá escuchar). Explicaciones breves, con tablas para paradigmas, contraste con el español y errores típicos de hispanohablantes ("ojo:"). Nada de `<script>`, estilos o enlaces.

## vocab
15–25 palabras clave de la unidad. `art` (der/die/das) solo en sustantivos; `pl` plural si es sustantivo contable (opcional); `ex` frase de ejemplo corta del nivel.

## Tipos de ejercicio (exercises: 14–20, mezclando tipos; test: 10–12, sin repetir ítems de exercises)
- Elección múltiple: `{"t":"mc","q":"Pregunta o frase con ___","o":["op1","op2","op3"],"a":0,"exp":"por qué (español)"}` — `a` = índice correcto.
- Hueco escrito: `{"t":"gap","q":"Ich ___ aus Spanien.","a":["komme"],"hint":"kommen","exp":"…"}` — `a` lista de respuestas aceptadas (sin el resto de la frase). Un solo hueco `___`.
- Ordenar: `{"t":"order","w":["komme","Ich","aus","Spanien"],"a":"Ich komme aus Spanien.","es":"Soy de España."}`; `"alt"`: otras ordenaciones válidas (opcional) — `w` desordenadas, `a` frase correcta con mayúsculas y punto.
- Dictado: `{"t":"listen","de":"Wie heißt du?","es":"¿Cómo te llamas?"}` — se reproduce con voz y la alumna escribe.
- Traducir: `{"t":"tr","es":"Vivo en Madrid.","a":["Ich wohne in Madrid."]}` — varias variantes válidas si las hay.
- Emparejar: `{"t":"match","p":[["der Hund","el perro"],["die Katze","el gato"],["das Pferd","el caballo"],["der Vogel","el pájaro"]]}` — 4–5 pares.
- Leer y responder: `{"t":"read","text":"Texto corto en alemán (3–6 frases)","q":"Pregunta en español","o":["…","…","…"],"a":1}`.

## speak
5–8 frases útiles de la unidad para decir en voz alta, con `tip` de pronunciación cuando haya un sonido difícil para un hispanohablante.

Revisa que el JSON sea válido, que cada `a` sea correcto y que no haya ambigüedades (si dos opciones podrían valer, cambia el ítem).
