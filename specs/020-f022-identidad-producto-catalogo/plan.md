# Plan: F02.2 — Identidad del producto y propuestas de catálogo

**Spec**: [spec.md](spec.md) (aprobada 2026-11-25, D-01..D-05 = A). **Estado**: espera aprobación de Andre.
**Condición de inicio**: la corrección de importación (enmienda F02.1) integrada en `main`. US$0, sin IA ni servicios externos.

## Arquitectura (sin cambios de estilo)
Clean Architecture + Unit of Work + RLS como en F02. Módulos: `medicamentos` (identidad y propuestas), `inventario` (conciliación), `busqueda`/`reservas` (solo muestran), `usuarios` (capacidad delegable).

## 1. Datos (ver [data-model.md](data-model.md))
Migraciones **nuevas**, sin editar las existentes:
| Migración | Qué hace |
|---|---|
| `f02/007_product_identity.sql` | Columnas `laboratorio`, `marca`, `forma_farmaceutica` (`NOT NULL DEFAULT ''`, minúsculas y espacios simples). Crea el índice único nuevo **y después** retira `medicamento_referencia_unica`, en la misma transacción. No borra ni reescribe filas. |
| `f02/008_catalog_proposals.sql` | Tablas de propuestas, auditoría y capacidad de revisor, con RLS + `FORCE RLS`; funciones `can_propose_catalog`, `can_review_catalog` y `decide_catalog_proposals`. |
| `f01/017_catalog_capability.sql` | `CREATE OR REPLACE` de las dos funciones de personal para admitir `catalog.propose`; la otorga a los propietarios activos que ya importan. |
| `f025/016_owner_catalog_test.sql` | La activación de una farmacia otorga `catalog.propose` al propietario. Es un archivo nuevo: **su hash se registra para tu revisión** en el migrador; no se toca ningún hash anterior. |
| `f03/003_public_search_identity.sql` | Función nueva `search_public_offers_v2` con laboratorio, marca y forma (la anterior se conserva). |

La única operación no aditiva es retirar esa restricción de unicidad (necesaria para D-01 y la identidad por laboratorio).

## 2. Identidad, duplicados e importación
- `catalogKey` pasa a incluir forma, laboratorio y marca. Marca vacía = genérico; «—» o «-» se tratan como vacío.
- El detector de F02.1 añade columnas opcionales `codigo`, `laboratorio`, `marca` (`nombre_comercial`) y `forma_farmaceutica`, por nombre y contenido; el empate se pregunta.
- Duplicado real: identidad repetida **o** código repetido. Mismo código con datos distintos también bloquea (D-02). Se usa el código de incidencia existente `FILA_DUPLICADA` con causa específica: no cambia ninguna restricción de importación.
- Productos existentes sin laboratorio solo coinciden con filas sin laboratorio (D-03).

## 3. Propuestas y revisión
- **Farmacia**: «Proponer los pendientes» crea un lote (máx. 1000 por vez) desde la vista previa vigente; no duplica propuestas abiertas idénticas. Pantalla de estado de sus propuestas.
- **Revisor** (`CATALOG_REVIEW` + segundo factor verificado, rol de plataforma activo; nunca sobre farmacias donde es miembro): pantalla `/admin/catalogo/propuestas` con lotes, conteos y filtros.
  - Acciones individuales y **en lote**: aprobar, rechazar (motivo), vincular a existente.
  - **Revisión de muestra obligatoria para el lote**: el servidor elige al azar `máx(10, 5 %)` filas, tope 30 (o todas si hay menos de 10); el revisor debe verlas y marcarlas antes de habilitar la acción, y el servidor lo exige. Si marca alguna como incorrecta, el lote no se puede aprobar.
  - Las filas con aviso (posible duplicado del catálogo, sin laboratorio, datos sospechosos) quedan **fuera** de la aprobación en lote y se revisan una a una.
  - Vincular en lote solo para filas con un producto existente sugerido.
  - Resultado resumido y agrupado (nunca cientos de avisos).
- **Escritura del catálogo**: solo por `f02.decide_catalog_proposals` (SECURITY DEFINER, propietario `NOLOGIN NOSUPERUSER NOBYPASSRLS` con políticas propias), transaccional, idempotente y auditada. El rol de la aplicación no recibe INSERT sobre el catálogo.
- La capacidad de revisor se otorga solo con un procedimiento offline TEST, como las de F02.5.

## 4. Lectura (sin cambiar comportamiento)
Búsqueda pública, comparables, sugerencias, reservas, historial/CSV e inventario muestran laboratorio y marca. La clave de caché Redis sube de versión.

## 5. Verificación
1. Migración sobre una base con datos previos: mismos productos, inventarios, reservas e importaciones antes y después (conteos y claves).
2. Unitarias: identidad, duplicados por identidad y código, detector, muestra del lote.
3. RLS Alfa/Beta con conexión reutilizada: propuestas, vista previa, revisor (sin inventario), revisor miembro de la farmacia denegado, sin segundo factor denegado, revocación inmediata, escritura directa del catálogo denegada, concurrencia al aprobar.
4. Regresión F02, F03 (con y sin Redis), F04, F08.1, F01.1/F01.2 y F02.1; contratos; E2E proponer → aprobar → reimportar → confirmar.
5. Revisión de seguridad de las migraciones antes del cierre.

## Riesgos
- Cambia la identidad que usan búsqueda, reservas e importación: regresión amplia.
- Capacidades nuevas = cambio de autorización: matriz obligatoria.
- `f025/016` depende de que F02.5 siga siendo TEST; si prefieres no tocar F02.5, la alternativa es otorgar la capacidad solo desde `f01/017` a los propietarios existentes y por delegación manual a los nuevos.
