# Feature Specification: F07 — Despliegue AWS controlado

**Feature Branch**: `feat/f07-aws-deploy`

**Created**: 2026-11-16

**Status**: Draft — requiere aclaraciones y aprobación humana antes de planificar o crear recursos

**Input**: Preparar y ejecutar, solo tras autorización presupuestaria independiente, el despliegue académico de FarmaFind definido en el Documento Maestro v2.0: frontend privado publicado por CDN, API y Notificaciones en servidor aislado, datos y caché privados, HTTPS, CI/CD controlado, respaldo, restauración, observabilidad y evidencias.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Autorizar un despliegue con costo conocido (Priority: P1)

Como titular responsable, quiero revisar región, recursos, costo estimado, presupuesto, etiquetas y procedimiento de apagado antes de crear infraestructura para evitar gastos o acciones no consentidas.

**Why this priority**: La Constitution prohíbe recursos facturables sin autorización humana previa y concreta.

**Independent Test**: Revisar el inventario previo y comprobar que ningún recurso se crea mientras falte región, presupuesto, estimación actual, titularidad y autorización expresa.

**Acceptance Scenarios**:

1. **Given** que falta cualquiera de los datos presupuestarios obligatorios, **When** se intenta iniciar el aprovisionamiento, **Then** el proceso se detiene antes de crear recursos.
2. **Given** una propuesta concreta, **When** el titular la revisa, **Then** puede identificar cada recurso, región, costo estimado, costo variable, etiquetas, responsable y procedimiento de apagado.
3. **Given** una alerta de presupuesto configurada, **When** se documenta su alcance, **Then** se aclara que alerta pero no garantiza detener todos los cargos.

---

### User Story 2 - Publicar la aplicación con superficie mínima (Priority: P1)

Como usuario de demostración, quiero acceder al frontend por HTTPS y consumir la API autorizada, mientras la base de datos, Redis y Notificaciones permanecen inaccesibles desde Internet.

**Why this priority**: Es el recorrido central del despliegue F07 y conserva la seguridad multi-tenant existente.

**Independent Test**: Abrir rutas directas de la SPA, consultar salud y ejecutar un recorrido público y autenticado; comprobar simultáneamente que los puertos privados no son accesibles externamente.

**Acceptance Scenarios**:

1. **Given** un despliegue autorizado, **When** se abre cualquier ruta válida de la SPA por HTTPS, **Then** carga la aplicación sin hacer público su almacenamiento de origen.
2. **Given** la API publicada, **When** se consultan únicamente los puertos autorizados, **Then** HTTPS y salud responden y PostgreSQL, Redis y Notificaciones no tienen exposición pública.
3. **Given** dos farmacias ficticias, **When** se ejecutan pruebas positivas y cruzadas tras el despliegue, **Then** se conserva el aislamiento RLS sin filtraciones.
4. **Given** que Redis o Notificaciones falla, **When** se ejecutan sus recorridos permitidos, **Then** la búsqueda usa su fallback y las transacciones confirmadas no se revierten.

---

### User Story 3 - Publicar una versión revisada y reversible (Priority: P1)

Como mantenedor, quiero que cada publicación corresponda a una revisión aprobada, ejecute controles obligatorios y conserve una reversión preparada para evitar desplegar cambios defectuosos o no autorizados.

**Why this priority**: Un despliegue automático sin gates humanos, respaldo o rollback contradice la arquitectura aprobada.

**Independent Test**: Simular una publicación con controles satisfactorios y otra con un control crítico fallido; solo la primera puede avanzar al entorno autorizado.

**Acceptance Scenarios**:

1. **Given** un cambio propuesto, **When** falla compilación, seguridad, aislamiento o smoke, **Then** no se promociona.
2. **Given** controles satisfactorios y aprobación de entorno, **When** se publica, **Then** se registra revisión, artefactos, fecha, responsable y salud posterior.
3. **Given** una publicación defectuosa, **When** se activa el rollback, **Then** se restaura una versión conocida sin revelar secretos y se registra el incidente.

---

### User Story 4 - Recuperar datos y operar la demostración (Priority: P2)

Como operador académico, quiero respaldos protegidos, restauración ensayada, métricas y un runbook para recuperar el servicio y demostrar sus límites reales.

**Why this priority**: Un único servidor es un punto único de fallo; la recuperación comprobada evita presentar respaldo como alta disponibilidad.

**Independent Test**: Restaurar un respaldo sintético en un entorno aislado, medir pérdida y tiempo de recuperación y seguir el runbook sin usar datos reales.

**Acceptance Scenarios**:

1. **Given** datos completamente ficticios, **When** se ejecuta respaldo y restauración aislada, **Then** se recuperan datos y políticas de acceso con resultados medidos.
2. **Given** una degradación de disco, servicio o certificado, **When** el operador consulta el runbook, **Then** encuentra diagnóstico, contención, recuperación, verificación y escalamiento.
3. **Given** la topología de un servidor, **When** se presentan evidencias, **Then** se declara expresamente que no existe alta disponibilidad.

### Edge Cases

- Cuenta, región, cuota o permiso insuficiente antes del aprovisionamiento.
- Estimación vencida, costo variable inesperado o alerta de presupuesto no entregada.
- Ruta profunda de SPA, caché antigua de `index.html` o invalidación incompleta.
- Certificado no emitido, DNS en propagación, origen CORS incorrecto o reloj desalineado.
- Migración incompatible, volumen casi lleno, reinicio del servidor o contenedor no saludable.
- Restauración con roles elevados, RLS ausente o secretos incluidos en el respaldo.
- Fallo de API, Notificaciones, PostgreSQL o Redis durante o después de la publicación.
- Pipeline desde rama, revisión o entorno no autorizados.

## Requirements *(mandatory)*

### Functional Requirements

- **F07-FR-001**: El despliegue DEBE permanecer bloqueado hasta registrar autorización humana explícita para una propuesta concreta de recursos facturables.
- **F07-FR-002**: La propuesta previa DEBE identificar titular autorizado, región, recursos, tamaño, costos actuales estimados, componentes variables, presupuesto mensual, impuestos aplicables y plan de apagado o eliminación.
- **F07-FR-003**: El entorno DEBE utilizar únicamente datos sintéticos y credenciales separadas de desarrollo, CI y demostración.
- **F07-FR-004**: Los recursos DEBEN usar nombres y etiquetas que identifiquen proyecto, entorno, responsable y finalidad académica.
- **F07-FR-005**: El frontend DEBE publicarse desde almacenamiento privado, con acceso público exclusivamente mediante la distribución HTTPS autorizada.
- **F07-FR-006**: El origen del frontend DEBE bloquear acceso público directo y limitar el acceso de lectura a la distribución autorizada.
- **F07-FR-007**: Las rutas válidas de la SPA DEBEN resolverse al documento de entrada sin convertir errores reales de activos o API en respuestas exitosas engañosas.
- **F07-FR-008**: Los activos versionados DEBEN admitir caché prolongada y el documento de entrada DEBE usar una política corta que permita publicar correcciones.
- **F07-FR-009**: La API y Notificaciones DEBEN ejecutarse como procesos separados; la API DEBE permanecer sin estado entre réplicas futuras.
- **F07-FR-010**: PostgreSQL y Redis DEBEN permanecer en redes privadas y NO DEBEN publicar puertos en Internet.
- **F07-FR-011**: El rol runtime de PostgreSQL NO DEBE ser superusuario ni tener `BYPASSRLS`; las políticas RLS y el contexto transaccional DEBEN conservarse tras despliegue y restauración.
- **F07-FR-012**: El acceso externo a la API DEBE usar HTTPS válido, proxy, encabezados de seguridad, límites de solicitud, CORS explícito y healthchecks.
- **F07-FR-013**: Notificaciones DEBE aceptar únicamente comunicación interna autenticada y conservar idempotencia, reintentos y separación del Outbox.
- **F07-FR-014**: Redis DEBE conservar Cache-Aside, TTL e invalidación aprobados; su caída DEBE producir fallback a PostgreSQL.
- **F07-FR-015**: Secretos y variables privadas DEBEN permanecer fuera del repositorio, artefactos frontend, logs, capturas y resultados de pruebas.
- **F07-FR-016**: El pipeline de Pull Request DEBE ejecutar compilación, pruebas aplicables, revisión de tipos, seguridad, secretos y controles de aislamiento antes de permitir integración.
- **F07-FR-017**: La publicación a un entorno AWS DEBE requerir un commit revisado, entorno protegido y aprobación humana; un merge no autoriza por sí mismo crear o modificar recursos facturables.
- **F07-FR-018**: La autenticación de CI con AWS DEBE usar credenciales temporales y permisos mínimos limitados a repositorio, rama y entorno; no se permiten claves duraderas versionadas.
- **F07-FR-019**: Cada release DEBE registrar revisión, artefactos, migraciones, fecha, responsable, salud y versión anterior apta para rollback.
- **F07-FR-020**: Una falla en controles críticos o smoke posterior DEBE detener promoción y activar el procedimiento documentado de recuperación o rollback.
- **F07-FR-021**: PostgreSQL DEBE disponer de respaldo lógico protegido, retención definida y restauración ensayada en un entorno aislado.
- **F07-FR-022**: El runbook DEBE cubrir despliegue, rollback, migraciones, respaldo, restauración, certificados, DNS, capacidad, incidentes y cierre de recursos.
- **F07-FR-023**: La observabilidad DEBE cubrir salud y latencia de API, recursos del servidor, PostgreSQL, Redis, Outbox, Notificaciones, seguridad y consumo/costo, sin registrar datos privados.
- **F07-FR-024**: Las pruebas posteriores DEBEN incluir HTTPS, rutas SPA, autenticación, autorización, aislamiento entre dos farmacias ficticias, Redis caído, Notificaciones caída y ausencia de puertos privados expuestos.
- **F07-FR-025**: La evidencia DEBE distinguir controles locales, staging/demo, resultados omitidos y revisión humana; no debe afirmar alta disponibilidad ni producción.
- **F07-FR-026**: F07 DEBE conservar S3 privado + CloudFront y Lightsail Linux como arquitectura objetivo; RDS, Redis administrado, proveedores externos y múltiples réplicas pertenecen a evoluciones posteriores.
- **F07-FR-027**: Las pruebas comparativas de una y dos réplicas y el informe integral de escalabilidad pertenecen a F08; F07 solo DEBE dejar el despliegue medible y preparado.
- **F07-FR-028**: La estrategia de región, capacidad y presupuesto será [NEEDS CLARIFICATION: seleccionar región AWS, tamaño inicial de Lightsail y presupuesto mensual máximo antes del plan].
- **F07-FR-029**: La estrategia de nombres públicos será [NEEDS CLARIFICATION: decidir si se usará dominio propio/proveedor DNS, Route 53 o únicamente nombres temporales autorizados para frontend y API].
- **F07-FR-030**: Los objetivos académicos de recuperación serán [NEEDS CLARIFICATION: definir RPO, RTO y retención mínima que deberán medirse en la restauración].

### Key Entities

- **Propuesta de costo**: recursos concretos, región, capacidad, costo fijo/variable, presupuesto, etiquetas y autorización.
- **Entorno de despliegue**: local, staging o demo con límites, endpoints y credenciales separados.
- **Release**: revisión aprobada, artefactos, migraciones, estado de salud y referencia de rollback.
- **Respaldo verificable**: copia protegida de datos sintéticos, retención, fecha, integridad y resultado de restauración.
- **Evidencia de despliegue**: control ejecutado, entorno, fecha, resultado, limitación y material no sensible.
- **Incidente operativo**: condición detectada, contención, recuperación, verificación y responsable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **F07-SC-001**: Cero recursos facturables se crean antes de una autorización que identifique el 100 % de recursos y costos previstos.
- **F07-SC-002**: El 100 % de rutas SPA de la batería carga mediante HTTPS y el almacenamiento de origen rechaza acceso público directo.
- **F07-SC-003**: La inspección externa encuentra únicamente los puertos expresamente aprobados y cero accesos públicos a PostgreSQL, Redis o Notificaciones.
- **F07-SC-004**: El 100 % de intentos de acceso cruzado incluidos en la batería es denegado sin filtrar datos, y los recorridos positivos equivalentes continúan funcionando.
- **F07-SC-005**: Cualquier control crítico fallido impide la promoción en el 100 % de ejecuciones de prueba del pipeline.
- **F07-SC-006**: Un respaldo sintético puede restaurarse de forma aislada dentro de los RPO/RTO aprobados, conservando roles y políticas de aislamiento.
- **F07-SC-007**: La batería posterior verifica salud, autenticación, búsqueda con fallback y persistencia transaccional ante caída de Notificaciones sin regresiones críticas.
- **F07-SC-008**: La inspección de repositorio, artefactos, frontend, logs y evidencias encuentra cero secretos, credenciales o datos personales reales.
- **F07-SC-009**: Cada release de demostración posee revisión, artefactos, aprobación, salud y rollback trazables, sin afirmar alta disponibilidad.

## Assumptions

- F00–F06 constituyen la línea base; sus pendientes humanos no se convierten automáticamente en aprobados por desplegarlos.
- La primera topología usa un solo servidor y es un prototipo académico, no producción ni alta disponibilidad.
- S3 privado + CloudFront y Lightsail son decisiones normativas; las cantidades y precios deben verificarse nuevamente antes de autorizar gastos.
- La preparación local, IaC o scripts sin ejecutar puede planificarse antes de autorizar recursos, pero no debe contener secretos ni efectuar llamadas de mutación a AWS.
- F08 realizará escalabilidad comparativa y consolidación final de evidencias; F07 conserva las métricas necesarias.

## Source Traceability

- Documento Maestro Definitivo v2.0: capítulos 25–26 y 30–33, en particular párrafos 563–623 y 708–815.
- Constitution v1.1.0: principios VI–XIV, XVI–XVIII y XX; especialmente XI y XII.
- F00–F06: builds, contratos, RLS, Redis, Outbox, Notificaciones y asistente ya implementados; su aceptación final permanece independiente.
- Rúbrica docente: despliegue, CI/CD, seguridad, disponibilidad declarada, pruebas, costos y evidencias de los 16 criterios sin resultados inventados.
