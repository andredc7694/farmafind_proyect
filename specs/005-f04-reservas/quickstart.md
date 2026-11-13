# F04 — Guia local de validacion

## Entorno observado

- Windows 10, Node.js 24.17.0 y npm 11.13.0.
- PostgreSQL oficial `postgres:18.6-bookworm` en `127.0.0.1:55431`.
- Credenciales ficticias en `.cache/`, ignoradas por Git.

## Controles ejecutables

```powershell
docker compose -f compose.f01-postgres.yaml up -d postgres
npm.cmd run test:f04:unit
npm.cmd run test:f04:api
npm.cmd run test:f04:rls
npm.cmd run test:f04:load
npm.cmd run check:f04
npm.cmd run build
npm.cmd run test:base
npm.cmd audit --audit-level=low
```

Las pruebas RLS/carga crean y eliminan solo bases TEST con sufijo aleatorio. No reconstruyen
`farmafind_f01_test` ni eliminan volumenes. Para detener sin borrar datos:

```powershell
docker compose -f compose.f01-postgres.yaml stop postgres
```

`npm.cmd run dev:f04` requiere `.cache/f04-fixture/state.local.json`, ignorado por Git y con
URLs ficticias locales. Con frontend activo, abrir `http://127.0.0.1:5173/reservations`.

## Aceptacion pendiente

`frontend/tests/reservations/f04.spec.js` debe ejecutarse con Playwright en Linux oficialmente
compatible. Hasta entonces F04 esta implementada y validada localmente, con aceptacion final pendiente.
