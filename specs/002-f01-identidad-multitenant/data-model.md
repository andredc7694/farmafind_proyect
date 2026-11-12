# F01 — Modelo de identidad, membresías y aislamiento

**Estado actualizado 2026-11-12:** existen migraciones y políticas F01 base aplicadas y probadas en PostgreSQL ficticio aislado; [implementation-evidence.md](implementation-evidence.md) registra lo verificado. EXC-01/ROL-01 autorizan solo preparar concesión/revocación local de `TRABAJADOR`, todavía sin mutaciones operativas ni aceptación completa. GLO-01 bloquea concesiones globales y BOOT-01 solo permite diseñar el alta inicial. Fuentes: [spec.md](spec.md) FR001–020, maestro v2.0 caps. 12 y 27–29, Constitución VII–VIII, ADR-04/06 históricos y [authorization-decisions.md](authorization-decisions.md).

## Entidades y relaciones

| Entidad | Campos conceptuales mínimos | Relación y validación |
|---|---|---|
| `usuario` | `id`, `email`, `password_hash`, `estado`, fechas de creación/actualización | Identidad **global**; correo único normalizado, nunca contraseña en claro. Registro ordinario crea `CLIENTE`, sin membresía ni rol de plataforma. Estados propuestos: ACTIVO, INACTIVO; transición administrativa exige permiso y auditoría. |
| `rol_plataforma` / autorización global | usuario, permiso global explícito, estado y actor que lo otorgó | Separado de roles de farmacia; sin concesión pública ni autoelevación. Solo autorización y procedimiento específicos; GLO-01 y BOOT-01 aún deben definir acciones y asignación inicial, sin permiso universal. |
| `farmacia_referencia` | `id`, `estado`, nombre público mínimo de fixture | F01 solo necesita existencia y estado para validar membresía. Alta, perfil, precio e inventario son de otras funcionalidades. En pruebas, A/B son sintéticas. |
| `usuario_farmacia` | `id`, `usuario_id`, `farmacia_id`, `rol`, `estado`, fechas y actor del último cambio | Asociación pooled; un usuario puede tener varias farmacias, una membresía vigente por par usuario–farmacia según regla de unicidad. Rol y estado pertenecen **a esa farmacia**, no a la identidad global. Estados propuestos: ACTIVA, SUSPENDIDA, REVOCADA; revocación conserva historial. |
| `delegacion` | membresía, capacidad específica, estado, otorgante, fecha | No concede rol más alto ni se transfiere a otra farmacia. El permiso de aceptar reservas puede quedar representado, pero la operación de reserva pertenece a F04. |
| `sesion` | identificador, `usuario_id`, huella del secreto de sesión, creación, último uso, vencimiento por inactividad/absoluto, revocación | Secreto bruto solo en cookie; estado persistente para revocación y varias instancias API. No guardar rol/farmacia como autoridad duradera. |
| `auditoria_acceso` | identificador, actor o referencia anónima limitada, acción, `farmacia_id` opcional, recurso técnico, resultado, instante, correlación | Acceso restringido; sin contraseña, token, cadena de conexión, datos clínicos ni payload privado bruto. Fallos de login registran señal limitada para evitar enumeración y datos personales innecesarios. |

`usuario_farmacia` referencia a `usuario` y `farmacia_referencia`. `delegacion` referencia a la membresía, no solo al usuario; `sesion` referencia al usuario global. La clave de farmacia en datos privados posteriores se conserva como compromiso arquitectónico, sin crear tablas de Inventario/Reservas en F01.

## Reglas de integridad y migraciones propuestas

- Correo canónico único con validación de formato y tratamiento consistente de mayúsculas/espacios; no exponer si otro usuario lo posee durante login. La respuesta de registro duplicado debe evitar filtración innecesaria y se revisa en contrato.
- FK de membresía a usuario y farmacia; unicidad lógica del par usuario–farmacia para evitar dos roles activos contradictorios. Si se conserva historial de cambios, usar entidad de auditoría en vez de duplicar membresía activa; índices por usuario, farmacia, estado y rol según consultas verificadas.
- La combinación `farmacia_id` + ID de membresía/delegación debe preservar la pertenencia; revisar FK compuestas y constraints para impedir relación cruzada. No usar un índice parcial como destino de FK si PostgreSQL exige clave única no parcial.
- `password_hash` almacena formato/versiones de algoritmo y parámetros para futuras actualizaciones; la sal se genera por credencial. Huella de sesión única, caducidad y revocación indexables; evitar exponer el valor bruto.
- Las migraciones tendrán orden reproducible, revisión de `GRANT`/`REVOKE`, verificación de `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY` donde aplique, `USING` y `WITH CHECK`, y prueba de reversión en base ficticia. El rol de esquema/migración es distinto del runtime; las tablas de negocio no son propiedad del runtime.
- El fixture de dos farmacias, clientes, dueño/admin/persona delegada y administrador de plataforma se carga solo en BD de prueba con identidades ficticias. No genera una vía pública de autoasignación de propietario/admin global.

## Estados y decisiones de acceso

| Objeto | Estado / evento | Resultado autorizado |
|---|---|---|
| Usuario | ACTIVO → INACTIVO | La siguiente verificación de sesión deniega; sesiones afectadas se revocan según política. No borrar trazabilidad. |
| Membresía | ACTIVA → SUSPENDIDA o REVOCADA | Pierde acceso en la siguiente operación; no conserva contexto activo. React puede seguir mostrando selección anterior hasta refrescar, pero API deniega. |
| Sesión | VIGENTE → EXPIRADA/REVOCADA | No autoriza ninguna operación privada; cierre/revocación idempotentes sin reactivar sesión. |
| Delegación | ACTIVA → REVOCADA | La capacidad deja de autorizar; rol base no adquiere esa capacidad por defecto. |
| Farmacia | ACTIVA → INACTIVA (gestionado fuera F01) | F01 rechaza uso de su membresía para operaciones privadas. |

La fuente de decisión de una operación protegida es: sesión vigente + usuario activo + permiso explícito + membresía activa en la farmacia seleccionada cuando corresponde + recurso/acción. El contexto de datos solo se fija **después** de esa validación, por transacción, y el cliente nunca lo impone por ID.

## Modelo de RLS y roles de BD

| Ámbito | Lectura/escritura permitida | Política o control requerido |
|---|---|---|
| Identidad global y sesión | Lookup mínimo de autenticación por correo/huella de sesión; perfil propio tras autenticar | Rol de autenticación restringido, consultas parametrizadas y DTO mínimos; nunca exposición pública de hashes/sesiones. La identidad global no usa `farmacia_id` ficticio. |
| Membresías propias | Actor autenticado ve solo sus filas necesarias para seleccionar farmacia | Política RLS por identidad de actor transaccional, sin requerir aún `app.farmacia_id`; no habilita cambios sobre sí mismo. |
| Membresías de A | Dueño/admin autorizado de A con permiso local explícito concede/revoca solo `TRABAJADOR` de otra persona de A | EXC-01/ROL-01 ratificadas para este alcance, aún sin mutación implementada. Aplicación valida identidad, membresía, actor distinto, recurso y permiso; RLS usa `app.farmacia_id=A` y actor verificado. `USING` controla fila existente y `WITH CHECK` estado/tenant nuevo. |
| Administración global | Solo acción global expresamente permitida y auditable | Política separada y limitada, sin `BYPASSRLS` ni predicado que abra todas las filas por defecto. No se especifica una concesión universal. |
| Auditoría | Actor autorizado o supervisión con permiso específico | No visible para usuario público ni otra farmacia; cuidado con eventos anónimos/globales. |
| Sin contexto tenant | Ninguna fila privada de farmacia | Fail-closed en SELECT/INSERT/UPDATE/DELETE. Mensajes y constraints no revelan datos ajenos. |

Rol runtime de negocio: no propietario, `NOSUPERUSER NOBYPASSRLS`; migración, mantenimiento y trabajadores tienen roles/políticas separados, mínimos y auditados. Se evaluará `FORCE` para el propietario de cada tabla privada. El runtime no puede `TRUNCATE` ni alterar políticas. PostgreSQL advierte que FK/UNIQUE pueden funcionar fuera de RLS para integridad; normalizar errores públicos y probar fugas laterales.

## Contexto de transacción y casos de prueba obligatorios

La secuencia prevista usa un cliente del pool durante toda la transacción. La identidad de actor procede de una sesión verificada; la lectura de membresías propias confirma que la farmacia pedida es válida; solo entonces se establece `app.farmacia_id` con ámbito local a esa transacción y se consultan/escriben filas privadas. Commit o rollback elimina contexto antes de devolver conexión. Las pruebas fuerzan reutilización de la misma conexión entre A y B, rollback, dos solicitudes concurrentes y ausencia de contexto. Un mock de repositorio solo prueba lógica; la aceptación de RLS exige PostgreSQL real y rol runtime real.

Evidencia positiva y negativa: actor de A lee/cambia A según permiso; actor de A no lee/cambia B; autoelevación falla; miembro revocado falla; usuario de A/B cambia de contexto sin mezcla; rol app sin contexto recibe cero filas y no escribe; rol propietario/BYPASSRLS se detecta como configuración insegura. Sin inventario ni reservas implementados, las pruebas se realizan sobre membresía/auditoría F01 y fixtures sintéticos.
