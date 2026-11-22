# Preparación de CI para F00

Los comandos locales reutilizables son `npm.cmd run check`, `check:config`, `test:base` y `build`; `verify:local` añade arranque HTTP, separación y limpieza en Windows 10. Las salidas usan códigos 0/1 y reportes privados por ejecución. Esto permite diseñar después un job de GitHub Actions con checkout, Node/npm de referencia y `npm ci`, sin crear ahora un workflow, secretos, runner remoto ni despliegue.

Las pruebas unitarias de configuración/reportes, la integración HTTP técnica y los controles base de seguridad arquitectónica se ejecutan localmente. Playwright exige un Windows oficialmente compatible, Chromium preparado explícitamente y dos preparaciones completas A/B de la misma revisión. No se declara soporte Windows 10 para esas pruebas. Las pruebas de negocio, PostgreSQL/RLS, Redis, carga k6, infraestructura AWS y despliegue pertenecen a fases posteriores y no se simulan en CI F00.
