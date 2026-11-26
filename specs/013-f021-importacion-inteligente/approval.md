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

## Ampliación de la enmienda — 2026-11-25 (decisiones de Andre)
- **Avisos agrupados:** la vista previa muestra primero un resumen con conteos (filas totales, pendientes de catálogo, por revisar, errores), después la tabla con filtros y al final los avisos agrupados por tipo con «Ver detalle»; nunca cientos de líneas. Los duplicados reales siguen indicando fila y causa.
- **Catálogo de la DEMO:** cargarlo desde su archivo ficticio con un script, solo en el entorno TEST, para ver importación y confirmación; explicar cómo.
- **Duplicados por laboratorio:** opción A (laboratorio y marca en la identidad del producto) como **incremento aparte** (spec 020) con rama propia y SDD completo; incluye la propuesta de productos nuevos (la farmacia propone, un revisor aprueba). Espera su aprobación.
No marca T046, T057 ni T063.

## Ajustes de pantalla del Panel de farmacia e integración — 2026-11-25 (decisiones de Andre)
- **Ajustes dentro de la misma enmienda y rama:** (a) Inventario en solo lectura con nombre legible, laboratorio si existe, precio, stock físico, comprometido, disponible y última revisión; búsqueda por nombre, filtros «Sin stock» y «Stock bajo», paginación, detalle con un clic y revisión manual como botón secundario. (b) Importar: solo elegir archivo, vista previa y confirmar. (c) Historial de importaciones en tarjetas (fecha, autor, resultado en lenguaje claro, conteos y «Ver detalle»), con las vistas previas agrupadas; nombre del archivo solo si no vulnera la minimización. (d) Movimientos en la pestaña Historial con producto y motivo legibles.
- **Condiciones:** reutilizar endpoints y datos; mantener la prueba de aislamiento Alfa/Beta; sin tocar RLS ni permisos; probar en navegador con el inventario importado desde su archivo.
- **Integración (opción A):** PR de `feat/f025-cierre-verificacion` y fusión solo cuando (a) estén estos ajustes, (b) Andre haya repetido T046 y dado su veredicto y (c) el PR esté MERGEABLE y CLEAN, CI en verde, sin secretos y con la regresión aplicable aprobada. En `main` debe constar que **F02.5 sigue sin aceptar** (T057 y T063 pendientes). Después: actualizar `main` y crear la rama de la spec 020.
- **Veredicto de T046: pendiente.** No marcar T046, T057 ni T063.

## Enmienda: exclusión explícita e historial detallado — 2026-11-25 (decisiones de Andre)
- Nombre del archivo: opción A (no se guarda). «Stock bajo» = 1 a 5 disponibles.
- **A) Exclusión explícita:** permitir excluir las filas duplicadas y las pendientes de catálogo para confirmar solo las listas, con botón y confirmación que muestren los números exactos. Los errores de datos siguen bloqueando. Confirmación atómica sobre el resto, revalidando identidad, permisos, referencias y concurrencia. Las excluidas no crean productos ni stock y se pueden importar después subiendo de nuevo el archivo.
- **B) Historial detallado:** lista de la más reciente a la más antigua con fecha, autor y resultado; conteos; detalle de las confirmadas con búsqueda y paginación; bloque de filas excluidas (número y motivo); vistas previas agrupadas y sin cambios.
- **Condiciones:** reutilizar endpoints y datos; si hiciera falta migración, avisar antes; no tocar RLS ni permisos. No marcar T046, T057 ni T063.

## 2026-11-25 · T046 — ACEPTADA («A: T046 ACEPTO», Andre)
- Andre verificó en su DEMO: `farma.xlsx` importado con exclusión explícita de las 583 filas por revisar (517 importadas, 0 errores); inventario e historial detallado correctos; la búsqueda pública de «Aciclovir» muestra ofertas de HUAMANFAR; el menú por rol funciona; el mapa abre desde Buscar medicamentos.
- **Salvedad:** las 583 filas excluidas quedan pendientes hasta implementar la spec 020.
- Sustituye al «NO APROBADA» anterior del mismo día. **F02.5 sigue SIN ACEPTAR:** T057 y T063 pendientes (solo Andre); F025-RF23 aplazada.
