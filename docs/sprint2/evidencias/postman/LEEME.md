# Postman / newman — evidencia real (2026-11-27)

- Colección: `tests/postman/farmafind-sprint2.postman_collection.json` (Postman v2.1; se puede importar en Postman). Fuente legible: `scripts/postman/build-collection.mjs`.
- Entorno: `tests/postman/copia-local.postman_environment.json` (sin credenciales; el lanzador las pasa en memoria).
- Ejecución: `npm run test:postman -- .cache/<copia>/state.local.json` contra la copia temporal `127.0.0.1:3001` (base TEST efímera con datos ficticios, Redis propio de la copia y límites reales 60/120 por minuto). Rechaza los puertos de la DEMO.
- Resultado final: **85 peticiones, 48 aserciones, 0 fallos**; tiempo medio 17 ms (máx. 421 ms, el login con Argon2). El 429 con `Retry-After` llegó en el intento 58 de la ráfaga (las búsquedas anteriores de la colección ya habían consumido parte de las 60 por minuto).
- Primera corrida: 47/48. La aserción «parámetro no permitido → 400» era una suposición errónea de la prueba: el contrato no prohíbe parámetros extra en la consulta y la API los ignora. Se cambió por «parámetro desconocido se ignora sin exponer stock» (200 y sin datos privados) y se repitió tras esperar la ventana de 60 s.
- Archivos: `newman-resumen.txt` (salida de newman) y `newman-junit.xml` (JUnit), ambos sin credenciales.

Qué cubre: salud; búsqueda, sugerencias, farmacias por ciudad y cercanas (ubicación solo en el cuerpo); asistente; validación 400; 401 sin sesión; CSRF (403); login fallido con mensaje genérico; login, membresías y farmacia activa; aislamiento entre farmacias (inventario y reservas de otra farmacia → 404/403); cierre de sesión; límite de abuso 429.
