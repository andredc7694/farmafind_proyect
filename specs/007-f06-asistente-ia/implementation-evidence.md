# Evidencia de implementación F06

**Estado:** cierre técnico provisional. La aprobación documental fue otorgada expresamente el 2026-11-16; la aceptación humana final continúa pendiente.

## Límites acreditables

- Proveedor configurado: `MockAIProvider` determinista.
- Proveedores externos, SDK y recursos pagados: ninguno.
- Persistencia propia F06: ninguna.
- Datos permitidos: proyecciones públicas F03.

## Resultados reales — 2026-11-16

| Control | Resultado observado |
|---|---|
| `npm run check:f06` | 9 archivos, 32 pruebas satisfactorias |
| `npm run check` | límites modulares y TypeScript satisfactorios; 101 archivos revisados |
| `npm run build` | backend, frontend y notificaciones compilan; Vite produjo 48 módulos |
| `npm run test:base` | 72 archivos satisfactorios, 14 omitidos; 274 pruebas satisfactorias y 81 omitidas |
| `npm run test:f03:integration` | 3/3 Redis reales satisfactorias |
| `npm run test:f03:rls` | 4/4 PostgreSQL/RLS satisfactorias |
| `node scripts/f03/fixture.mjs verify` | base F03 aislada y base persistente intacta; RLS activo |
| `npm run verify:f06:integration` | 2 fuentes en búsqueda, 2 en comparación y rechazo clínico; proveedor mock |
| `npm run test:f06:fallback` | fallback PostgreSQL satisfactorio con Redis detenido y cero resultados inventados |
| `npm run test:f06:load` | 100 consultas; p95 8.668 ms, p99 11.889 ms, cero proveedores de red |
| `npm audit --audit-level=low` | cero vulnerabilidades |
| `git diff --check` y barrido | sin errores; 45 archivos revisados y cero patrones de secretos |

La primera ejecución de fallback contra `farmafind_f01_test` falló porque esa base persistente no contiene el esquema F03. Se corrigió la configuración de la prueba para usar el fixture F03 aislado; no se migró ni modificó la base persistente.

La convergencia revisó 24 requisitos, 8 criterios de éxito, cuatro historias, las decisiones del plan y los principios constitucionales aplicables. No detectó trabajo construible faltante, contradicciones ni ampliaciones fuera de alcance; no añadió tareas.
