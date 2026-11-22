# ADR-F025-001 — Incorporación y administración de farmacias (propuesta)

**Estado:** DEC-01, DEC-02 y DEC-03, spec y plan aprobados expresamente por el responsable en esta conversación el 2026-11-19 para implementación TEST/DEMO aislada; Constitution 1.3.0 incorpora F02.5 al roadmap. No autoriza migraciones ni uso en bases persistentes.

## Contexto y fuentes

El Documento Maestro v3.0 Parte B, capítulos 4–5, asigna al módulo Farmacias alta, ubicación, contactos y estado, y a la plataforma la administración de farmacias. Los capítulos 27–29 imponen aislamiento pooled, membresías expresas y RLS. La Parte A fijaba un roadmap sin F02.5. La nueva versión v3.1, leída íntegra y comparada con v3.0, añade F02.5 en A4 bis como **propuesta de adopción**, con F025-RF01–28 y F025-AC01–12; no enmendó automáticamente la Constitution. La aprobación humana posterior incorporó F02.5 mediante Constitution 1.3.0.

F01 GLO-01 define cinco permisos globales para Usuarios y roles; no contiene permiso de aprobar farmacias. BOOT-01 permite alta inicial privilegiada solo mediante comando offline y en bases TEST efímeras. El capítulo 27 histórico dice «Solo la API autorizada, sin modificar membresías de terceros» para `usuario_farmacia`. EXC-01/ROL-01 permiten únicamente gestión local de TRABAJADOR; no conceden DUENO.

## Decisiones aprobadas con límites

1. **DEC-01**: diseñar permisos de plataforma específicos del módulo Farmacias para consultar solicitudes, revisar documentos autorizados, decidir y activar. No otorgan acceso a inventarios o reservas privados ni se heredan del título de administrador global. La provisión y ejecución iniciales se restringen a TEST/DEMO aislado; nada autoriza privilegios persistentes o productivos.
2. **DEC-02**: una aprobación legítima por administrador de plataforma expresamente autorizado puede crear/activar una farmacia y asignar **una sola membresía DUENO al solicitante** en una transacción idempotente, auditable y segura ante concurrencia, solo en TEST/DEMO aislado. Esta es una **excepción nueva expresamente aprobada** frente a la frase histórica del capítulo 27; la regla histórica se conserva íntegra y no se atribuye al maestro una autorización que no contiene.
3. **DEC-03**: en TEST/DEMO se permiten únicamente datos ficticios mínimos de establecimiento, contacto, ubicación y representante. RUC y documentos son opcionales; no se declara validación legal, sanitaria o documental real.
4. Reutilizar F02 para CSV/XLSX, F03 para proyecciones públicas, F04 para reservas, F05 para el evento local y F07 para ubicación; nunca confiar en un identificador tenant aportado por el cliente.
5. Preservar BOOT-01 para la provisión inicial del revisor TEST, sin ejecutar alta privilegiada en bases persistentes ni producción. Los permisos F02.5 nuevos exigen una asignación TEST explícita y auditada; el catálogo GLO-01 de cinco permisos no los incluye.

## Puertas que siguen pendientes

- Aprobación final de F02.5 tras pruebas; la aprobación de [spec F02.5](../../specs/012-f025-incorporacion-farmacias/spec.md) y del plan técnico ya consta en [approval.md](../../specs/012-f025-incorporacion-farmacias/approval.md).
- La inserción F02.5 entre F08 y F09 fue resuelta por Constitution 1.3.0. `ADR-ROADMAP-V3-001`, decisión 3, se conserva íntegra como antecedente, sin renombrar historia.
- Adopción formal del maestro v3.1 como nueva referencia principal, si el responsable la desea; mientras tanto v3.0 y Constitution 1.3.0 rigen. El archivo v3.1 es fuente específica de alcance F02.5.
- Procedimiento para suspensión/desactivación (v3.1 F025-RF23), requisitos documentales definitivos y cualquier habilitación de privilegios o activaciones persistentes/productivas.

## Consecuencias y límites

La nueva capacidad afectaría autorización de plataforma, solicitudes, transacción de activación, RLS, proyección pública, interfaces y pruebas Alfa/Beta. **Discrepancias visibles:** v3.1 A4 bis.2 y F025-RF09 aluden a revisión «según GLO-01», pero sus cinco permisos vigentes no cubren Farmacias; DEC-01 exige permisos nuevos separados. V3.1 F025-RF15 trata XLSX como soporte por confirmar, pero el contrato y parser F02 actuales lo admiten; se reutiliza el soporte real, sin simular una ampliación. V3.1 F025-RF23 propone suspensión, pero DEC-01–03 no aprueban su procedimiento; queda fuera del primer incremento operativo. Suspensión productiva, dueños adicionales, concesión global genérica, AWS, Gemini real y bases persistentes no quedan aprobados. F00–F08 y Constitution permanecen intactos.
