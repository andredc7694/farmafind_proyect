# F02 — Matriz de autorización acotada

**Estado:** decisión INV-01 aprobada para F02; nombres de capacidades ratificados al aprobar el plan. No constituye un mecanismo de concesión operativo ni ejecuta BOOT-01/GLO-01.

| Actor | Ámbito | Capacidades explícitas posibles | Resultado sin capacidad |
|---|---|---|---|
| Dueño de farmacia con sesión, membresía activa y farmacia propia seleccionada | Solo propia | `inventory.read`, `inventory.write`, `inventory.import.preview`, `inventory.import.confirm`, `inventory.history` individualmente | Denegar la acción no concedida. |
| Administrador autorizado con sesión, membresía activa y farmacia propia seleccionada | Solo propia | Las mismas capacidades, únicamente las concedidas expresamente | Denegar la acción no concedida. |
| TRABAJADOR | Ninguna acción F02 por su rol inicial | Ninguna concesión F02 aprobada para este incremento | Denegar lectura y escritura privadas F02. |
| Cliente/usuario común | Ninguna acción F02 privada | Ninguna | Denegar. |
| Administrador de plataforma | Sin permiso de inventario ajeno por título | Ninguna concesión global F02 operativa | Denegar inventario ajeno; GLO-01 bloqueada. |

Cada solicitud verifica identidad, sesión vigente, membresía activa, rol, capacidad concreta, recurso y farmacia activa. El identificador recibido del navegador solo solicita contexto. Las políticas SQL comprueban la misma autorización y el contexto transaccional; un filtro de API no basta. El fixture FIX-01 puede otorgar capacidades solo a identidades sintéticas en una base recién creada y aislada. No añade rutas de concesión ni modifica la base persistente F01. La revocación o inactivación surte efecto en la siguiente operación protegida.
