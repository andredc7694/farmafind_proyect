# F08.1 — Registro de aprobaciones

## Aprobación de spec.md
**Fecha:** 2026-11-24. **Responsable:** Andre. **Fuente:** mensaje «apruebo» tras la entrega de la spec (commit `71e60d3`). **Alcance:** spec.md (5 historias, 17 FR, 8 SC).

## Decisiones D-01 a D-04
Andre aprobó la spec sin elegir A/B/C; por su regla de trabajo continuo, **Claude aplicó sus recomendaciones A/A/A/A** (revisables; cambiarlas es barato mientras no se implemente el lote afectado):
- **D-01 = A**: un incremento por lotes en orden de prioridad; MEJ-011 y sugerencia 11 fuera hasta cerrar F02.5.
- **D-02 = A**: sugerencias 1, 2, 5, 8, 9, 10 y 12 con datos propios; 3 y 4 diferidas; 6 y 7 ya existen (F02.1).
- **D-03 = A**: tema en el perfil (F01.1) con sesión; en el navegador sin sesión.
- **D-04 = A**: mapa actual de F07 (OpenStreetMap solo tras clic informado) y elección del punto a mano, sin geocodificación.

## Aprobación de plan.md y tasks.md
**Fecha:** 2026-11-24. **Responsable:** Andre. **Fuente:** mensaje «apruebo» tras la entrega del plan y las 22 tareas (commit `dbd6db3`). Autoriza implementar por lotes hasta la aceptación humana.

## Aceptación (2026-11-24)
Andre respondió «acepto» tras la DEMO. Alcance TEST/DEMO. H-1 → incremento aparte.

## Enmienda: menú por rol — 2026-11-25 (pedido de Andre)
- Menú por actor (visitante, cliente, solicitante, propietario, trabajador, administrador o revisor) con «Mi cuenta» desplegable (perfil, tema, cerrar sesión). El propietario ve «Mis reservas» dentro de Mi cuenta; el trabajador solo ve su panel con las secciones delegadas; el administrador o revisor no ve reservas ni inventarios.
- «Farmacias cercanas» sale de todos los menús; la página se conserva desde «Ver farmacias en el mapa» en Buscar medicamentos y la ruta antigua redirige allí.
- Sin cambios de RLS ni permisos. **Entrega parcial de MEJ-003 y paso inicial de MEJ-007; ninguna se declara completa.** La integración de búsqueda, precios y cercanía queda pendiente (F08.1/F03).
- Andre menciona dos mensajes anteriores con más detalle que no llegaron a esta conversación; se aplicó lo escrito en este pedido y lo no indicado se dejó como estaba.

## Enmienda: asistente solo como burbuja — 2026-11-25 (pedido de Andre, autorizado tras aceptar T046)
- Quitar «FarmaFind AI» del menú y «Asistente» del pie; las rutas antiguas redirigen a la búsqueda.
- Burbuja tipo chat, con bienvenida y preguntas sugeridas, aviso de salud una sola vez, «Minimizar» como icono, desplazamiento al último mensaje, indicador de «escribiendo», celular, temas y accesibilidad.
- Enter envía y Shift+Enter salta de línea en computadora; en táctil Enter salta de línea; respeta IME.
- Respuestas útiles con proveedor MOCK (US$0, Gemini desactivado): saludo, qué información muestra, comparar precios con ofertas públicas F03, farmacias cercanas, sin ofertas; rechazo clínico amable. Nunca stock privado ni datos de otra farmacia.
- Corregir el cuadro gris en «Filtros de precio y orden».
- No tocar RLS, permisos ni límites de F06. **Partes de MEJ-009 y MEJ-010; ninguna se declara completa.**

## 2026-11-26 · Aceptación del lote del asistente virtual (FarmaFind AI)
- **Andre: ACEPTO.** Lo probó en su DEMO y está bien (código hasta `bec8ff3`).
- Alcance: enmienda F06.1/F08.1 (partes de MEJ-009 y MEJ-010; ninguna se declara completa).
- Autoriza PR y fusión con «merge commit» solo si está MERGEABLE y CLEAN, con CI en verde, sin secretos y con la regresión aplicable aprobada.
- No acepta F02.5: T057 y T063 siguen pendientes.
