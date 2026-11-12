# Security and Documentation Checklist: F01 — Identidad multi-tenant

**Purpose**: Evaluar la calidad, claridad y trazabilidad de los requisitos de F01 antes de aprobar plan y tareas.
**Created**: 2026-11-11
**Feature**: [spec.md](../spec.md)

**Note**: Checklist personalizada generada mediante `$speckit-checklist`. Sus preguntas examinan requisitos escritos, no resultados de implementación.
**Review Ownership**: La revisión y sus marcas corresponden a una persona revisora. `[x]` solo significa que esta confirmó la calidad documental del criterio.
**Marker Semantics**: Ningún marcador representa código, pruebas ni despliegue terminados.

## Integridad y alcance de requisitos

- [ ] CHK001 ¿Están los 20 requisitos F01-FR-001–020 identificados y vinculados con las cuatro historias y los siete F01-SC-001–007? [Completeness, Spec §Functional Requirements, §Measurable Outcomes]
- [ ] CHK002 ¿Distinguen los requisitos de registro, identidad y perfil propio los datos públicos de los privados sin conferir membresía por autorregistro? [Clarity, Spec §F01-FR-001, §F01-FR-004, §F01-FR-012]
- [ ] CHK003 ¿Quedan fuera de F01 las operaciones de inventario, reservas, búsqueda, pagos, notificaciones de negocio y FarmaFind AI, aun cuando aparezcan como ejemplos de autorización? [Consistency, Spec §F01-FR-020]
- [ ] CHK004 ¿Se diferencian identidad global, rol de plataforma, membresía, rol local, delegación, farmacia activa, recurso y acción sin que uno sustituya a otro? [Clarity, Spec §F01-FR-005, §F01-FR-010]

## Autorización, discrepancia y puertas de aprobación

- [ ] CHK005 ¿Documenta F01 literalmente la discrepancia de la fila `usuario_farmacia` del maestro capítulo 27 sin atribuirle la excepción delegada posterior? [Conflict, Spec §Clarifications, authorization-decisions §EXC-01]
- [ ] CHK006 ¿Consta la ratificación expresa y limitada de EXC-01 el 2026-11-12 sin atribuir la excepción al maestro ni ampliar la gestión fuera de trabajadores de la farmacia propia? [Traceability, authorization-decisions §EXC-01]
- [ ] CHK007 ¿Separan los requisitos las autorizaciones globales de la gestión de trabajadores y roles delegables inferiores de la propia farmacia? [Consistency, Spec §F01-FR-008, §F01-FR-011]
- [ ] CHK008 ¿Están definidos los límites de dueño, administrador autorizado, trabajador y cliente sin atribuir a sus títulos permisos automáticos no documentados? [Clarity, Spec §F01-FR-005–011, authorization-decisions §Matriz]
- [ ] CHK009 ¿Se distingue ROL-01 aprobada solo para `TRABAJADOR` de GLO-01 sin concesión global operativa y BOOT-01 limitada al diseño del alta inicial? [Consistency, authorization-decisions §Matriz]
- [ ] CHK010 ¿Están descritos los rechazos de autoelevación, concesión igual/superior no autorizada y modificación de membresías de otra farmacia? [Coverage, Spec §US3, §F01-FR-009]
- [ ] CHK011 ¿Se exige que cada concesión o revocación evalúe sesión, identidad, rol, membresía vigente, farmacia, permiso, recurso y acción, con auditoría? [Completeness, Spec §F01-FR-008, §F01-FR-014]
- [ ] CHK012 ¿Queda especificado que la suspensión o revocación cambia la autorización desde la siguiente operación protegida sin conservar permisos anteriores? [Measurability, Spec §US2 escenario 4, §F01-SC-006]

## Contraseña y sesión

- [ ] CHK013 ¿Se distingue Argon2id obligatorio de `argon2` adoptado tras comprobación local de instalación, hashing, verificación y auditoría en este Windows 10/Node.js 24.17.0, sin atribuir soporte oficial universal? [Consistency, Spec §F01-FR-013, authorization-decisions §ARG-01]
- [ ] CHK014 ¿Se expresa la detención y nueva decisión humana si el paquete falla, sin sustitución automática del algoritmo? [Exception Flow, authorization-decisions §ARG-01]
- [ ] CHK015 ¿Definen los documentos vigencia, revocación y revalidación de sesiones sin almacenar credenciales ni autoridad duradera en el navegador? [Completeness, Spec §F01-FR-003, §F01-FR-013]
- [ ] CHK016 ¿Quedan claros los atributos de cookie, el alcance de la excepción HTTP loopback y la dependencia futura de SameSite/CORS respecto al dominio real? [Clarity, Plan §Session, Frontend and API Design]
- [ ] CHK017 ¿Están especificados CSRF y Origin para mutaciones, incluidos login/logout, junto con rechazo de abuso y respuestas que no enumeren cuentas? [Coverage, Spec §F01-FR-002, §F01-FR-013]

## PostgreSQL RLS y escenarios

- [ ] CHK018 ¿Exigen los requisitos PostgreSQL oficial, modelo pooled y RLS para lectura, inserción, actualización y borrado de filas privadas? [Completeness, Spec §F01-FR-015–017]
- [ ] CHK019 ¿Queda establecido que el contexto tenant procede de identidad y membresía comprobadas y vive solo en la transacción y conexión de la operación? [Clarity, Spec §F01-FR-017]
- [ ] CHK020 ¿Se exige denegación sin contexto, rol runtime sin `BYPASSRLS`, propietario controlado y políticas `USING`/`WITH CHECK`? [Completeness, Spec §F01-FR-016–017, Constitution §VIII]
- [ ] CHK021 ¿Incluyen los escenarios positivos y negativos A/B, actor con dos membresías, ID manipulado y revocación? [Coverage, Spec §US2, §US4, §F01-SC-003–004]
- [ ] CHK022 ¿Incluyen los criterios el rollback, la reutilización del pool y la concurrencia, con PostgreSQL real como evidencia obligatoria de RLS? [Coverage, Spec §F01-FR-018, §F01-SC-004]
- [ ] CHK023 ¿Se especifica que salidas públicas y auditoría excluyen contraseñas, sesiones y datos personales innecesarios? [Measurability, Spec §F01-FR-012–014, §F01-SC-005]

## Aceptación y gobernanza

- [ ] CHK024 ¿Pueden medirse los siete criterios de éxito con casos positivos equivalentes y rechazo total de la batería AC04, sin atribuir resultados aún no obtenidos? [Acceptance Criteria, Spec §F01-SC-001–007]
- [ ] CHK025 ¿Se distingue la aprobación de spec/plan y EXC-01/ROL-01 de las operaciones locales aún no implementadas, GLO-01 bloqueada y BOOT-01 solo documental? [Consistency, Spec §Status, Plan §Status, authorization-decisions §EXC-01]
- [ ] CHK026 ¿Quedan los controles Playwright pendientes de entorno oficialmente compatible y separados de la aceptación F00 pendiente? [Dependency, Spec §Assumptions, Plan §Testing]
- [ ] CHK027 ¿Conservan los documentos trazabilidad a Constitution, maestro, requisitos históricos y 16 criterios docentes sin declarar implementación ni calificaciones? [Traceability, Spec §Traceability, Plan §Traceability]

## Notes

- Todas las casillas nuevas permanecen sin marcar hasta revisión humana.
- EXC-01/ROL-01 están ratificadas para el alcance local `TRABAJADOR`; GLO-01 prohíbe concesiones globales en este incremento; BOOT-01 solo permite diseño. ARG-01 tiene comprobación técnica local, pero ninguna de estas decisiones acredita implementación o aceptación de las operaciones pendientes.
- `$speckit-implement` lee el estado de esta checklist y no modifica sus marcadores.
