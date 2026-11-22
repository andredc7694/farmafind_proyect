# Matriz documental consolidada de trazabilidad v3.2

**Estado:** trazabilidad documental adoptada en etapa 0.2, 2026-11-21, según [ADR-ROADMAP-V3-002](adr/ADR-ROADMAP-V3-002-adopcion-documental-v3.2.md). No modifica specs ni demuestra implementación o aceptación de las mejoras. La columna AC es una **asignación de verificación propuesta** a AC10–AC17 del maestro v3.2 §7; los criterios específicos de cada mejora constan en §16. AC01–AC09 históricos se conservan y se aplicarán además cuando correspondan. `E` significa evidencia que aún debe obtenerse para **la ampliación v3.2**, aunque existan pruebas históricas del módulo base.

| MEJ | Actor | HU → RF | AC propuesto | Módulo principal; relacionados | Prueba de aceptación v3.2 | E pendiente |
|---|---|---|---|---|---|---|
| 001 | Propietario | HU11 → RF22–24 | AC10, AC13 | F02; F03/F08 | XLSX/CSV heterogéneo: detectar hoja/cabecera, conciliar presentación, preview, confirmar archivo atómico; Alfa no importa Beta. | Archivos ficticios representativos, rollback, concurrencia, RLS y caché tras commit; nunca inventarios reales como fixtures. |
| 002 | Todos | HU12 → RF25 | AC12, AC13 | F08/F02; F01/F04 | Error con campo, causa y corrección; sin trazas o datos privados. | E2E auth/importación/reservas y accesibilidad de mensajes. |
| 003 | Usuario multirol | HU13 → RF26 | AC10, AC12 | F08; F01/F02.5 | Menú por contexto; URL/endpoint directo de otro rol denegado, cambio de tenant revalidado. | E2E multirol, API negativas y RLS conexiones reutilizadas. |
| 004 | Propietario | HU14 → RF27 | AC12 | F08; F02/F02.5/F04 | Panel con Resumen, farmacia/ubicación, inventario, importación, reservas, historial, personal y configuración. | Recorrido navegador propio/ajeno y accesibilidad. |
| 005 | Cliente, trabajador, revisor | HU14 → RF27 | AC10, AC12 | F08/F02.5; F01 | Panel específico por actor, solo acciones autorizadas; admin no ve inventario privado. | E2E por actor, denegación API/RLS y revisión humana. |
| 006 | Propietario | HU15 → RF28 | AC10, AC12 | F07; F02.5/F08 | Pin o GPS puntual con confirmación de dirección, fallback manual y consentimiento. | E2E sin proveedor externo, RLS ubicación Alfa/Beta, política de tiles/geocoder antes de activarlos. |
| 007 | Visitante/cliente | HU16 → RF29 | AC12, AC16 | F03; F07/F08 | Una búsqueda une medicamento, presentación, precio, oferta pública y distancia opcional; sin stock privado. | API pública/Redis fallback, comparabilidad, E2E con y sin ubicación. |
| 008 | Visitante/cliente | HU16 → RF29 | AC12 | F08; F03/F07 | Buscador y resultados con sugerencias, filtros, lista/mapa y estados vacíos accesibles. | E2E responsive/teclado y comparación pública real TEST. |
| 009 | Visitante | HU17 → RF30 | AC12, AC16 | F08; F06.1 | Chat flotante minimizable, móvil, contexto preservado, sin tapar CTA ni retener PII. | E2E teclado/móvil, privacidad y fallo mock. |
| 010 | Visitante/cliente | HU18 → RF31 | AC10, AC16 | F06.1; F03 | Herramientas públicas de solo lectura, citas/fecha, cero ofertas inventadas o mutaciones. | API/seguridad, prompt injection, RLS, catálogo vacío y revisión profesional si hay contenido farmacológico real. |
| 011 | Solicitante | HU19 → RF32 | AC10, AC12 | F02.5; F07/F08 | Wizard de solicitud con ubicación confirmada; no autoaprobar por GPS ni crear tenant antes de revisión. | E2E cinco farmacias TEST, deduplicación, 401/403, auditoría y aceptación F02.5. |
| 012 | Todos | HU20 → RF33 | AC10, AC12 | F08; F01/F02/F03/F07/F02.5 | Los 12 tipos v3.2 §11.1 sugieren sin mutar precio, dosis, rol, ubicación o reserva. | Matriz 12/12 de origen/límite/fallback, E2E y pruebas tenant. |
| 013 | Propietario/trabajador | HU21 → RF34–35 | AC10, AC14 | F04; F05/F08 | Polling/reconexión sin duplicados; exportar solo historial de farmacia autorizada. | E2E, API/RLS exportación, interrupción de red, Outbox e idempotencia. |
| 014 | Cliente/farmacia | HU22 → RF36 | AC14, AC15 | F04; F08 | Preferencia 30/60/120 min o franja dentro de horario y vencimiento F04-TIME-01, sin prometer cita. | Casos límite 1–8 h/default 4, vencimiento fijo, cancelación/expiración y concurrencia. |
| 015 | Operador autorizado | HU23 → RF37 | AC10, AC11 | F01; F02.5 | Provisión global solo offline TEST bajo BOOT/GLO; ausencia de ruta/UI pública y de acceso tenant implícito. | Pruebas negativas de autoelevación, duplicación, aprobación, auditoría y RLS. Persistente/productivo bloqueado. |
| 016 | Propietario | HU24 → RF38–39 | AC10, AC11 | F01; F02.5/F08 | Crear cuenta operativa individual o vincular existente con aceptación, clave efímera y capacidades por farmacia. | Diseño de alias/recuperación aprobado, API/RLS Alfa/Beta, cambio obligatorio y revocación. |
| 017 | Usuarios privilegiados | HU25 → RF40–41 | AC10, AC11 | F01; F05 | Verificación/cambio/recuperación seguros y TOTP admin si se aprueba política concreta; sin correo real en TEST. | Pruebas de caducidad, abuso, secreto, pérdida de factor, revocación y sesión. |
| 018 | Todos | HU26 → RF42–43 | AC12 | F08; todos los módulos visuales | Claro/oscuro/sistema, responsive, foco y contraste en flujos completos. | Auditoría accesibilidad, teclado/lector, Playwright y aceptación humana visual. |
| 019 | Usuario autenticado | HU27 → RF44–45 | AC10–AC12 | F01/F08 | Editar solo perfil propio; correo revalidado, preferencias y sesiones, sin editar permisos. | API/RLS, CSRF, reautenticación, revocación y E2E de perfil. |

## Agrupaciones sin pérdida de identificadores

| Iniciativa | MEJ incluidas | Límite de la agrupación |
|---|---|---|
| Experiencia visual por actor | 003/004/005/018 | Navegación y paneles comparten diseño, pero cada acción sigue autorizada por API/RLS. |
| Búsqueda, mapa y sugerencias | 006/007/008/012 | Vista integrada sobre ofertas públicas; coordenadas privadas y proveedores externos conservan controles propios. |
| Asistente informativo | 009/010 | Burbuja de F08 sobre herramientas F06.1/F03 solo lectura y MockAIProvider; sin Gemini real por defecto. |
| Reservas | 013/014 | Centro operativo y preferencia estimada no sustituyen máquina de estados, Outbox ni F04-TIME-01. |
| Identidad | 015/016/017/019 | Trabajadores y perfil no son vía de autoelevación ni de alta pública de administrador general. |
| Inventario y errores | 001/002 | Mejoras de parser/UX sin perder validación, conciliación ni atomicidad. |

## Cobertura fuera de las 19 filas

| Códigos | Relación | Evidencia y decisión pendiente |
|---|---|---|
| HU01–HU06, RF01–RF13, AC01–AC09, RC01–RC11, DA01–DA09, ADR-01–ADR-12 | Línea histórica F00–F06/F07–F08 preservada por Constitution XV. | Mantener specs/evidencias y controles originales; ninguna mejora reescribe IDs ni autoaprueba producción. |
| HU07–HU10, RF14–RF21 | Navegación pública, identidad, incorporación, perfil, aislamiento, auditoría. | Cruzan F01/F02.5/F08; comprobar en specs nuevas sin confundirse con `F025-RFxx`. |
| HU28, RF46–RF47, AC17, RC12–RC18, DA10–DA16, ADR-P13–ADR-P20 | Costos, AWS manual, calidad, restricciones y decisiones arquitectónicas propuestas. | DEC-001: objetivo US$0 en servicios externos TEST/DEMO, especialmente nuevas APIs; F09 manual sujeto a aprobación por recurso y costo. ADR-P13–P20 no ratificadas por aparecer en v3.2. |
| 16 criterios docentes | Constitución §«Trazabilidad con los 16 criterios» y maestro v3.2 §17/anexo histórico. | Cada incremento debe guardar requisito, código, prueba real, resultado, omisiones y captura pertinente; no asignar puntaje por plan ni documento. |

**Estado de base:** F01/F02/F03/F04/F05/F06/F06.1/F07/F08 contienen código y evidencias de sus alcances anteriores; F02.5 está activo y no aceptado. Ninguna fila de esta matriz declara implementada la ampliación v3.2. El diagnóstico de componentes reutilizables y riesgos está en [analisis-maestro-v3.2.md](analisis-maestro-v3.2.md).
