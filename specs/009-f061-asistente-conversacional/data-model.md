# Modelo de información F06.1 — propuesto

No se propone migración ni persistencia nueva. PostgreSQL conserva los datos oficiales de F03/F01; Redis conserva exclusivamente su papel F03. El modelo siguiente describe valores efímeros y contenido revisado, no tablas implementadas.

| Entidad | Campos mínimos y restricciones | Relación / ciclo |
| --- | --- | --- |
| Conversación efímera | `id` opaco aleatorio; huella técnica del origen, sin IP en claro; `createdAt`, `lastActiveAt`, `expiresAt`; hasta 6 turnos aceptados; sin texto de solicitudes clínicas rechazadas. | Nace en primera consulta, caduca tras 15 min de inactividad, se borra explícitamente o por capacidad. No equivale a identidad ni farmacia. |
| Turno | Entrada validada de 1–500 caracteres; se conserva solo clasificación, referente no clínico mínimo y referencias a fuentes, no la consulta original; orden temporal. | Pertenece solo a conversación activa. Si falla validación o política clínica, no se agrega texto sensible al contexto. |
| Fuente farmacéutica candidata | Autoridad, jurisdicción, ID/URL, versión/fecha, vigencia, permiso de reutilización, revisor profesional y estado de aprobación. | Solo fuente autorizada y vigente puede respaldar afirmaciones expuestas. Retirada o caducidad invalida respuestas nuevas. |
| Afirmación fundamentada | Texto educativo, ID de fuente, revisión, categoría y fecha de comprobación. | Cada afirmación debe tener una fuente concreta; sin ella, abstención. No infiere tratamiento personal. |
| Resultado público F03 | DTO público de oferta o farmacia, precio/disponibilidad referenciales y fecha. | Solo lectura por puerto F03; no da acceso a inventario privado ni autoridad para reservar. |
| Decisión de seguridad | Categoría permitida, rechazada, limitada o indisponible; código y métricas agregadas. | No registra prompt, respuesta, PII o identificador de conversación completo. |

**Transiciones de conversación:** nueva → activa → expirada o eliminada. Expirada/eliminada son terminales para ese identificador; no se reactivan. Si se excede el límite de turnos, se indica reinicio de contexto, sin reutilizar turnos previos. La gestión de contexto no modifica sesiones F01 ni políticas RLS.

**Validación pendiente de aprobación técnica:** 6 turnos/15 minutos son propuestas del plan. Los límites de 500 caracteres, 4 KiB, 30/min/origen, 3 herramientas y 20 ofertas proceden del F06 aprobado.
