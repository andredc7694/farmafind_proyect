# Evidencia F07.1

## T001–T002 · 2026-11-26
- Borradores en `sql-review/` (no se aplican solos): `007_platform_location_review.sql` (`6D7E0C11…3BB0F9`) y `008_opening_hours.sql` (`0A6EB089…26D2EBF`), con la matriz de 21 casos en `sql-review/README.md`. No se ejecutó nada: es una entrega de redacción para la revisión de Andre (T003).
- Comprobado leyendo el código: las coordenadas de las pruebas F07 están dentro de los límites del Perú; las tablas F01 usadas por `f071_policy` (`usuario`, `platform_role_assignment`) no tienen RLS; `sesion` y `usuario_farmacia` sí, de ahí sus dos políticas nuevas de solo lectura.

## T003 · 2026-11-26
- **Bases donde se ejecutan:** `migrateF07TestDatabase` solo acepta `127.0.0.1:55431/farmafind_f01_test_<12 hex>`, con usuario no runtime y la marca de base «FarmaFind F07 TEST efimera». Rechaza `farmafind_f01_test` antes de conectar (prueba existente en `backend/tests/geolocation/migrations.test.ts`). En la práctica: bases efímeras de pruebas F07 y F02.5 y, al reiniciar, la base TEST de la DEMO (marcada).
- Copiados sin cambios a `backend/migrations/f07/` (hashes idénticos). No había lista de hashes de F07: el ejecutor exigía exactamente seis archivos. Ahora usa una **lista cerrada** de los ocho aprobados, con hash obligatorio para 007 y 008 (001–006 sin hash histórico, sin cambios).
- Prueba estática nueva `f071-migrations.test.ts`: lista cerrada, hashes, sin DROP/ALTER POLICY, sin BYPASSRLS, sin `f025.` y con propietarios internos. 7 pruebas en verde (2 omitidas por necesitar base de datos).
- DEMO (consulta de solo lectura dentro del contenedor, sin usar sus puertos): `f025-reviewer-…@example.invalid` tiene `ADMINISTRADOR_PLATAFORMA` ACTIVA desde el 2026-11-21 y 0 membresías de farmacia.
- Matriz ampliada con el caso 22 (columnas visibles de la propuesta y de la proyección pública).

## T004–T007 · 2026-11-26 (servidor, sin puertos)
- T004 revisión de plataforma: `PlatformLocationReview`, `PgPlatformLocationRepository` y `platform-locations-router.ts` (`GET /platform/location-proposals`, `POST …/:id/decision`). Solo la última pendiente, nunca la propia, versión obligatoria y motivo; reutiliza decide/publish/audit de F07 bajo las políticas de la 007.
- T005 estado e historial: `GET /farmacias/:id/ubicacion` (`buildLocationStatus`), con «Reemplazada» calculada y autores «Tú», «Otra persona de la farmacia» o «Revisión de FarmaFind».
- T006 límites del Perú en `parseLocationProposal` (los mismos que la restricción de la 007).
- T007 horario: dominio (`parseOpeningHours`), `ManageOpeningHours` (versión y conflicto), `ReadPublicOpeningHours` (cache-aside Redis, máximo 50 ids) y `opening-hours-router.ts`. Montado en la composición con geolocalización TEST.
- Pruebas: `backend/tests/geolocation` 45 en verde (incluye 13 nuevas de `f071-server.test.ts` y 4 de `f071-migrations.test.ts`); 15 omitidas por necesitar PostgreSQL (después de T057). `tsc` correcto.
- **Corrección:** en el commit `cc0d230` se anotó por error que `check` pasaba; en realidad falló por la regla de arquitectura (Redis solo en la infraestructura de búsqueda F03 y acceso entre módulos solo por contratos). Se movió la caché del horario a `busqueda/infrastructure/redis-opening-hours-cache.ts` con el contrato `farmacias/contracts/opening-hours.ts`. Ahora `check` es correcto (306 archivos) y las 45 pruebas siguen en verde.

## T008–T011 · 2026-11-26 (pantalla, sin puertos)
- T008 «Mi farmacia» (`MyPharmacy.jsx`): sustituye a «Farmacia y ubicación». Reúne el contacto (ya no aparece en `/inventory`), la dirección y la ubicación (`LocationAdmin` con estado, historial, límites del Perú y la lectura única del dispositivo de `PointPicker`) y el horario. Se quitó el enlace de menú «Ubicación de farmacia»: la ubicación vive en el panel y `/ubicacion` sigue por enlace directo.
- T009 «Revisar ubicaciones» (`/admin/farmacias/ubicaciones`, `LocationReview.jsx`): solo datos públicos. El enlace aparece solo si el servidor responde 200.
- T010 horario: editor (`OpeningHoursEditor`) y muestra pública «Hoy: …» en la búsqueda y en el mapa (`PublicOpeningHours`, hora de Lima).
- T011 `/mi-perfil` (`ProfilePage.jsx`), enlazada desde «Mi cuenta». Las reglas del perfil no cambian.
- Pruebas: frontend 246/246 (11 nuevas en `frontend/tests/f071`; 5 existentes actualizadas al cambio aprobado: nombre «Mi farmacia» y sin enlace «Ubicación de farmacia»). E2E `a11y` y `f081-experience` actualizados en el texto, **sin ejecutar** hasta después de T057. `check` correcto (312 archivos). Build del frontend correcto (en la copia de trabajo, con el modo de la app pasado como variable temporal).
