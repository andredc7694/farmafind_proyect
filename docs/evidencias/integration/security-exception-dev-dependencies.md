# Excepción temporal de seguridad — dependencias de desarrollo

**ID:** SEC-EXC-DEV-2026-001

**Fecha de entrada en vigor:** 2026-11-17

**Estado:** activa y limitada a la candidata `integration/f00-f06`

**Responsable de revisión:** mantenedor humano del proyecto FarmaFind

**Próxima revisión obligatoria:** antes de cada release o cambio de dependencias y, como máximo, el 2026-12-17

## Alcance exacto

La excepción cubre únicamente `GHSA-fc5q-39xc-vjpf` / `CVE-2026-112366` en
`picomatch@4.0.7`, introducido por dependencias de desarrollo:

- `vite@7.3.8` → `picomatch`, `fdir` y `tinyglobby`;
- `vitest@4.1.12` → `picomatch`, `tinyglobby` y Vite.

`npm audit` representa esta única vulnerabilidad transitiva como cinco nodos de severidad
alta. No se exceptúa ninguna vulnerabilidad de producción, dependencia futura, advisory
distinto ni una ampliación de exposición del servidor de desarrollo.

## Evaluación del riesgo

El advisory describe una denegación de servicio al compilar patrones extglob especialmente
construidos. La explotación requiere que un atacante controle el patrón glob entregado a
`picomatch`. FarmaFind no expone una API de globs: Vite y Vitest consumen patrones definidos
por el repositorio durante desarrollo y pruebas. El servidor Vite está fijado a
`127.0.0.1`; Vitest no se publica como servicio. La SPA productiva es el resultado estático
de Vite y el backend/Notificaciones no importan estas herramientas.

La auditoría del 2026-11-17 obtuvo:

- `npm audit`: 5 vulnerabilidades altas por la cadena anterior;
- `npm audit --omit=dev --audit-level=high`: 0 vulnerabilidades;
- `npm ls --omit=dev vite vitest picomatch fdir tinyglobby --all`: árbol vacío;
- búsqueda en `dist`, `backend/dist` y `notifications/dist`: sin referencias a esos paquetes.

Se evaluó el descenso sugerido por npm a Vite 6.2.7 y Vitest 3.1.4. Conservó
`picomatch@4.0.7` y elevó el informe a siete vulnerabilidades, dos críticas. Se restauraron
Vite 7.3.8, Vitest 4.1.12 y el lockfile original. El parche upstream disponible sigue sin
fusionar ni publicar; no se adopta código de forks ni se falsea una versión mediante override.

## Medidas obligatorias mientras esté activa

1. Mantener las versiones exactas y el `package-lock.json`; no ejecutar `npm audit fix --force`.
2. No aceptar patrones glob de usuarios ni exponer Vite, Vitest o sus interfaces fuera de
   loopback o de ejecutores CI aislados.
3. Construir artefactos con herramientas de desarrollo, pero desplegar solo la SPA estática
   y dependencias runtime instaladas con `npm ci --omit=dev`.
4. Ejecutar `npm audit` y `npm audit --omit=dev` en cada cambio de dependencias y antes de
   una release. Una vulnerabilidad de producción bloquea la publicación.
5. Revisar el advisory y el registro npm en la fecha indicada; conservar visible el resultado
   completo, sin reducir severidad ni atribuir cero vulnerabilidades al árbol de desarrollo.

## Retiro y bloqueo

La excepción DEBE retirarse cuando exista una versión oficial compatible que corrija el
advisory. La actualización requiere lockfile reproducible, auditoría completa con cero
vulnerabilidades y repetición de build, TypeScript, pruebas y Playwright afectados.

La excepción caduca el 2026-12-17 si no se revisa expresamente. También queda revocada de
inmediato si Vite/Vitest se exponen a red no confiable, FarmaFind empieza a aceptar globs
externos, la cadena entra en producción o aparece una explotación aplicable al uso real.
En cualquiera de esos casos se detienen integración y despliegue hasta corregir o recibir
una nueva decisión humana documentada.

## Compatibilidad normativa

La Constitution v1.1.0 no impone auditoría completa con cero avisos como condición absoluta.
Sus principios XIII, XIV y Governance exigen pruebas según riesgo, evidencia reproducible y
corrección de incumplimientos. Esta excepción conserva los resultados reales, no omite pruebas,
no cambia arquitectura ni seguridad multi-tenant y no autoriza despliegue AWS. Por tanto, no
requiere enmienda constitucional y permite versionar la rama de integración bajo estos límites.
