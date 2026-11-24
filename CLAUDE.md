# FarmaFind — reglas permanentes para Claude Code

Responder siempre en español. Fuente de verdad: `.specify/memory/constitution.md` (v2.0.0). Si algo aquí la contradice, manda la Constitution.

## Stack obligatorio
- Frontend: React + Vite + JSX.
- Backend: Node + Express + TypeScript.
- PostgreSQL con RLS; Redis con Cache-Aside.
- Clean Architecture, Unit of Work, Transactional Outbox.
- Servicio de Notificaciones F05 independiente.

## Seguridad multi-tenant
- Ninguna farmacia accede a datos privados de otra.
- Nunca `BYPASSRLS`, nunca bypass de RLS, nunca permisos globales implícitos.
- El backend autoriza cada acción; la UI no es control de seguridad.

## Metodología SDD (Spec Kit)
- Spec, plan y tasks aprobados por Andre **antes** de escribir código.
- Nunca autoaprobar tareas de aceptación humana (p. ej. T038).
- No inventar resultados de pruebas, commits ni aprobaciones; registrar solo lo realmente ejecutado.

## Git (Constitution 2.0.0)
- Un commit por incremento probado. Un commit no equivale a aceptación funcional.
- Nunca force push. Nunca publicar secretos (`.env`, `.cache`, credenciales).
- Respetar las protecciones de GitHub: si exigen PR, usar PR.
- Commits: ver «Flujo de ramas» abajo (commit y push a ramas de trabajo autorizados; PR y merge a `main` siempre con confirmación explícita de Andre).

## Costos
- US$0 en APIs nuevas. No activar Gemini facturable, proveedores de pago ni AWS.
- F09 (AWS) solo manual y con autorización expresa de Andre.

## Datos
- Nunca tocar la base persistente `farmafind_f01_test`. Usar bases TEST efímeras.

## Estado y orden de trabajo
- F02.5 sigue **sin aceptar** (pendientes T046, T057, T063).
- Orden: F02.1 (falta aceptación T038) → F01.1 → F04.1 → F08.1 → pruebas integrales.
- Al terminar cada bloque, actualizar `docs/seguimiento/ESTADO.md`: fecha, rama, commit, qué se hizo, pruebas ejecutadas con resultado real y pendientes.

## Modo de trabajo autónomo (autorizado por Andre, 2026-11-23)
Trabajar de forma continua y autónoma, deteniéndose **solo** en las puertas de aprobación. Responder en español sencillo.

**Docker y entorno TEST (autorización permanente):**
- Encender/apagar Docker Desktop y los contenedores TEST autorizados (`farmafind-f01-postgres`, `farmafind-f025-postgres`, `farmafind-f03-search`, archivos `compose.*.yaml`) cuando una prueba, DEMO o medición lo necesite. Si el motor no responde, intentar iniciar Docker Desktop y esperar.
- Al terminar cada bloque, detener los contenedores encendidos (excepto la DEMO mientras Andre la esté probando). Nunca `docker system prune`, ni borrar volúmenes, imágenes o contenedores existentes.
- Solo bases PostgreSQL TEST efímeras o fixtures marcados TEST. **Sobre `farmafind_f01_test`: ninguna escritura, migración ni borrado, ni de verificación.**
- Levantar la DEMO local (frontend, API, PostgreSQL, Redis) con farmacias ficticias Alfa y Beta y dejarla encendida hasta que Andre termine; entregar URL, usuarios, contraseñas y pasos sencillos.

**Entre puertas, hacer todo:** investigación, specs, planes, tasks, código, pruebas, evidencia y documentación. No pedir a Andre que ejecute comandos.
- Commit local al terminar cada bloque probado, con mensaje descriptivo, sin force push y sin secretos. Un cambio de código distinto = un commit distinto.
- Si una prueba falla: intentar corregir hasta 2 veces; si no, detenerse y explicar con opciones.
- No inventar resultados. RLS y contexto tenant transaccional siempre; cero acceso cruzado. US$0 en APIs nuevas; sin Gemini, pagos ni AWS (F09).

**Puertas (únicos momentos para detenerse):**
1. Aceptación T038 de F02.1: la hace Andre en el navegador. Nunca marcarla. Al responder ACEPTO / ACEPTO CON OBSERVACIONES / RECHAZO: registrar en `acceptance.md`, marcar T038, commit y continuar.
2. Push, PR o merge a `main`: antes, decir el método según las protecciones reales de GitHub y esperar confirmación.
3. Aprobación de `spec.md`, `plan.md` y `tasks.md` de cada incremento nuevo, uno por uno.
4. Decisiones de negocio/seguridad de F01.1 (login del personal alias o correo, recuperación, contraseña temporal, TOTP del admin): presentar opciones A/B/C con recomendación.
5. Cualquier costo nuevo, servicio de pago, AWS, borrado de datos o cambio fuera del alcance autorizado.
6. Modificación arquitectónica o de seguridad de mayor alcance que el autorizado: presentar impacto y detenerse.

**No hacer:** declarar aceptadas F02.1, F02.5 (T046, T057, T063), F08 ni F06.1 (dejarlas pendientes en ESTADO.md). No abrir F01.1 ni otro incremento hasta cerrar F02.1.

**Formato de cada parada (máx. 15 líneas):** qué hice · pruebas ejecutadas y resultado real · qué debo aprobar/decidir (con recomendación) · qué haré después.

## Metodología Spec Kit por incremento (obligatoria, autorizada 2026-11-23)
- Skills en `.agents/skills/speckit-*` (specify, clarify, plan, tasks, analyze, implement, converge, checklist, constitution). Mi entorno no los detecta como invocables: **leer cada `SKILL.md` y seguirlo paso a paso**, generando los mismos archivos.
- Cada incremento nuevo va en carpeta nueva y numerada de `specs/` (siguiente libre: 015; 014 = F01.1). No reutilizar números ni tocar carpetas ya existentes.
- Flujo: a) specify → `spec.md` **[PUERTA: aprobación]** · b) clarify con opciones A/B/C y recomendación **[PUERTA: respuestas]** · c) plan → `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md` **[PUERTA]** · d) tasks → `tasks.md` numeradas y enlazadas a requisitos **[PUERTA]** · e) analyze (corregir contradicciones antes de implementar) · f) implement por lotes; casilla solo con evidencia real en `evidence.md` · g) converge (diferencias contra la spec) · h) `acceptance.md`; la decisión final es de Andre, nunca mía.
- Cada aprobación de Andre se registra con fecha y alcance en `approval.md` del incremento **antes** de avanzar. No pasar de a→b, c→d ni d→f sin ella.
- Al presentar spec/plan/tasks para aprobar: resumen de máx. 15 líneas en lenguaje sencillo (qué se construye, qué queda fuera, riesgos, decisiones abiertas).
- Mantener `docs/seguimiento/ESTADO.md` con el paso de Spec Kit de cada incremento.

## Flujo de ramas definitivo (autorizado por Andre, 2026-11-23)
- **Un incremento, una rama:** `feat/<fase>-<nombre>`. Crearla al empezar el incremento, partiendo del `main` **actualizado**, y publicarla con **push** después de cada lote probado. No dejar commits solo en local. Push a ramas de trabajo: autorizado de forma permanente. Nunca force push.
- **Al aceptar Andre el incremento (Puerta 1), antes de pasar al siguiente:** integrar la rama en `main` con el método que permitan las protecciones reales de GitHub y la Constitution 2.0.0. Si exigen PR: abrir el PR con `gh`, verificar que pasen los controles y fusionarlo **solo cuando Andre lo confirme**. PR y merge a `main` son una puerta: pedir confirmación explícita **cada vez**, con el resumen de lo que se integra.
- **Después de integrar:** actualizar `main` local y **solo entonces** crear la rama del incremento siguiente.
- Usar `gh` (GitHub CLI) para PR y merge. Comprobar que esté instalado y con sesión; si falta, guiar a Andre para iniciar sesión por navegador (`gh auth login`). **Nunca pedir ni pegar tokens** en archivos ni chat.
- Excepción histórica: `feat/f011-identidad-personal` se creó desde `feat/f021-importacion-inteligente` (F02.1 aún no integrada en `main`).


## Modo de trabajo continuo (autorizado por Andre, 2026-11-23; reemplaza las paradas por lote)
- Trabajar de corrido: no detenerse entre lotes ni para informar avances. Encadenar lotes hasta terminar el incremento. Tras cada lote probado: actualizar `ESTADO.md` y hacer push, sin pedir nada.
- Detenerse solo cuando falte algo que solo Andre puede dar: aprobación de spec/plan/tasks, decisión de negocio o seguridad sin recomendación resoluble, aceptación humana del incremento, costo nuevo, algo destructivo o cambio fuera de alcance. Varias decisiones pendientes se agrupan en un solo mensaje con opciones A/B/C y recomendación.
- Si una puerta no bloquea el trabajo siguiente, seguir avanzando y dejar la pregunta anotada para la próxima respuesta.
- Decisiones menores y reversibles (sin impacto en seguridad, costos ni alcance): decidir con mejor criterio y registrarlas en `ESTADO.md` para revisión posterior.
- **PR permanente:** cuando Andre acepte un incremento, abrir su PR a `main` y fusionarlo con «merge commit» (sin squash, sin borrar la rama) sin otra confirmación, si el estado es MERGEABLE y CLEAN, no hay secretos y la regresión del incremento pasó. Después actualizar `main` local y crear la rama del siguiente. Avisar en dos líneas. Si hay conflicto, algo raro o verificación fallida: detenerse.
- Modo económico: pruebas por capas, E2E solo al final del incremento, salidas cortas, sin releer documentos grandes.
- Informes de parada: máximo 10 líneas, lenguaje sencillo.
