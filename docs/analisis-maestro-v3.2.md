# Auditoría de adopción del Documento Maestro v3.2

**Fecha:** 2026-11-21. **Estado:** análisis para revisión humana; v3.2 no está ratificado ni implementado por este documento. **Alcance:** lectura de código y documentación, sin ejecutar servicios, migraciones ni pruebas.

## A. Fuentes, integridad y estado real

- Maestro v3.2: `docs/referencias/FarmaFind_Documento_Maestro_v3_2_Integral_Analisis_Arquitectura_AWS_Manual.docx`, 117 446 bytes, SHA-256 `39DCFDBE676E8FAC4F512BAA8F49C9A235A0E0887AB40AE2DE6E893A5919414E`. Se leyó el XML íntegro del cuerpo (2 436 párrafos no vacíos; 165 123 caracteres) y sus encabezado y pie. Sus 19 entradas ZIP se pudieron abrir sin errores. Incluye texto nuevo (§0–18), anexo v3.1 íntegro según la declaración del propio documento y anexo v2.0 (§0–36). No contiene figuras incrustadas aparte de una miniatura. La integridad del contenedor no certifica la veracidad de sus afirmaciones sobre el repositorio.
- La copia independiente de v3.1 y la de v2.0 **no están presentes hoy** en `docs/referencias/`; sí aparecen dentro del anexo v3.2. El archivo RAR histórico está presente, pero no se extrajo en esta revisión. La copia v3.0 aparece como eliminada en el árbol de trabajo y no se restauró. Su contenido y sus hashes previos constan en `docs/roadmap-v3-adoption.md` y `specs/012-f025-incorporacion-farmacias/research.md`; no se atribuye a una nueva lectura de esas copias ausentes.
- Constitución leída: `.specify/memory/constitution.md`, versión **1.3.0**, ratificación original 2026-11-10, última enmienda 2026-11-19. Su versión 1.3.0 existe como **cambio local sin commit** frente al HEAD 1.2.0. La precedencia vigente en el árbol de trabajo sigue siendo Constitution y decisiones humanas expresas; v3.2 se presenta a sí mismo como propuesta (§0, §15).
- Revisión local: `docs/adr/ADR-ROADMAP-V3-001-adopcion-controlada.md`, `docs/adr/ADR-F025-001-incorporacion-farmacias-propuesta.md`, `docs/adr/ADR-F04-SEC-001-aislamiento-inventario-reservas-propuesta.md`, specs/planes/tareas/evidencias de F01, F02, F02.5, F03, F04, F06.1, F07 y F08, contratos OpenAPI, `README.md`, Compose, frontend, backend, notificaciones y scripts. No se verificó en línea el repositorio histórico GitHub citado por v3.2; la lectura histórica independiente queda limitada a los anexos y documentos locales anteriores.
- Git observado: rama `feat/f025-incorporacion-farmacias`, HEAD `df5831e`, **47 entradas** en `git status --porcelain` antes de este análisis. Incluyen código F02.5 y F04, documentación, Constitution modificada y v3.0 eliminado; son cambios preexistentes que se conservan. `main` no se tocó.

### Inventario documental

El nuevo cuerpo identifica **28 HU (HU01–HU28), 47 RF (RF01–RF47), 17 AC (AC01–AC17), 18 RC (RC01–RC18), 16 DA (DA01–DA16) y 19 mejoras (MEJ-001–019)**. Preserva **12 ADR históricas (ADR-01–ADR-12)** y propone **8 ADR-P13–ADR-P20**, aún sin ratificar. Además existen ADR locales posteriores de roadmap, F02.5, F04 y F06; no se cuentan como sustitutos de esas 12 ni de las ocho propuestas. HU01–06, RF01–13, AC01–09, RC01–11 y DA01–09 conservan su numeración y su alcance histórico. HU28/RF46–47 tratan costos/AWS manual y no corresponden a una MEJ de interfaz.

### Diagnóstico de ejecución

| Área | Hallazgo de lectura | Estado demostrable hoy |
|---|---|---|
| F00–F07 | Hay specs, contratos, código, pruebas y evidencias históricas; F07 tiene aprobación humana TEST/DEMO. | Se preserva el alcance aceptado; no se repitieron pruebas en esta auditoría. |
| F06.1 | Existen conversación mock, herramientas públicas y adaptador Gemini apagado. `evidence-traceability.md` registra 47/49 tareas y falta permiso de reutilización de fuentes y revisión profesional. | Parcial TEST/DEMO; no equivale a IA clínica ni a proveedor externo activo. |
| F08 | React/JSX, shell, búsqueda, inventario, reservas, mapa y asistente tienen pantallas. `acceptance.md` declara 32 tareas técnicas verificadas y aceptación humana final pendiente. | Base reutilizable, no cumplimiento automático de MEJ-003–012/018. |
| F02.5 | `tasks.md` declara 19/63 marcadas; `evidence.md` contiene verificaciones posteriores, incluida navegación al panel de revisión y HUAMANFAR pendiente. Las casillas y evidencias requieren reconciliación antes de cerrar. | En curso; demostración humana de cinco farmacias y T063 pendientes. No inferir 63/63. |
| F02 | `file-parser.ts` acepta CSV y XLSX con controles de tamaño/ZIP, pero exige **una sola hoja**, encabezado en primera fila y mapeo explícito; `ImportPreview.jsx` da plantilla CSV y previsualización. | Soporte básico existente; detección de hojas/cabeceras y perfiles adaptativos MEJ-001 faltan. |
| F03/F04/F05 | Búsqueda pública y Redis, reservas transaccionales con Outbox y Notificaciones separadas tienen código y evidencias. | Reutilizar sin sustituir contratos. Los nuevos paneles/horarios todavía son propuesta. |
| Documentación general | `README.md` aún describe solo F00 y Constitution 1.1.0. El borrador `specs/008-f07-aws-deploy/` es F07-LEGACY-AWS, no F07 geolocalización actual. | Referencias desactualizadas; actualizar solo tras adopción aprobada, preservando historia. |

Esta auditoría fue **estática**. La existencia de un archivo o evidencia previa no demuestra que un flujo opere hoy en navegador ni que una base esté disponible. No se inició Docker, API, Redis, Playwright ni AWS.

## B. Trazabilidad integral de las 19 mejoras

**Lectura de la tabla:** `CA` es el criterio específico de v3.2 §16, no un criterio histórico ya aceptado. `P` = propuesta pendiente; `base` = componente existente comprobado por lectura; `TEST` = solo las evidencias históricas citadas. En todos los incrementos se exige prueba negativa de identidad/tenant pertinente además de la prueba funcional. Los caminos de componente indican dónde reutilizar, no ordenan modificar esos archivos ahora.

| MEJ / actor | HU → RF; módulo principal y relacionados | Base, faltante y criterio de aceptación v3.2 | PostgreSQL, seguridad y prueba clave | Fase |
|---|---|---|---|---|
| **001** Propietario | HU11 → RF22–24; F02, F03/F08 | `file-parser.ts`, `ImportPreview.jsx`; faltan hoja/cabecera variables, sinónimos y perfil por tenant. CA: vista previa completa y commit único tras conciliación. | Posible perfil/mapeo y lote por `farmacia_id`; RLS, fórmulas/ZIP, concurrencia, rollback y Redis tras commit. | F02.1, alta |
| **002** Todos | HU12 → RF25; F08/F02 y rutas API | Hay errores de importación; falta catálogo uniforme campo/motivo/remedio. CA: errores útiles sin trazas sensibles en auth, importación, reservas y geocoding. | Sin migración base prevista; test 400/403/409, accesibilidad y no filtración. | F02.1 + F08.1, alta |
| **003** Usuario multirol | HU13 → RF26; F08/F01 | `AppShell.jsx`/`routes.js` filtran algunos enlaces; falta navegación integral por contexto. CA: menú público mínimo y cada acción privada revalidada en backend. | Sesiones/membresías existentes; test cambio de tenant, revocación y rutas directas. | F08.1, alta |
| **004** Propietario | HU14 → RF27; F08/F02.5 | `PharmacyDashboard.jsx` reutilizable; falta orden completo Resumen, farmacia/ubicación, inventario, importar, reservas, historial, personal y configuración. | Sin migración por presentación; pruebas navegación, capacidades y datos ajenos. | F08.1, alta |
| **005** Cliente, trabajador, revisor | HU14 → RF27; F08/F02.5/F01 | Pantallas parciales de identidad y solicitudes; faltan paneles integrales por actor. CA: cada actor ve tareas propias sin duplicar permisos. | Posibles proyecciones de lectura; RLS para paneles y tests de rol cruzado. | F08.1, alta |
| **006** Propietario | HU15 → RF28; F07/F02.5 | `PharmacyMap.jsx`, rutas de ubicación; falta edición directa por pin en flujo completo. CA: GPS puntual o manual, dirección confirmada y fallback. | Reutilizar ubicación F07; no activar migración persistente; prueba RLS de coordenadas, consentimiento y denegación cruzada. | F08.1, alta |
| **007** Visitante/cliente | HU16 → RF29; F03/F07/F08 | `PublicSearch.jsx` y búsqueda geográfica existen por separado. CA: medicamento primero, ofertas comparables, precio y distancia opcional en una búsqueda. | Proyección pública mínima; test normalización, comparabilidad, Redis/fallback, sin exponer stock interno. | F08.1, muy alta |
| **008** Visitante/cliente | HU16 → RF29; F08/F03 | Base F08 y resultados; faltan sugerencias, filtros colapsables, lista/mapa y estados unificados. CA: CTA accesibles con resultados/vacío reales. | Normalmente sin migración; test responsive, teclado y API pública. | F08.1, alta |
| **009** Visitante | HU17 → RF30; F08/F06.1 | `AssistantView.jsx` existe como página; falta burbuja flotante minimizable. CA: no tapar contenido ni perder contexto. | Sin migración obligatoria; test privacidad, foco y móvil. | F08.1, media |
| **010** Cliente/visitante | HU18 → RF31; F06.1/F03 | Herramientas públicas de lectura y mock existen; falta evidenciar comparaciones integradas v3.2. CA: citas y fecha de ofertas comparables; cero mutaciones. | Sin acceso tenant privado; test alucinación, consulta sin resultados, prompt injection y RLS. Fuentes farmacológicas reales siguen bloqueadas por revisión profesional. | F08.1, alta |
| **011** Solicitante | HU19 → RF32; F02.5/F07/F08 | `PharmacyApplication.jsx` y seguimiento existen; falta wizard corto con mapa/fallback. CA: solicitud humana, GPS no aprueba negocio. | Reusar solicitud F02.5 TEST; test pasos, duplicado, 401/403 y no autoactivación. | Cierre F02.5 + F08.1, alta |
| **012** Todos | HU20 → RF33; F08/F01/F02/F03/F07/F02.5 | Hay entradas y catálogos; faltan los **12** tipos v3.2 §11.1. CA: sugerir por etapas sin cambiar datos silenciosamente. | Perfiles por tenant si se guardan; test fuente, límite, consentimiento, accesibilidad y cero filtraciones. Geocoder requiere revisión de uso. | F08.1, alta |
| **013** Farmacia | HU21 → RF34–35; F04/F05/F08 | `PharmacyReservations.jsx` y Outbox existen; faltan actualización automática, filtros/exportación. CA: polling tolerante a reconexión y CSV propio. | Posible índice/evento de lectura; test duplicados, RLS de exportación, reconexión y sin mutar estados. | F04.1, muy alta |
| **014** Cliente/farmacia | HU22 → RF36; F04/F08 | F04 ya guarda vencimiento 1–8 h. Falta preferencia estimada/franjas. CA: 30/60/120 min o franja válida, **sin** ampliar vencimiento ni prometer cita. | Campo opcional si se aprueba; test horario, expiración fija, concurrencia y stock. | F04.1, alta |
| **015** Operador autorizado | HU23 → RF37; F01/F02.5 | GLO-01/BOOT-01 solo TEST efímero y procedimiento offline; falta política para entorno persistente. CA: ningún botón/endpoint público de alta global. | No tocar datos persistentes; test idempotencia, auditoría, autoelevación y falta de membresía. | F01.1, obligatoria |
| **016** Propietario | HU24 → RF38–39; F01/F02.5/F08 | Gestión de membresía `TRABAJADOR` existente; falta cuenta operativa con alias temporal y vinculación con aceptación. CA: clave de un uso, delegación acotada y revocación. | Migraciones de credencial/invitación propuestas, no aprobadas; RLS por farmacia, sesiones revocadas y no autoelevación. | F01.1, alta |
| **017** Usuarios privilegiados | HU25 → RF40–41; F01/F05 | Argon2id/sesiones existen; falta verificación real de correo, recuperación y TOTP admin. CA: simulador TEST, MFA obligatorio para admin solo tras decisión aprobada. | Datos de factores/retención; test secreto cifrado, pérdida de factor, abuso y bloqueo seguro. | F01.1, alta |
| **018** Todos | HU26 → RF42–43; F08 | F08 tiene tokens y responsive; falta tema claro/oscuro/sistema y cierre transversal de todos los flujos. CA: contraste, teclado, móvil y preferencias persistentes. | Preferencia propia si se guarda; test accesibilidad y persistencia sin PII. React/Vite/JSX permanece. | F08.1, muy alta |
| **019** Usuario autenticado | HU27 → RF44–45; F01/F08 | Perfil mínimo y sesión existen; falta edición segura, correo revalidado, preferencias y seguridad propia. CA: nunca editar roles/tenant desde perfil. | Migraciones de perfil/preferencias solo tras spec; test reautenticación, revocación, CSRF, privacidad. | F01.1, alta |

**Trazabilidad adicional:** HU07–HU10/RF14–RF21 son capacidades transversales de navegación, identidad, onboarding y aislamiento; HU28/RF46–RF47 rigen costos/AWS. No quedan absorbidas por una MEJ concreta. Las 19 MEJ se agrupan sin renumerarlas: diseño F08.1 (003/004/005/008/018), búsqueda/mapa/onboarding (006/007/011/012), reservas F04.1 (013/014), identidad F01.1 (015/016/017/019) e importación F02.1 (001/002).

## C. Diferencias v3.1 → v3.2 y precedencia

| Cambio propuesto en v3.2 | Origen / antecedente | Tratamiento hasta aprobación |
|---|---|---|
| Añade HU07–28, RF14–47, AC10–17, RC12–18, DA10–16 y ADR-P13–P20 como numeración transversal nueva; no equivale a los códigos `F025-RFxx` del anexo v3.1. | v3.2 §§4–8; anexo v3.1 Parte A, especialmente A4 bis. | Ampliación propuesta, sin renumerar HU01–06/RF01–13 ni alterar F02.5 ya aprobado TEST. |
| Descompone mejoras en F08.1, F01.1, F04.1 y F02.1. | v3.2 §12; Constitution XV mantiene F02.5 después de F08 y antes de F09. | Subincrementos propuestos, cada uno requiere spec/plan y aprobación humana antes de código. No desplazar ni reabrir aceptaciones históricas. |
| Redacta **24 h** de recogida para CONFIRMADA. | v3.2 §3.2 y antecedente v2.0; F04-TIME-01 aprobó 1–8 h, default 4 h, desde confirmación, vencimiento fijo. | **Contradicción normativa:** prevalece F04-TIME-01. Corregir v3.2 por enmienda documental aprobada; no implementar 24 h. |
| Sugiere «React/Vite (base documental JavaScript/JSX; migración TypeScript si ratificada)». | v3.2 §9.2; Constitution IV exige JavaScript/JSX. | TS frontend es solo posibilidad futura con enmienda; F08.1 debe planearse en JS/JSX. |
| Propone crear trabajadores con alias y credencial temporal, además de verificación de correo/TOTP admin. | v3.2 §§2.2, 6, 8; F01 conserva correo+contraseña y sesiones; GLO/BOOT solo TEST. | Requiere decisión de identidad, recuperación y migración/ADR; no inferir equivalencia entre alias y correo ni autorizar provisión privilegiada persistente. |
| Mejoras de mapa, geocoder, autocomplete y LLM opcional. | v3.2 §§9–11; Constitution III/XII/XIX/XX, F07 TEST y F06.1 mock. | Proveedores/condiciones y contenido farmacológico aún sin aprobación. Mantener fallback manual/mock y objetivo US$0 para servicios externos TEST/DEMO. |
| Habla de «prueba correo local» en servicio de Notificaciones. | v3.2 §9.2; F05 aceptó solo notificaciones locales, sin correo/SMS/push externos. | Interpretar como sink simulado TEST, nunca como envío real hasta contrato y autorización. |
| Despliegue AWS solo manual con etapas y presupuestos. | v3.2 §14; Constitution XI/XII y ADR-ROADMAP-V3-001 ya lo exigen. | Compatible; F09 no está autorizado para ejecución ni gasto. |
| F02.5 y cinco farmacias se presentan como línea base propuesta en el anexo. | v3.1 A4 bis; aprobación DEC-01–03 TEST/DEMO. | El alcance TEST aprobado sigue, pero aceptación F02.5 y uso persistente/productivo permanecen pendientes. F025-RF23 suspensión sigue bloqueada. |

**Inconsistencia adicional de fuente:** v3.2 §0 enumera «GitHub docs/main (19 archivos)» y declara haberlo consultado el 21/11/2026. Este análisis no revalidó ese repositorio remoto; los 19 nombres aparecen en §18 y el anexo local. Antes de declarar sincronización histórica completa, cotejar la copia oficial con su commit/hash. La rúbrica de 16 criterios queda vigente; no se asigna puntaje por una propuesta.

## E. Riesgos y controles obligatorios

| Riesgo | Gravedad | Puerta verificable |
|---|---|---|
| Cambio de permisos de trabajador/admin o panel que exponga otro tenant | Crítica | Matriz de capacidades, API 401/403/404, RLS Alfa/Beta para lectura/escritura/exportación y reutilización de conexiones; admin global sin acceso privado implícito. |
| Importación adaptativa que confunda concentración/presentación o compromisos de stock | Crítica | Conciliación explícita, límites CSV/XLSX, no evaluar fórmulas, preview, revalidación y rollback de archivo, pruebas de concurrencia. |
| Nueva preferencia de recogida que amplíe las 1–8 h o duplique liberación | Crítica | F04-TIME-01, estados terminales, transacción stock–reserva–Outbox, carreras, idempotencia y expiración. |
| Contraseñas temporales, recuperación o TOTP que permitan toma de cuentas | Alta | Diseñar antes de migrar; clave de un uso, hash, vencimiento, sesión revocada y recuperación auditada, sin secretos en frontend/logs. |
| Búsqueda/IA que mezclen ofertas no equivalentes o privadas | Alta | Proyección pública, fecha/fuente, comparabilidad por presentación, Redis fallback, rechazo clínico y test de prompt injection. |
| UI dinámica que oculte pero no proteja endpoints | Alta | Backend autoriza cada recurso; pruebas de URL directa y cambio de contexto. |
| Geocoder/tiles, correo, LLM o AWS con condiciones/costo no revisados | Alta | Mock/fallback TEST, revisión de licencia/privacidad/cuotas antes de activar y aprobación individual por recurso AWS F09. |
| Divergencia entre `tasks.md` F02.5, evidencias y estado de Git | Media | Reconciliar tareas con pruebas por criterio; no cerrar ni publicar cambios preexistentes durante adopción. |

## F. Decisiones humanas estrictamente pendientes

1. **Adopción normativa v3.2:** aprobar el cuerpo nuevo como fuente principal futura, subordinado a Constitution 1.3.0 y a decisiones específicas. Aceptar una corrección explícita de §3.2: F04-TIME-01 (1–8 h, predeterminado 4) prevalece sobre 24 h. Determinar si la enmienda constitucional necesaria es solo de referencia/precedencia o incluye otras reglas nuevas; no editar la Constitution por esta auditoría.
2. **Identidad MEJ-016/017:** aprobar o rechazar alias operativo como identificador distinto del correo, método de recuperación, política de credencial temporal y TOTP/recuperación del administrador. BOOT-01/GLO-01 siguen restringidos a TEST efímero; no hay autorización para cuentas globales persistentes.
3. **F02.5 pendiente:** definir por separado F025-RF23 (actor, suspensión/desactivación, efectos sobre ofertas, reservas y sesiones) antes de implementarla; completar recorrido humano de cinco farmacias y aceptación TEST. No es condición para redactar specs de mejoras independientes, sí para declarar F02.5 terminado.
4. **Proveedores y contenido:** verificar y autorizar licencias/condiciones de mapas y geocoding, correo real, corpus farmacológico revisado por profesional y eventual LLM externo antes de activarlos. No se requiere esa decisión para diseñar fallback local/mock.
5. **F09 AWS:** aprobación futura, separada y por cada recurso, configuración y costo. El plan documental no concede ninguna de ellas.

No hay permiso para editar código, Constitution, datos, servicios o main por el mero hecho de aprobar este análisis. El orden y las puertas SDD se detallan en [roadmap-implementacion-v3.2.md](roadmap-implementacion-v3.2.md).
