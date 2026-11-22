# F08 — Investigación y decisiones de diseño

**Estado:** decisiones de diseño aprobadas con la especificación y el plan el 2026-11-18. Fuentes: Maestro v3 §A7, Constitution v1.2.0, frontend y OpenAPI F01–F07.

| Decisión | Justificación | Alternativas y límite |
| --- | --- | --- |
| Reutilizar React/Vite/JSX, clientes HTTP y vistas existentes | Constitución IV y menor riesgo de romper flujos aceptados. | Sustituir framework o reescribir dominio no está autorizado. |
| Rutas UI explícitas y navegación semántica sin dependencia nueva inicialmente | Las rutas actuales son páginas enlazadas por pathname; una tabla central permite cubrirlas y probar permisos. | Una librería de router solo se propondrá si un caso real exige navegación anidada/estado que no pueda resolverse con la base actual. |
| CSS variables y componentes propios ligeros | Paleta y estados consistentes con poco peso y sin alterar reglas. | Un kit visual pesado añade dependencias y estilos difíciles de auditar. |
| Clientes existentes como única capa de transporte F01–F07 | Ya contienen cookies, CSRF y parámetros aprobados; evita contratos divergentes. | No llamar directamente a tablas, Redis ni endpoints internos F05. |
| Estado de sesión derivado de F01; interfaz condicionada por permisos recibidos | Evita controles administrativos visibles a usuarios sin capacidad; backend/RLS siguen autoridad. | No inferir acceso por URL, farmacia_id o rol nominal aislado. |
| F05 sin bandeja | Su OpenAPI solo expone POST interno de eventos; el navegador sí puede ver estados F04 autorizados. | Un inbox requiere nuevo contrato y aprobación, fuera de F08. |
| F07 solo TEST/DEMO, mapa voluntario | F07 fue aceptada solo en ese entorno; condiciones productivas de teselas y GEO persisten. | Nunca habilitar mapa productivo por efecto del rediseño. |
| F06.1 determinista con fuentes ya autorizadas | Gemini real apagado y contenido farmacológico pendiente de revisión profesional. | No prometer IA generativa ni mostrar clases/opciones no validadas. |
| Accesibilidad en dos capas: automatización y revisión humana | WCAG 2.2 AA es objetivo; los verificadores automáticos no cubren todos los recorridos. | Proponer axe solo tras revisar dependencia; Playwright/Testing Library ya disponibles. |
| Datos y rendimiento | Fixtures TEST aislados para mutaciones; medir bundle y tiempos reales antes de fijar presupuestos. | No inventar resultados de usabilidad, accesibilidad o carga. |

**Aclaraciones resueltas por fuentes:** no hay autorización de privilegios globales persistentes, mapas productivos, proveedores IA externos ni API pública F05. La aprobación de spec/plan se registró el 2026-11-18.

**Inspección de integración F08:** `frontend/src/main.jsx` resolvía rutas por `pathname`; la pantalla F00 de `/` es comprobada por `frontend/tests/bootstrap.spec.js` y `tests/bootstrap/browser-separation.spec.js`. Las vistas F01–F07 poseen clientes HTTP propios, por lo que F08 centraliza navegación y presentación sin duplicar transporte. F05 expone solo `/internal/v1/events`; no existe bandeja pública. El shell evita solicitar sesión en la raíz para conservar el control técnico F00 sin errores de red cuando la API está detenida.

**Herramienta de accesibilidad verificada el 2026-11-18:** `@axe-core/playwright` 4.14.0, licencia MPL-2.0 y `engines.node >=22.12.0` según el manifiesto oficial del paquete; compatible por requisito declarado con Node.js 24.17.0. Se añadió únicamente como dependencia de desarrollo y `npm install` reportó 0 vulnerabilidades. Referencias: [manifiesto oficial](https://github.com/dequelabs/axe-core-npm/blob/develop/packages/playwright/package.json), [paquete publicado](https://www.npmjs.com/package/%40axe-core/playwright). La ejecución Playwright de aceptación continúa sujeta a Linux oficialmente compatible.
