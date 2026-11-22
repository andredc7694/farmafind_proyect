# Comparación local A/B de F00

Ejecución observada el 2026-11-10 en Windows 10. Una misma persona preparó dos copias nuevas de la candidata registrada en [candidate.md](candidate.md); no compartieron `node_modules`, `dist`, `.env.local`, procesos ni reportes. Se reutilizaron únicamente las herramientas del equipo y la caché de descarga de npm. Los directorios y reportes privados permanecen en `artifacts/f00/`, fuera de Git.

| Preparación | RunId | Instalar | Controles | Estados |
|---|---|---|---|---|
| A | `F00-A-2026-11-11T03-04-00.058Z` | `npm.cmd ci --ignore-scripts --no-audit --no-fund --offline=false`: 205 paquetes, código 0. | `npm.cmd run verify:local -- --preparation A`: 34 tests de configuración, 64 tests base, build de tres componentes, HTTP y tres reinicios, código 0. | `local=passed`, `overall=pending`, `acceptance=pending`; limpieza `passed`; errores `none`. |
| B | `F00-B-2026-11-11T03-05-02.171Z` | El mismo `npm ci`: 205 paquetes, código 0. | `npm.cmd run verify:local -- --preparation B`: 34 tests de configuración, 64 tests base, build de tres componentes, HTTP y tres reinicios, código 0. | `local=passed`, `overall=pending`, `acceptance=pending`; limpieza `passed`; errores `none`. |

Los comandos de preparación fueron `node scripts/f00/prepare-local-copy.mjs A` y después `B`, cada uno con código 0. Ambas copias informaron hash de fuente `3164f37ed8f0fc45d2636bb518b6c052a5bc5f721d627134f7fc97aedbdc9290` y hash de lockfile `bf790d7a8b05595f21258d0e83b3b080ad17514700d33ddd5896e73e1a7019c9`. Node observado: `v24.17.0`; npm `11.13.0`; Vite `7.3.8`; Vitest `4.1.12`. Los comandos internos `check`, `check:config`, `test:base` y `build`, sus tiempos, códigos y resultados se conservan en cada JSON privado.

Resultado esperado de cada preparación local: instalación congelada, configuración/compilación/pruebas satisfactorias, tres respuestas técnicas independientes y puertos libres al terminar. Resultado obtenido: esos controles pasaron en ambas copias. Ningún resultado de Playwright o captura UI se inventó; el preflight de aceptación completa permanece pendiente de un Windows oficialmente compatible. Por ello, F00-SC-001/002/007 y la aceptación completa no se declaran satisfechos. Los reportes de esta candidata local no sustituyen dos preparaciones completas de una futura revisión confirmada en Git.
