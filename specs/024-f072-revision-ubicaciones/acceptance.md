# Aceptación F07.2 — Revisión de ubicaciones

**Decisión de Andre (2026-11-27): ACEPTO.**

> «ACEPTO F07.2 (propuestas duplicadas, «Reemplazada», búsqueda limitada a la ciudad y aviso de distancia). Lo revisé en la copia temporal.»

- **Alcance aceptado:**
  - Un solo envío: el botón queda desactivado tras el éxito hasta cambiar algún dato, y el servidor devuelve la misma propuesta ante un envío idéntico del mismo autor en 10 s (también con envíos simultáneos).
  - Regla única de «Reemplazada» (D-01 A, sin SQL), igual para el dueño (historial) y el revisor (filtro «Reemplazadas»); «Pendientes» solo con la más reciente de cada farmacia si sigue pendiente.
  - «Buscar en el mapa» limitado a ~30 km del centro de la ciudad de la lista interna, con el mensaje orientador pedido.
  - Aviso de distancia (> 30 km) en «Mi farmacia» y en «Revisar ubicaciones», sin bloquear.
- **Probado por Andre** en la copia temporal (3001/5174) con datos ficticios.
- **Pendiente tras la aceptación:** PR y merge; actualizar la DEMO con aviso previo y copia de seguridad, y comprobar en solo lectura que la propuesta de STUART-FAR de 17:33:42 salió de «Pendientes» y aparece «Reemplazada», sin borrarse ni modificarse (D-03 A). Después Andre corrige la ubicación de HUAMANFAR.
- F02.5 sigue sin aceptar (T057 y T063 sin marcar) y la spec 020 sigue en opción A.
