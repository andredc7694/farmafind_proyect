# Aprobaciones F07.2 — Revisión de ubicaciones

## 2026-11-27 · Pedido de Andre
- Problema 1 (propuestas duplicadas): desactivar «Enviar propuesta» mientras envía y que el servidor rechace o ignore un segundo envío idéntico al instante; que una propuesta nueva deje las pendientes anteriores como «Reemplazada» (fuera de «Pendientes», visibles en el historial); que «Pendientes» muestre solo la más reciente de cada farmacia; proponer cómo resolver la propuesta colgada de STUART-FAR con registro auditado y sin borrarla (no tocarla sin autorización).
- Problema 2 (aviso de distancia): «Buscar en el mapa» limitado a la ciudad o distrito escrito y aviso si el punto queda lejos (más de 30 km) antes de enviar; el mismo aviso para el revisor antes de aprobar; el aviso no impide; lista interna, sin servicios externos nuevos.
- Reglas: revisar la spec F07.1 y sus enmiendas; si hace falta enmienda o migración (p. ej. «Reemplazada»), presentar enmienda y SQL con hash; no editar SQL aprobado. Copia temporal 3001/5174 con datos ficticios (doble envío y punto lejano). No tocar la DEMO, su base ni su Redis.
- Registrar como pendiente, sin empezar, la mejora del asistente (preguntas naturales sin IA externa, tarjetas compactas con las 3 más baratas y «Ver todas», más grande en computadora). Hecho en `ESTADO.md`.

## Pendiente
- Aprobación de `spec.md` y de las decisiones D-01 a D-06.
