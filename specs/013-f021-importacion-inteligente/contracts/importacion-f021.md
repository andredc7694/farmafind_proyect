# Contrato propuesto de importación F02.1

**Estado:** plan aprobado el 2026-11-22. La ruta `analizar`, la selección opcional de vista previa, los perfiles y las incidencias están implementados localmente y verificados en pruebas focales; la aceptación de navegador y humana permanece pendiente. Es una extensión compatible de [OpenAPI F02](../../003-f02-catalogo-inventario/contracts/inventory.openapi.yaml).

Todas las rutas están bajo el prefijo API existente, requieren cookie de sesión F01, farmacia activa/membresía/capacidad y `Cache-Control: no-store`. POST/PATCH requieren CSRF. Identificadores ajenos no revelan existencia de recursos.

| Operación propuesta | Solicitud | Respuesta esperada | Permiso |
|---|---|---|---|
| `POST /farmacias/{pharmacyId}/importaciones/analizar` | multipart: `archivo` CSV/XLSX, sin mapeo obligatorio | `huella`, hojas, filas candidatas de encabezado, columnas, mapeo sugerido, ambigüedades; sin persistir stock | `inventory.import.preview` |
| `POST /farmacias/{pharmacyId}/importaciones/vista-previa` existente, extendido | `archivo` y `mapeo` actuales; opcional `seleccion` con hoja/fila/huella | campos F02 existentes y `incidencias[]` opcional por fila/campo, estado y caducidad | `inventory.import.preview` |
| `GET /farmacias/{pharmacyId}/importaciones/perfiles` | sin body | perfiles propios con nombre, compatibilidad, versión | `inventory.import.preview` |
| `POST /farmacias/{pharmacyId}/importaciones/perfiles` | nombre e `importacionId` de una vista previa propia, válida y no vencida; el servidor obtiene mapeo, huella de encabezados y hoja/fila de esa vista previa | identificador/versión del perfil propio | `inventory.import.confirm`; acción distinta de confirmar stock |
| `GET /farmacias/{pharmacyId}/importaciones/{importacionId}` existente, extendido | id | estado F02 e `incidencias[]` opcional | `inventory.history` |
| `POST /farmacias/{pharmacyId}/importaciones/{importacionId}/confirmar` existente | id | respuesta F02 sin cambio obligatorio; archivo entero o rechazo | `inventory.import.confirm` |

Ejemplo conceptual de incidencia: `{ fila: 7, columna: "E", campo: "precioReferencial", codigo: "PRECIO_REQUERIDO", titulo: "Falta el precio", motivo: "La celda está vacía", accion: "Completa un precio válido y vuelve a validar", codigoSoporte: "F021-PRECIO_REQUERIDO" }`. La columna puede referirse al encabezado y letra para XLSX; no se devuelve el valor bruto. Precio y cantidad vacíos originan **dos** incidencias.

Errores HTTP: 400 archivo/mapeo inválido con incidencias seguras; 401 sesión ausente; 403 CSRF/capacidad cuando no filtre existencia; 404 recurso/farmacia no visible; 409 conflicto/revisión concurrente; 413 límite. Se conservan los códigos F02 públicos. Respuestas ajenas no incluyen perfil, fila ni nombre de farmacia. El plan no autoriza cambiar los contratos históricos de reservas.

La implementación deberá reflejar esta extensión en OpenAPI antes de código, o registrar una revisión humana si alguna ruta/campo resulta incompatible. No hay endpoint público de perfiles ni mapeos.
