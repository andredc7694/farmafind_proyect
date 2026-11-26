# Feature Specification: F02.1 — Importación inteligente

**Feature Branch**: `feat/f025-incorporacion-farmacias` (rama de desarrollo existente)
**Created**: 2026-11-22
**Status**: Especificación y plan aprobados expresamente por el responsable el 2026-11-22 para MEJ-001 y los errores de importación de MEJ-002; implementación en curso, aceptación pendiente.
**Input**: Documento Maestro v3.2 MEJ-001 y MEJ-002; alcance aclarado por el responsable.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Preparar archivos heterogéneos (Priority: P1)

Como responsable autorizado de inventario quiero cargar CSV o XLSX con hojas, encabezados y columnas variables, revisar la interpretación propuesta y corregirla antes de importar.

**Why this priority**: Permite resolver archivos reales sin alterar inventario durante la preparación.
**Independent Test**: Con archivos ficticios de varias hojas, encabezados desplazados y sinónimos, se obtiene una vista previa corregible; el inventario permanece intacto.

**Acceptance Scenarios**:

1. **Given** un XLSX con varias hojas, **When** se carga, **Then** se propone la hoja y fila de encabezado relevantes y el usuario puede corregirlas.
2. **Given** un CSV/XLSX con sinónimos españoles, **When** se prepara, **Then** se proponen correspondencias para medicamento, concentración, presentación, clasificación, precio y stock.
3. **Given** hojas o columnas ambiguas, **When** se prepara, **Then** se solicita selección explícita antes de conciliar o confirmar; no se asigna silenciosamente un campo clínico distinto.
4. **Given** una vista previa cancelada, **When** se consulta inventario, historial y búsqueda pública, **Then** no hay cambios derivados del archivo.

---

### User Story 2 - Corregir errores precisos (Priority: P1)

Como responsable autorizado quiero conocer fila, campo, motivo y acción correctiva de cada error de importación.

**Why this priority**: La DEMO actual reduce precio y cantidad vacíos a `VALOR_INVALIDO`, sin indicar qué corregir.
**Independent Test**: Un archivo ficticio con ambos campos vacíos produce dos incidencias distinguibles y no escribe inventario.

**Acceptance Scenarios**:

1. **Given** precio y cantidad vacíos en una fila, **When** se valida, **Then** aparecen dos incidencias separadas con fila/columna, campo faltante y corrección sugerida.
2. **Given** valor inválido, columna faltante o referencia ambigua, **When** se valida, **Then** cada incidencia muestra título en español, causa, acción y código de soporte seguro, sin traza ni datos privados.
3. **Given** varias incidencias, **When** se revisa el informe, **Then** se puede localizar cada fila y volver a validar el archivo o mapeo corregido.

---

### User Story 3 - Reutilizar un perfil propio y conciliar (Priority: P2)

Como responsable autorizado quiero guardar un mapeo validado para mi farmacia y reutilizarlo solo con archivos compatibles.

**Why this priority**: Reduce trabajo repetido sin trasladar configuraciones entre tenants.
**Independent Test**: Alfa reutiliza un perfil compatible; Beta no puede consultarlo; un formato cambiado exige revisión.

**Acceptance Scenarios**:

1. **Given** un mapeo validado, **When** se guarda para Alfa, **Then** solo actores autorizados de Alfa pueden usarlo.
2. **Given** encabezados incompatibles, **When** se intenta aplicar un perfil, **Then** se pide revisión explícita.
3. **Given** concentración o presentación distinta o coincidencia incierta, **When** se concilia, **Then** no se equiparan productos clínicamente diferentes de forma automática.

---

### User Story 4 - Confirmar íntegramente (Priority: P1)

Como responsable autorizado quiero confirmar un archivo válido para actualizar solo el inventario de mi farmacia, con movimientos verificables.

**Why this priority**: Conserva la atomicidad y la integridad aprobadas en F02/F04.
**Independent Test**: Archivo válido confirma todas las filas; error, revocación o conflicto concurrente confirma cero filas y no rompe stock comprometido.

**Acceptance Scenarios**:

1. **Given** vista previa válida, **When** se confirma explícitamente, **Then** se revalidan autorización, referencias, precios, cantidades y compromisos; la importación y sus movimientos quedan consistentes.
2. **Given** error, referencia pendiente, conflicto concurrente o membresía revocada, **When** se confirma, **Then** se rechaza el archivo entero sin escritura parcial.
3. **Given** un archivo confirmado, **When** se consulta la búsqueda pública, **Then** aparece solo la oferta publicable actualizada, nunca el inventario privado.
4. **Given** un actor de Alfa que manipula el identificador de Beta, **When** prepara o confirma, **Then** se deniega sin revelar ni alterar datos de Beta.

### Edge Cases

- Archivo vacío, ilegible, hojas igualmente plausibles, encabezados duplicados, sinónimos conflictivos y filas duplicadas: error específico o decisión explícita.
- Cambiar hoja, encabezado o mapeo vuelve a validar filas afectadas.
- Usuario de Alfa y Beta: cada operación usa farmacia activa verificada; perfil y vista previa no se trasladan entre ellas.
- Revocación entre vista previa y confirmación, reintentos y confirmaciones simultáneas no producen escrituras parciales ni sobreasignación.
- El informe no muestra trazas ni información privada de otra farmacia.

## Requirements *(mandatory)*

### Functional Requirements

- **F021-FR-001**: Aceptar CSV y XLSX admitidos por F02, detectar hoja candidata en XLSX y mostrar alternativas ambiguas.
- **F021-FR-002**: Detectar fila candidata de encabezados aunque no sea la primera y permitir corregirla.
- **F021-FR-003**: Reconocer sinónimos españoles y proponer mapeo de medicamento, concentración, presentación, clasificación, precio y stock sin asociaciones clínicas ambiguas automáticas.
- **F021-FR-004**: Permitir corrección de hoja, encabezado y mapeo antes de confirmar; cada cambio revalida las filas afectadas.
- **F021-FR-005**: Mostrar vista previa con datos propuestos, referencia conciliada o pendiente e incidencias por fila, sin alterar stock, movimientos u oferta pública.
- **F021-FR-006**: Cada incidencia de importación indica campo y ubicación, causa, corrección sugerida y código de soporte seguro en español y de forma accesible; precio y cantidad vacíos generan incidencias separadas.
- **F021-FR-007**: Guardar perfiles reutilizables por farmacia tras autorización, aplicarlos solo a formatos compatibles y aislarlos entre farmacias.
- **F021-FR-008**: No equiparar automáticamente medicamentos de diferente concentración o presentación; la conciliación incierta requiere decisión explícita.
- **F021-FR-009**: Cancelar o abandonar vista previa no persiste inventario ni movimientos.
- **F021-FR-010**: Confirmar requiere acción explícita y revalidación de identidad, sesión, membresía, permiso, farmacia activa y recurso.
- **F021-FR-011**: Confirmar de forma atómica por archivo y revalidar referencias, precios, cantidades y stock comprometido frente a concurrencia y reintentos.
- **F021-FR-012**: Tras confirmación válida, actualizar solo la proyección pública permitida; vista previa o fallo no la modifica.
- **F021-FR-013**: Impedir lectura, uso o escritura cruzada de perfiles, vistas previas e inventarios mediante autorización backend y PostgreSQL RLS.
- **F021-FR-014**: Conservar contratos y comportamientos aprobados de F02/F04; cualquier extensión necesaria requiere revisión del plan antes del código.

### Key Entities

- **Archivo de importación**: CSV/XLSX, hoja y encabezado seleccionados, farmacia de contexto.
- **Perfil de importación**: mapeo validado y compatibilidad, propiedad de una farmacia.
- **Vista previa**: interpretación y conciliación antes de confirmar, con incidencias localizables.
- **Incidencia**: fila, columna/campo, causa, acción y código de soporte no sensible.
- **Confirmación**: aplicación íntegra o rechazo íntegro con movimientos autorizados.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **F021-SC-001**: Todos los archivos de aceptación con varias hojas, encabezados desplazados y sinónimos permiten identificar o corregir los seis campos antes de confirmar.
- **F021-SC-002**: El caso de DEMO con precio y cantidad vacíos presenta dos incidencias separadas y cero cambios tras vista previa.
- **F021-SC-003**: En los casos ambiguos de aceptación, cero referencias clínicamente distintas se equiparan automáticamente.
- **F021-SC-004**: Archivo inválido, conflicto, revocación o cancelación dejan cero filas parcialmente confirmadas.
- **F021-SC-005**: En matriz Alfa/Beta hay cero accesos cruzados a perfiles, vistas previas, inventarios o confirmaciones privadas.
- **F021-SC-006**: Un archivo válido se prepara, revisa y confirma desde la interfaz; inventario propio y búsqueda pública se actualizan solo tras confirmar.
- **F021-SC-007**: Regresión aplicable de F02, F03 y F04 conserva stock comprometido, reservas y proyección pública correctos.

## Assumptions

- F02 conserva su importador CSV/XLSX, catálogo, permisos, contratos y confirmación aprobados.
- MEJ-002 cubre **solo errores de importación** en F02.1 por aclaración expresa del responsable; autenticación, reservas, permisos y geolocalización siguen pendientes en incrementos correspondientes. No se declarará MEJ-002 completa aquí.
- Se usan archivos y farmacias ficticios en TEST/DEMO; la base persistente `farmafind_f01_test` no se modifica.
- F02.5 queda suspendida como prioridad por decisión de iniciar F02.1; T046, T057, T063 y F025-RF23 conservan estado pendiente/bloqueado, sin aceptación F02.5.

## Traceability and approval gate

| Fuente | Cobertura | Estado |
|---|---|---|
| Maestro v3.2 MEJ-001, HU11, RF22–RF24, AC13 | F021-FR-001–005, 007–013; SC-001, 003–007 | Especificación y plan aprobados; verificación técnica en curso. |
| Maestro v3.2 MEJ-002, HU12, RF25, AC12–AC13 | F021-FR-006; SC-002; solo importación | Cobertura parcial; resto pendiente. |
| F02 aprobado, Constitution 2.0.0, ADR-F04-SEC-001 | F021-FR-008–014; aislamiento, atomicidad, stock | Se preservan decisiones históricas. |
| Roadmap v3.2 y F02.5 | Cambio de prioridad con suspensión expresa | F02.5 no aceptada. |

El responsable aprobó expresamente esta especificación en su mensaje «F02.1 — Especificación» del 2026-11-22, con MEJ-002 limitada a importación. El plan recibió aprobación humana posterior, registrada en [approval.md](approval.md). Ninguna de esas aprobaciones constituye aceptación de los resultados de F02.1.

## Enmienda 2026-11-25 — Importación en un paso y detector por contenido
Aprobada en [approval.md](approval.md). Precisa y, donde difiera, sustituye lo anterior sobre FR-001–004 y FR-006:
- **F021-FR-016**: Al elegir el archivo el sistema DEBE analizarlo y mostrar la vista previa sin pasos manuales; el ajuste de columnas queda oculto y solo se pregunta por el dato imprescindible que falte o sea ambiguo.
- **F021-FR-017**: El detector DEBE ser determinista y local, combinando nombre de columna normalizado (coincidencia flexible) y contenido; un empate real no se resuelve en silencio. `categoria_terapeutica` nunca es la clasificación (`condicion_venta`).
- **F021-FR-018**: En la hoja elegida se leen solo texto y números; fecha, fórmula o enlace en una columna usada generan una incidencia con hoja, celda, causa y solución, sin evaluar. Las hojas sin datos de inventario se ignoran.
- **F021-FR-019**: Los productos sin equivalencia en el catálogo se muestran como «pendientes de catálogo»; no se descartan ni equiparan, y la confirmación sigue siendo atómica por archivo.
- **F021-FR-020**: Un archivo rechazado DEBE explicar causa y solución; nunca solo «No se pudo completar la solicitud».
- **F021-SC-008**: Un archivo ficticio de 3 hojas, 40 o más filas y encabezados como los reales llega a la vista previa con los seis campos propuestos sin intervención.
