# F02 — Modelo de datos propuesto

**Estado:** diseño aprobado e implementado localmente en migraciones F02 001–004. Se aplicaron solo en bases TEST/DEMO aisladas; no en la base persistente F01 ni en producción.

| Entidad | Campos lógicos mínimos | Relaciones y restricciones |
|---|---|---|
| Medicamento del catálogo | id, nombre normalizado, concentración, presentación, clasificación, estado | Referencia común; combinación normalizada inequívoca. Consulta acotada F02; mutación operativa bloqueada por CAT-01/GLO-01. |
| Inventario | id, farmacia_id, medicamento_id, precio referencial, cantidad física registrada, cantidad comprometida, última revisión, versión | Una fila por farmacia y medicamento; precio y cantidades no negativos; cantidad física ≥ comprometida. FK compuesta por farmacia para referencias privadas y control de concurrencia. |
| Movimiento de inventario | id, farmacia_id, inventario_id, medicamento_id, antes, después, motivo, responsable_id, fecha, correlación | Solo cambios confirmados; inmutable para la aplicación ordinaria; misma farmacia que inventario. Motivo e identificador de actor obligatorios. |
| Importación | id, farmacia_id, actor_id, digest, nombre seguro opcional, estado, creada/caduca/confirmada, errores resumidos | Una sola farmacia y actor. El archivo original se procesa temporalmente y se descarta; no se guarda en el registro. Reintento/confirmación se controla por estado y digest, sin conceder acceso por ID. |
| Fila de vista previa | importacion_id, farmacia_id, número de fila, referencia conciliada, precio, cantidad, error minimizado | Vinculada a la importación de la misma farmacia; una fila inválida bloquea toda confirmación. Evitar texto crudo innecesario. |
| Farmacia/membresía F01 | farmacia_id, actor, rol, estado y capacidades verificadas | Referencias existentes. Su alta operativa no se implementa en F02; FIX-01 permite datos ficticios aislados. |

## Estados y transiciones

La importación propuesta pasa de `VISTA_PREVIA` a `CONFIRMADA`, `RECHAZADA` o `EXPIRADA`. Solo una vista previa válida, vigente y perteneciente al actor/farmacia autorizados puede confirmarse. `CONFIRMADA`, `RECHAZADA` y `EXPIRADA` son terminales para ese intento; corregir errores requiere una vista previa nueva. La misma confirmación repetida no vuelve a aplicar movimientos. Si falla la transacción de inventario, todos los cambios de stock y movimientos se revierten; la incidencia puede quedar en el historial mediante una operación separada y restringida.

El inventario no introduce estados de reserva. En F02, la cantidad comprometida inicia en cero en fixtures y no se modifica por rutas F02. F04 será responsable de compromisos y reservas con su propia autorización, Unit of Work y Outbox. La disponibilidad digital se define como cantidad física registrada menos cantidad comprometida, pero la publicación pública se reserva a F03.

## Invariantes de seguridad

- `farmacia_id` de tablas privadas es obligatorio; una solicitud no puede transferir una fila entre farmacias. Políticas RLS de lectura y escritura niegan contexto ausente o ajeno. Las FK y claves únicas incluyen farmacia donde corresponde.
- La identidad global y el catálogo común no se convierten artificialmente en tablas tenant. La lectura del catálogo por F02 no habilita edición global. Un fixture de prueba no crea roles operativos ni rutas de producción.
- Cada escritura y movimiento se confirma junto con la fila de inventario en la misma transacción. La fecha de revisión se actualiza solo con revisión efectiva, nunca por lectura o vista previa.
- Precio y cantidades se validan en dominio y base. La confirmación bloquea o compara versiones para detectar cambios concurrentes y vuelve a evaluar compromisos antes de escribir.
- La sesión F01 vigente, la membresía activa, el rol autorizado y la capacidad explícita se revisan antes de fijar el contexto tenant; la revalidación ocurre de nuevo al confirmar una importación.
- El rol runtime de F02 debe ser no propietario, `NOSUPERUSER` y `NOBYPASSRLS`. El rol de migración nunca sirve peticiones de aplicación. Una conexión reutilizada no conserva actor o farmacia de la transacción anterior.

## Migración y fixture locales verificados

Las migraciones `001_permissions.sql` a `004_imports.sql` se probaron sobre bases nuevas con F01 001–009. FIX-01 creó una base separada con Farmacia Alfa/Beta, referencias y responsables ficticios con capacidades explícitas. La cuenta runtime no carga fixtures ni ejecuta DDL. Las pruebas RLS comprobaron roles sin `BYPASSRLS`, contexto transaccional, A/B, revocación y pool reutilizado; los resultados y límites constan en [implementation-evidence.md](implementation-evidence.md).
