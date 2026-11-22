# F00 — Entorno de navegador verificado

**Fecha:** 2026-11-17
**Alcance:** aceptación técnica F00 en la candidata integrada F00–F06.

El host permanece en Windows 10 con Node.js 24.17.0 y npm 11.13.0. No se atribuye soporte oficial de Playwright a Windows 10. La autorización de integración permitió ejecutar el navegador dentro de `mcr.microsoft.com/playwright:v1.65.0-noble`, sobre Ubuntu 24.04 compatible, usando el mismo paquete Playwright 1.65.0 del proyecto.

El navegador observado en ambas preparaciones fue `Google Chrome for Testing 158.0.8127.18`. Los servicios frontend, API y Notificaciones se ejecutaron en el host y un puente TCP limitado a los tres puertos de prueba permitió el acceso desde el contenedor. No se instalaron Ubuntu, WSL ni navegadores en Windows y no se usaron servicios externos.

Resultado real: una prueba Playwright satisfactoria en A y una en B, con pantalla “FarmaFind — Bootstrap”, respuesta HTTP 200, React montado, recursos sin errores, captura técnica y limpieza de los tres procesos.
