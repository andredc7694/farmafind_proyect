# F08 — Guía de validación propuesta

**Estado:** plan de validación; no se han ejecutado pruebas F08 al registrar la aprobación humana de spec y plan el 2026-11-18.

1. Confirmar rama F08, Constitution v1.2.0 y ausencia de cambios en main/base persistente.
2. Preparar PostgreSQL y Redis TEST locales según guías F01–F07, usando fixtures efímeros y cuentas ficticias. Nunca dirigir escrituras a `farmafind_f01_test` persistente.
3. Iniciar API y frontend TEST con los lanzadores aprobados; no activar Gemini ni mapas productivos.
4. Recorrer Inicio → búsqueda/comparación → mapa/lista sin permiso → asistente. Verificar estados vacíos, fuentes y ausencia de datos inventados.
5. Iniciar sesión con cuentas TEST Alfa/Beta: perfil, selector, inventario/importación y reservas. Probar que Beta no vea ni modifique Alfa; denegaciones backend/RLS obligatorias.
6. Probar F07 ubicación con proponente/revisor TEST distintos, CSRF y capacidades explícitas; sin concesiones persistentes.
7. Ejecutar pruebas de componentes, formularios, navegación, HTTP y permisos; Playwright en Linux compatible a 360/768/1280 px, teclado y zoom 200 %. Ejecutar verificación automática de accesibilidad y revisión humana de tareas críticas.
8. Ejecutar regresión F00–F07, build, TypeScript, contratos OpenAPI, npm audit completo y producción, revisión de secretos y `git diff --check`.
9. Registrar comandos, versiones, resultados reales y casos omitidos con razón. F08 queda pendiente de aceptación humana hasta completar los criterios y aprobarla expresamente.

No se ejecutan estos pasos durante la planificación. El contrato de rutas está en [contracts/ui-routes.md](contracts/ui-routes.md).
