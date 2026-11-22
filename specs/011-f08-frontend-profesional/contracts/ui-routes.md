# F08 — Contrato de rutas de interfaz y API existente

Propuesta de navegación; cada cliente F01–F07 conserva sus contratos OpenAPI. El prefijo backend `/api/v1` aplica donde corresponda; los OpenAPI de algunos módulos ya lo incluyen.

| Ruta UI prevista | Contrato de origen | Acceso y límite |
| --- | --- | --- |
| `/` | Sin datos obligatorios; enlaces a F03/F07/F06 | Pública; no inventar cifras ni ofertas. |
| `/search` | F03 `/busquedas`, `/farmacias/{pharmacyId}` | Pública; precio/disponibilidad referencial. |
| `/mapa` | F07 `/geolocalizacion/farmacias`, `/geolocalizacion/consultas` | Solo TEST/DEMO; geolocalización consentida; mapa opcional. |
| `/assistant`, `/assistant/conversation` | F06 `/asistente/consultar`; F06.1 `/asistente/conversaciones` | Público informativo; mock y rechazo clínico. |
| `/identity` | F01 `/auth/*`, `/me/memberships`, `/me/active-pharmacy` | Registro/acceso público; perfil/selector con sesión. |
| `/inventory` | F02 `/catalogo/medicamentos`, `/farmacias/{pharmacyId}/inventario`, `/importaciones/*` | Membresía/capacidad verificada; TEST para escrituras. |
| `/reservations` | F04 `/reservas`, `/farmacias/{pharmacyId}/reservas/*` | Propias con sesión; farmacia con permiso correspondiente. |
| `/ubicacion` | F07 `/farmacias/{farmaciaId}/ubicacion/propuestas/*` | Capacidad explícita, misma farmacia; solo TEST/DEMO. |
| Notificaciones | F05 `/internal/v1/events` | **No existe ruta pública**: prohibido llamar desde React. Mostrar solo estados F04 autorizados. |

La tabla no crea endpoints. Cualquier ruta nueva de presentación debe apuntar a estos contratos y comprobar 401/403, errores de red y vacíos. Las rutas `/platform/role-assignments` de F01 no se exponen en F08 fuera del TEST efímero autorizado.
