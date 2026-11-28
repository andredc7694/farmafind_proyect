# Plan: F02.2 — Identidad del producto, forma farmacéutica y propuestas de catálogo

**Spec**: [spec.md](spec.md), aprobada por Andre el 2026-11-27 (D-01..D-12 = A), con condiciones sobre D-08, la prueba de la restricción, la revisión por lotes y D-09 (ver [approval.md](approval.md)).
**Estado**: **pendiente de aprobación de Andre** (plan, tareas y SQL). Sustituye el plan del 2026-11-25. Nada se programa ni se aplica antes.
**Rama**: `feat/f022-identidad-producto-catalogo` (con `main` `b0557d5`). US$0, sin IA ni servicios externos.

## Decisión de plan (para aprobar)
- **P-01 · Quién puede proponer productos**
  - **A) (recomendada)** Quien ya puede **confirmar importaciones** en su farmacia (`inventory.import.confirm`): el propietario y los trabajadores a los que se la delegó. No hay capacidad nueva.
    - Evita reescribir tres funciones de personal de F01 y una migración de F02.5.
    - Evita **insertar permisos nuevos en los datos de tu DEMO** (los 5 propietarios ya tienen esa capacidad).
    - Proponer solo sugiere una ficha de producto; quien confirma importaciones ya decide qué entra a su inventario.
  - B) Capacidad nueva `catalog.propose`, como en el plan del 25/11: requiere `f01/017` (reescribe `create_staff_account` y `set_staff_capabilities`), `f025/018` (activación) y una inserción de permisos en los datos de la DEMO para los 5 propietarios.
  - El SQL de abajo está escrito para **A**. Si eliges B, preparo esos dos archivos con sus hashes antes de programar.

## SQL propuesto (borradores en `sql/`, NO aplicados; destino tras tu aprobación, copia literal)
| Archivo | Destino | SHA-256 (LF) |
|---|---|---|
| `sql/f02_007_product_identity.sql` | `backend/migrations/f02/007_product_identity.sql` | `E3887FDC855514CEB9C9173441BDAB2DD42F1E340B0BE46CC3BEC7B8C196BCD3` |
| `sql/f02_008_catalog_proposals.sql` | `backend/migrations/f02/008_catalog_proposals.sql` | `9551A52F2C7E4AA097D63FC65222B56935D7F7212E9EBD41D85CFF824773063E` |
| `sql/f03_004_public_search_identity.sql` | `backend/migrations/f03/004_public_search_identity.sql` | `3EDF5C02F3A781F8F4E9D2560B6CA4C53E76FA53116BB93863CF8E3428988B45` |
| `sql/f07_011_search_identity_location.sql` | `backend/migrations/f07/011_search_identity_location.sql` | `9AFE188400AFF77F65A4AEB2B34C9377D6958FBF22E94B35E0297BE7739B8E58` |

- **f02/007**: columnas `forma_farmaceutica` (lista cerrada de 16 formas o ''), `laboratorio` y `marca` (normalizadas, '' por defecto). Crea la unicidad completa **antes** de retirar `medicamento_referencia_unica`, en la misma transacción. Índice para encontrar el producto «sin laboratorio» equivalente. Amplía los campos admitidos en las incidencias de importación. **No reescribe ninguna fila.**
- **f02/008**: revisor de catálogo, lotes, propuestas, revisión por lote con muestra, auditoría inmutable y funciones:
  - `submit_catalog_proposals`: propone un lote de hasta 1000 filas; vincula solas las ya aprobadas (D-09) y omite las repetidas abiertas.
  - `start_catalog_review`: el servidor elige la muestra al azar.
  - `mark_catalog_sample` y `decide_catalog_proposals`: decisión atómica; es la **única** vía de escritura del catálogo, idempotente y segura ante concurrencia.
  - Es RLS + FORCE en todas las tablas nuevas. El rol interno `f022_catalog` es NOLOGIN y NOBYPASSRLS. La aplicación solo lee.
  - Las propuestas **no tienen** precio, stock, reservas ni archivos. La vinculación automática solo entrega a la farmacia el id del producto del catálogo, que es público.
- **f03/004 y f07/011**: la búsqueda nueva `f03.search_public_offers_identity` es igual a la de F03.2 más laboratorio, marca y forma. Se crean funciones nuevas sin editar las existentes, y la de F07 solo devuelve coordenadas verificadas. La marca cuenta como nombre; el laboratorio y la forma suman coincidencias pero no bastan solos (D-12). Sin texto limpio guardado (D-10).
- **Hashes**:
  - Los de F03 y F07 se agregan a las listas cerradas `F03_APPROVED` y `F07_APPROVED`.
  - El migrador de F02 hoy no verifica hashes; agrego la verificación para 007 y 008 (cambio pequeño en `inventario/infrastructure/migrate.ts`).
- **Validación del SQL:** los borradores no se han ejecutado. El primer paso tras tu aprobación (T003) los corre en una base efímera. Si hubiera que corregir algo, te presento el hash nuevo antes de seguir, como en F03.2.

## Diseño por partes
### 1. Identidad y forma (US1)
- `medicamentos/domain`: `catalogKey` con forma, laboratorio y marca. La lista y la deducción de formas pasan a `medicamentos/contracts/dosage-form.ts`; el asistente la importa de ahí, sin copia.
- Detector de columnas F02.1: columnas opcionales `codigo`, `laboratorio`, `marca` y `nombre_comercial`, `forma_farmaceutica` y `principio_activo` (`nombre_generico`), reconocidas por nombre y contenido; el empate se pregunta.
- Forma (D-06 A):
  1. Columna de forma si existe.
  2. Si no, deducción de presentación y nombre (exactamente una forma).
  3. Si no, «sin forma».
- Duplicado real: identidad completa repetida o código repetido (D-02, causa en el aviso). Las filas sin laboratorio solo coinciden con productos sin laboratorio (D-03).

### 2. Reimportar sin perder ni duplicar (US2, D-08 A con tus condiciones)
- Todo ocurre **dentro de la transacción única que ya usa `ConfirmImport`**, con el rol de la aplicación y RLS. No hace falta SQL nuevo para esto.
  - Por cada fila que **realmente entra** en esa confirmación, si su producto tiene laboratorio, marca o forma, se busca en **esa farmacia** la fila de inventario del producto «sin laboratorio» equivalente (mismo nombre, concentración, presentación y condición; laboratorio, marca y forma vacíos).
  - Esa fila pasa a 0 unidades con un movimiento «Reemplazado por producto con laboratorio (importación …)».
  - Se conservan su historial y sus reservas; el precio no cambia.
- **Atomicidad:** la fila nueva y el reemplazo se confirman en el mismo `COMMIT`.
  - Una búsqueda concurrente ve el estado anterior completo o el nuevo completo, nunca un hueco (aislamiento de PostgreSQL).
  - Si algo falla a mitad, se deshace todo y la importación queda como hoy (`RECHAZADA` en una transacción aparte, sin tocar inventario).
- **Bloqueos:** todas las filas de inventario tocadas se bloquean en orden de id, para evitar interbloqueos con reservas o con otra confirmación. Los conflictos ya se traducen en «importación no confirmable» sin cambios.
- **Reservas abiertas:** si la fila «sin laboratorio» tiene unidades comprometidas, no se reemplaza. Esa fila nueva entra igual, y el resultado lo dice («N no reemplazados: tienen reservas abiertas; vuelve a importar cuando se cierren»).
- **Vista previa:** anuncia «Se reemplazarán N productos sin laboratorio» y cuáles no podrán reemplazarse.
- Re-subir el mismo archivo ya funciona hoy (la huella se renueva si la vista previa anterior no es reutilizable).

### 3. Proponer (US3)
- En la vista previa, «Proponer los pendientes» agrupa las filas sin producto del catálogo.
  - Pide el **principio activo** cuando falta: sin él el producto nunca se publica (F03). Se toma de la columna `principio_activo`/`nombre_generico` si existe.
  - Permite elegir la forma por grupo o dejar «sin forma».
  - Más de 1000 filas se envían en varios lotes automáticamente.
- Pantalla «Mis propuestas» con estado, filtros y conteos.

### 4. Revisión por lotes cómoda para ~5350 productos (US4, condición de Andre; **más pantalla que la prevista**)
- `/admin/catalogo/propuestas`:
  - Contadores arriba: pendientes, decididas hoy, por farmacia, y «quedan N».
  - Filtros por **farmacia, laboratorio, forma**, aviso y texto, con paginación de 50.
  - Selección de la página o de **todo lo filtrado** (hasta 1000).
- «Revisar selección» crea la revisión y muestra la **muestra visible**: 10–30 fichas elegidas al azar por el servidor, cada una con «Correcta» o «Incorrecta».
  - Con la muestra completa y correcta se habilitan **«Aprobar selección»** y «Vincular a sugeridos».
  - Una incorrecta bloquea el lote y deja ver la ficha.
- Rechazo en lote con motivo. Las filas con aviso (sin laboratorio, sin forma, posible duplicado) se deciden una a una desde la misma lista.
- Resultado agrupado: aprobadas, ya existentes, vinculadas solas en otras farmacias (D-09). Accesible con teclado, en claro y oscuro.
- Las consultas de conteo y filtro corren en el servidor (con índice `propuesta_revision_idx`); el revisor nunca ve inventario, precios ni archivos.

### 5. Mostrar laboratorio, marca y forma (US5)
- Búsqueda: el repositorio usa `search_public_offers_identity`; contrato de búsqueda **0.4.0** (`PublicMedication.laboratorio`, `marca`, `formaFarmaceutica`); clave de caché nueva (v3). Sugerencias con la marca.
- Comparables, reservas, historial/CSV e inventario muestran laboratorio y marca.
- Asistente F06.2:
  - Agrupa y busca alternativas con la **forma del catálogo**; si está vacía, usa la deducción de F06.2.
  - Las tarjetas muestran laboratorio y marca.
  - Contrato de conversación **2.1.0**.
  - La regla «mismo principio activo, concentración y forma conocida» no se relaja.
- `scripts/f025/load-demo-catalog.mjs` se ajusta a la unicidad nueva (hoy usa la anterior en su `ON CONFLICT`).

### 6. Revisor de catálogo
- Concesión `CATALOG_REVIEW` solo con un script offline TEST (`scripts/f022/grant-catalog-reviewer.mjs`), como las de F02.5 y F07.1.
- Exige rol de plataforma activo y **segundo factor verificado en la sesión**.
- En tu DEMO, darla es una escritura de datos: se hará solo con tu aprobación, después de su copia de seguridad. El revisor necesitará tener el segundo factor activado.

## Verificación
1. **Restricción y migración sobre una copia restaurada de tu DEMO** (condición de Andre), con `scripts/f022/verify-migration-copy.mjs`.
   - Antes, **te pido permiso** para un `pg_dump` nuevo de tu DEMO. Es solo lectura, pero la copia de hoy (`…antes-f062…`) es anterior a tu T057 y no tiene las 2545 filas de inventario.
   - Se restaura en una base efímera marcada TEST, se aplican 007/008/004/011 y se comparan conteos **y claves** antes y después: ids de productos, (inventario, farmacia, producto), movimientos, reservas, importaciones y filas de importación.
   - La base se borra al terminar.
2. **D-08**:
   - Prueba de fallo a mitad (se fuerza un error tras N filas: cero cambios).
   - Prueba de concurrencia: confirmación contra reserva nueva sobre la fila «sin laboratorio», y dos confirmaciones a la vez.
   - Prueba de visibilidad: un lector concurrente nunca ve el producto sin oferta de esa farmacia.
   - Prueba de reservas abiertas: no se reemplaza y se informa.
3. **Aislamiento Alfa/Beta**, con conexión reutilizada:
   - Propuestas, vista previa, revisor sin inventario, revisor miembro denegado, sin segundo factor denegado, revocación inmediata, escritura directa del catálogo denegada, concurrencia al aprobar.
   - **D-09:** la farmacia B, vinculada sola, no ve nada de A (ni precio, ni stock, ni reservas, ni quién propuso): solo el id público del producto.
4. Unitarias: identidad, forma, detector, duplicado por identidad y código, muestra, reemplazo.
5. Regresión: F02, F02.1, F03 (con y sin Redis), F03.1/F03.2, F04, F06.2, F07.1/F07.2, F08.1, F01.1/F01.2; contratos (búsqueda 0.4.0, conversación 2.1.0, catálogo 0.2.0); `check`; build; frontend.
6. E2E en la **copia temporal 3001/5174** con `scripts/copy/start-copy.mjs`, con varios laboratorios, formas y una fila «caja x 30»:
   - Importar → proponer → revisar muestra → aprobar en lote → reimportar → confirmar (reemplazo) → buscar → asistente con alternativas.
   - Beta no ve nada. axe, celular, 0 llamadas externas.
7. Nada usa los puertos 3000/5173 de tu DEMO. Las pruebas de base de datos usan bases efímeras del clúster de pruebas.

## DEMO (solo tras tu aceptación)
1. Te pido permiso. Hago la copia de seguridad (nombre y tamaño; si falla, no se sigue).
2. Tú reinicias la DEMO con `demo-run.ps1`, que aplica las migraciones.
3. Foto en solo lectura: conteos iguales y 518 productos con laboratorio, marca y forma vacíos.
4. Con tu aprobación aparte, doy el permiso de revisor de catálogo.
5. Después haces a mano el flujo (D-11 A).

## Riesgos
- Regresión amplia por cambiar la identidad.
- Pantalla de revisión más grande que la prevista.
- El SQL aún no se ha ejecutado: si la validación de T003 obliga a cambiarlo, te presento hashes nuevos.
- La DEMO tendrá unas 5350 propuestas; con D-09, el revisor decide cada producto distinto una vez.
