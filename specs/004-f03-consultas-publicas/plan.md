# Implementation Plan: F03 — Consultas públicas

**Branch**: `feat/f03-consultas-publicas` | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)

**Status**: Plan técnico aprobado expresamente por el usuario el 2026-11-12. La implementación queda autorizada dentro de F03 y de los límites documentados.

**Input**: F03 aprobada, Documento Maestro Definitivo v2.0, Constitution v1.1.0, fuentes históricas y base F00–F02. El capítulo 33 vigente asigna a F03 las consultas públicas y Redis Cache-Aside.

## Summary

F03 incorporará el módulo **Búsqueda** al monolito modular existente. Una consulta pública sin sesión buscará nombre comercial o principio activo, leerá una proyección estricta de PostgreSQL y devolverá ofertas referenciales de farmacias activas. Redis almacenará solo respuestas públicas mediante Cache-Aside, TTL configurable de 60 segundos y una generación de caché que se incrementa después de cambios confirmados. Si Redis falta, expira o falla, PostgreSQL responde. La interfaz React añadirá búsqueda, filtros, comparación y estados vacíos/error, sin reservas, IA, administración ni rediseño visual profesional.

## Technical Context

**Language/Version**: Node.js 24.17.0, Express 5.2.1, TypeScript 5.9.3; React 19.2.7, Vite 7.3.8 y JavaScript/JSX; npm 11.13.0, según los manifiestos versionados.

**Primary Dependencies**: reutilizar Express, `pg`, React, Vitest, Supertest y Playwright. Candidato nuevo: cliente oficial `redis@6.0.0`, que declara Node.js 20 como mínimo y por ello es compatible por rango con Node.js 24.17.0; la instalación, auditoría y prueba real siguen pendientes. Servidor local propuesto: imagen oficial `redis:8.10.3-alpine`, con etiqueta exacta, pendiente de descarga y prueba.

**Storage**: PostgreSQL continúa como fuente oficial. Migraciones F03 aditivas incorporarán principio activo normalizado y un perfil público de farmacia con dirección y coordenadas opcionales; no alterarán datos persistentes existentes sin respaldo. Redis será descartable y almacenará exclusivamente resultados públicos serializados y la generación de invalidación.

**Testing**: Vitest unitario, Supertest/contrato HTTP, PostgreSQL y Redis reales aislados, pruebas de RLS/proyección, caída/recuperación, TTL/invalidation, Playwright en Linux oficialmente compatible y k6 para AC01/criterio 13. Las pruebas Windows 10 compatibles se conservan; los controles de navegador se ejecutarán en la imagen oficial versionada.

**Target Platform**: desarrollo principal Windows 10 con Docker Desktop local para PostgreSQL/Redis y navegador Linux de prueba. Destino AWS de la Constitución, sin crear recursos ni servicios de pago en F03.

**Project Type**: aplicación web con frontend React y API Express dentro de los npm workspaces y monolito modular existentes.

**Performance Goals**: p95 de búsquedas ≤ 2 segundos y errores técnicos < 1 % bajo una carga y dataset documentados; medir p99, throughput, hit/miss, fallback, consultas PostgreSQL y recursos. No se promete mejora por caché antes de medirla.

**Constraints**: búsqueda pública sin sesión; solo proyección permitida; PostgreSQL oficial; Redis no confirma stock; RLS no se desactiva; sin ubicación persistida; sin datos reales; GLO-01 y BOOT-01 siguen bloqueados; no alterar requisitos, contratos aprobados ni evidencias históricas F00/F01/F02. F03 puede añadir un puerto de invalidación post-commit al código F02 sin cambiar sus reglas de inventario.

**Scale/Scope**: cuatro historias, 18 F03-FR y siete F03-SC. Contrato inicial: término 2–120 caracteres, página desde 1, tamaño 20 por defecto y máximo 50, hasta 200 candidatos para ordenar por cercanía en el incremento académico. Estos límites quedan sujetos a la aprobación de este plan y a medición posterior.

## Constitution Check

*GATE antes de investigación y después del diseño. Pasa para planificación; código y pruebas ejecutables esperan aprobación humana del plan.*

| Principios | Decisión y verificación | Gate |
|---|---|---|
| I, XVI–XVIII: SDD, rama y aprobación | Spec aprobada; plan y artefactos en rama F03. No se generará código antes de aprobar este plan. | Pasa para diseño. |
| II–VI: módulos, stack y Clean Architecture | Búsqueda tendrá dominio/aplicación/infraestructura/presentación. Medicamentos, Farmacias e Inventario se consumen por contratos; Notificaciones e IA no se activan. | Pasa. |
| VII–VIII: PostgreSQL y RLS | PostgreSQL genera la proyección. Un rol no-login y sin BYPASSRLS ejecuta una función de proyección fija bajo políticas públicas explícitas; runtime solo recibe permiso de ejecución. Pruebas directas demuestran ausencia de campos privados. | Diseño; evidencia pendiente. |
| IX: Redis Cache-Aside | Cliente oficial, claves opacas con namespace y hash, TTL 60 s configurable, generación post-commit, métricas y fallback. Redis privado y descartable. | Diseño; evidencia pendiente. |
| X–XII: UoW/Outbox/AWS/costos | La invalidación ocurre después del commit y no participa en UoW. No se implementan reservas/Outbox/Notificaciones ni recursos AWS. | Pasa. |
| XIII–XV: pruebas, rúbrica e historia | HU01–HU02/RF01–RF04 y AC aplicables trazados. Integración real PostgreSQL/Redis, seguridad, E2E y carga quedan obligatorias. | Diseño; evidencia pendiente. |
| XIX–XX: límites clínicos y datos | No hay recomendaciones clínicas ni IA. Fixtures Alfa/Beta ficticios, ubicación voluntaria no persistida y secretos locales ignorados. | Pasa. |

**Post-design:** [research.md](research.md), [data-model.md](data-model.md), [public-search.openapi.yaml](contracts/public-search.openapi.yaml) y [quickstart.md](quickstart.md) conservan los gates. No hay excepciones constitucionales ni `NEEDS CLARIFICATION` pendientes.

## Design

### Límites y flujo

El nuevo módulo `busqueda` define el caso de uso `SearchPublicOffers` y los puertos `PublicOfferRepository`, `SearchCache`, `SearchMetrics` y `Clock`. El dominio normaliza consulta, filtros, orden y paginación y construye una respuesta pública. Express valida el contrato y no requiere sesión. React consume únicamente el contrato público.

Flujo Cache-Aside: validar y canonicalizar → leer generación de caché → calcular SHA-256 de parámetros cacheables → obtener entrada → en hit devolver → en miss/error consultar PostgreSQL → proyectar campos permitidos → intentar guardar con TTL → devolver. Un fallo de lectura/escritura Redis se registra de forma minimizada y nunca impide la respuesta PostgreSQL.

La ubicación opcional se valida y se usa solo durante la solicitud. No se registra ni se incluye en claves. La caché conserva candidatos públicos sin distancia; el caso de uso calcula distancia, ordena y pagina después de leerlos. Si faltan coordenadas o se supera el máximo documentado, se conserva dirección textual y se informa que cercanía no está disponible.

### Proyección pública y RLS

La migración F03 será aditiva:

1. Añade `principio_activo` normalizado al catálogo F02 y lo exige para referencias nuevas; los fixtures migran sus datos sintéticos. Los registros operativos preexistentes requieren un valor verificado antes de imponer `NOT NULL`.
2. Crea `f03.farmacia_publica`, vinculada uno a uno con `f01.farmacia_referencia`, para dirección textual y coordenadas opcionales. Solo fixtures autorizados escriben durante F03; no se crea CRUD de farmacia.
3. Define políticas SELECT explícitas para un rol `f03_projection_owner` `NOLOGIN NOSUPERUSER NOBYPASSRLS`. Este rol no es dueño de las tablas.
4. Expone una función `SECURITY DEFINER` de firma fija, `search_path` bloqueado y sin SQL dinámico. El rol runtime recibe solo `EXECUTE`; la función devuelve medicamento/presentación, farmacia pública, precio, disponibilidad booleana, fecha y ubicación pública.

La política pública admite solo medicamento activo, farmacia activa e inventario con `cantidad_fisica - cantidad_comprometida > 0`. Pruebas con runtime, rol de proyección y migrador verifican grants, propietarios, `rolbypassrls=false`, ausencia de contexto tenant y rechazo de tablas privadas.

### Caché e invalidación

Las claves siguen `farmafind:f03:v1:g{generacion}:search:{sha256}`. El hash cubre término normalizado, filtros estáticos y conjunto candidato; no contiene texto crudo, IP, sesión, coordenadas ni farmacia privada. La respuesta serializada se valida al leer; una entrada inválida se trata como miss.

El TTL inicial será 60 segundos y configurable. Tras commits F02 que cambien catálogo, estado público de farmacia, precio o inventario, un puerto de invalidación ejecuta `INCR farmafind:f03:v1:generation`. Las nuevas lecturas dejan de usar claves anteriores; estas expiran por TTL. El fallo de invalidación no revierte la escritura PostgreSQL y se registra. No se escanean ni eliminan claves ajenas.

Redis usa URL/contraseña local desde archivo ignorado, timeout y reconexión acotados. El contenedor se enlaza solo a `127.0.0.1`, tiene healthcheck y almacenamiento separado. No se reutiliza Redis para sesiones, rate limit, reservas o IA.

### Contrato, interfaz y protección contra abuso

[public-search.openapi.yaml](contracts/public-search.openapi.yaml) define `GET /api/v1/busquedas` y `GET /api/v1/farmacias/{id}`. La consulta admite término, rango de precio, orden por disponibilidad, ubicación opcional y paginación. Solo se publican ofertas con disponibilidad positiva. Fallar Redis no produce 503 si PostgreSQL está sano.

La interfaz en español añade ruta `/search`, formulario, filtros, orden, tarjetas comparables, aviso referencial, fecha, dirección, carga, vacío y error. No ofrece reserva ni recomendación clínica. Accesibilidad: etiquetas, teclado, foco y regiones de estado; no se ejecuta el rediseño profesional aplazado.

La ruta usa validación estricta, límites de longitud/página y un limitador por proceso detrás de un puerto, sin persistir IP ni usar Redis fuera de la caché. Se documenta que el límite distribuido para múltiples instancias requiere una decisión posterior compatible con el principio IX.

### Pruebas y evidencias

Unitarias: normalización, claves, DTO, disponibilidad, filtros, orden estable, distancia, paginación, TTL y fallback. Integración: contrato HTTP, PostgreSQL real, rol/grants/RLS, Redis hit/miss/corrupción/timeout/caída/recuperación e invalidación post-commit. Seguridad: parámetros adversariales, ausencia total de campos prohibidos, farmacias inactivas y datos A/B.

Playwright cubre búsqueda sin sesión, comparación/estado vacío y caída de mapas/ubicación. k6 compara el mismo dataset con caché fría/caliente y Redis detenido, registrando p95/p99, throughput, errores y consultas PostgreSQL. Los resultados se guardarán después de ejecutarlos.

## Project Structure

### Documentation (this feature)

```text
specs/004-f03-consultas-publicas/
  spec.md
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts/public-search.openapi.yaml
  checklists/requirements.md
  tasks.md                         # posterior, con $speckit-tasks
```

### Source Code (propuesta; todavía no creado)

```text
backend/
  migrations/f03/
  src/modules/busqueda/{domain,application,infrastructure,presentation}/
  tests/search/
frontend/
  src/search/
  tests/search/
scripts/f03/
compose.f03-search.yaml
```

**Structure Decision:** conserva `frontend`, `backend` y `notifications`. Búsqueda se añade al backend modular; Redis es infraestructura reemplazable, no un módulo de negocio ni servicio público.

## Risks and implementation gates

| Riesgo | Control | Puerta |
|---|---|---|
| Datos sin principio activo verificado | Migración en dos etapas; fixtures sintéticos se completan, registros reales requieren revisión. | No inventar valores operativos. |
| Función pública evade RLS o amplía columnas | Dueño no privilegiado, policy explícita, firma fija, search_path cerrado y tests SQL. | Fallo bloquea implementación/aceptación. |
| Entrada obsoleta tras commit | Generación post-commit + TTL; fallo observado y fallback. | Probar cambios manuales e importación. |
| Redis incompatible o vulnerable | Instalar versión exacta, auditar y verificar Node 24/servidor real. | Vulnerabilidad alta o incompatibilidad obliga a revisar. |
| Ubicación se filtra | No persistir, no incluir en clave, sanitizar logs y probar ausencia. | Fallo bloquea aceptación. |
| Cercanía con 200 candidatos | Medir y conservar dirección textual; PostGIS/proveedor externo quedan fuera. | No afirmar escala productiva. |
| F02 PR aún apilada | F03 depende del commit F02 y su PR; mantener base explícita y no tocar main. | Integración final depende de F02. |

## Traceability to the 16 teaching criteria

F03 aporta entregables previstos para 1 (HU01–HU02/RF01–RF04), 2–3 (modelo/proyección/arquitectura), 4 (SDD), 5 (unitarias/integración), 6 (E2E), 7 (interfaz), 9 (índices/consulta), 11 (caché), 13 (k6), 14 (código/migraciones ficticias) y 15–16 (informe/demo). Los criterios 8, 10 y 12 mantienen seguimiento transversal y no se declaran cumplidos. No se asignan puntajes ni resultados.

## Complexity Tracking

No existe excepción constitucional. La función con rol dedicado cumple simultáneamente acceso público, minimización y RLS; una vista con permisos directos se descartó porque ampliaría el acceso del runtime a columnas internas.
