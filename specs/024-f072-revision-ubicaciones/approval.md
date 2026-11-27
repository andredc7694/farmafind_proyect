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


## 2026-11-27 · Plan y tasks aprobados
- Andre: «Apruebo plan y tasks de F07.2 (commit c85dab4). Puedes empezar a programar».
- Agrega: si «Buscar en el mapa» no encuentra la dirección dentro de la ciudad, el mensaje debe orientar, p. ej. «No encontramos esa dirección en Ayacucho. Revisa cómo está escrita o marca el punto tocando el mapa», con prueba.
- Cuando la copia esté lista: recorrido exacto y credenciales ficticias. No tocar la DEMO.

## 2026-11-27 · Aceptación
- Andre: «ACEPTO F07.2 (propuestas duplicadas, «Reemplazada», búsqueda limitada a la ciudad y aviso de distancia). Lo revisé en la copia temporal.»
- Autoriza: apagar la copia y borrar solo su base y sus usuarios técnicos; PR y merge a `main` con merge commit solo si está MERGEABLE, CLEAN, con CI en verde, sin secretos y con la regresión correcta (sin force push; si algo falla, detenerse).
- Después del merge: avisar antes de actualizar la DEMO; copia de seguridad previa; al terminar, comprobar en solo lectura que los datos siguen intactos y que la propuesta de STUART-FAR de 17:33:42 salió de «Pendientes» y aparece «Reemplazada», sin borrarse ni modificarse. Luego Andre corrige HUAMANFAR.
