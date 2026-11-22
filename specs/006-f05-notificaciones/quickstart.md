# Quickstart: F05 — Validación local

## Prerrequisitos

- Windows 10, Node.js 24.17.0, npm 11.13.0.
- Docker Desktop y PostgreSQL de `compose.f01-postgres.yaml`.
- Variables ficticias locales ignoradas: conexiones TEST y secreto HMAC F05.

## Controles previstos

```powershell
docker compose -f compose.f01-postgres.yaml up -d --wait postgres
npm.cmd run test:f05:unit
npm.cmd run test:f05:api
npm.cmd run test:f05:rls
npm.cmd run test:f05:recovery
npm.cmd run check:f05
npm.cmd run build
npm.cmd run test:base
npm.cmd audit --audit-level=low
```

`scripts/f05/check.mjs` carga la credencial PostgreSQL exclusivamente desde `.cache` para
la suite RLS. El worker `scripts/f05/publish.mjs` se ejecuta solo después de `npm run build`
y exige `F05_DATABASE_URL`, `F05_NOTIFICATIONS_URL` y `F05_INTERNAL_SECRET` en el proceso
local; no se versionan valores. La URL de base y el endpoint quedan limitados a loopback.

Las suites PostgreSQL crean una base TEST con sufijo aleatorio, aplican migraciones F01, F02,
F04 y F05 y eliminan únicamente esa base al terminar. No alteran `farmafind_f01_test`.

## Resultado esperado

- Notificaciones caída: Reserva confirma y Outbox permanece pendiente.
- Servicio recuperado: eventos se publican y cada uno produce una entrega local.
- Reenvíos idénticos son estables; huella distinta devuelve conflicto.
- Alfa/Beta, firma inválida y roles excesivos se rechazan.
- Cien eventos con dos publicadores terminan sin pérdida ni duplicación lógica.

Para detener PostgreSQL sin borrar volúmenes:

```powershell
docker compose -f compose.f01-postgres.yaml stop postgres
```

No se configura correo, SMS, push, proveedor, AWS ni destinatario humano.
