# Feature Specification: F02 — Catálogo e inventario por farmacia

**Feature Branch**: `feat/f02-catalogo-inventario`

**Created**: 2026-11-12

**Status**: Especificación, decisiones funcionales y plan técnico aprobados por el usuario el 2026-11-12. El incremento F02 TEST/DEMO pasó sus verificaciones técnicas y recibió revisión humana global el 2026-11-12; GLO-01, BOOT-01 y operación productiva siguen fuera de alcance.

**Input**: Continuar con el siguiente incremento funcional sustentado por el Documento Maestro Definitivo v2.0, la Constitution ratificada y F01. El capítulo 33 actualizado identifica F02 como «Catálogo/Inventario»; el capítulo 10 conserva otra secuencia histórica y no se usa para ampliar este incremento.

## Clarifications

### Ratificación 2026-11-12

- **CAT-01 — catálogo global:** F02 permite consultar referencias del catálogo común y cargarlas como datos ficticios mediante fixture exclusivo de prueba. Su edición operativa permanece bloqueada hasta que se apruebe GLO-01 con autoridad y procedimiento acotados; el fixture no crea una ruta global de producción.
- **INV-01 — permisos de inventario:** el dueño o administrador autorizado de una farmacia puede realizar operaciones de inventario solo dentro de su farmacia y con permiso explícito para la acción. `TRABAJADOR` no adquiere permisos de inventario por su rol; ninguna delegación adicional se presume aprobada. Cada operación revalida identidad, sesión, membresía, farmacia activa, permiso y recurso.
- **FIX-01 — datos de prueba:** se autoriza un fixture aislado, exclusivo de pruebas y con identidades/farmacias ficticias, que pueda representar actores dueños o administradores para probar autorización F02. No modifica la base persistente F01, no ejecuta el procedimiento real BOOT-01 y no habilita autorregistro privilegiado ni privilegios globales en la aplicación.

La aprobación posterior del plan autoriza el código F02 dentro de CAT-01, INV-01 y FIX-01. GLO-01 y la ejecución BOOT-01 mantienen sus bloqueos.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reconocer medicamentos del catálogo común (Priority: P1)

Como responsable autorizado de una farmacia quiero identificar un medicamento por sus atributos normalizados para registrar existencias sin confundir presentaciones diferentes.

**Why this priority**: El inventario por farmacia necesita una referencia común y estable.

**Independent Test**: Con un catálogo ficticio, una persona autorizada distingue dos presentaciones del mismo medicamento y selecciona exactamente la referencia pretendida; no obtiene datos privados de otra farmacia.

**Acceptance Scenarios**:

1. **Given** referencias ficticias con nombre, concentración, presentación y clasificación, **When** un responsable consulta el catálogo para cargar inventario, **Then** distingue cada referencia y recibe solo los atributos permitidos.
2. **Given** una referencia inexistente o ambigua, **When** se intenta asociarla a un inventario, **Then** se solicita corrección o conciliación antes de escribir existencias.
3. **Given** una persona sin autorización de administración global, **When** intenta crear o alterar una referencia común, **Then** no cambia el catálogo.

---

### User Story 2 - Registrar y revisar inventario manual de la farmacia propia (Priority: P1)

Como responsable autorizado quiero registrar precio y cantidad física revisada de mi farmacia y consultar su historial, para mantener información referencial con una fecha de revisión veraz.

**Why this priority**: La gestión manual es parte del MVP y permite operar sin importación.

**Independent Test**: Con farmacias ficticias A y B, una persona autorizada de A registra y revisa un artículo de A; se conserva la cantidad, el precio, el responsable, el motivo y la fecha. La misma persona no lee ni modifica el inventario privado de B.

**Acceptance Scenarios**:

1. **Given** una referencia válida y una farmacia propia activa, **When** un actor con permiso registra o corrige precio y cantidad física, **Then** el resultado pertenece solo a esa farmacia y queda un movimiento con antes/después, motivo, responsable y fecha.
2. **Given** una consulta, visita o refresco sin revisión física declarada, **When** se lee el inventario, **Then** la fecha de última revisión no cambia.
3. **Given** cantidad física menor que los compromisos vigentes, precio inválido o cantidad negativa, **When** se intenta confirmar el cambio, **Then** se rechaza sin alterar inventario ni historial confirmado.
4. **Given** actor sin membresía activa, permiso válido o farmacia seleccionada, **When** solicita inventario privado, **Then** la operación se rechaza sin revelar filas.

---

### User Story 3 - Preparar una importación conciliada (Priority: P1)

Como responsable autorizado quiero cargar un archivo .xlsx o .csv, mapear sus columnas y revisar una vista previa con errores, para corregirlo antes de confirmar cambios.

**Why this priority**: El documento maestro identifica hojas de cálculo como entrada frecuente y exige conciliación antes de escribir.

**Independent Test**: Un archivo ficticio con columnas reordenadas produce vista previa y asociación inequívoca con el catálogo; filas inválidas o ambiguas muestran errores y no modifican inventario.

**Acceptance Scenarios**:

1. **Given** un archivo ficticio .xlsx o .csv, **When** se mapean las columnas necesarias, **Then** la vista previa identifica medicamento, concentración, presentación, precio y cantidad física, además de errores por fila y referencias sin conciliar.
2. **Given** encabezados distintos, referencias ambiguas, filas duplicadas, datos fuera de rango o un archivo que declara otra farmacia, **When** se valida la vista previa, **Then** se informa el problema sin aplicar escrituras parciales.
3. **Given** una vista previa de A, **When** cambia la autorización del actor o intenta confirmarla en B, **Then** se deniega y no se reutiliza una autorización anterior.

---

### User Story 4 - Confirmar o rechazar íntegramente un archivo (Priority: P1)

Como responsable autorizado quiero confirmar una importación validada de mi farmacia y consultar su resultado, para tener un inventario consistente y auditable.

**Why this priority**: La atomicidad por archivo y la auditoría son condiciones expresas del capítulo 8 y del F02 actualizado.

**Independent Test**: Un archivo válido de A confirma todas sus filas y movimientos; otro con una fila inválida o un conflicto de compromisos no confirma ninguna. Un actor de B no puede confirmar el archivo de A.

**Acceptance Scenarios**:

1. **Given** una vista previa válida y autorización vigente, **When** se confirma, **Then** se revalidan referencias, cantidades y compromisos; todas las filas aplicables y sus movimientos quedan confirmados juntas.
2. **Given** una fila inválida, no conciliada, ajena o un conflicto concurrente, **When** se confirma, **Then** se rechaza el archivo entero, se informa el error y no queda ninguna escritura de esa confirmación.
3. **Given** una importación confirmada, **When** se consulta su historial autorizado, **Then** se muestran estado, incidencias y movimientos de la farmacia propia, sin revelar los de otra.

### Edge Cases

- Un usuario pertenece a A y B: cada operación usa una farmacia activa verificada y no traslada permisos, vistas previas ni movimientos entre ambas.
- Una membresía se revoca después de preparar la vista previa: la confirmación se deniega.
- Dos confirmaciones o una corrección manual concurren sobre el mismo artículo: ninguna deja cantidad física inferior al compromiso ni un historial incongruente.
- Un archivo vacío, ilegible, demasiado grande o repetido se rechaza de forma controlada; los límites concretos se fijarán en el plan aprobado.
- La falta de autorización para crear farmacias o administrar globalmente el catálogo no habilita rutas de prueba en producción.

## Requirements *(mandatory)*

### Functional Requirements

- **F02-FR-001**: El sistema DEBE conservar un catálogo común de medicamentos con nombre, concentración, presentación y clasificación, distinguiendo referencias diferentes y evitando asociaciones ambiguas.
- **F02-FR-002**: F02 DEBE ofrecer lectura de referencias comunes autorizadas. La modificación operativa del catálogo común DEBE permanecer bloqueada hasta aprobar GLO-01; solo se permite carga sintética mediante fixture exclusivo de prueba, sin ruta global de producción.
- **F02-FR-003**: El inventario DEBE asociar cada referencia de catálogo a una farmacia y conservar precio referencial, cantidad física registrada, cantidad comprometida y fecha de última revisión efectiva.
- **F02-FR-004**: La lectura, el cambio manual, la vista previa, la confirmación y el historial privados DEBEN requerir identidad vigente, farmacia activa verificada, membresía y permiso explícito para cada acción y recurso dentro de la farmacia propia. El dueño o administrador autorizado solo actúa con ese permiso; `TRABAJADOR` no recibe acceso de inventario por su rol.
- **F02-FR-005**: El dueño o administrador autorizado de una farmacia DEBE poder gestionar únicamente el inventario de su establecimiento conforme a sus permisos; el rol `TRABAJADOR` por sí solo NO DEBE conferir esa facultad.
- **F02-FR-006**: Las escrituras DEBEN denegar cambios cruzados A/B aun cuando el solicitante conozca o altere el identificador de farmacia o inventario.
- **F02-FR-007**: La fuente oficial DEBE ser PostgreSQL; las filas privadas de inventario, importaciones, movimientos y auditoría DEBEN conservar autorización por farmacia y RLS para lectura y escritura. El contexto DEBE provenir de una membresía comprobada y limitarse a la transacción.
- **F02-FR-008**: La actualización manual DEBE validar precio y cantidad, impedir valores negativos y rechazar cantidad física inferior a compromisos vigentes sin conciliación de reservas.
- **F02-FR-009**: Cada cambio confirmado DEBE generar un movimiento con farmacia, medicamento, cantidades antes/después, motivo, responsable y fecha, de forma consistente con el cambio de inventario.
- **F02-FR-010**: La fecha de última revisión DEBE cambiar solo tras revisión efectiva de datos por la farmacia; consultas, visitas y refrescos no DEBEN alterarla.
- **F02-FR-011**: La importación MVP DEBE aceptar .xlsx y .csv con mapeo de columnas, vista previa, validación de formato/rangos/catálogo y conciliación antes de confirmar.
- **F02-FR-012**: Una referencia no conciliada o una fila inválida DEBE generar errores identificables antes de confirmación y bloquear la aplicación del archivo completo.
- **F02-FR-013**: La confirmación de importación DEBE ser atómica por archivo: todas las filas válidas se aplican juntas o ninguna; no DEBE existir importación parcial silenciosa.
- **F02-FR-014**: Antes de confirmar se DEBEN revalidar autorización, referencias, disponibilidad y compromisos concurrentes; una vista previa antigua NO DEBE servir como permiso permanente.
- **F02-FR-015**: El historial de importaciones y movimientos DEBE estar limitado a la farmacia autorizada y mostrar estado e incidencias sin exponer archivos, datos internos ni personas de otra farmacia.
- **F02-FR-016**: Los archivos originales DEBEN protegerse y someterse a una política explícita de retención; no se publicarán en Git, salidas públicas ni registros de seguridad.
- **F02-FR-017**: F02 DEBE integrarse con la identidad y selección de farmacia F01 sin crear dueños, administradores globales o permisos por autorregistro. Las pruebas que requieran responsables autorizados DEBEN usar exclusivamente el fixture sintético aislado FIX-01; no se ejecutará BOOT-01 sobre la base persistente o un entorno operativo.
- **F02-FR-018**: La interfaz DEBE permitir las operaciones autorizadas de catálogo e inventario y mostrar errores de validación y denegación en español, sin decidir permisos en el navegador.
- **F02-FR-019**: Las pruebas DEBEN cubrir casos positivos y negativos manuales y de importación, rollback completo, concurrencia, revocación, ausencia de contexto y acceso cruzado mediante API y PostgreSQL RLS real, con datos ficticios.
- **F02-FR-020**: F02 NO DEBE implementar búsqueda pública con Redis, reservas, Outbox, notificaciones de negocio, pagos, IA ni el rediseño visual profesional. La proyección pública de consultas pertenece a F03 según el capítulo 33.

### Key Entities *(include if feature involves data)*

- **Medicamento del catálogo**: referencia común con atributos normalizados; no contiene stock por farmacia.
- **Inventario de farmacia**: referencia, farmacia, precio, cantidad física, compromiso y fecha de revisión.
- **Movimiento de inventario**: cambio confirmado, cantidades antes/después, motivo, responsable y fecha.
- **Importación**: archivo de una farmacia, mapeo, vista previa, estado e incidencias; su confirmación es una unidad indivisible.
- **Farmacia y membresía**: contexto vigente provisto por F01; su alta privilegiada no forma parte de F02.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **F02-SC-001**: En el conjunto de aceptación ficticio, el 100 % de las referencias con distinta concentración o presentación se distinguen sin asociación ambigua.
- **F02-SC-002**: El 100 % de los cambios manuales autorizados del conjunto de aceptación conserva valor antes/después, motivo, responsable y fecha; los no autorizados no cambian datos.
- **F02-SC-003**: El 100 % de los archivos con una fila inválida, no conciliada o ajena deja cero cambios confirmados; los válidos aplican todas sus filas.
- **F02-SC-004**: El 100 % de los intentos A/B y sin contexto definidos en la batería de aceptación se deniega sin filtrar datos privados, con casos positivos equivalentes.
- **F02-SC-005**: El 100 % de las actualizaciones que reducirían la cantidad física por debajo de compromisos vigentes se rechaza sin cambios parciales.
- **F02-SC-006**: El 100 % de las consultas sin revisión efectiva conserva la fecha de última revisión; los cambios confirmados sí registran la fecha correspondiente.
- **F02-SC-007**: Una persona autorizada completa manualmente y por archivo los recorridos definidos para F02 desde la interfaz en español; el resultado se acredita con pruebas y revisión humana, no con la existencia de pantallas.

## Assumptions

- El capítulo 33 del maestro v2.0 actualiza la secuencia: F02 cubre catálogo e inventario interno; F03 cubrirá consultas públicas y Redis. El capítulo 10 conserva una secuencia histórica diferente; no se mezclan ambas.
- Los siete módulos históricos permanecen separados: Farmacias conserva su responsabilidad de alta/estado, Medicamentos el catálogo e Inventario los datos por farmacia. F02 no autoriza automáticamente CRUD de establecimientos.
- F01 tiene 65/69 tareas marcadas al commit `e1a9e8f`; T050, T051, T062 y T067 siguen pendientes. El fixture DEMO de F01 no concede permisos de inventario ni autoriza BOOT-01/GLO-01.
- El diseño de retención, límites de archivo, formato de errores y parámetros de concurrencia pertenece al plan. Ningún valor no documentado se considera aprobado por la especificación.
- Se usarán exclusivamente datos ficticios y una base de prueba separada; la base persistente F01 no se altera para preparar esta especificación.

## Source Traceability and Scope Gates

| Fuente | Regla aplicable | Estado para F02 |
|---|---|---|
| Documento Maestro v2.0, capítulos 4–8 | Responsabilidades de Farmacias, Medicamentos e Inventario; RF10; entrada manual/.xlsx/.csv, vista previa, conciliación, atomicidad por archivo, movimientos y fecha veraz. | Requisitos documentados; implementación F02 no iniciada. |
| Documento Maestro v2.0, capítulos 27–29 y 33 | Catálogo central, inventario privado por farmacia, RLS, pruebas A/B y secuencia F02 Catálogo/Inventario. | Requisitos documentados; permisos globales y alta inicial siguen bloqueados. |
| Constitution v1.1.0, principios I–X, XIII–XX | SDD, siete módulos, stack, Clean Architecture, PostgreSQL/RLS, pruebas y privacidad. | Normativa ratificada, sin cambios. |
| F01 `spec.md`, `authorization-decisions.md` y tareas | Identidad, membresía verificada, TRABAJADOR no privilegiado; GLO-01 y ejecución BOOT-01 no autorizadas. | Dependencia; no se presume permiso de inventario. |
| Histórico HU05/RF10, RC y ADR conservados en la Constitution | Gestión manual/Excel, límites arquitectónicos y trazabilidad. | Se conservarán códigos originales sin renumerarlos ni atribuir implementación. |

La rúbrica de 16 criterios se conserva íntegra en la matriz constitucional. Para F02 son directamente trazables los criterios 1–7, 9, 12, 14–16 mediante requisitos, diseño posterior, pruebas reales, interfaz y evidencias; los criterios 8, 10, 11 y 13 quedan asociados a los incrementos de escalabilidad, AWS, búsqueda/Redis y carga previstos por el maestro. Esta asociación no asigna calificaciones ni acredita ejecución.

Las decisiones CAT-01, INV-01 y FIX-01 fueron ratificadas con el alcance limitado anterior. Ninguna pantalla, endpoint, migración o prueba F02 se declara existente; el plan requiere aprobación humana antes de implementar.
