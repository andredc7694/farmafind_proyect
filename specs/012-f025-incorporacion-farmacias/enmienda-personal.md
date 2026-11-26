# Enmienda F02.5 · El propietario activado gestiona su personal (F025-FR-029)

**Estado:** plan y tasks **pendientes de aprobación de Andre**. El SQL es un borrador: **no se ha ejecutado** en ninguna base y no está registrado en el ejecutor de migraciones.

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

## Efecto en tu DEMO (HUAMANFAR)
- **Antes:** el dueño `yes@farma.find` tiene 9 permisos (inventario y reservas) y no ve «Personal».
- **Después:** gana solo `membership.manage`, con una línea de auditoría nueva. No se borra ni se modifica nada: inventario, importaciones, reservas, catálogo, solicitudes y cuentas siguen igual. La aplicación empieza a mostrarle «Personal».
- **Cuándo:** solo tras tu aprobación del SQL. Es un único paso en una transacción; si falla, no cambia nada. El arranque de la DEMO ya aplica las migraciones pendientes, así que bastaría reiniciarla (unos 5 a 10 minutos sin servicio).
- **Observación (fuera de este alcance):** HUAMANFAR tampoco tiene `pharmacy.profile.read/write` (la 014). Probablemente se activó antes de que existiera esa migración. No lo corrijo sin tu orden.

## Tasks
- [ ] T065 Aprobación de Andre del SQL `016` (hash `361365757C3CFB75354ACC0EBAF0825A26157B94214DAC5BC265981BE2DE9C4A`) y de este plan (FR-029).
- [ ] T066 Registrar `016` en `migrate-f025.ts`. Pruebas SQL: la activación concede la capacidad de forma atómica; trabajador y administrador global no la obtienen; un insert directo del ejecutor con otra membresía se rechaza; la reparación es idempotente y respeta las revocaciones.
- [ ] T067 Recorrido HTTP/E2E en una base TEST efímera: solicitud → aprobación → el propietario abre «Personal» → crea un empleado → el empleado entra con la clave temporal. Aislamiento Alfa/Beta.
- [ ] T068 Regresión: F01.1, F02.5 (RLS, comandos, activación), spec 017, check, build y frontend. Evidencia en `evidence.md`.
- [ ] T069 Con tu autorización ya dada tras T065: aplicar a tu DEMO, verificar HUAMANFAR antes y después, y avisarte. T057 sigue siendo tuya.
