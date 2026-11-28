# Implementation Plan: F06.2 — Asistente FarmaFind AI mejorado

**Branch**: `feat/f062-asistente-mejorado` | **Spec**: `spec.md` (aprobada 2026-11-27, D-01 a D-10 en A, con ajustes en D-04, D-06 y D-08)
**Status**: **Aprobado por Andre el 2026-11-27** (commit `0767cbd`), con condiciones sobre el `contexto` (ver `approval.md`).
**SQL**: **ninguno.** Sin migraciones, RLS ni permisos nuevos. Proveedor en **MOCK**. Sin librerías nuevas.

## Resumen
El servidor pasa a ser **sin estado** para la conversación (D-01 A): cada pregunta trae un `contexto` pequeño que vive solo en la memoria de la página. Un clasificador determinista ampliado reconoce PRECIO, CERCANÍA, HORARIO y ALTERNATIVA dentro de frases naturales; el medicamento se encuentra comparando con las ofertas públicas (búsqueda F03.2). La respuesta (contrato **2.0**) trae texto + tarjetas, opciones, sugerencia y «Ver todas». La pantalla se convierte en panel lateral en computadora y hoja inferior en celular.

## Revisión constitucional
| Principio | Cumplimiento |
|---|---|
| III · IA complementaria, solo lectura, MOCK | Herramientas de solo lectura (búsqueda pública F03/F03.2, farmacias públicas y horario público F07.1); sin escrituras; «Reservar» es un enlace a la pantalla de reserva (D-07). Proveedor MOCK; sin Gemini. |
| XIX · límites clínicos | Se conservan las reglas de F06.1 (dosis, diagnóstico, tratamiento, inyección). D-04 es comparación de **precios publicados** de formulaciones compatibles con aviso, sin «equivalente» ni «reemplazar». |
| VIII · datos públicos, RLS | Solo DTO públicos ya expuestos; nada de inventario interno, reservas ni datos privados. |
| IX · caché | Se reutiliza la caché de búsqueda F03 y la del horario público; sin claves nuevas. |
| US$0 | Sin servicios, librerías ni costos nuevos; distancia de edición escrita en el proyecto. |
| Contratos versionados (F061-FR-020) | `conversation.openapi.yaml` **2.0.0** en esta spec. |

## Diseño

### Backend (`backend/src/modules/asistente-ia/`)
- **`domain/assistant-language.ts`** (nuevo): limpieza con la misma regla de F03.2 (reexportada desde `busqueda/contracts/public-search-text.ts`), palabras de pregunta a quitar («dónde», «qué», «está», «más», «barato», «farmacia», «cerca», «abierta», «ahora»…), detección de intención:
  - PRECIO («barato», «precio», «cuánto cuesta», «comparar»…); CERCANÍA («cerca», «cercana», «más cerca»); HORARIO («abierta», «abre», «atiende», «ahora», «horario»); ALTERNATIVA («más barato que X», «algo parecido a X», «genérico de X»); SEGUIMIENTO («¿y en …?», «¿y el de 600 mg?», «¿y la de jarabe?»).
  - Distrito dentro de la frase (lista de lugares, abajo) y concentración/presentación pedida (tokens de F03.2).
- **`domain/places.ts`** (nuevo): copia de la lista interna (16 distritos de Huamanga + lista F07.1) con prueba de **paridad** contra las listas de la pantalla.
- **`domain/dosage-form.ts`** (nuevo, ajuste D-04): forma farmacéutica desde la presentación: tableta/comprimido, cápsula, jarabe, suspensión, solución, gotas, crema, gel, ungüento, inyectable, supositorio, óvulo, polvo/sobre, parche, spray/inhalador. **«caja x 30», «frasco 120 ml» u otras → forma desconocida → no se ofrece como alternativa.**
- **`domain/edit-distance.ts`** (nuevo): distancia Damerau-Levenshtein acotada (código propio). Sugerencia si distancia ≤ 2 (palabras ≥ 6 letras) o ≤ 1 (más cortas).
- **`domain/emergency.ts`** (nuevo, D-08): números verificados (SAMU 106 Minsa, Bomberos 116, Policía 105), fuente gob.pe y fecha 2026-11-27. La urgencia se evalúa **antes que todo** y la respuesta **no lleva tarjetas ni opciones**.
- **`domain/conversation-contract.ts`**: versión 2.0: petición `{ consulta, contexto? }` con `contexto` **estructurado, nunca texto libre** (condición de Andre): intención de una lista cerrada, medicamento (solo letras, números y espacios, ≤ 60), concentración (formato `500 mg`, ≤ 20), forma de la lista de `dosage-form.ts`, distrito de la lista de lugares o punto redondeado a 3 decimales dentro del Perú; el JSON del contexto ≤ 1 KB. El servidor **descarta en silencio** las claves y valores que no reconoce (el contexto queda vacío, la pregunta sigue) y **nunca escribe el contexto en registros**; respuesta con `tarjetas` (≤ 3), `opciones` (≤ 6), `sugerencia`, `verTodas`, `emergencia` y `contexto` nuevo. `conversacionId` deja de usarse.
- **`application/converse-assistant.ts`**: flujo sin almacén:
  1. Seguridad: urgencia → respuesta de emergencia sola; clínica/inyección → rechazo amable (F06.1).
  2. Intención + contexto (seguimiento usa el contexto recibido).
  3. Medicamento: palabras útiles → búsqueda pública F03.2 → nombres/principios de las ofertas que aparecen completos en la frase (D-02 A). Si no hay: candidatos por prefijo (4–5 letras) + distancia de edición → `sugerencia` (D-03 A).
  4. Datos: PRECIO → orden por precio; CERCANÍA → orden por cercanía con el distrito/punto (si falta, opciones de distrito); HORARIO → farmacias públicas del distrito + horario público → abiertas ahora en hora de Lima (si falta distrito, opciones, D-09 A); ALTERNATIVA → producto de referencia → ofertas con mismo principio activo, misma concentración y **misma forma conocida**, más baratas; etiqueta «Mismo principio activo y concentración» y aviso «Consulta al químico farmacéutico antes de cambiar de producto».
  5. Aclaración: si hay varias variantes (concentración + presentación) y la frase no las distingue → «¿Cuál buscas?» con hasta 5 opciones y «Ver todas».
  6. Tarjetas: las 3 más relevantes con farmacia, producto, precio, distancia (si hay lugar), horario de hoy y enlace a reservar; `verTodas` = `/search?q=…`.
- **`infrastructure/mock-conversation-provider.ts`**: usa el dominio nuevo; sigue sin red ni SDK.
- **Herramientas públicas** (`busqueda/contracts/public-knowledge.ts` + `F03PublicAssistantGateway`): `search(term, { orden, latitud, longitud })`, `pharmaciesIn(city)` (lista pública F07) y `openingHours(ids)` (lectura pública F07.1, inyectada en la composición). Solo lectura.
- **Composición** (`identity-app.ts`): se retira `InMemoryConversationStore` del flujo; la ruta de descarte responde 204 sin hacer nada (compatibilidad).

### Frontend (`frontend/src/assistant/`)
- **`ChatBubble.jsx` → panel** (D-06 A con ajuste):
  - **≥ 1280 px:** panel lateral derecho de 420 px a alto completo y el contenido principal se corre (`margin-right`) para que **no tape** los resultados.
  - **1024–1279 px:** panel lateral encima del contenido, con «Minimizar» a un clic; el estado minimizado se recuerda durante la visita (`sessionStorage`, solo ese indicador; nunca la conversación).
  - **< 1024 px:** burbuja que abre una hoja inferior; la burbuja se ubica por encima de la zona de botones fijos y se oculta en formularios largos donde taparía el envío.
- **Contenido:** preguntas rápidas (D-10 A), tarjetas (`AssistantCards`), botones de opción y de sugerencia, enlace «Ver todas en Buscar medicamentos», bloque de emergencia destacado (con `tel:` en celular) que nunca se mezcla con tarjetas.
- **Memoria:** `contexto` en estado de React; al cerrar el panel con «Nueva conversación», minimizar no borra; **recargar o cerrar la pestaña borra todo** (D-01 A).
- **Contexto de pantalla:** `search/search-context.js` (módulo en memoria) publica la ruta, el término y el lugar elegido en «Buscar medicamentos»; el panel propone «¿Quieres ver el más barato cerca de ti?» cuando hay término.
- **Accesibilidad:** Tab recorre todo, Enter envía, Escape minimiza, botones con texto, `aria-live` para respuestas.

## Pruebas
- **Backend unitarias:** frases del pedido (incluida «¿En qué farmacia el ibuprofeno está más barato?»), seguimiento con contexto, distritos, forma farmacéutica (formas conocidas y desconocidas), distancia de edición («ibuprofemo», «amoxisilina», límites), alternativa (mismo principio, concentración y forma; forma desconocida excluida; texto sin «equivalente» ni «reemplazar»), emergencia exclusiva con 106/116/105, validación estricta de `contexto`, paridad de la lista de lugares.
- **Regresión F06.1:** todas sus pruebas clínicas, de inyección, de límites y de búsqueda; las que dependían del almacén se adaptan a contexto en el navegador.
- **PostgreSQL real** (`scripts/f06/verify-f062.mjs`, base efímera marcada, borrada al final): las 4 frases sobre datos ficticios con la búsqueda F03.2 real, horario F07.1 real y farmacia inactiva/sin stock fuera.
- **Frontend:** panel por ancho, minimizado recordado, teclado, botones rápidos, tarjetas, opciones, sugerencia, emergencia sin tarjetas, propuesta por pantalla, nada guardado al recargar.
- **Contrato:** `conversation.openapi.yaml` 2.0.0 y `check-openapi-routes.mjs` apuntando a esta spec.
- **Copia temporal 3001/5174** con datos ficticios (varias concentraciones y formas, «Panadol» ficticio, horarios, dos distritos); E2E con Chrome, axe, 0 llamadas externas.

## Riesgos
- Frases muy libres pueden no reconocerse: se responde con preguntas rápidas y la búsqueda convencional.
- Catálogo real con presentaciones «caja x N»: las alternativas quedarán vacías cuando la forma no se conozca (es lo pedido); se dirá «No encontré otros productos con la misma forma farmacéutica publicada».
- Retirar el almacén del servidor cambia un comportamiento de F06.1 (conversación de 15 min): queda registrado como enmienda D-01.
