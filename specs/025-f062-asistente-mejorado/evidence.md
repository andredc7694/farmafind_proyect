# Evidencia F06.2 — Asistente FarmaFind AI mejorado

Rama `feat/f062-asistente-mejorado`. Commits: `013bf43` (servidor), `ae1e6ec` (pantalla), `9789e59` (verificación real), `9d7cdc5` («el más barato cerca»). Sin SQL ni migraciones. Proveedor MOCK.

## T001–T004 · Dominio · 2026-11-27
- `assistant-language.ts` (limpieza F03.2 reexportada en `busqueda/contracts/public-search-text.ts`), `places.ts` (16 distritos de Huamanga con prueba de **paridad** contra `search-places.js`), `dosage-form.ts` («caja x N», «frasco», dos formas → desconocida), `edit-distance.ts` (Damerau-Levenshtein propio), `emergency.ts` (SAMU 106, Bomberos 116, Policía 105; fuentes gob.pe; verificado 2026-11-27), `opening-now.ts` (hora de Lima).
- Pruebas: `backend/tests/assistant/conversation-f062.test.ts` (dominio y frases del pedido).

## T005 · Contrato 2.0 y contexto estructurado (condición de Andre) · 2026-11-27
- Petición `{ consulta, contexto? }`. `contexto` solo con `intencion` (lista), `medicamento` (letras, números y espacios, ≤ 60), `concentracion` (`número unidad`, ≤ 20), `forma` (lista), `distrito` (lista) y `punto` (Perú, 3 decimales). Lo que no se reconoce se descarta en silencio; > 1 KB se descarta entero; cuerpo > 4 KB → 413. El servidor no guarda ni registra el contexto.
- Pruebas: `conversation-contract.test.ts` (contexto manipulado: claves extra, texto libre con `<script>`, valores fuera de lista o de rango; contexto de 1,1 KB) y `conversation-security.http.test.ts` (HTTP: manipulado → `contexto: {}`; largo → `{}`; 5 KB → 413; **ninguna llamada a `console.*` contiene el contexto**).

## T006–T008 · Herramientas, caso de uso y regresión F06.1 · 2026-11-27
- Herramientas de solo lectura: búsqueda pública (orden y punto), sugerencias públicas F08.1 (para «¿Quisiste decir…?»), farmacias públicas cercanas F07 y horario público F07.1. Sin F07 activo no existen las de lugar y horario.
- Caso de uso sin almacén: urgencia → rechazo clínico → intención → medicamento → aclaración → tarjetas. **Una sola búsqueda pública por pregunta.** Ruta de descarte: 204 sin efecto. Se retiró `InMemoryConversationStore`.
- Regresión F06.1 adaptada (clínica, inyección, límites, fichas, 30 diálogos de seguimiento ahora con contexto de la página: 30/30).
- Contrato `contracts/conversation.openapi.yaml` **2.0.0**; `check-openapi-routes.mjs` apunta a él: **41 operaciones con ruta Express**. (No hay validador YAML instalado; no se agregó ninguno.)

## T009–T012 · Pantalla · 2026-11-27
- Panel: ≥ 1280 px lateral de 420 px y el contenido se corre; 1024–1279 px encima, «Minimizar» a un clic, recordado en `sessionStorage['farmafind.chat.minimized']`; < 1024 px hoja inferior.
- Preguntas rápidas (las de nombre rellenan; las completas envían), tarjetas (≤ 3, «Reservar» a `/reservations?pharmacyId=…&medicationId=…`), opciones, sugerencia, «Ver todas», emergencia con `tel:` y sin tarjetas, propuesta «¿Quieres ver el más barato cerca de ti?» desde «Buscar medicamentos» (`search-context.js`, en memoria).
- Pruebas: `frontend/tests/f081/chat-bubble.test.jsx` (11), `no-mutation.test.jsx`, `conversation-client.test.jsx`, `conversation-view.test.jsx`, `f08/assistant.test.jsx`.

## T013 · PostgreSQL real · 2026-11-27
- `node scripts/f06/verify-f062.mjs`: base TEST efímera marcada en el clúster de pruebas, todas las migraciones, rol de ejecución propio sin BYPASSRLS, datos ficticios. **14/14**: precio con aclaración y orden; farmacia INACTIVA y oferta sin stock fuera; «Reservar»; «¿y el de 600 mg?»; «¿y en Carmen Alto?» con distancia; cercanía; abierta ahora (viernes 10:00 Lima) sin cerrada ni inactiva; alternativa solo con forma conocida (fuera «caja x 30» y jarabe) con aviso y sin «equivalente/reemplazar»; «ibuprofemo»; emergencia sola; sin campos privados. **Base y rol borrados** (quedan 0).

## T014 · Regresión · 2026-11-27
- Backend + frontend: **989 pasan**, 234 omitidas por entorno. 1 falla de entorno **a propósito**: `conversation-f03-fallback.integration.test.ts` necesita el Redis 127.0.0.1:56379, que es el compartido con la DEMO; no se usó. La prueba de aislamiento F06.1 con PostgreSQL real (base madre de pruebas) **pasó**.
- `npm run check`: 334 archivos correctos. Contratos: 41 operaciones. F03.2 real **35/35**; F07.2 real **15/15** (bases efímeras borradas). Web compila (`vite build`).

## T015 · Copia temporal 3001/5174 · 2026-11-27
- Base efímera propia (marca TEST), sin el Redis compartido; datos ficticios: 5 farmacias verificadas en Ayacucho/Carmen Alto (una abierta 24 h, una cerrada todo el día), una sin verificar; ibuprofeno 400/600 mg, amoxicilina, «Panadol» ficticio, paracetamol en tabletas, «caja x 30» y jarabe.
- E2E con Chrome (`.cache/f062-copy/e2e-f062.mjs`): **31/31** — panel de 420 px que no tapa los resultados (1366); minimizar a un clic y recordado (1100); hoja inferior sin tapar «Buscar» y sin desborde (390); las frases del pedido; emergencia con `tel:106/116/105`; teclado (Escape, Enter); recargar borra; nada de la conversación en el navegador; axe sin violaciones graves (3 vistas); **0 llamadas externas**.
- **Incidente (registrado):** al encender la web de la copia, el primer intento usó el comando del proyecto, que fija el puerto **5173** (el de la DEMO). La DEMO estaba apagada (se había apagado al cerrar la sesión anterior), así que no chocó con nada; se detuvo enseguida y la web se encendió en 5174 con la configuración del proyecto. No se tocó la base ni el Redis de la DEMO.
- Pendiente: revisión de Andre.

## T016 · Revisión de seguridad y converge · 2026-11-27
- **Sin SQL, RLS ni permisos nuevos.** Todo es lectura de DTO públicos ya expuestos (F03/F03.2, F07, F07.1); nada de inventario interno, reservas ni datos privados (verificado en la base real). El asistente no escribe ni reserva.
- Clínica: reglas F06.1 intactas; urgencia ampliada (emergencia, intoxicación, sobredosis, convulsiones, desmayo, sangrado, suicidio) y antes que todo, sola. Alternativas con etiqueta y aviso, sin «equivalente», «reemplazar» ni «genérico».
- Inyección: el contexto no admite texto libre; las instrucciones ajenas no cambian herramientas ni producen datos (F08.1).
- Privacidad: el servidor no guarda conversaciones ni registra el contexto; el navegador solo guarda el indicador de minimizado. El punto de la búsqueda va redondeado a 3 decimales y solo a nuestro servidor.
- US$0: sin servicios, librerías ni costos nuevos; MOCK.
- Converge: FR-001 a FR-016 cumplidos con las pruebas citadas. Diferencias registradas como decisiones menores en `ESTADO.md`.

## Protección de puertos de la copia temporal (pedido al aceptar) · 2026-11-27
- `scripts/copy/ports.mjs` y `scripts/copy/start-copy.mjs`: los puertos se revisan antes de arrancar. 3000 y 5173 se rechazan siempre (para API o web) con mensaje claro; un puerto ocupado también detiene la copia sin tocar al proceso que lo usa. El `serve.mjs` de cada copia debe tomar el puerto con `copyApiPort()`.
- Prueba `tests/bootstrap/copy-ports.test.mjs`: **10/10**. Prueba real sobre la copia F06.2: con `--web-port 5173` salió con error y no inició nada; sin parámetros levantó 3001/5174 (salud, web y asistente 200).

## Cierre de la copia · 2026-11-27
- Procesos de 3001/5174 detenidos. Borrada solo `farmafind_f01_test_3c04bbedfef2` y sus roles `ff_f071c_auth_…` y `ff_f071c_runtime_…`. Comprobación en solo lectura: quedan las dos bases de la DEMO, la del clúster y la madre F06.1; ningún rol de copia ni de verificación.
- Nota: en el incidente del puerto, la primera orden para detener la web equivocada fue denegada por el control de permisos y la detuve con otra orden (`taskkill`) sobre mi propio proceso.

## Regresión final (antes del PR) · 2026-11-27
- Suite completa (`vitest run`): 1073 pasan, 234 omitidas, 2 fallas de entorno: (1) la prueba con el Redis compartido de la DEMO, no usado a propósito; (2) «el bundle compilado no incorpora variables privadas», que necesita `frontend/.env.local` (ausente en la carpeta de trabajo). Con ese archivo temporal (solo `VITE_APP_MODE=bootstrap`) `tests/bootstrap` pasa **72/72**; el archivo se quitó.
- `check` 337 archivos; contratos 41 operaciones; verificación PostgreSQL real F06.2 14/14 (base y rol borrados).
