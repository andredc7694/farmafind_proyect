# Modelo de datos propuesto — F07

**Estado**: diseño, sin migración ejecutada. Se reutilizan `f01.farmacia_referencia`, `f03.farmacia_publica`, ofertas F03, identidad/membresía/delegación F01 y auditoría existente cuando su contrato lo permita.

| Entidad | Campos propuestos | Protección |
| --- | --- | --- |
| Ubicación de farmacia | `farmacia_id` (PK/FK), dirección publicable, `ciudad` normalizada, latitud, longitud, precisión_m opcional, fuente, estado, propuesta_por, revisada_por, fecha_propuesta, fecha_verificación, `updated_at` | Filas privadas de propuesta bajo RLS tenant; proyección pública solo si farmacia activa y ubicación aprobada. `ciudad` puede ser nula únicamente en filas F03 heredadas hasta corrección autorizada. |
| Revisión de ubicación | identificador, farmacia, versión propuesta, decisión, actor, instante, referencia de evidencia no sensible | Auditoría inmutable para la farmacia; la evidencia sensible no se expone públicamente. |
| Consulta de proximidad | coordenadas efímeras en cuerpo POST, radio, filtros de producto, distancias calculadas | No es tabla; no se persiste ni entra en URL, historial, caché, logs de aplicación/proxy ni analítica. |
| Consulta por ciudad | ciudad explícita en GET, filtros públicos y resultados sin radio geográfico implícito | No recibe coordenadas personales; rechaza latitud/longitud y parámetros desconocidos. |
| Oferta geográfica pública | farmacia, producto, precio y disponibilidad referenciales, fecha de revisión, distancia opcional | Composición de proyecciones aprobadas F03; nunca inventario privado ni cantidad interna. |

## Estados y transiciones

`PENDIENTE → PUBLICADA_VERIFICADA` o `PENDIENTE → RECHAZADA`. Una corrección de ubicación publicada crea una nueva propuesta; la publicación anterior puede conservarse hasta aprobar la nueva versión si sigue siendo válida. Si deja de ser fiable, se retira de mapa/radio. Nadie revisa su propia propuesta. Una revocación de membresía invalida el permiso en la siguiente operación.

## Restricciones

- Latitud −90..90, longitud −180..180; ambas presentes o ambas ausentes según el estado. Precisión positiva cuando se declara. Cada nueva propuesta exige `ciudad` de 2–120 caracteres normalizada; el dato heredado nulo no se rellena por inferencia desde `direccion_texto`.
- `farmacia_id` referencia F01 y no se acepta como prueba de autorización. Propuesta y revisión pertenecen al mismo tenant.
- Solo una versión publicada por farmacia. La revisión exige versión actual para evitar sobrescribir decisiones concurrentes.
- La proyección pública nunca expone fuente/evidencia privada, actor ni historial de ubicación del visitante. Las coordenadas F03 existentes quedan **pendientes** hasta revisión expresa. La búsqueda textual F03 continúa para filas heredadas sin ciudad; la búsqueda F07 por ciudad requiere un valor explícito y no las oculta de F03.
- RLS habilitada y forzada en tablas pertinentes; roles de aplicación sin SUPERUSER/BYPASSRLS. Funciones públicas con dueño acotado, permisos mínimos y pruebas de acceso cruzado.

## Compatibilidad y migración

La migración se diseña aditiva: `ciudad` nullable para compatibilidad, metadatos y tabla de propuestas/revisiones, índices por ciudad/farmacia/estado y restricciones para propuestas nuevas. Antes de ejecutarla en TEST se compara con las migraciones F03 y se prueba que no rellene ciudad ni marque filas heredadas como verificadas. Antes de cualquier ejecución persistente se exige respaldo y autorización específica. La función pública F03 requiere revisión para no exponer coordenadas no verificadas; conservar dirección y oferta referencial evita perder la búsqueda histórica.
