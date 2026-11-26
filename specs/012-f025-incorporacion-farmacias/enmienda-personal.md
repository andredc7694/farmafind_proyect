# Enmienda F02.5 · El propietario activado gestiona su personal (F025-FR-029)

**Estado (2026-11-26):** SQL aprobado por Andre en lo esencial; **bloque ampliado de reparación pendiente de su aprobación**. Hash final `2667F61535861CB30852A3ACE1A867015A7AE68245EF254F9AFEBADCC7DF27AE`, registrado en `migrate-f025.ts`. Probado solo en bases TEST técnicas; **no aplicado a la DEMO**.

## Hallazgo (2026-11-26)
Los propietarios creados al activar una solicitud aprobada reciben permisos de inventario (009), reservas (013) y perfil (014), pero no `membership.manage`. Sin él, el panel oculta «Personal» y el servidor rechaza crear o invitar trabajadores. La gestión de personal (F01.1) ya existe y está aceptada. Solo la probaron las farmacias Alfa y Beta, que la DEMO crea por guion con ese permiso.

## Plan
1. **Migración nueva y aditiva** `backend/migrations/f025/016_owner_staff_manage_test.sql`. No modifica la 009, la 013 ni la 014, y tampoco sus hashes. Sigue el mismo patrón que la 013 y la 014:
   - **RLS (aviso):** hace falta **una política nueva de alta** (`f025_owner_staff_manage_insert`) sobre `f01.delegacion`, solo para `f025_activation_executor` y solo para `membership.manage`. Es imprescindible, porque la tabla tiene FORCE RLS y las políticas existentes limitan las capacidades por nombre. No cambia ni elimina ninguna política existente.
   - **Disparador `AFTER INSERT ON f025.activacion`:** concede la capacidad en la misma transacción que la membresía (atómico) y con las mismas guardas TEST y de revisor.
   - **Reparación única:** alcanza a los propietarios vigentes de activaciones aprobadas que nunca tuvieron la fila. Si la capacidad fue revocada a propósito, no se vuelve a conceder. Cada alta se audita en `f01.auditoria_identidad` como `CAPABILITY_GRANT`, sin actor humano y con una correlación común.
2. Registrar la migración y su hash en `migrate-f025.ts` **solo después de tu aprobación del SQL**.
3. **Sin autoescalada:** el trabajador sigue sin poder recibir ni delegar `membership.manage` (F01.1). El administrador global no tiene membresía en la farmacia, así que la política no le aplica.
4. **Numeración:** la spec 020 usará la siguiente libre (`f025/017`) en lugar de `016`.

## Ampliación aprobada en principio (2026-11-26)
- La reparación concede además `pharmacy.profile.read` y `pharmacy.profile.write` (los que da la 014 a las activaciones nuevas) con las mismas reglas: solo el propietario activo de una activación aprobada; no toca filas existentes, vigentes o revocadas; una auditoría `CAPABILITY_GRANT` por alta; repetible.
- **Comparación de solo lectura de HUAMANFAR** (activada el 2026-11-21 22:20; la 014 se aplicó a su base el 2026-11-22): los disparadores conceden 009 (5 de inventario), 013 (4 de reservas) y 014 (2 de perfil); la 015 no concede ninguno. Le faltan **solo** `pharmacy.profile.read` y `pharmacy.profile.write` (y `membership.manage`, nueva en la 016).
- **Atribución:** cada delegación reparada queda a nombre del **revisor original** que activó la farmacia (`granted_by_usuario_id = activacion.revisor_id`). La auditoría la identifica como **aplicada por la migración**: `actor_usuario_id` NULL, `objetivo_usuario_id` = propietario, `farmacia_id` y una `correlation_id` común a toda la ejecución.
- **Rol y RLS:** la reparación corre dentro de la migración, como `f01_migrator`, que en el clúster TEST es superusuario (`rolsuper` y `rolbypassrls`), igual que todas las migraciones 001–015. Por eso RLS no se evalúa en ese bloque. **La ampliación no añade ni cambia políticas.** La única política nueva de la 016 sigue siendo `f025_owner_staff_manage_insert`, para las activaciones nuevas. Fuera de las migraciones, ningún rol de la aplicación obtiene BYPASSRLS.
- **Hashes:** la 016 es un archivo nuevo. No edita la 001–015, sus hashes aprobados ni la lista de `prepare.mjs`; solo añade su línea a `migrate-f025.ts`.

## Efecto en tu DEMO (HUAMANFAR)
- **Antes:** el dueño `yes@farma.find` tiene 9 permisos (inventario y reservas) y no ve «Personal».
- **Después:** gana `membership.manage`, `pharmacy.profile.read` y `pharmacy.profile.write` (12 permisos), con tres líneas de auditoría nuevas. No se borra ni se modifica nada: inventario, importaciones, reservas, catálogo, solicitudes y cuentas siguen igual. La aplicación empieza a mostrarle «Personal».
- **Cuándo:** solo tras tu aprobación del SQL. Es un único paso en una transacción; si falla, no cambia nada. El arranque de la DEMO ya aplica las migraciones pendientes, así que bastaría reiniciarla (unos 5 a 10 minutos sin servicio).
- **Observación (fuera de este alcance):** HUAMANFAR tampoco tiene `pharmacy.profile.read/write` (la 014). Probablemente se activó antes de que existiera esa migración. No lo corrijo sin tu orden.

## Tasks
- [ ] T065 Aprobación de Andre del SQL `016` (hash `361365757C3CFB75354ACC0EBAF0825A26157B94214DAC5BC265981BE2DE9C4A`) y de este plan (FR-029).
- [X] T066 Registrar `016` en `migrate-f025.ts`. Pruebas SQL: la activación concede la capacidad de forma atómica; trabajador y administrador global no la obtienen; un insert directo del ejecutor con otra membresía se rechaza; la reparación es idempotente y respeta las revocaciones.
- [X] T067 Recorrido HTTP/E2E en una base TEST efímera: solicitud → aprobación → el propietario abre «Personal» → crea un empleado → el empleado entra con la clave temporal. Aislamiento Alfa/Beta.
- [X] T068 Regresión: F01.1, F02.5 (RLS, comandos, activación), spec 017, check, build y frontend. Evidencia en `evidence.md`.
- [ ] T069 Con tu autorización ya dada tras T065: aplicar a tu DEMO, verificar HUAMANFAR antes y después, y avisarte. T057 sigue siendo tuya.
