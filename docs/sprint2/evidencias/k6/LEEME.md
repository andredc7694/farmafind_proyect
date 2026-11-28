# Evidencia k6 (Sprint 2, AC01 / K6-02)

Corridas contra la **copia temporal** (API 3001, base TEST efímera, Redis aparte). Nunca contra la DEMO.

| Archivos | Corrida |
|---|---|
| `rampa-con-redis-*` | Rampa 50, 250, 500, 1000 y 2000 usuarios virtuales, con Redis (límite de carga solo en la copia) |
| `rampa-sin-redis-*` | La misma rampa con Redis desconectado (la búsqueda va a PostgreSQL) |
| `limite-real-*` | 20 usuarios sin pausa durante 20 s con el límite real (60 por minuto e IP) |
| `limite-real-corrida1-*` | Primera ráfaga: 5 de 9798 peticiones no abrieron conexión (`dial: i/o timeout`); por eso se repitió |

- `*-resultado.json`: resumen por etapa (cada etapa mide solo los 45 s con todos los usuarios activos).
- `*-k6.json`: resumen completo de k6. `*-recursos.json`: CPU y memoria cada 10 s. `*-salida.txt`: mensajes de k6.
- Código de salida 99 de k6 en las rampas: se incumplió la meta p95 < 2 s en las etapas altas (no hubo errores HTTP).

Repetir: `node scripts/load/sprint2.mjs <carpeta de la copia> <etiqueta> ramp|limit`.
