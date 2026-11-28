# Aceptación F06.2 — Asistente FarmaFind AI mejorado

**Decisión de Andre (2026-11-27): ACEPTO.**

> «ACEPTO F06.2 (asistente mejorado). Lo revisé en la copia temporal. Acepto también tus tres decisiones menores.»

- **Probado por Andre** en la copia temporal (3001/5174) con datos ficticios.
- **Decisiones menores aceptadas:**
  - El asistente reconoce los 16 distritos de Huamanga.
  - «¿y en Carmen Alto?» después de una pregunta de precio pasa a buscar por cercanía.
  - La pregunta rápida dice «Algo más barato con el mismo principio activo», sin la palabra «genérico».
- **Pedido junto con la aceptación:** el script de la copia temporal debe comprobar el puerto antes de arrancar y detenerse con un mensaje claro si intenta usar 3000 o 5173; con su prueba, en esta rama.
- **Después:** apagar la copia y borrar solo su base efímera y sus usuarios técnicos; PR y merge commit; encender la DEMO con `main`, con copia de seguridad previa y comprobación en solo lectura.
- F02.5 sigue sin aceptar (T057 y T063 sin marcar) y la spec 020 sigue en opción A.
