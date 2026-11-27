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

## T020–T023 y T025 · 2026-11-26 (sugerencia de dirección y ubicación)
- T020 `AddressSuggestions` (límite global de 1/s, caché en memoria de 24 h con 500 entradas, espera máxima de 3 s, fallo externo → sin sugerencia) y `NominatimGeocoder` (Perú, `limit=1`, español, 4 s, User-Agent «FarmaFind-DEMO/0.1 (proyecto local de pruebas)», calle sin número). Sin registros de lo consultado.
- T021 `POST /farmacias/:id/ubicacion/sugerencias/buscar` e `/inversa`: sesión, CSRF, `GEO_LOCATION_PROPOSE`, 503 si está apagado. Interruptor `addressSuggestions`: apagado por defecto en la composición; `demo-serve.mjs` lo enciende en TEST/DEMO (se apaga con `FARMAFIND_ADDRESS_SUGGESTIONS=off`).
- T022 `peru-cities.js`: 25 capitales departamentales y el Callao, Ayacucho/Huamanga, 11 ciudades grandes y 32 distritos de Lima; centra el mapa sin servicio externo.
- T023 formulario: «Buscar en el mapa» solo al pulsar; marcador arrastrable con búsqueda inversa y aviso «Ubicación aproximada: completa el número»; fuente automática; referencia opcional con advertencia; «Opciones avanzadas: coordenadas»; etiquetas encima. En pantallas estrechas con formulario, la burbuja del asistente queda solo como icono y no tapa «Enviar propuesta» (comprobado en Chrome a 390 px; en la primera captura sí lo tapaba y se corrigió).
- Pruebas, todas con el servicio **simulado**: backend geolocalización 55/55 (10 nuevas de sugerencias) y frontend 253/253 (7 nuevas; 2 existentes actualizadas al formulario enmendado). En una corrida intermedia el frontend reportó 52 archivos y 250 pruebas sin fallos; al repetirla dio 53/253. `check` correcto (314 archivos) y build correcto.
- T025: decisión registrada en `research.md` (R-06), en la enmienda de `spec.md` y en `approval.md`.
- Copia temporal: solo se reinició su API (3001), con el interruptor encendido; la revisión en Chrome no hizo ninguna consulta a Nominatim. DEMO (3000/5173) y su Redis intactos.

## T024 · 2026-11-26
- **Andre revisó la copia temporal y da conforme** la mejora del formulario de dirección y ubicación (búsqueda, completar al marcar, respaldo de ciudades y formulario ordenado). La copia sigue encendida a pedido suyo.

## T026–T031 · 2026-11-26 (historial de «Revisar ubicaciones», enmienda D-06 A)
- T026–T027: enmienda y SQL `f07/009` aprobados por Andre; la 009 se copió sin cambios a `backend/migrations/f07/` y entró en la lista cerrada con su hash `21B8A3F6…845BF`. No se editaron la 007 ni la 008.
- T028 servidor: `GET /api/v1/platform/location-proposals/historial?estado=PENDIENTE|APROBADA|RECHAZADA&pagina=N` (20 por página, de la más reciente a la más antigua). Solo devuelve farmacia, dirección, ciudad, coordenadas, decisión, motivo, fechas y «Tú» u «Otro revisor de FarmaFind». No devuelve identificadores de usuario.
- T029 pantalla: filtro Pendientes, Aprobadas y Rechazadas; historial paginado; formulario de decisión con cada campo bajo su propia etiqueta.
- Pruebas: backend geolocalización 59 en verde y 15 omitidas por necesitar PostgreSQL. Frontend 256/256, con 54 archivos. `check` correcto con 315 archivos.
- Incidencia: Docker Desktop se detuvo y dejó sin PostgreSQL ni Redis a la DEMO y a la copia. Con permiso de Andre (opción A) se encendieron solo `farmafind-f025-postgres` y `farmafind-f03-search-redis`. No se reiniciaron los procesos de la DEMO.
- T030: la matriz H1 a H8 se ejecutó en la base efímera de la copia (`farmafind_f01_test_0627f4917a55`, nunca la DEMO) y dio **18/18 OK**. Todo se hizo en una transacción que se revirtió al final. La 009 ya estaba aplicada desde el intento anterior, y se confirmó que sus dos políticas existen.
  - H1: el revisor ve las decisiones y los motivos de otro revisor.
  - H2: un revisor que es miembro de una farmacia no la ve.
  - H3: sin concesión o siendo dueño, no ve nada.
  - H4: no lee inventario, movimientos, reservas, perfil, documentos, membresías ajenas ni delegaciones.
  - H5: solo devuelve los campos aprobados y ningún identificador.
  - H6: orden y paginación sin repeticiones.
  - H7: con la concesión revocada ya no ve nada.
  - H8: no se puede decidir una propuesta antigua.
- T031: solo se reinició la API de la copia (3001) con el código nuevo. Se crearon por la API datos ficticios: una propuesta rechazada, una aprobada y una pendiente.
  - En Chrome a 1280 y a 390 px se ven los tres filtros, las tarjetas con los campos aprobados y la paginación, sin desplazamiento lateral.
  - La primera captura de «Rechazadas» en PC mostró «Cargando…» porque el guion no esperó a que terminara la carga; a 390 px sí se ve la tarjeta.
  - La DEMO (3000 y 5173) respondió 200 y no se tocó.
