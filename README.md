# Máquina de escribir

Editor, revisor y biblia para proyectos de escritura: novela, cuento, ensayo, columna, guion o poesía. Escribes en la hoja; el revisor deja notas al margen y tú decides qué hacer con ellas. Nunca reescribe ni propone trama.

**Úsala aquí:** https://pedrom071.github.io/maquina-de-escribir/

Funciona en el navegador, sin cuenta y sin conexión, y se puede instalar como app desde el menú del navegador ("Instalar" o "Agregar a pantalla de inicio").

## Qué hace

- **Proyectos y capítulos.** Varios proyectos, cada uno con capítulos (o partes, secciones, escenas), papelera y meta de palabras.
- **Editor.** Hoja continua, deshacer propio, modo foco tipo máquina de escribir, ecos (palabras repetidas cerca) y conteo diario.
- **Revisión rápida, sin IA.** Mientras escribes marca ortografía (diccionario de español), palabras repetidas seguidas, puntuación y signos de apertura, frases demasiado largas, ecos, muletillas y nombres que no coinciden con la biblia. Es gratis, instantánea y funciona sin conexión. Las palabras propias se agregan a tu diccionario.
- **Revisión con IA, con tu propia clave.** Con una clave de Anthropic (Claude), OpenAI o un servicio compatible (OpenRouter, Ollama), revisa coherencia y ambigüedades, hace informes del capítulo, extrae datos a la biblia y responde preguntas sobre tu texto. La clave se guarda solo en tu navegador y el texto va directo al proveedor que elijas.
- **Notas.** Marcas propias, respuestas, correcciones aplicables, resueltas y cabos sueltos.
- **Biblia.** Fichas por sección (personajes, lugares, mundo…), apariciones en el texto, cabos sueltos y decisiones.
- **Diagramas.** Mapa de relaciones y línea de tiempo que compara el orden de la historia con el orden del relato. Se exportan en SVG y PNG.
- **Historial.** Versiones automáticas y manuales por capítulo, comparación palabra por palabra y restauración.
- **Importar y exportar.** Word (.docx, con las notas como comentarios), Markdown, texto, HTML y respaldo .json.
- **Apariencia.** Temas, modo claro u oscuro, color de acento, tipografías, tamaño de letra, interlineado, ancho de hoja, márgenes y lado de las notas.

## Tus datos

Sin cuenta, todo vive en tu navegador (IndexedDB): proyectos, apariencia, diccionario y clave de IA. Descarga un respaldo completo de vez en cuando desde **Tu perfil y apariencia → Tus datos**; con él puedes llevar tus textos a otro computador. Las cuentas con correo y la colaboración en vivo vendrán en una etapa siguiente.

## Cómo está armado

```
src/js/          módulos de la app (se unen en un solo archivo)
src/style.css    diseño
src/body.html    esqueleto para la versión de claude.ai
web/             piezas de la app web: shell, service worker, manifiesto, íconos,
                 corrector ortográfico (spell-worker) y diccionario
docs/            app web construida; es lo que publica GitHub Pages
build.py         construye docs/ y dist/maquina-de-escribir.html
test/            pruebas: fusión y sincronización, app web, uso sin conexión
```

El mismo código corre en dos lugares: como app web (guardado en el navegador, IA con clave propia) y como página dentro de claude.ai (guardado en la nube de la página, IA de la cuenta de claude.ai, colaboración en vivo). `src/js/02-store.js` y `src/js/02b-web.js` deciden cuál usar.

## Desarrollo

```
npm install          # dependencias para pruebas y para reconstruir el corrector
python3 build.py     # genera docs/ y dist/
npm run serve        # abre la app en http://localhost:8000
npm test
```

Después de cambiar algo en `src/` o `web/`, corre `python3 build.py` y sube también `docs/`.

## Créditos

Diccionario de español: proyecto RLA-ES (licencias GPL, LGPL o MPL). Corrector: nspell. Lectura de Word: mammoth. Escritura de Word: JSZip.

Hecho con Claude.
