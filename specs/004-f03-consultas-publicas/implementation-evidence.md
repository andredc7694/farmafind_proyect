# Evidencia de implementación F03

**Fecha**: 2026-11-12

**Rama**: `feat/f03-consultas-publicas`

**Estado**: incremento implementado y verificado localmente; aceptación humana final pendiente.

## Entorno observado

- Windows 10, Node.js 24.17.0, npm 11.13.0.
- PostgreSQL `18.6-bookworm` en `127.0.0.1:55431`, reutilizando `compose.f01-postgres.yaml`.
- Redis oficial `8.10.3-alpine` en `127.0.0.1:56379`, con secreto local ignorado, healthcheck y datos efímeros.
- Cliente `redis@6.0.0`, licencia MIT y Node `>=20.0.0`; `npm audit`: 0 vulnerabilidades.
- Playwright `1.65.0` en `mcr.microsoft.com/playwright:v1.65.0-noble` con montajes mínimos de solo lectura; `.cache`, Git y documentación privada quedaron fuera.
- k6 oficial `1.8.2`, escenario local de 3 VU durante 15 s.

## Resultados reales

| Control | Resultado |
|---|---|
| `npm run check` | Correcto: sintaxis, TypeScript estricto y límites modulares. |
| `npm run build` | Correcto: backend, Notificaciones y frontend Vite. |
| `npm run test:f03:unit` | 12 archivos, 25 pruebas correctas. |
| `npm run test:f03:integration` | 3/3 pruebas Redis real correctas, incluida expiración y reconexión. |
| `npm run test:f03:rls` | 4/4 pruebas PostgreSQL/RLS real correctas, incluida farmacia inactiva. |
| `npm run verify:f03:demo` | Búsqueda, comparación, vacío y perfil público correctos; también pasó con Redis detenido y tras recuperarlo. |
| Suite base | 46 archivos correctos, 200 pruebas correctas; 12 archivos/64 pruebas condicionadas a entorno se omitieron y los controles RLS relevantes se ejecutaron por separado. |
| Regresión F01 RLS | 9 archivos, 45 pruebas correctas. |
| Regresión F02 RLS | 1 archivo, 14 pruebas correctas. |
| Playwright Linux | 2/2: búsqueda/comparación y vacío/fallback de ubicación. |
| k6 Redis disponible | 45/45 respuestas; 0 % errores; p95 33,37 ms; 2,96 req/s. |
| k6 fallback PostgreSQL | 45/45 respuestas; 0 % errores; p95 30,41 ms; 2,94 req/s. |
| Contadores Cache-Aside | Antes: 0 hits/0 misses; tras dos smokes: 9 hits/3 misses. |
| Auditoría npm | 0 vulnerabilidades. |

Una ejecución diagnóstica inicial con 5 VU y pausas de 200 ms superó el límite intencional de 60 solicitudes/minuto por IP y produjo `429`. No se debilitó el control: el escenario final se ajustó a una carga válida documentada. Para aislar el fallback se usó un proceso API nuevo y no se mezclaron ventanas del limitador.

## Seguridad demostrada

- El login runtime no tiene `SUPERUSER` ni `BYPASSRLS`; `f02.inventario` y `f03.farmacia_publica` usan `FORCE ROW LEVEL SECURITY`.
- La función fija `SECURITY DEFINER` pertenece a un rol `NOLOGIN`, sin `BYPASSRLS`, con `search_path` cerrado.
- Runtime ejecuta la proyección, pero no puede leer directamente el perfil F03; PostgreSQL devuelve `42501`.
- Solo se publican farmacias/medicamentos activos con disponibilidad positiva. No aparecen cantidades, sesiones, membresías, movimientos, importaciones ni reservas.
- La ubicación es opcional y efímera: no entra en Redis ni se persiste. Sin ella permanece la dirección textual.
- La invalidación ocurre después de resolver la transacción; un rollback no invalida. Un fallo Redis no revierte la escritura PostgreSQL.
- El fixture usa una base TEST independiente; la verificación no detectó cambios en los conteos de la base persistente.

## Limitaciones

- La carga describe un fixture local pequeño y no predice capacidad productiva.
- El limitador es por proceso; una estrategia distribuida requiere una decisión posterior compatible con la Constitución.
- No se crearon recursos AWS, reservas, pagos, notificaciones de negocio ni FarmaFind AI.
- GLO-01 y BOOT-01 permanecen bloqueados y no fueron ejecutados.
