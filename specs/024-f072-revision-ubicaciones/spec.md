# Feature Specification: F07.2 — Revisión de ubicaciones: propuestas reemplazadas y aviso de distancia

**Feature Branch**: `feat/f072-revision-ubicaciones` (creada desde `main` `3ad229a`)
**Created**: 2026-11-27
**Status**: Borrador, **pendiente de aprobación de Andre** (decisiones D-01 a D-06).
**Input**: corrección pedida por Andre el 2026-11-27 sobre «Mi farmacia» y «Revisar ubicaciones» (F07.1).
**Trazabilidad**: F07.1 (spec 021): D-04 A, F071-FR-013 a FR-018; F07 (spec 010); Constitution (US$0, sin servicios nuevos, RLS).

## Qué pasó (revisado en solo lectura en la DEMO, sin cambios)

- **Propuestas duplicadas (STUART-FAR):** dos propuestas idénticas a las 17:33:42 y 17:33:46. Se aprobó la segunda; la primera sigue PENDIENTE.
  - El botón «Enviar propuesta» **sí** se desactiva mientras envía. Pero, tras el éxito, el formulario queda lleno y listo: un segundo clic 4 s después manda otra propuesta igual.
  - «Pendientes» ya muestra solo la más reciente pendiente de cada farmacia. Al aprobar la nueva, la anterior pasa a ser «la más reciente pendiente» y reaparece.
  - F07.1 decidió **D-04 A** («la nueva reemplaza a la pendiente, que queda Reemplazada») y lo implementó **calculándolo al leer**, sin cambiar F07 (plan 021, R-03). Ese cálculo solo mira propuestas pendientes; por eso falla cuando la más nueva ya fue decidida.
  - Riesgo acotado: aprobar ahora la propuesta vieja **fallaría** con «Ubicación pública cambió» (control de versión), así que no puede sobrescribir la ubicación aprobada.
- **Punto lejano (HUAMANFAR):** la ubicación aprobada (-17,195; -70,936) coincide con el centro de **Moquegua**, a unos 570 km en línea recta de Ayacucho.
  - «Buscar en el mapa» envía «dirección, ciudad, Perú» a Nominatim (F071-FR-013, «sesgado por la ciudad»), **sin limitar la zona**: encontró una calle parecida en otra ciudad.
  - Ni «Mi farmacia» ni «Revisar ubicaciones» comparan el punto con la ciudad escrita.

## Revisión previa (lo aprobado que toca este pedido)

| Fuente | Qué dice | Efecto |
|---|---|---|
| F07.1 D-04 A y plan R-03 | La nueva propuesta reemplaza a la pendiente («Reemplazada» calculada al leer, sin tocar F07). La revisión solo acepta la última pendiente. | Se mantiene la regla; se corrige el cálculo (D-01). |
| F07 001/002 | `ubicacion_propuesta.estado` solo admite PENDIENTE, PUBLICADA_VERIFICADA y RECHAZADA; una no pendiente exige revisor. El dueño no puede modificar sus propuestas (solo el revisor, por RLS). | Un estado guardado «REEMPLAZADA» exige migración nueva con cambios de restricciones y RLS (D-01 B). |
| F071-FR-013 | «Buscar en el mapa» restringido al Perú y **sesgado** por la ciudad. | Enmienda: **limitado** a la zona de la ciudad cuando está en la lista interna (D-02). |
| F071-FR-015 y F03.1 E-01 | Lista interna `peru-cities.js` (capitales, ciudades grandes, distritos de Lima) y `search-places.js` (16 distritos de Huamanga), sin servicio externo. | Se usan ambas para el centro de la ciudad y la distancia. Sin servicios nuevos. |
| F071-FR-017 | Historial con filtro «Pendientes / Aprobadas / Rechazadas». | Se agrega «Reemplazadas». |
| Constitution | US$0; RLS siempre; sin servicios nuevos. | Nominatim ya estaba aprobado (F07.1); no se agrega nada. |

## User Scenarios & Testing

### User Story 1 — Un solo envío por propuesta (P1)
1. **Given** el dueño envía una propuesta, **When** pulsa otra vez «Enviar propuesta» al instante o tras el éxito sin cambiar nada, **Then** no se crea una segunda propuesta: el botón queda desactivado hasta que cambie algún dato, y el servidor devuelve la misma propuesta si llega un envío idéntico.
2. **Given** dos envíos idénticos simultáneos (doble clic muy rápido o dos pestañas), **When** llegan al servidor, **Then** queda una sola propuesta.

### User Story 2 — La propuesta anterior queda «Reemplazada» (P1)
1. **Given** hay una propuesta pendiente, **When** el dueño envía otra distinta, **Then** la anterior deja de estar en «Pendientes» y aparece en el historial como «Reemplazada».
2. **Given** se aprueba o rechaza la más reciente, **When** el revisor vuelve a «Pendientes», **Then** no reaparece ninguna anterior de esa farmacia.
3. «Pendientes» muestra solo la propuesta más reciente de cada farmacia, y solo si sigue pendiente.

### User Story 3 — Aviso de distancia (P1)
1. **Given** el dueño escribe «Ayacucho» y pulsa «Buscar en el mapa», **When** busca la dirección, **Then** solo se aceptan resultados dentro de la zona de Ayacucho.
2. **Given** el punto queda a más de 30 km del centro de la ciudad escrita, **When** está por enviar, **Then** ve «Este punto está a 570 km de Ayacucho. ¿Es correcto?» y puede enviar igual.
3. **Given** el revisor abre una propuesta lejana, **When** la mira antes de decidir, **Then** ve el mismo aviso junto a la propuesta y puede aprobar o rechazar igual.
4. **Given** la ciudad no está en la lista interna, **Then** se dice «No podemos comprobar la distancia: "X" no está en nuestra lista de ciudades» (sin bloquear).

### Edge Cases
- Envío idéntico = misma farmacia, mismo autor, misma dirección, ciudad, coordenadas (6 decimales) y fuente, dentro de 10 s (D-05).
- Cambiar un dato después del éxito vuelve a habilitar el envío (es una propuesta nueva que reemplaza a la anterior).
- El aviso usa línea recta (no rutas) y redondea a km.
- Los distritos de Huamanga cuentan como su propio centro (lista E-01).
- Sin resultados dentro de la zona: «No encontramos esa dirección en Ayacucho. Marca el punto en el mapa.»

## Requirements

### Functional Requirements
- **F072-FR-001**: «Enviar propuesta» DEBE quedar desactivado mientras envía y, tras el éxito, mientras el formulario no cambie. Se protege también el doble clic dentro del mismo instante.
- **F072-FR-002**: El servidor DEBE devolver la propuesta existente, sin crear otra ni otro registro de auditoría, si llega un envío idéntico (D-05) de la misma farmacia y el mismo autor; los envíos simultáneos de una farmacia se procesan de a uno.
- **F072-FR-003**: Una propuesta nueva DEBE dejar las pendientes anteriores de esa farmacia como «Reemplazada» (D-01), visibles en el historial y fuera de «Pendientes».
- **F072-FR-004**: «Pendientes» DEBE mostrar solo la propuesta más reciente de cada farmacia, y solo si sigue pendiente; la revisión solo DEBE aceptar esa propuesta.
- **F072-FR-005**: El historial de «Revisar ubicaciones» y el de «Mi farmacia» DEBEN mostrar «Reemplazada»; el filtro suma «Reemplazadas».
- **F072-FR-006**: «Buscar en el mapa» DEBE limitarse a la zona de la ciudad o distrito escrito (D-02) si está en la lista interna; si no, se busca como hoy y se avisa que no se pudo limitar.
- **F072-FR-007**: «Mi farmacia» DEBE mostrar antes de enviar el aviso de distancia cuando el punto queda a más de 30 km (D-04) del centro de la ciudad escrita.
- **F072-FR-008**: «Revisar ubicaciones» DEBE mostrar el mismo aviso junto a cada propuesta pendiente (y en el historial).
- **F072-FR-009**: El aviso NO DEBE impedir enviar ni aprobar (D-06).
- **F072-FR-010**: Sin servicios, librerías ni costos nuevos; la distancia se calcula con la lista interna.
- **F072-FR-011**: Sin cambios en qué se publica ni en quién puede proponer o revisar; RLS igual (salvo lo que apruebe D-01 B).
- **F072-FR-012**: Para la propuesta colgada de STUART-FAR en la DEMO: resolverla con registro auditado y **sin borrarla**, solo con autorización de Andre (D-03).
- **F072-FR-013**: Mostrarlo en la copia temporal 3001/5174 con datos ficticios, incluidos el doble envío y un punto lejano.

## Success Criteria
- **SC-001**: Doble clic, segundo clic tras el éxito y dos pestañas simultáneas producen una sola propuesta.
- **SC-002**: Tras aprobar la más reciente, «Pendientes» no muestra propuestas anteriores de esa farmacia; el historial las muestra como «Reemplazada».
- **SC-003**: Un punto a más de 30 km muestra el aviso con los km correctos (±1 km) en «Mi farmacia» y en «Revisar ubicaciones».
- **SC-004**: Con la ciudad en la lista, «Buscar en el mapa» no devuelve resultados fuera de su zona.

## Decisiones para Andre (opción recomendada en **negrita**)

- **D-01 · Cómo queda «Reemplazada»**
  - **A) Calculada al leer, corregida, sin SQL (recomendada):** una pendiente queda «Reemplazada» si existe una propuesta **más nueva de la misma farmacia en cualquier estado**. Corrige el defecto, sigue D-04 A tal como se aprobó en F07.1 («sin tocar F07») y no cambia restricciones ni RLS. El registro auditado del reemplazo es la PROPUESTA nueva, que ya queda en la auditoría.
  - B) Estado guardado «REEMPLAZADA» con migración nueva `f07/011`: ampliar el estado permitido y la regla «no pendiente exige revisor», agregar la acción de auditoría «REEMPLAZO» y una política RLS para que el dueño cierre sus pendientes. Más explícita, pero cambia restricciones y permisos de F07 (te presentaría el SQL con su hash).
- **D-02 · Cómo limitar «Buscar en el mapa»**
  - **A) Zona alrededor del centro de la ciudad de la lista interna (recomendada):** la pantalla envía el centro de la ciudad; el servidor pide a Nominatim solo resultados dentro de un recuadro de ~30 km (`viewbox` + `bounded`). Si la ciudad no está en la lista, se busca como hoy con un aviso.
  - B) Buscar como hoy y descartar en el servidor los resultados lejanos.
- **D-03 · Propuesta colgada de STUART-FAR (17:33:42) en la DEMO** (no se toca sin tu autorización)
  - **A) Con D-01 A, sin escribir nada (recomendada):** al actualizar la DEMO con esta mejora, sale sola de «Pendientes» y el historial la muestra «Reemplazada» por la de 17:33:46, cuya PROPUESTA y APROBACIÓN ya están auditadas. No se borra ni se modifica ninguna fila.
  - B) Hoy, desde la pantalla: «Rechazar» con motivo «Duplicada: reemplazada por la propuesta aprobada de 17:33:46». Queda auditada como RECHAZO con motivo; no cambia la ubicación publicada.
  - C) Con D-01 B: marcarla «REEMPLAZADA» con un registro «REEMPLAZO» y motivo, mediante una acción única autorizada, con copia de seguridad previa.
- **D-04 · Umbral del aviso:** **A) 30 km fijos (recomendada, tu ejemplo).** B) Según el tamaño de la ciudad.
- **D-05 · Envío idéntico:** **A) mismo autor y mismos datos dentro de 10 s → se devuelve la misma propuesta (recomendada).** B) Rechazar con un mensaje «Ya enviaste esta propuesta».
- **D-06 · Forma del aviso:** **A) Aviso visible junto al botón, sin paso extra (recomendada; «solo alerta»).** B) Pedir un clic de confirmación adicional.

## Fuera de alcance
- Corregir la ubicación publicada de HUAMANFAR (la hará el dueño con una propuesta nueva cuando esté la mejora).
- Rutas reales o distancias por carretera; ampliar la lista de ciudades.
- Pendientes sin empezar: márgenes, ayuda de dirección en el registro (después de T063), corrida de pruebas por investigar, opción C de F03.2 (con la spec 020) y la mejora del asistente (preguntas naturales y tarjetas compactas).

## Assumptions
- Nominatim sigue siendo el servicio aprobado de F07.1 (gratuito, a través del servidor); `viewbox` y `bounded` son parámetros de ese mismo servicio.
- F02.5 sigue sin aceptar (T057 y T063 sin marcar) y la spec 020 sigue en opción A.
