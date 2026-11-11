# Candidata local F00 para controles A/B

La candidata local se congeló como copia de fuente antes de ejecutar las dos preparaciones. No tiene un commit propio: el HEAD de partida era `5378af10af68b1a2844e1ba478fbd109ec6347e0`, que no representa el código nuevo sin confirmar. No se inventa un SHA de commit para esta candidata.

- Hash SHA-256 del manifiesto de fuente e instrucciones: `3164f37ed8f0fc45d2636bb518b6c052a5bc5f721d627134f7fc97aedbdc9290`.
- Hash SHA-256 de `package-lock.json`: `bf790d7a8b05595f21258d0e83b3b080ad17514700d33ddd5896e73e1a7019c9`.
- Exclusiones del manifiesto: `.git`, `docs/referencias`, perfiles `.env.local`, `node_modules`, `dist`, cachés y `artifacts`.
- Copias propias: `artifacts/f00/preparations/3164f37ed8f0fc45/Preparation A` y `Preparation B`, ambas privadas e ignoradas por Git.

Los controles A/B de esta candidata son **locales** en Windows 10. No se ha ejecutado Playwright, no existen dos preparaciones **completas** y no se declara F00 aceptada. Si el código, lockfile o instrucciones cambian después de esta captura, una futura aceptación requiere una nueva candidata y repetir A/B completos.
