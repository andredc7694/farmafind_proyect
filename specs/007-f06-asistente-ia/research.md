# Research: F06 — Asistente IA informativo

## Decisiones resueltas

### R1 — Proveedor

**Decisión:** `MockAIProvider` local y determinista; interfaz `AIProvider` desacoplada.
**Razón:** el usuario lo aprobó y el Maestro exige funcionamiento sin proveedor. No se
instala SDK ni existe fallback de red. Una implementación real requiere autorización nueva.

### R2 — Grounding

**Decisión:** generar texto mediante plantillas sobre resultados de herramientas públicas
F03, no mediante conocimiento libre del mock. Cada fuente se devuelve estructurada.
**Razón:** permite demostrar AC-IA01 y evita inventar hechos.

### R3 — Clínica

**Decisión:** filtro determinista conservador anterior al proveedor. Incluye diagnóstico,
dosis, prescripción, tratamiento, contraindicación, consumo y sustitución. La mezcla o duda
se rechaza completa.
**Razón:** Constitution XIX prevalece sobre utilidad conversacional.

### R4 — Endpoint público y abuso

**Decisión:** 30 solicitudes por minuto por origen, cuerpo 4 KiB, consulta 500 caracteres,
máximo 3 herramientas y 20 resultados; comprobación antes del proveedor.
**Razón:** límites locales medibles sin Redis adicional. El rate limit distribuido queda
para una decisión futura de despliegue.

### R5 — Privacidad

**Decisión:** consulta y respuesta solo en memoria durante la solicitud. Logs/métricas no
guardan contenido, IP, sesión ni payload. No hay tabla F06.
**Razón:** endpoint público, mínimo dato y ausencia de finalidad de historial.

### R6 — Integración F03

**Decisión:** adaptar casos y contratos públicos existentes mediante un puerto de aplicación.
No acceder a tablas privadas ni duplicar Redis/SQL.
**Razón:** F03 ya aplica proyección, fecha referencial, Cache-Aside y fallback.

### R7 — UI

**Decisión:** recorrido React mínimo en español sin dependencia visual nueva.
**Razón:** valida el flujo aprobado y pospone el rediseño profesional.

## Compatibilidad documental

Las diez decisiones del usuario coinciden con Maestro 9 y capítulos 25–36, y con
Constitution II, XIX y XX. La numeración antigua que ubica IA como F07 es histórica; el
plan actualizado fija F05 Notificaciones y F06 Asistente IA. No se cambia ningún ID histórico.

## Pendiente obligatorio

Aprobación humana conjunta de spec, ADR/C4 y plan antes del código. No quedan decisiones
funcionales o técnicas adicionales bloqueantes para generar tareas.
