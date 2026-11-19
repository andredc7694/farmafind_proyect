# Plan técnico F08 — Frontend profesional completo

**Rama:** `feat/f08-frontend-profesional` | **Fecha:** 2026-11-18 | **Spec:** [spec.md](spec.md)

**Estado:** especificación y plan aprobados conjuntamente por el responsable del proyecto el 2026-11-18 en esta conversación. Implementación y aceptación F08 pendientes al registrar esta aprobación.

## Resumen y contexto técnico

Unificar el frontend React en navegación y sistema visual reutilizables, conservando los clientes HTTP y flujos F01–F07. Implementar por recorridos y verificar con bases TEST aisladas. El backend, PostgreSQL RLS y los contratos existentes conservan la autoridad sobre datos y permisos.

| Aspecto | Decisión vigente o propuesta |
| --- | --- |
| Plataforma | Windows 10; Node.js 24.17.0 y npm 11.13.0 de referencia; Playwright en Linux compatible. |
| Frontend | React 19.2.7, Vite 7.3.8, JavaScript/JSX, CSS y npm workspaces. Aprobado por Constitution/F00. |
| Backend | Express + TypeScript y OpenAPI F01–F07; F05 expone solo eventos internos. Vigente. |
| Datos | PostgreSQL oficial, RLS y Redis Cache-Aside mediante backend. F08 no crea tablas ni duplica reglas. |
| Navegación | Tabla de rutas y enlaces semánticos sobre rutas actuales, sin librería de router nueva. Propuesta. |
| Diseño | Tokens CSS y componentes React compartidos, sin kit comercial ni Tailwind obligatorio. Propuesta. |
| Pruebas | Vitest/Testing Library y Playwright existentes. Herramienta axe para accesibilidad solo como dependencia de desarrollo propuesta, tras revisar versión, licencia y auditoría. |
| Alcance | Rutas F00–F07; mapas F07 solo TEST/DEMO; F05 sin bandeja pública; Gemini real desactivado. |

## Control constitucional

- I/XVII/XVIII: la aprobación humana conjunta de especificación y plan se registró el 2026-11-18; tareas y código quedan habilitados dentro del alcance aprobado.
- II–VI: preservar siete módulos, FarmaFind AI complementario, React/Vite/JSX, Express/TS y contratos. El diseño es presentación, no un módulo de negocio.
- VII–X: no recalcular inventario, vencimiento, autorización, Outbox ni caché en React. Mutaciones según contratos y contexto F01; RLS real obligatorio.
- XI/XII: sin AWS, proveedor pago ni despliegue. Mapas productivos requieren autorización separada.
- XIX/XX: sin contenido clínico pendiente de revisión, sin Gemini real, datos ficticios y secretos solo backend.

**Puerta previa cumplida:** aprobación humana expresa de [spec.md](spec.md) y este plan el 2026-11-18. **Puerta posterior:** tareas, análisis y código. Aceptación F08 requerirá pruebas y revisión humana propias.

## Estructura propuesta

```text
frontend/src/
  app/                 rutas, navegación y estados de sesión
  design/              tokens CSS y componentes reutilizables
  identity/            flujos F01 existentes
  inventory/           flujos F02 existentes
  search/              flujos F03 existentes
  reservations/        flujos F04 existentes
  assistant/           flujos F06/F06.1 existentes
  geolocation/         flujos F07 existentes
frontend/tests/f08/    componentes, rutas, permisos y E2E
```

Conservar clientes existentes. La navegación se deriva de sesión, membresía y capacidades F01; ocultar enlaces no aplicables no sustituye la comprobación backend. No guardar token, posición personal ni conversación clínica en almacenamiento local.

## Navegación y permisos

| Vista | Público | Autenticado sin farmacia | Membresía/capacidad local |
| --- | --- | --- | --- |
| Inicio, búsqueda, comparación, asistente público | Sí | Sí | Sí |
| Mapa/lista F07 | Solo TEST/DEMO | Solo TEST/DEMO | Solo TEST/DEMO |
| Registro/acceso | Sí | Perfil | Perfil |
| Perfil, reservas propias, selector | No | Sí | Sí |
| Inventario, importaciones, reservas de farmacia | No | No | Solo permiso F01/F02/F04 pertinente |
| Membresías y ubicación administrativa | No | No | Capacidad explícita en farmacia activa; GEO solo TEST |
| Notificaciones | Sin bandeja pública F05 | Estado de reserva F04 | Estados autorizados F04 |

GLO-01/BOOT-01 siguen restringidos a TEST efímero. URL o farmacia_id no conceden permiso.

## Sistema visual y accesibilidad

Propuesta: esmeralda #087F5B, petróleo #123A43, blanco #FFFFFF, superficie #F4F7F6 y texto #18312D. Verificar contraste WCAG antes de fijar combinaciones. Tipografía del sistema; jerarquía 14/16/20/28/36 px; espacios 4/8/12/16/24/32/48 px; radios 8/12 px. Componentes: AppShell, Header, Nav, PageHeader, Card, Button, Field, Select, StatusNotice, EmptyState, LoadingState, DataTable, Pagination, ConfirmDialog, Badge, Tabs y SourceCitation. Etiquetas y errores asociados, foco visible, anuncios de estado, semántica y teclado. Probar 360/768/1280 px y zoom 200 %. Evitar animación no esencial.

## Integraciones

Reutilizar /api/v1/auth, /me/memberships, /catalogo/medicamentos, /farmacias/{id}/inventario, /busquedas, /reservas, /asistente/* y /geolocalizacion/* según [matriz de rutas](contracts/ui-routes.md). Antes de adaptar cada vista, contrastar parámetros, errores y permisos con los OpenAPI F01–F07. No crear un cliente duplicado ni simular respuestas productivas. El endpoint F05 /internal/v1/events nunca se llama desde React.

## Fases de ejecución aprobadas

1. Tokens, componentes, navegación, Inicio y estados comunes; conservar vistas previas funcionales.
2. Público: F03 y F07 TEST, con vacíos, filtros, consentimiento y lista sin mapa.
3. Identidad y farmacia: F01 y F02, verificando capacidades y contexto Alfa/Beta.
4. Reservas y asistente: F04, estados F05 permitidos, F06/F06.1 deterministas.
5. E2E: responsive, teclado, accesibilidad, HTTP, RLS, regresión, contratos, auditoría y revisión humana.

Cada fase exige pruebas afectadas. Si falta contrato público o privilegio autorizado, dejar esa operación bloqueada y continuar con recorridos independientes.

## Riesgos

- F05 carece de contrato público de bandeja: solo estados de reservas autorizadas. Una bandeja necesitaría nuevo alcance backend.
- F07 sigue TEST/DEMO: teselas productivas y provisión GEO persistente requieren decisión separada.
- F06.1: contenido farmacológico pendiente de fuentes y revisión profesional no se presenta como validado; Gemini apagado.
- Automatización de accesibilidad no sustituye revisión humana de teclado, zoom y lectura.
- Fixtures efímeros para escrituras; base persistente intacta. No equiparar éxito de mocks con contrato real.
- Los 16 criterios docentes conservan su trazabilidad, sin inventar resultados o puntajes F08.

**Control posterior al diseño:** no se propone excepción normativa. La aprobación conjunta de spec/plan está registrada; la aceptación final F08 sigue pendiente.
