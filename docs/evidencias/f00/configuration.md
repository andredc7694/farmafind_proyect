# Configuración técnica F00

Los archivos `.env.example` contienen exclusivamente valores ficticios. Cada proceso lee su `.env.local` propio, ignorado por Git. Ningún valor se copia a los reportes publicables. Windows 10, Node 24.17.0 y npm 11.13.0 son las referencias del desarrollo local.

| Componente | Nombre | Obligatoria | Visibilidad | Ejemplo ficticio | Validación |
|---|---|---|---|---|---|
| Frontend | VITE_APP_MODE | Sí | Pública | bootstrap | Único valor admitido; otro prefijo VITE_ se rechaza. |
| API | APP_MODE | Sí | Privada local | bootstrap | Se rechaza cualquier otro modo. |
| API | HOST | Sí | Privada local | 127.0.0.1 | Solo loopback. |
| API | PORT | Sí | Privada local | 3000 | Entero 1–65535, distinto de los demás. |
| Notificaciones | APP_MODE | Sí | Privada local | bootstrap | Se rechaza cualquier otro modo. |
| Notificaciones | HOST | Sí | Privada local | 127.0.0.1 | Solo loopback. |
| Notificaciones | PORT | Sí | Privada local | 3001 | Entero 1–65535, distinto de los demás. |
| Lanzador frontend | HOST/DEV_PORT/PREVIEW_PORT | Sí | Local, fuera del bundle | 127.0.0.1 / 5173 / 4173 | Puertos estrictos. |

Variables futuras deshabilitadas: `DATABASE_URL`, `REDIS_URL`, `AI_PROVIDER`, `AI_API_KEY` y configuración AWS. No se leen ni habilitan servicios en F00. Nunca usar valores reales en ejemplos, fixtures o evidencias. La presencia de estas variables en un entorno heredado no sustituye el perfil técnico explícito ni activa integraciones.
