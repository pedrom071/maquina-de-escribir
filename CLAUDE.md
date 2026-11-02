# Instrucciones para Claude en este repositorio

Máquina de escribir: editor, revisor y biblia para proyectos de escritura, de Pedro Maiz. Responde en español de Chile.

## Reglas del producto
- El revisor señala; no reescribe ni propone trama, escenas ni argumentos. Mantén esto en cualquier prompt o regla nueva.
- El texto manda sobre la biblia: la biblia se actualiza con el texto (incluso cuando se borra algo), no al revés. Solo se marca el texto cuando algo nuevo contradice lo que el propio texto ya había establecido.
- La revisión rápida (src/js/15-checker.js) no usa IA y debe seguir funcionando sin conexión.
- La clave de IA de cada persona se guarda solo en su navegador y el texto va directo al proveedor. No agregar servidores intermedios sin que Pedro lo pida.
- No subir textos personales de Pedro (novela u otros) al repositorio, ni en pruebas.

## Flujo
1. Edita `src/` o `web/`.
2. `python3 build.py` (revisa sintaxis y genera `docs/` y `dist/`).
3. `npm test`.
4. Commit en español con mensaje claro, incluyendo `docs/`.

GitHub Pages publica `docs/` desde `main`.
