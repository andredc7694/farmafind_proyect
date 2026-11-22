# F03 — Investigación y decisiones de planificación

**Fecha:** 2026-11-12. **Estado:** decisiones técnicas aprobadas con el plan el 2026-11-12; no acredita todavía instalación ni pruebas.

## Secuencia y alcance

**Decisión:** aplicar el capítulo 33 del maestro v2.0: F03 es Consultas públicas con proyección del catálogo y Redis Cache-Aside. F02 ya concentró catálogo/inventario interno.

**Motivo:** conserva HU01–HU02/RF01–RF04. **Alternativas descartadas:** Reservas y FarmaFind AI pertenecen a incrementos posteriores.

## Cliente y servidor Redis

**Decisión propuesta:** cliente oficial `redis@6.0.0` e imagen oficial `redis:8.10.3-alpine`, con versiones exactas. Antes de adoptar se comprobarán instalación, conexión autenticada, operaciones básicas, reconexión, auditoría y compatibilidad real con Node.js 24.17.0 y Windows 10/Docker.

**Motivo:** Redis documenta node-redis para Cache-Aside y fallback. La versión 6.0.0 declara Node.js 20 mínimo, compatible por rango con 24.17.0, pero falta prueba local. La etiqueta 8.10.3-alpine es estable y explícita; no se usará `latest`.

**Alternativas:** ioredis se descarta porque Redis recomienda el cliente oficial; caché en memoria no satisface RC11; Redis administrado/AWS queda fuera.

## Cache-Aside e invalidación

**Decisión propuesta:** cachear solo candidatos públicos. Miss, entrada inválida o error cargan PostgreSQL. TTL 60 segundos. Cambios confirmados incrementan una generación global después del commit.

**Motivo:** evita borrados por patrón y mantiene PostgreSQL como autoridad. **Alternativa descartada:** escribir Redis dentro de la transacción PostgreSQL.

## Frontera pública y RLS

**Decisión propuesta:** rol no-login `f03_projection_owner`, sin BYPASSRLS y distinto del dueño de tablas; policies SELECT explícitas; función `SECURITY DEFINER` fija con `search_path` cerrado. Runtime recibe EXECUTE, no SELECT privado.

**Motivo:** permite consulta pública sin desactivar RLS. **Alternativas descartadas:** SELECT general, RLS deshabilitado o inventario duplicado como autoridad en Redis.

## Datos faltantes

**Decisión propuesta:** migración aditiva para principio activo y perfil público de farmacia. Fixtures sintéticos se completan; una referencia operativa sin principio activo no se publica hasta revisión.

**Motivo:** F02 solo guarda `nombre` y F01 solo `nombre_publico`, mientras RF01/RF03/RF04 exigen principio activo, dirección y ubicación. No se infiere información farmacológica.

## Cercanía y privacidad

**Decisión propuesta:** coordenadas opcionales, validadas y efímeras; no se guardan, registran ni incluyen en claves. La aplicación ordena hasta 200 candidatos cacheados sin distancia.

**Motivo:** evita proveedor/costo y minimiza datos. **Alternativas:** API de mapas requiere aprobación; PostGIS queda para ADR si las mediciones lo justifican.

## Límites

**Decisión propuesta:** término 2–120; página ≥1; tamaño 20, máximo 50; precios en centavos; latitud/longitud juntas y válidas; cercanía exige ubicación.

## Fuentes

- Constitution v1.1.0, principios VII–IX y XIII–XVIII.
- Maestro v2.0, capítulos 5–7, 13–15, 27–29 y 33.
- HU01–HU02, RF01–RF04, AC aplicables, RC01/02/03/06/08/11, DA01/03/04/05/06/07/09 y ADR-01/03/04/05/06/07/08.
- Documentación oficial Redis de Cache-Aside, errores, node-redis y registro de imagen oficial, consultada el 2026-11-12.
