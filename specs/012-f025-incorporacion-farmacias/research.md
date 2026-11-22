# F02.5 — Investigación y resolución de diseño (2026-11-19)

**Estado:** lectura documental y del código; no se instalaron paquetes ni ejecutaron pruebas F02.5.

## Documentos maestros y precedencia

- El DOCX v3.1 se pudo abrir y leer íntegro: 1 547 párrafos, 94 743 bytes, SHA-256 `B5EE9B8873DFC4E5D102D51101D7BAB058E8AC0A5FF2F3379FE992F9AC8CE56C`. La sección A4 bis añade F025-RF01–28 y F025-AC01–12. Su portada y A4 bis.13 lo presentan como propuesta de adopción, no como enmienda automática.
- La versión v3.0 vigente tiene 1 262 párrafos, SHA-256 `CD93097E4378056FDB81E55D41265900947CE66806F58C49A303779C7540E997`. En el árbol de trabajo aparecía eliminada; se restauró bit a bit desde HEAD, sin cambiar su contenido. Al comparar párrafos, los 23 textos v3.0 no reproducidos literalmente en v3.1 corresponden a portada, roadmap, estado y protocolo de adopción de Parte A; el anexo histórico Parte B permanece textualmente presente.
- La Constitution 1.3.0, principio XV, mantiene v3.0 como fuente principal e incorpora F02.5 entre F08 y F09 por enmienda expresa del 2026-11-19. `ADR-ROADMAP-V3-001` decisión 3 conserva la secuencia anterior como antecedente. v3.1 no produce esa enmienda automáticamente. F09 y F10 no se renumeran.

## Decisiones verificadas

| Tema | Evidencia real | Decisión de planificación | Alternativa descartada |
|---|---|---|---|
| GLO-01 y plataforma | `authorization-decisions.md` y migración F01 010: cinco permisos globales cerrados, ninguno para Farmacias. | Capacidades F02.5 separadas, concedidas expresamente solo en TEST por expediente offline auditado a un administrador global TEST activo. | Interpretar que `ADMINISTRADOR_PLATAFORMA` concede revisión automáticamente. |
| BOOT-01 y dueño | F01 010 solo permite `INITIAL_PHARMACY_OWNER` offline para una farmacia existente en TEST. Cap. 27 histórico niega mutación de membresías de terceros. | DEC-02 permite nueva vía exclusiva: aprobación de solicitud crea una primera membresía DUENO para solicitante de farmacia nueva, atómica, solo TEST. Registrar la excepción sin reescribir la regla. | Ejecutar BOOT-01 por HTTP o sobre base persistente. |
| Solicitud antes de tenant | F01/RLS vincula datos privados existentes a `farmacia_id`; la solicitud aún no tiene farmacia aprobada. | Tabla de solicitud con RLS por actor solicitante o revisor F02.5 explícito; negar todo acceso sin sesión válida. | Inventar un `farmacia_id` o desactivar RLS para revisión. |
| Activación | `f01.farmacia_referencia` contiene id/estado/nombre; runtime solo tiene SELECT, no INSERT general. | Función estrecha de activación en mismo PostgreSQL, rol NOLOGIN/NOBYPASSRLS, políticas y comprobaciones explícitas; sin GRANT amplio. | Permitir INSERT general o BYPASSRLS. |
| Importación | Spec F02 FR-011 y `file-parser.ts` admiten CSV y XLSX con límite 5 MiB, 5 000 filas, ZIP preflight y rechazo de fórmulas. | Reutilizar ambos sin nueva dependencia; plantilla CSV existente está en cambios DEMO sin versionar y no se da por aceptada. | Tratar XLSX como inexistente porque v3.1 lo presenta como sujeto a confirmación. |
| Outbox | `f04.outbox_evento` exige `reserva_id` y `farmacia_id`; F05 procesa reservas. | Outbox F02.5 propio con evento mínimo; adaptador de lectura en Notificaciones sin cambiar la semántica F04. | Crear reserva ficticia para evento de solicitud o relajar F04. |
| Ubicación pública | F03 `farmacia_publica` y F07 revisión publican datos seleccionados; F07 persistente sigue restringido. | Activación no publica coordenadas automáticamente; ubicación DEMO sigue revisión F07 y datos sintéticos. | Hacer pública la ubicación privada del representante. |
| Suspensión | v3.1 F025-RF23 la propone, pero DEC-01–03 no definen actor/procedimiento ni efectos sobre reservas activas. | Documentar contrato futuro y mantener operación deshabilitada hasta aprobación específica. | Implementar una desactivación con consecuencias inventadas. |
| Datos legales | v3.1 A4 bis.9 exige verificar fuentes peruanas antes de imponer documentos, RUC o autorizaciones. | En TEST solo campos ficticios mínimos; RUC/adjuntos opcionales; ninguna validación legal alegada. | Presentar revisión interna DEMO como autorización sanitaria. |

## Dependencias históricas que no se modifican

F01 aporta sesiones opacas, CSRF, membresía y contexto transaccional. F02 aporta inventario e importación atómica CSV/XLSX. F03 aporta proyecciones públicas y Redis Cache-Aside. F04 conserva transiciones de reservas, vencimiento e idempotencia. F05 sigue siendo proceso independiente. F06/F06.1 mantienen MockAIProvider y límites clínicos. F07 conserva ubicación TEST y revisión. F08 aporta una SPA y componentes accesibles; su aceptación humana está pendiente. Ninguna aceptación histórica se reabre por esta investigación.

## Gates

DEC-01–03 están aprobadas solo en los límites registrados en [spec.md](spec.md). Los códigos de permisos, esquema y contratos fueron aprobados como plan TEST/DEMO el 2026-11-19; véase [approval.md](approval.md). Uso persistente, suspensión y adopción normativa general de v3.1 requieren autorizaciones independientes. No existen secretos, servicios externos ni pruebas ejecutadas en esta fase documental.
