# F03 — Guía prevista de validación local

**Estado:** diseño. Estos comandos se verificarán durante implementación; no declaran F03 ejecutada.

## Prerrequisitos

- Rama `feat/f03-consultas-publicas`, Node.js 24.17.0 y npm 11.13.0.
- Docker Desktop en Windows 10 para PostgreSQL y Redis aislados.
- Secretos ficticios ignorados por Git.
- Dataset separado con Farmacia Alfa/Beta y referencias ficticias. No alterar `farmafind_f01_test` ni ejecutar BOOT-01/GLO-01.

## Preparación prevista

```powershell
docker compose -f compose.f01-postgres.yaml up -d postgres
docker compose -f compose.f03-search.yaml up -d redis
npm.cmd ci --ignore-scripts
npm.cmd run build
node scripts/f03/fixture.mjs prepare
node scripts/f03/fixture.mjs verify
```

El compose enlazará puertos solo a `127.0.0.1`, usará imágenes exactas y healthchecks. Para detener sin borrar:

```powershell
docker compose -f compose.f03-search.yaml stop redis
docker compose -f compose.f01-postgres.yaml stop postgres
```

No usar `down -v`.

## Controles previstos

```powershell
npm.cmd run check
npm.cmd run build
npm.cmd run test:base
npm.cmd run test:f03:unit
npm.cmd run test:f03:integration
npm.cmd run test:f03:rls
npm.cmd run verify:f03:demo
npm.cmd audit --audit-level=high
git diff --check
```

1. Buscar sin sesión por nombre comercial/principio activo y comprobar estado vacío.
2. Comparar Alfa/Beta por precio/disponibilidad; comprobar dirección, revisión y aviso.
3. Cercanía con coordenadas ficticias; sin ubicación, conservar dirección.
4. Confirmar ausencia de cantidades internas, movimientos, importaciones, membresías, sesiones, reservas y auditoría.
5. Demostrar miss/hit/TTL; cambiar inventario F02, confirmar commit y nueva generación.
6. Detener Redis, repetir consulta y comprobar fallback PostgreSQL; reiniciar y comprobar recuperación.
7. Verificar grants, RLS, `rolbypassrls=false` y función pública.
8. Ejecutar Playwright en Linux oficial y k6 con dataset/carga documentados.

## Arranque previsto

```powershell
npm.cmd run dev:f03
npm.cmd run dev:web
```

Abrir `http://127.0.0.1:5173/search`. Debe funcionar sin login.

## Estados

- **local**: `PASS` el 2026-11-12; check, build, pruebas, PostgreSQL/Redis y smoke pasaron en Windows 10.
- **overall**: `PASS` automatizado el 2026-11-12; RLS, caída/recuperación Redis, Playwright Linux, k6, regresiones y auditoría pasaron con los resultados de `implementation-evidence.md`.
- **acceptance**: `PENDING`; requiere revisión y aprobación humana final, no se infiere por `local`/`overall`.

Nada se marca aprobado por anticipado. F00/F01/F02 conservan sus pendientes.
