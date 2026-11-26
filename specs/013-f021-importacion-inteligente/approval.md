# Aprobación SDD F02.1

**Fecha:** 2026-11-22 (America/Lima).
**Responsable:** propietario del proyecto FarmaFind.
**Fuente:** mensaje de esta conversación «apruebo todo asi que empieza ya de una vez», posterior a la presentación de `plan.md`, sus decisiones y 38 tareas.

Quedan aprobados la [especificación](spec.md) de MEJ-001 y errores de importación de MEJ-002, y el [plan técnico](plan.md) presentado. Se autoriza implementar y verificar las tareas de [tasks.md](tasks.md) dentro de ese alcance, sin extender MEJ-002 a autenticación, reservas, permisos o geolocalización.

La aprobación no cierra F02.5 ni sus pendientes T046/T057/T063/F025-RF23, no autoriza datos reales, AWS, Gemini, bases persistentes ni elusión de PostgreSQL RLS o del ruleset de GitHub. El plan no equivale a aceptación funcional; T038 requiere evidencia y revisión humana posterior.

## Aceptación humana final T038 — 2026-11-23

**Fecha:** 2026-11-23 (America/Lima). **Responsable:** propietario del proyecto FarmaFind. **Decisión:** «ACEPTO» (mensaje de esta conversación). **Alcance:** F02.1 en TEST/DEMO según [acceptance.md](acceptance.md), con los límites y pendientes allí registrados. No autoriza integración a `main`, datos reales, AWS ni la apertura de otros incrementos más allá de lo indicado en la autorización de trabajo continuo del mismo día.

## Enmienda F02.1 — 2026-11-25 (aprobada por Andre tras T046 no aprobada)
Andre aprobó la corrección con estas decisiones (y un complemento al punto 6):
1. **Un solo paso:** al elegir el archivo se analiza solo y se muestra la vista previa; sin botón «Analizar», sin descarga de plantilla y sin formulario de columnas visible (queda en «Ajustar columnas»). Solo se pregunta por el dato imprescindible que falte o sea ambiguo.
2. **Celdas con fecha o fórmula:** opción A (leer solo texto y números de la hoja elegida; señalar la celda problemática con hoja, celda, causa y solución; nunca evaluar). Ignorar hojas sin datos de inventario.
3. `categoria_terapeutica` no es la clasificación; la clasificación es `condicion_venta`.
4. **Stock:** buscar en todas las hojas e informar hoja y columna; no inventarlo.
5. **Productos ausentes del catálogo:** mostrarlos como «pendientes de catálogo», sin descartarlos ni equipararlos.
6. Diccionario ampliado y mensajes específicos en lugar del genérico. **Complemento:** detector determinista (sin IA ni APIs externas) que combina nombre normalizado con coincidencia flexible, análisis del contenido (precio, concentración, presentación, condición de venta, enteros) y puntuación combinada; ante empate real pregunta solo por ese campo y no asigna en silencio un campo clínico dudoso; pruebas con encabezados inventados.
No autoriza cambios de RLS, permisos ni esquema. T046, T057 y T063 de F02.5 siguen sin marcar.
