# Implementation Plan: F07.1 — Mi farmacia: datos, ubicación y horario

**Branch**: `feat/f071-mi-farmacia` | **Date**: 2026-11-26 | **Spec**: [spec.md](spec.md) (aprobada el 2026-11-26)
**Estado**: plan **pendiente de aprobación de Andre**. Ningún SQL de F07.1 está en una carpeta que se aplique sola. El borrador `f025/017` no está registrado en el ejecutor de migraciones.

## Resumen técnico
Se reutiliza lo que ya existe y se añade solo lo necesario:
- **F07:** propuesta, publicación verificada y selector de punto `PointPicker`.
- **Contacto:** el flujo versionado de la 014 (`GET/PATCH /farmacias/:id/perfil`).
- **Revisión de plataforma:** se añade una vía de revisión para el administrador de plataforma, en paralelo a la revisión por farmacia de F07, que no se modifica (D-02 A).

## Contexto técnico
- **Stack** (Constitution): React + Vite + JSX; Node + Express + TypeScript; PostgreSQL con RLS y FORCE RLS; Redis cache-aside; Clean Architecture con Unit of Work.
- **Mapa:** Leaflet 1.9.4 con la fuente de teselas ya revisada en F07 (`map-source.js`). Sin geocodificador ni servicio de pago.
- **Pruebas:** Vitest (unitarias, API, RLS en bases TEST efímeras) y Playwright (escritorio y 390 px).
- **Restricciones:** US$0; cero BYPASSRLS en roles de aplicación; migraciones aditivas; no editar F07 001–006 ni F02.5 001–016 ni sus hashes.

## Constitution Check
| Regla | Cumplimiento |
|---|---|
| Multi-tenant sin acceso cruzado | Políticas por `farmacia_id`; el revisor de plataforma solo accede a propuestas y proyección pública, nunca a F02, F04, personal ni documentos. Matriz Alfa/Beta. |
| Sin BYPASSRLS ni permisos globales implícitos | Concesión explícita, aprobada y auditada (D-01 A). Las funciones SECURITY DEFINER pertenecen a roles NOLOGIN NOBYPASSRLS, como `f025_policy`. |
| El backend autoriza cada acción | Casos de uso más RLS; la pestaña solo refleja las capacidades. |
| SDD | Plan y tasks con aprobación; SQL mostrado antes de ejecutarlo. |

## Diseño por partes

### 1. Permiso de ubicación del propietario (FR-007)
- Borrador [`017_owner_location_test.sql`](../../backend/migrations/f025/017_owner_location_test.sql), hash `CC87C9880E82DAC6796F11A0755FA8E880ED45CB68EECF35A93C6FCE7F131B9A`, **para tu revisión**. Mismo patrón que la 016:
  - una política de alta limitada a `GEO_LOCATION_PROPOSE`;
  - un disparador en la activación;
  - una reparación única y repetible, atribuida al revisor original y auditada como aplicada por la migración.
- Corre como `f01_migrator`, superusuario del clúster TEST, igual que la 016. No concede `GEO_LOCATION_REVIEW`.
- **Numeración:** esta toma `f025/017`; la spec 020 usará `f025/018`.

### 2. Revisión por el administrador de plataforma (FR-005, D-01 A)
Migración nueva `f07/007_platform_location_review.sql`. Solo se escribe tras tu aprobación, porque las migraciones de F07 se aplican solas.
- **Concesión:** tabla `f07.platform_location_grant` (actor, estado, aprobación, hash de aprobación, motivo y fechas), con RLS: el actor solo ve sus filas, y solo el guion TEST de aprovisionamiento (como migrador) da de alta.
- **Función `f07.can_platform_location_review(scope uuid)`:** SECURITY DEFINER y propiedad de un rol NOLOGIN NOBYPASSRLS. Es verdadera solo si se cumplen las cuatro condiciones:
  - sesión vigente, validada con `f025.authenticated_actor()`;
  - rol `ADMINISTRADOR_PLATAFORMA` activo;
  - concesión activa;
  - el actor **no es miembro, en ningún estado, de la farmacia `scope`**.
- **Políticas nuevas** (aditivas; las de F07 no cambian):
  - `ubicacion_propuesta`: SELECT solo de propuestas `PENDIENTE` o decididas por el propio revisor; UPDATE solo de la última `PENDIENTE` de cada farmacia, con quien propone ≠ quien revisa.
  - `ubicacion_auditoria`: INSERT de `APROBACION` y `RECHAZO`.
  - `f03.farmacia_publica`: SELECT y UPDATE de publicación, con las mismas comprobaciones de igualdad con la propuesta y de versión que la 005.
- **Nombre de la farmacia para el revisor:** se obtiene con una función de solo lectura que devuelve nombre público, dirección publicable, ciudad, coordenadas, fuente y estado. Nunca devuelve el contacto, el RUC, documentos ni el inventario.
- **API:**
  - `GET /api/v1/platform/location-proposals` (lista);
  - `POST /api/v1/platform/location-proposals/:id/decision` (APROBAR o RECHAZAR, con motivo y confirmación de evidencia, y versión).
  - Ambas con CSRF y límite de peticiones, como en F02.5.
- **D-04 A sin tocar F07:** la tabla de F07 no admite el estado «Reemplazada». Por eso, al llegar una propuesta nueva, la anterior se muestra en el historial como «Reemplazada» (se calcula al leer). La revisión de plataforma solo acepta la **última** pendiente, y la versión pública (`base_public_version`) impide publicar algo antiguo.

### 3. Pestaña «Mi farmacia» (FR-001, 002, 003, 004, 006)
- La sección `mi-farmacia` sustituye a «Farmacia y ubicación» en el panel. Es visible con `pharmacy.profile.read` o `GEO_LOCATION_PROPOSE`.
- Tiene tres bloques: **Contacto** (formulario de la 014, edición inmediata, con versión y auditoría), **Dirección y ubicación** (`LocationAdmin` con `PointPicker`) y **Historial**.
- **Ubicación del dispositivo:** botón «Usar la ubicación de este dispositivo», con una sola llamada a `getCurrentPosition` (sin `watchPosition`) que solo rellena el pin. Si se niega el permiso, se usa el pin o las coordenadas escritas.
- **Límites del Perú (aproximados):** latitud −18,4 a 0,1; longitud −81,4 a −68,6. Se validan en el servidor y en la pantalla.
- **Estado visible:** «En revisión», «Verificada» o «Rechazada (motivo)», según la última propuesta y la proyección pública.
- **Historial:** propuestas y decisiones con fecha, autor (nombre del propio usuario o «Revisión de FarmaFind») y motivo, sin identificadores internos.
- El bloque de contacto deja de mostrarse en `/inventory`.

### 4. Horario de atención (P2, FR-008, D-03 A)
- Migración nueva `f07/008_opening_hours.sql`, también tras tu aprobación.
- **Tabla `f07.horario_atencion`:** farmacia, día ISO 1–7, `abre`, `cierra`, `cerrado`, versión, autor y fecha, con CHECK `cerrado OR abre < cierra`. RLS por farmacia: escritura con `pharmacy.profile.write` y lectura con `pharmacy.profile.read`, mediante una función con el mismo patrón que la 014.
- **Lectura pública:** función de proyección propiedad de `f03_projection_owner` que devuelve el horario solo de farmacias activas.
- **Integración:** la búsqueda y el mapa lo piden aparte, por lista de farmacias. **No se modifica `search_public_offers`**, así no choca con la spec 020.
- **API:** `GET/PUT /api/v1/farmacias/:id/horario` (privada, con versión) y `GET /api/v1/farmacias-publicas/horarios?ids=…` (pública, con caché Redis e invalidación al guardar).

### 5. «Mi perfil» visible (P2, FR-009, D-05 A)
- Ruta nueva `/mi-perfil` que reutiliza `Profile.jsx`, sin cambiar sus reglas.
- En «Mi cuenta», «Mi perfil» apunta a `/mi-perfil`; `/identity` conserva el desplegable.

## Pruebas (por capas)
1. **SQL `f025/017`:** la activación concede solo al dueño; trabajador y administrador global quedan sin el permiso; un insert directo se rechaza; la reparación es idempotente y respeta las revocaciones.
2. **RLS de la revisión de plataforma** (base efímera):
   - el revisor lee y decide pendientes de Alfa y Beta, pero no puede leer F02, F04, personal, contacto ni documentos;
   - el revisor que es miembro de la farmacia es rechazado;
   - quien propone no puede aprobar;
   - se rechazan decisiones sobre una propuesta que no es la última y versiones obsoletas;
   - la conexión reutilizada Alfa → Beta no filtra datos.
3. **Horario:** reglas de horas, RLS Alfa/Beta y proyección pública solo de farmacias activas.
4. **API y unitarias**, frontend: pestaña, estados, historial, botón de dispositivo simulado y horario.
5. **Navegador:** propietario propone → administrador aprueba → aparece «Verificada» en el mapa; rechazo; horario en búsqueda y mapa; «Mi perfil» desde «Mi cuenta»; escritorio y 390 px.
6. **Regresión:** F07 completo, F02.5, F01.1, F03 y F08; `check`, build y CI.

## Riesgos y mitigación
| Riesgo | Mitigación |
|---|---|
| Revisor con alcance entre farmacias | Políticas solo sobre propuestas y proyección pública; prueba explícita de que no ve datos privados. |
| Autoaprobación | Ya está en el CHECK de F07 (quien propone ≠ quien revisa), más la exclusión de miembros en la función. |
| Ubicación del dispositivo | Una lectura con permiso; no se guarda nada fuera de la propuesta. |
| Choque con la spec 020 | El horario va aparte de `search_public_offers`; las migraciones `f025` se renumeran. |
| Cambiar lo aprobado de F07 | Solo políticas y funciones nuevas; regresión completa de F07. |

## Decisiones de la spec aplicadas por defecto (confírmalas)
D-01 A · D-02 A · D-03 A · D-04 A (implementada sin tocar F07, como se explica en la parte 2) · D-05 A · T057 A.

## Aplicación a la DEMO
Solo tras tu aprobación del SQL (`f025/017`, `f07/007` y `f07/008`). Será un reinicio único, que aplica todo en orden. Después se reporta: permisos de HUAMANFAR antes y después, propuestas, y que inventario, importaciones y reservas siguen intactos.

## Project Structure (archivos previstos)
- `backend/migrations/f025/017_owner_location_test.sql` (borrador listo), `backend/migrations/f07/007_platform_location_review.sql`, `backend/migrations/f07/008_opening_hours.sql`.
- `backend/src/modules/farmacias/`: casos de uso de revisión de plataforma y de horario; repositorios; routers `platform-locations-router.ts` y `opening-hours-router.ts`.
- `frontend/src/pharmacies/MyPharmacy.jsx`, `frontend/src/geolocation/LocationAdmin.jsx` (estado, historial y dispositivo), `frontend/src/platform/LocationReview.jsx`, `frontend/src/pharmacies/OpeningHours.jsx`, página `/mi-perfil`, `navigation.js` y `routes.js`.
- Pruebas: `backend/tests/geolocation/f071-*.test.ts`, `scripts/f025/verify-application-commands.mjs` (casos de la 017), `frontend/tests/f071/*.test.jsx`, `frontend/e2e/f071-mi-farmacia.spec.js`.
