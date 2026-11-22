# F00 — revisión de dependencias T003

Fecha de revisión: 2026-11-10. Rama `feat/sdd-aws-multitenant`; HEAD documental `5378af10af68b1a2844e1ba478fbd109ec6347e0`. Referencias observadas: Node.js `v24.17.0`, npm `11.13.0`.

Las selecciones originales Vite `7.3.6` y Vitest `4.0.18` presentaron avisos en la consulta previa de metadatos y seguridad del registro npm. El usuario autorizó expresamente Vite `7.3.8` y Vitest `4.1.12`. Sus engines/peers declarados admiten Node 24.17.0 y el resto del árbol seleccionado. Los tipos auxiliares concretados fueron `@types/node 24.19.2`, `@types/express 5.0.6` y `@types/supertest 6.0.3`; las demás versiones directas permanecen en los manifiestos.

Se resolvió `package-lock.json` raíz y se instaló con `npm ci --ignore-scripts --no-audit --no-fund`. No se descargaron navegadores. La auditoría `npm audit --json --offline=false` del árbol instalado devolvió código 0, `0` vulnerabilidades informadas en `258` dependencias. La auditoría previa del lockfile consta en [audit-before-install.json](audit-before-install.json). Este resultado refleja el estado del registro al momento de la consulta; no constituye una garantía futura.

La compilación Vite/TypeScript y las pruebas técnicas locales se comprobaron en Windows 10. La ejecución de Playwright, la aceptación completa y las dos preparaciones A/B siguen pendientes. No se aplicó `npm audit fix --force` ni se cambiaron versiones principales o arquitectura.
