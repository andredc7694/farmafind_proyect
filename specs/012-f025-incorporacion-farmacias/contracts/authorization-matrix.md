# F02.5 — Matriz de autorización propuesta

**Estado:** diseño aprobado como parte del plan F02.5 el 2026-11-19. DEC-01/02 autorizan el alcance TEST/DEMO, no privilegios persistentes ni uso productivo.

| Actor | Solicitud propia | Solicitudes ajenas | Documentos ajenos | Decidir | Activar | Inventario privado |
|---|---|---|---|---|---|---|
| Visitante | No | No | No | No | No | No |
| Usuario normal / solicitante | Crear, leer y editar según estado | No | No | No | No | No |
| Dueño de farmacia A | Lo anterior según identidad | No | No | No | No | Solo A y permiso F02 |
| Trabajador A | Lo anterior según identidad | No | No | No | No | Solo A si delegación F02 expresa |
| Administrador global sin capacidades F02.5 | Su propia solicitud | No | No | No | No | No |
| Revisor global TEST con capacidades explícitas | Su propia solicitud | Según capacidad | Según capacidad | Según capacidad | Según capacidad adicional | No, salvo membresía tenant independiente |

Capacidades cerradas propuestas:

| Código | Acción permitida | Límite |
|---|---|---|
| `F025_APPLICATION_READ` | Listar solicitudes ajenas de forma minimizada. | No autoriza detalle privado, documentos ni decisión. |
| `F025_APPLICATION_REVIEW` | Consultar detalle privado necesario, iniciar revisión y registrar observación. | No descarga documentos ni aprueba/activa. |
| `F025_DOCUMENT_READ` | Leer adjuntos sintéticos TEST de la solicitud revisada. | No URL pública ni lectura de inventario. |
| `F025_APPLICATION_DECIDE` | Rechazar o aprobar con motivo y estado válido. | Aprobar requiere además `F025_PHARMACY_ACTIVATE`. |
| `F025_PHARMACY_ACTIVATE` | Completar alta atómica de farmacia y primera membresía DUENO del solicitante. | Solo una solicitud aprobable en TEST; no administra dueños posteriores. |

El revisor debe mantener sesión F01 vigente y asignación `ADMINISTRADOR_PLATAFORMA` activa **más** un grant F02.5 activo. Esos grants no pertenecen a los cinco permisos GLO-01; se provisionan solo por expediente offline TEST auditable, nunca mediante autorregistro o ruta HTTP genérica. El solicitante no puede aprobarse a sí mismo, aun si obtiene una capacidad de revisión por error de configuración. Una revocación de sesión, rol global o grant F02.5 deniega la siguiente operación.

EXC-01/ROL-01 solo permiten gestionar `TRABAJADOR` dentro de la farmacia propia, con permiso. DEC-02 permite exclusivamente el primer `DUENO` tras aprobación legítima TEST de farmacia nueva. Cualquier otro dueño, permiso global, suspensión o acceso transversal exige decisión separada.

Los IDs de solicitud/farmacia, cabeceras, cuerpos y archivos son referencias de recurso, no evidencia de autorización. Los errores de acceso ajeno usan respuesta minimizada; no confirman existencia de otra solicitud ni exponen documentos.

## Perfil privado del establecimiento — diseño SDD aprobado 2026-11-21

Estas capacidades tenant fueron aprobadas expresamente para la adenda TEST de T036–T037, independientes de los cinco permisos de plataforma anteriores. Su concesión efectiva exige implementación posterior de delegaciones F01 y activación TEST auditada; este documento no concede permisos por sí mismo.

| Actor | `GET /farmacias/{id}/perfil` | `PATCH /farmacias/{id}/perfil` | Límite |
|---|---|---|---|
| DUENO de la farmacia con membresía activa y `pharmacy.profile.read` | Sí | Solo con `pharmacy.profile.write` adicional | Misma farmacia y sesión; PATCH solo `contacto`, versión y CSRF. |
| DUENO de otra farmacia, miembro revocado o usuario sin membresía | No | No | ID o cabecera de tenant no confieren acceso. |
| Trabajador o administrador de farmacia sin grants específicos | No | No | Ninguna capacidad implícita por rol. |
| Administrador de plataforma/revisor sin membresía tenant | No | No | Capacidades F02.5 de solicitudes no abren perfiles privados. |

GET propuesto: `farmaciaId`, `contacto`, `direccion`, `departamento`, `provincia`, `distrito`, `version`, `updatedAt` de la misma farmacia; no devuelve información personal de MEJ-019. PATCH propuesto: `contacto` válido de 1–160 caracteres y `version` positiva; campos comerciales, dirección/ubicación, estado, roles, dueño e identificadores protegidos no son editables por esta ruta. Auditar actor, farmacia, acción, fecha y correlación sin guardar secretos. PostgreSQL debe imponer `FORCE RLS` y `UPDATE USING/WITH CHECK` con identidad, membresía, delegación y contexto de tenant válidos en la transacción.
