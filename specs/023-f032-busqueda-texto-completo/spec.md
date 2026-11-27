# Feature Specification: F03.2 — Búsqueda con texto completo

**Feature Branch**: `feat/f032-busqueda-texto-completo` (creada desde `main` `288d72a`)
**Created**: 2026-11-27
**Status**: **Aprobada por Andre el 2026-11-27** (commit `e4c6116`, D-01 a D-05 en A, con condiciones en `approval.md`). Ampliada con FR-013 (ayuda «falta el nombre») a su pedido.
**Input**: corrección prioritaria pedida por Andre el 2026-11-27, registrada como observación en la aceptación de F03.1 (`specs/022-f031-busqueda-mapa/acceptance.md`).
**Trazabilidad**: F03-FR-002, F03-SC-001 y el caso límite de F03 sobre «acentos, mayúsculas o espacios»; F08.1 (sugerencias, `suggest-public.ts`); F03.1 (búsqueda y mapa).

## El problema hoy

- La base busca el texto completo dentro del **nombre** o del **principio activo** (`position(término in nombre)` en `f03.search_public_offers`).
- «paracetamol 500 mg tabletas x 10» une nombre, concentración y presentación, y no aparece entero en ninguno de los dos campos: da 0 resultados.
- Esa frase la propone el propio buscador (sugerencia de tipo «presentación» de F08.1), así que **una sugerencia lleva a una búsqueda vacía**.
- Además, la base guarda los nombres en minúsculas pero **con tildes**: «acido» no encuentra «ácido». La spec F03 ya pedía «coincidencias coherentes con acentos, mayúsculas o espacios»; esta mejora lo cumple.

## Revisión previa (lo aprobado que toca este pedido)

| Fuente | Qué dice | Efecto |
|---|---|---|
| Constitution («Restricciones y continuidad») | Las búsquedas públicas son por **nombre comercial o principio activo**. | Se mantiene: el texto **debe** coincidir con el nombre o el principio activo. La concentración y la presentación solo **afinan y ordenan**. «tabletas» sola sigue dando 0. |
| Constitution VIII y IX; F03 FR-009 | Solo proyecciones públicas sin RLS desactivado; Redis cache-aside; la clave distingue el término normalizado. | Sin cambio en qué se publica. La clave de caché sigue usando el término normalizado (con la nueva normalización). |
| F03 (spec 004), caso límite | Acentos, mayúsculas y espacios no deben romper coincidencias; **no fusionar presentaciones distintas**. | Se ignoran tildes y mayúsculas, pero cada presentación sigue siendo un resultado aparte. |
| F07 `003_public_projection.sql` | Versión vigente de `f03.search_public_offers`, con coordenadas solo verificadas. | No se edita (SQL aprobado). Si hace falta SQL, va en una migración **nueva** que conserve la misma regla de coordenadas. Ver D-01. |
| F03.1 (spec 022), contrato 0.2.0 y `validCached` | Respuesta con claves exactas; una entrada vieja de caché se descarta. | Si cambia la respuesta (D-03), se actualizan contrato, validador y versión de la clave. |
| F08.1 (spec 016), sugerencias | Salen solo de ofertas públicas visibles. | No cambian. Se agrega una prueba: **toda sugerencia lleva a ≥ 1 resultado**. |
| Asistente F06.1 | Usa la misma búsqueda pública. | Se beneficia sin cambios propios. |
| ADR-ROADMAP-V3-002 | US$0, sin servicios externos. | Sin librerías, extensiones de PostgreSQL ni servicios nuevos (D-01 A). |

## User Scenarios & Testing

### User Story 1 — Buscar con nombre, concentración y presentación (P1)
**Acceptance Scenarios**
1. **Given** hay paracetamol 500 mg tabletas x 10, 500 mg tabletas x 100 y 1 g tabletas x 10, **When** busca «paracetamol 500 mg tabletas x 10», **Then** ve primero (o solo, según D-02) paracetamol 500 mg tabletas x 10.
2. **When** busca «paracetamol 500», **Then** ve las dos presentaciones de 500 mg y no la de 1 g.
3. **When** busca «amoxicilina capsulas» (sin tilde), **Then** ve las amoxicilinas en cápsulas y no las de suspensión.
4. **When** busca «ibuprofeno 400mg» o «IBUPROFENO 400 MG», **Then** ve el mismo resultado que con «ibuprofeno 400 mg».
5. **When** busca «paracetamol» o «parace», **Then** ve lo mismo que hoy (sin pérdida).

### User Story 2 — Sin coincidencia exacta, otras presentaciones con aviso (P1)
1. **Given** solo hay paracetamol 500 mg, **When** busca «paracetamol 750 mg», **Then** ve los paracetamoles disponibles y el aviso «No encontramos esa presentación exacta; estas son otras disponibles».
2. **When** busca algo cuyo nombre no existe («xyzol 500 mg»), **Then** ve el estado vacío de siempre, sin aviso.
3. **When** busca solo una presentación o concentración («tabletas», «500 mg»), **Then** en vez de un «0 resultados» a secas ve la ayuda «Escribe también el nombre del medicamento, por ejemplo: paracetamol 500 mg» (FR-013).

### User Story 3 — Las sugerencias nunca llevan al vacío (P1)
1. **Given** cualquier sugerencia del buscador (nombre o presentación), **When** la elige, **Then** la búsqueda devuelve al menos un resultado.
2. Una prueba automática recorre todas las sugerencias de los datos de prueba y comprueba lo anterior.

### Edge Cases
- Número sin unidad («paracetamol 500») coincide con «500 mg», pero **no** con «1500 mg» (se compara el número entero, no un pedazo).
- «x10» y «x 10» son iguales; «500mg», «500 mg» y «500 MG» también.
- Singular y plural: «tableta» y «tabletas», «capsula» y «cápsulas».
- Palabras de relleno («de», «x», «en», «con», «para», «por», «y») no cuentan.
- Solo concentración o presentación («500 mg», «tabletas»): no se buscan productos (regla de la Constitution), pero se muestra la ayuda de FR-013.
- Los filtros de precio se aplican igual; si dejan la lista vacía, es el estado vacío normal (no es «sugerencia vacía»).
- Equivalencias de unidades («1 g» = «1000 mg») y errores de tipeo («paracetmol») quedan fuera.

## Requirements

### Functional Requirements
- **F032-FR-001**: La búsqueda DEBE ignorar tildes, mayúsculas y espacios repetidos, y tratar igual número y unidad juntos o separados («500mg» = «500 mg», «x10» = «x 10»), tanto en lo que se escribe como en los datos guardados.
- **F032-FR-002**: El texto se DEBE dividir en palabras. Un resultado es candidato solo si **al menos una palabra** coincide con el nombre comercial o el principio activo (se mantiene la búsqueda por parte del nombre, p. ej. «parace»).
- **F032-FR-003**: Las demás palabras DEBEN compararse con nombre, principio activo, concentración y presentación. Los números se comparan enteros; las palabras toleran singular y plural.
- **F032-FR-004**: **Coincidencia exacta** = todas las palabras útiles coinciden en algún campo del producto. Los resultados DEBEN ordenarse primero por parecido (palabras que coinciden) y después por el orden elegido (precio, cercanía, etc.). Qué se muestra cuando hay exactos lo define D-02.
- **F032-FR-005**: Si hay candidatos pero ninguno exacto, DEBEN mostrarse los productos del medicamento con el aviso «No encontramos esa presentación exacta; estas son otras disponibles».
- **F032-FR-006**: Sin candidatos, DEBE mostrarse el estado vacío actual.
- **F032-FR-013** (agregado por Andre el 2026-11-27): Si el texto no trae ninguna palabra que pueda ser un nombre (solo números, unidades o palabras de presentación como «tabletas», «cápsulas» o «jarabe»), la respuesta DEBE indicarlo y la pantalla DEBE mostrar «Escribe también el nombre del medicamento, por ejemplo: paracetamol 500 mg» en lugar del vacío genérico. Es un estado vacío explícito, compatible con F03-FR-002.
- **F032-FR-007**: Ninguna sugerencia del buscador DEBE llevar a una búsqueda con 0 resultados (sin filtros). Prueba automática obligatoria.
- **F032-FR-008**: No cambia qué se publica: solo farmacias activas, ofertas con stock disponible, campos públicos y coordenadas solo verificadas. Sin datos internos.
- **F032-FR-009**: La caché DEBE seguir funcionando (hit, miss, caída con respaldo en PostgreSQL). Si cambia la forma de la respuesta, las entradas viejas se descartan sin error.
- **F032-FR-010**: Costo US$0, sin servicios externos, librerías ni extensiones nuevas.
- **F032-FR-011**: Medir la búsqueda con los 518 productos de HUAMANFAR (sin tocar la DEMO, ver D-04) y dejar el resultado en `evidence.md`. Meta: p95 de la consulta en base ≤ 100 ms y sin empeorar más de 2× frente a la búsqueda actual.
- **F032-FR-012**: Mostrarlo en la copia temporal 3001/5174 con datos ficticios que incluyan varias concentraciones y presentaciones del mismo medicamento.

### Key Entities
- **Término normalizado**: texto sin tildes, en minúsculas, con número y unidad separados y espacios simples.
- **Palabras útiles**: palabras del término sin las de relleno.
- **Coincidencia**: `EXACTA` (todas las palabras), `APROXIMADA` (solo el nombre u otras parciales), `NINGUNA` (sin resultados) o `FALTA_NOMBRE` (sin resultados y sin palabra que pueda ser nombre).

## Success Criteria
- **F032-SC-001**: «paracetamol 500 mg tabletas x 10», «paracetamol 500», «amoxicilina capsulas» e «ibuprofeno 400mg» encuentran los productos esperados, con los más parecidos primero.
- **F032-SC-002**: El 100 % de las sugerencias de los datos de prueba lleva a ≥ 1 resultado.
- **F032-SC-003**: Las búsquedas que hoy funcionan siguen dando lo mismo (regresión F03, F03.1, F08.1 y asistente).
- **F032-SC-004**: Medición con 518 productos dentro de la meta de FR-011.

## Decisiones para Andre (opción recomendada en **negrita**)

- **D-01 · Dónde se hace la comparación**
  - **A) Nueva función SQL en una migración nueva** (sin editar las aprobadas): recibe las palabras ya normalizadas, quita tildes con `translate()` (incluido en PostgreSQL, sin extensiones) y devuelve el parecido de cada fila. Cumple tildes en los datos guardados y no corta resultados exactos por el límite de 200. **SQL para tu revisión antes de aplicarlo.**
  - B) Solo en el backend, sin SQL: varias consultas con la función actual y ordenar en TypeScript. Las tildes guardadas («ácido») seguirían fallando y el límite de 200 podría dejar fuera exactos.
  - C) Extensiones `unaccent`/`pg_trgm` con índices: tolera errores de tipeo, pero agrega extensiones e índices; excede lo pedido.
- **D-02 · Qué se ve cuando hay exactos**
  - **A) Solo los exactos.** Si no hay ninguno, todos los del medicamento con el aviso. Así «Más barato» ordena solo lo que pediste.
  - B) Todos los del medicamento, exactos primero y el resto debajo.
- **D-03 · Cómo sabe la pantalla que debe mostrar el aviso**
  - **A) Campo nuevo en la respuesta `coincidencia: "EXACTA" | "APROXIMADA" | "NINGUNA" | "FALTA_NOMBRE"`** (los dos últimos agregados por FR-013) (contrato 0.3.0). Se actualizan el validador de caché y la versión de la clave (`v1` → `v2`), y las entradas viejas se ignoran.
  - B) Sin cambiar el contrato: la pantalla compara por su cuenta. Frágil y duplica la lógica.
- **D-04 · Datos para medir con los 518 productos**
  - **A) Restaurar la copia de seguridad ya guardada** (`…antes-f031_20261126.dump`) en una base TEST efímera y marcada, medir antes/después, y borrarla. La DEMO no se toca ni se lee.
  - B) Generar 518 productos ficticios parecidos.
- **D-05 · Índices**
  - **A) Sin índices nuevos** si la medición cumple la meta (con 518 productos, una lectura completa es rápida). Si no cumple, te presento un índice como enmienda.
  - B) Agregar ya un índice sobre el nombre normalizado.

## Fuera de alcance
- Errores de tipeo, sinónimos de marcas y equivalencias de unidades.
- Cambios en qué se publica, en las sugerencias de F08.1 o en el mapa de F03.1.
- Márgenes de «Revisar solicitudes» y «Mi perfil», ayuda de dirección en el registro (después de T063) y la corrida de pruebas por investigar (siguen pendientes, sin empezar).

## Assumptions
- Los datos del catálogo ya se guardan en minúsculas y con espacios simples (restricciones de F02); las tildes se quitan al comparar, no se cambian los datos.
- La DEMO no recibe la migración en esta rama; se aplicará solo con tu autorización y copia de seguridad, después de integrar.
- F02.5 sigue sin aceptar (T057 y T063 sin marcar) y la spec 020 sigue en opción A.
