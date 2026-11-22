# F08 — Modelo de estado de interfaz

F08 no crea entidades persistentes ni migraciones. Todas las entidades de negocio siguen en F01–F07 y PostgreSQL.

| Estado UI | Fuente | Campos visibles mínimos | Regla |
| --- | --- | --- | --- |
| Sesión | F01 `/auth/session` | autenticación, perfil mínimo | Borrar de memoria al expirar, revocar o cerrar sesión. |
| Contexto de farmacia | F01 `/me/memberships` y `/me/active-pharmacy` | farmacia activa, rol/capacidades autorizadas | Cambiarlo exige respuesta exitosa del servidor; no confiar en URL. |
| Resultado público | F03 `/busquedas`, `/farmacias/{id}` | producto, farmacia, precio, disponibilidad referencial, actualización | Nunca sintetizar oferta o inventario desde React. |
| Ubicación puntual | F07 `/geolocalizacion/*` | ciudad o posición consentida, radio, resultados | Posición personal solo temporal en memoria de la interacción; no persistir. |
| Inventario de farmacia | F02 | filas, movimientos, importación/estado | Solo para farmacia activa autorizada; vaciar al perder sesión/contexto. |
| Reserva | F04 | estado, fecha exacta de vencimiento, acciones permitidas por respuesta | No inferir transiciones ni vencimiento nuevo en cliente. |
| Conversación informativa | F06/F06.1 | mensajes temporales, fuentes, estado de servicio | No mezclar fuentes comerciales con recomendaciones clínicas; no almacenamiento sensible innecesario. |
| Estado de pantalla | UI local | idle/loading/empty/success/error/forbidden | Ningún estado success sin confirmación HTTP real. |

**Transiciones UI:** anonymous → loading → authenticated; authenticated → expired/revoked → anonymous; pharmacy selected → permission revoked → private state cleared. Los estados de reserva PENDIENTE, CONFIRMADA, ENTREGADA, CANCELADA y EXPIRADA se muestran, nunca se calculan como dominio en F08.
