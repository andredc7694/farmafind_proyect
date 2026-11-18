# F07 — Guía de validación TEST/DEMO

**Estado**: F07 aceptada humanamente solo para TEST/DEMO el 2026-11-18; comprobaciones registradas en [implementation-evidence.md](implementation-evidence.md) y decisión en [acceptance.md](acceptance.md). La aprobación no autoriza migraciones sobre `farmafind_f01_test` ni uso productivo.

## Prerrequisitos

1. Spec y plan F07 aprobados expresamente, con tareas generadas y revisadas antes de implementar.
2. Rama `feat/f07-geolocalizacion` y línea base F00–F06/F06.1 disponibles. Node.js 24.17.0 y npm 11.13.0 como referencias del proyecto.
3. Base PostgreSQL **TEST efímera y aislada**, migraciones F01–F07 revisadas, roles sin BYPASSRLS; Redis local opcional para comprobar fallback. Nunca usar la base persistente sin respaldo y aprobación propia.
4. Cinco farmacias ficticias con coordenadas/distancias esperadas y ofertas públicas referenciales; dos personas ficticias de una farmacia con capacidades diferentes y una tercera de otra farmacia.
5. Política vigente de teselas, atribución y privacidad revisadas antes de permitir carga del mapa; navegador de prueba oficialmente compatible. Sin claves ni proveedores pagados.

## Escenarios de aceptación

| Paso | Comprobación prevista | Resultado esperado |
| --- | --- | --- |
| 1 | Ejecutar controles de configuración, compilación y TypeScript existentes tras implementar F07. | Sin errores; sin secretos en salida. |
| 2 | Consultar `GET /api/v1/geolocalizacion/farmacias?ciudad=lima` por ciudad y `POST /api/v1/geolocalizacion/consultas` con coordenadas/radio en el cuerpo. | Solo farmacias activas, distancia lineal coherente, orden estable; cero resultados produce lista vacía. |
| 3 | Filtrar un producto publicado y comparar con F03. | Misma fuente verificable, precio/disponibilidad referenciales y fecha; no inventario privado. |
| 4 | Probar permiso del dispositivo concedido, denegado y revocado; introducir ciudad/manual. | Nunca se obtiene posición antes del consentimiento; la lista sigue utilizable; no se guarda historial personal. |
| 5 | Abrir mapa por acción informada, luego simular fallo de teselas. | Atribución y política respetadas; lista y dirección permanecen; sin precarga ni coordenada privada en el enlace de indicaciones. |
| 6 | Proponer ubicación A y revisarla con usuario independiente autorizado de A. | Publicación solo tras aprobación; fuente/fecha/auditoría presentes; caché pública invalidada. |
| 7 | Intentar autoaprobación, acceso de B a A, rol sin capacidad, sesión revocada y coordenadas inválidas. | Todos rechazados sin mutación ni filtración; RLS real y reutilización de conexiones comprobadas. |
| 8 | Ejecutar regresión F01/F02/F03/F06 y pruebas de Redis con caída simulada. | Búsqueda textual y fallback PostgreSQL siguen correctos. |
| 9 | Ejecutar navegación teclado/lector de pantalla en móvil/escritorio y medir consulta con 200 candidatas. | Se registran resultados reales contra F07-SC-007/008; ninguna aceptación se presume. |

## Comandos locales reproducibles

En terminales separadas, después de verificar el fixture TEST aislado y sin iniciar una base persistente como destino F07:

```powershell
docker compose -f compose.f01-postgres.yaml up -d postgres
docker compose -f compose.f03-search.yaml up -d redis
npm run build --workspace @farmafind/backend
node scripts/f07/prepare.mjs verify
node scripts/f07/serve.mjs
```

```powershell
npm run dev:web
```

Abrir `http://127.0.0.1:5173/mapa`. La vista `/ubicacion` exige una sesión y capacidades F01 explícitas; las identidades del fixture no tienen contraseñas públicas. El flujo privado real se valida sin mostrar secretos mediante `node scripts/f07/http-private-smoke.mjs` en la base TEST. Para pruebas: `node scripts/f07/check.mjs unit|api|rls|cache|ui|migration`, `node scripts/f07/check-contract.mjs` y `node scripts/f07/load.mjs`. Playwright se ejecuta solo en el contenedor Linux oficialmente compatible descrito en la evidencia; no se declara soporte oficial en Windows 10. Detener los procesos iniciados con Ctrl+C y los contenedores únicamente con `docker compose -f compose.f03-search.yaml stop redis` y `docker compose -f compose.f01-postgres.yaml stop postgres`, sin `down -v`.
