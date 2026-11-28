# Data Model — F07.2

**Sin cambios en la base de datos** (D-01 A): sin tablas, columnas, restricciones, políticas RLS ni permisos nuevos.

## Regla derivada
- **Reemplazada** = `estado = 'PENDIENTE'` y existe otra propuesta de la misma farmacia con `(propuesta_at, id)` mayor, en cualquier estado.
- **Pendiente visible** = `estado = 'PENDIENTE'` y no existe ninguna más nueva.

## Objetos de la aplicación
- Historial del revisor: `decision` ∈ `PENDIENTE | APROBADA | RECHAZADA | REEMPLAZADA`; filtro `estado` ∈ `PENDIENTE | APROBADA | RECHAZADA | REEMPLAZADA`.
- Historial del dueño: `accion` ∈ `PROPUESTA | APROBACION | RECHAZO | REEMPLAZADA` (ya existía; cambia el cálculo).
- Búsqueda de direcciones: `{ direccion, ciudad, centro?: { latitud, longitud } }`.
- Aviso de distancia (solo pantalla): `{ tipo: 'lejos', km, ciudad } | { tipo: 'desconocida', ciudad } | null`.
