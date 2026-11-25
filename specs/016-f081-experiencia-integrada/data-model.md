# Data model — F08.1

**Sin migraciones ni tablas nuevas.** Todo es presentación o lectura sobre datos existentes.

| Dato | Origen | Uso |
|---|---|---|
| `f01.perfil_usuario.tema` | F01.1 (`CLARO`/`OSCURO`/`SISTEMA`) | Preferencia de tema con sesión |
| `f04.reserva` (estado, vencimientos) | F04 | `GET …/reservas/resumen`: pendientes, confirmadas por vencer (≤ 60 min), confirmadas |
| `f02.inventario` (físico/comprometido) | F02 | `GET …/inventario/resumen`: productos sin stock disponible |
| `f03.search_public_offers` | F03 | Sugerencias públicas y comparables |
| `localStorage['ff-theme']`, `['ff-filters']` | Navegador | Solo tema y filtros, sin datos personales |

## Proyecciones de solo lectura (sin persistir)
- **ResumenReservas**: `{ generatedAt, pending, confirmed, expiringSoon }` (enteros de la farmacia autorizada).
- **ResumenInventario**: `{ generatedAt, products, withoutStock }`.
- **Sugerencia**: `{ text, kind: 'NOMBRE' | 'PRESENTACION' }`, máximo 8, sin ids ni precios.
