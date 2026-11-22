# Candidata integrada F00 para controles A/B

La candidata se congeló desde el commit publicado `b160c6a381a60386311911053347b407a2833def` de `integration/f00-f06`. Las copias A y B se extrajeron por separado mediante `git archive HEAD`; por ello no incorporan archivos no versionados ni documentación ajena a F00–F06.

- Hash SHA-256 del manifiesto de fuente: `619accd73a89f48e5967df2a57294312d2f1df16927cf617628684f87554df2c`.
- Hash SHA-256 de `package-lock.json`: `e0cbfb81fc61613ac0ef9327f187d7a42554332e39d761a4d3499f7af7fa646f`.
- Preparación A: `F00-A-2026-11-17T18-51-19.916Z`.
- Preparación B: `F00-B-2026-11-17T18-53-12.890Z`.
- Copias independientes: `artifacts/f00/final-b160c6a/A` y `artifacts/f00/final-b160c6a/B`, privadas e ignoradas por Git.

Ambas preparaciones ejecutaron instalación reproducible, controles locales, regresión base, build y Playwright en el contenedor Linux oficial. Sus estados `overall` son `passed` y el comparador produjo `acceptance=passed`. Este resultado técnico prepara T058, pero no sustituye su revisión humana.
