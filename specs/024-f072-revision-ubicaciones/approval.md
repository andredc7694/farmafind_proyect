# Aprobaciones F07.2 — Revisión de ubicaciones

## 2026-11-27 · Pedido de Andre
- Problema 1 (propuestas duplicadas): desactivar «Enviar propuesta» mientras envía y que el servidor rechace o ignore un segundo envío idéntico al instante; que una propuesta nueva deje las pendientes anteriores como «Reemplazada» (fuera de «Pendientes», visibles en el historial); que «Pendientes» muestre solo la más reciente de cada farmacia; proponer cómo resolver la propuesta colgada de STUART-FAR con registro auditado y sin borrarla (no tocarla sin autorización).
- Problema 2 (aviso de distancia): «Buscar en el mapa» limitado a la ciudad o distrito escrito y aviso si el punto queda lejos (más de 30 km) antes de enviar; el mismo aviso para el revisor antes de aprobar; el aviso no impide; lista interna, sin servicios externos nuevos.
- Reglas: revisar la spec F07.1 y sus enmiendas; si hace falta enmienda o migración (p. ej. «Reemplazada»), presentar enmienda y SQL con hash; no editar SQL aprobado. Copia temporal 3001/5174 con datos ficticios (doble envío y punto lejano). No tocar la DEMO, su base ni su Redis.
- Registrar como pendiente, sin empezar, la mejora del asistente (preguntas naturales sin IA externa, tarjetas compactas con las 3 más baratas y «Ver todas», más grande en computadora). Hecho en `ESTADO.md`.

## Pendiente (resuelto el 2026-11-27)
- Aprobación de `spec.md` y de las decisiones D-01 a D-06.

## 2026-11-27 · Spec aprobada
- Andre: «Apruebo la spec de la corrección de revisión de ubicaciones (F07.2, commit f602f95) con las seis decisiones en A (D-01 a D-06)».
- Condiciones:
  - D-01: «Reemplazada» debe verse igual para el dueño (su historial) y para el revisor (filtro nuevo), con prueba automática del caso real de dos envíos seguidos.
  - D-03: la propuesta colgada de STUART-FAR no se borra ni se modifica; después de actualizar la DEMO, comprobar en solo lectura que salió de «Pendientes» y aparece «Reemplazada».
  - La ubicación de HUAMANFAR la corregirá Andre cuando la mejora esté en su DEMO, probando la búsqueda limitada y el aviso.
- Siguiente: plan y tasks para su aprobación antes de programar. No tocar la DEMO.

## Pendiente
- Aprobación de `plan.md` y `tasks.md` (sin SQL).
