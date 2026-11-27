# Aceptación F07.1 — Mi farmacia

**Decisión de Andre (2026-11-26): ACEPTO.**

> «ACEPTO F07.1 (Mi farmacia, revisión de ubicaciones, horario, Mi perfil, ayuda de dirección y mapa, e historial de revisiones). Lo probé en mi DEMO (5173) con HUAMANFAR y con el revisor.»

- **Alcance aceptado:**
  - «Mi farmacia»: contacto, dirección y ubicación con mapa, estado e historial.
  - Revisión de ubicaciones por la plataforma, con historial y filtro.
  - Horario de atención.
  - «Mi perfil».
  - Ayuda de dirección con Nominatim, solo en TEST/DEMO.
  - `GEO_LOCATION_PROPOSE` para el dueño (f025/017).
- **Probado por Andre:** en la DEMO local (http://localhost:5173), con el dueño de HUAMANFAR y con el revisor de la DEMO, después del reinicio de T018.
- **Evidencia técnica:** `evidence.md` (T012–T018), `convergence.md` y `traceability.md`.
- **Fuera de este incremento (pendientes registrados en ESTADO, sin empezar):**
  - Márgenes de «Revisar solicitudes» y «Mi perfil».
  - Ayuda de dirección y mapa en el registro de farmacia (después de T063).
  - La corrida de pruebas del frontend por investigar.
- F02.5 sigue sin aceptar (T057 y T063 sin marcar) y la spec 020 sigue en opción A.
