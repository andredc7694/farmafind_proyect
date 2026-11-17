# Recuperación de las rutas locales F00–F06 (2026-11-17)

Estado: verificación técnica local en Windows 10; no es una validación de producción.

## Causa reproducida

Con `npm run dev:api`, `/health` respondió 200, pero `GET /api/v1/busquedas`, `GET /api/v1/auth/csrf`, `GET /api/v1/reservas` y `POST /api/v1/asistente/consultar` devolvieron 404. El proxy de Vite también devolvió 404 para búsqueda. Ese comando inicia solamente `backend/dist/main.js` (bootstrap F00); el frontend sí usa la ruta `/api/v1` y el proxy esperado. PostgreSQL y Redis locales estaban sanos; la causa de los mensajes genéricos fue la ausencia de las rutas de F01–F06 en el proceso API utilizado.

Además, la pantalla F04 ocultaba las reservas propias hasta seleccionar una farmacia de membresía. F04 permite al cliente autenticado consultar y crear reservas sin pertenecer a la farmacia. Se corrigió solo la condición de presentación: la cola y configuración de farmacia siguen requiriendo membresía y permiso del servidor.

## Corrección y datos

`npm run prepare:local` aplica las cuatro migraciones F04 aprobadas únicamente al fixture F03 `F03_TEST_ONLY`, cuyo nombre cumple `farmafind_f01_test_<12 hex>`. `npm run dev:local` compone identidad, catálogo, inventario, búsqueda, reservas y MockAIProvider sobre ese mismo TEST aislado; Notificaciones permanece como proceso independiente. El arranque verifica que F01–F04 existan y tengan RLS y FORCE RLS. No se alteró `farmafind_f01_test` ni se ejecutó BOOT-01/GLO-01.

El enlace desde cada oferta pública lleva a una solicitud de reserva con los identificadores públicos. El servidor sigue validando sesión, farmacia, disponibilidad, CSRF y autorización. La consulta de reservas propias se muestra también a clientes sin membresía. No se añaden permisos ni endpoints de negocio.

## Resultados observados

| Verificación | Resultado |
|---|---|
| API original F00 y proxy `/api/v1` | 404 para las cuatro rutas afectadas |
| API integrada TEST, HTTP real | Búsqueda con dos ofertas 200; sin coincidencias 200 y `ofertas: []`; CSRF 200; reservas anónimas 401; asistente informativo 200 y rechazo clínico `CLINICA_RECHAZADA` 200 |
| Registro/sesión/reserva TEST por HTTP real | Registro 202, login 200, membresías vacías 200, reservas propias 200, cola administrativa denegada, creación de reserva 201 |
| Proxy Vite temporal 5174 → API 38001 | `/search`, `/assistant`, `/reservations` 200; búsqueda 200; CSRF 200; reserva anónima 401; rechazo clínico 200 |
| Chrome sin interfaz sobre TEST | Búsqueda, rechazo de dosis, registro, login, reservas propias sin membresía y creación desde oferta: correctos. La instancia temporal 5174 retransmitió solo mutaciones con `Origin: http://127.0.0.1:5173`, igual al origen normal aprobado; no se cambió la política CSRF |
| PostgreSQL / Redis | Contenedores saludables; F03 fixture verificado antes/después; base persistente intacta; fallback PostgreSQL con Redis inalcanzable: correcto |
| Regresión y contratos | `npm run test:base`: 285 pasadas, 88 omitidas por prerrequisitos; F03 Redis 3, F01 RLS 52, F02 RLS 14, F03 RLS 4, F04 RLS 16, F05 RLS 4, F01 API 26, F06 32; OpenAPI 36 operaciones |
| Compilación y arquitectura | `npm run check` y `npm run build` correctos; `git diff --check` sin errores |

La primera ejecución de `npm run test:f01:rls` fue detenida por revisión automática hasta acreditar que no alteraba la base persistente. Tras inspeccionar sus diez archivos, se confirmó que el URL de `farmafind_f01_test` se usa para crear y eliminar bases TEST efímeras y roles de prueba; las escrituras y el bootstrap de prueba ocurren en esas bases aisladas. La suite se ejecutó después y pasó 52/52 pruebas. La verificación posterior del fixture volvió a confirmar que la base persistente conservó sus conteos originales.

## Uso local normal

Mantener PostgreSQL y Redis locales activos. Si el terminal de API ejecuta `npm run dev:api`, detener **ese** proceso con Ctrl+C y, desde la raíz del repositorio, ejecutar `npm run prepare:local` una vez y luego `npm run dev:local`. Mantener `npm run dev:web` y `npm run dev:notifications` en sus terminales. Abrir `http://127.0.0.1:5173/search`, `/assistant` o `/reservations`. El fixture F03 de prueba debe existir antes de `prepare:local`; si falta, generar solo un fixture TEST siguiendo el quickstart F03. No iniciar dos procesos API en el puerto 3000. Las credenciales de prueba permanecen en `.cache` ignorado por Git y no se imprimen.
