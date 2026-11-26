# Feature Specification: F07.1 — Mi farmacia: datos, ubicación y horario

**Feature Branch**: `feat/f071-mi-farmacia`
**Created**: 2026-11-26
**Status**: Spec **aprobada por Andre el 2026-11-26** («apruebo»; ver [approval.md](approval.md)). D-01 a D-05 y T057 con la opción recomendada (A), pendientes de confirmar con el plan. Plan pendiente de aprobación.
**Input**: pedido de Andre del 2026-11-26, tras la consulta de solo lectura del mismo día. Parte de **MEJ-006** y **RF21** (perfil y datos de la farmacia); **MEJ-006 no se declara completa**.

## Problema (lenguaje sencillo)
El propietario de una farmacia activada por F02.5 (p. ej. HUAMANFAR) no ve ninguna sección para sus datos:
- el contacto solo se edita en `/inventory`, fuera del panel;
- la dirección no se puede cambiar después de la activación;
- la ubicación en el mapa (F07) exige `GEO_LOCATION_PROPOSE`, que F02.5 no concede, y su revisión exige `GEO_LOCATION_REVIEW` **dentro de la misma farmacia**, algo que nadie tiene;
- no existe horario de atención.

Además, «Mi perfil» funciona para cualquier cuenta, pero está escondido en un desplegable de `/identity`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Pestaña «Mi farmacia» con contacto y dirección (Priority: P1)
Como propietario quiero una pestaña «Mi farmacia» en el Panel de farmacia que reúna el contacto, la dirección y la ubicación de mi farmacia.

**Independent Test**: el dueño de una farmacia recién aprobada abre «Mi farmacia», cambia el contacto y lo ve guardado. Propone una dirección nueva y la ve «En revisión».

1. **Given** un propietario con permiso de perfil, **When** edita el contacto, **Then** el cambio rige de inmediato, con versión (dos ediciones simultáneas no se pisan) y auditoría.
2. **Given** un propietario, **When** propone una dirección nueva, **Then** queda «En revisión» y la dirección pública anterior sigue visible hasta que se aprueba.
3. **Given** un trabajador sin esos permisos, **When** abre el panel, **Then** no ve «Mi farmacia» y el servidor rechaza sus intentos.

### User Story 2 — Ubicación en el mapa con revisión de la plataforma (Priority: P1)
Como propietario quiero fijar la ubicación de mi farmacia y que un administrador de la plataforma la verifique antes de publicarla.

**Independent Test**: el propietario propone una ubicación con pin y la ve «En revisión». El administrador de la plataforma la aprueba y aparece «Verificada» en el mapa público. El propietario no puede aprobarla.

1. **Given** el propietario, **When** marca la ubicación con un pin en el mapa, con la ubicación actual de su dispositivo (una sola lectura, con su permiso y sin rastreo) o escribiendo las coordenadas, **Then** se crea una propuesta «En revisión».
2. **Given** una propuesta pendiente, **When** un administrador de plataforma la revisa, **Then** ve solo datos públicos de ubicación (nombre público, dirección publicable, ciudad y coordenadas). Nunca ve inventario, reservas, personal, contacto privado ni documentos.
3. **Given** la aprobación, **Then** la ubicación pasa a «Verificada» y se publica en la búsqueda y el mapa. **Given** el rechazo, **Then** queda «Rechazada» con su motivo y la ubicación publicada antes, si existía, no cambia.
4. **Given** quien propuso, o cualquier miembro de esa farmacia, **When** intenta aprobar, **Then** se deniega y queda auditado, aunque además sea administrador de plataforma.
5. **Given** la pestaña, **Then** muestra el estado actual («En revisión», «Verificada» o «Rechazada») y un historial de propuestas y decisiones, con fecha, autor y motivo.

### User Story 3 — Permisos de ubicación del propietario (Priority: P1)
Como propietario de una farmacia activada quiero tener ya el permiso para proponer su ubicación, sin trámites manuales.

1. **Given** una activación aprobada nueva, **Then** el dueño recibe `GEO_LOCATION_PROPOSE` en la misma transacción. Se usa el patrón de la migración 016; el SQL se muestra a Andre antes de ejecutarlo.
2. **Given** farmacias ya activadas (p. ej. HUAMANFAR), **Then** se reparan una vez, con la misma atribución al revisor original y una auditoría por alta. Nunca reciben el permiso trabajadores ni el administrador global.

### User Story 4 — Horario de atención (Priority: P2)
Como propietario quiero publicar mi horario por día, y como visitante quiero verlo en la búsqueda y el mapa.

1. **Given** el propietario, **When** define para cada día de la semana una hora de apertura y otra de cierre, o lo marca «Cerrado», **Then** se guarda con versión y auditoría y se muestra en la búsqueda y el mapa públicos.
2. **Given** horas inválidas (cierre antes de apertura, formato erróneo), **Then** se rechazan con un mensaje claro.

### User Story 5 — «Mi perfil» visible (Priority: P2)
Como cualquier usuario con sesión quiero llegar a «Mi perfil» desde un acceso claro, sin buscarlo en un desplegable. Sus reglas no cambian.

### Edge Cases
- Dos propuestas seguidas: la nueva reemplaza a la pendiente anterior, que queda «Reemplazada», o se rechaza el envío; se decide en *clarify* (D-04).
- El propietario deniega el permiso de ubicación del navegador: puede seguir con el pin o con las coordenadas escritas.
- Coordenadas fuera del Perú o en el mar: se rechazan con un mensaje claro (límites aproximados del país).
- Farmacia sin ubicación verificada: no aparece en el mapa, pero sí en la búsqueda (comportamiento actual de F07).
- El administrador de plataforma también es dueño de una farmacia: no puede revisar las propuestas de su propia farmacia.

## Requirements *(mandatory)*

- **F071-FR-001**: Pestaña «Mi farmacia» en el Panel de farmacia, visible solo con `pharmacy.profile.read` o `GEO_LOCATION_PROPOSE`. Reúne contacto, dirección, ubicación, estado e historial. El contacto deja de editarse en `/inventory`.
- **F071-FR-002**: El contacto se edita de forma inmediata, con versión optimista y auditoría. Reutiliza `pharmacy.profile.write` y el flujo de la 014.
- **F071-FR-003**: Dirección pública y ubicación se cambian solo mediante una **propuesta revisada**. La ubicación publicada anterior sigue vigente hasta que se aprueba la nueva.
- **F071-FR-004**: Tres formas de fijar la ubicación: pin en el mapa, una única lectura de la ubicación del dispositivo con permiso explícito (sin seguimiento continuo ni almacenamiento del historial del dispositivo) o coordenadas escritas. Se validan los límites del Perú.
- **F071-FR-005**: Revisión por **administrador de plataforma** con una capacidad nueva y explícita de revisión de ubicaciones, concedida como las capacidades F025 (con aprobación y auditoría). Solo ve datos públicos de ubicación. Nunca puede revisar si propuso el cambio o es miembro de esa farmacia.
- **F071-FR-006**: Estado visible («En revisión», «Verificada», «Rechazada») e historial con fecha, autor, decisión y motivo. Al propietario se le muestran nombres, nunca identificadores internos ni datos de otras farmacias.
- **F071-FR-007**: Activación F02.5 → `GEO_LOCATION_PROPOSE` para el dueño, de forma atómica. Reparación única y repetible de las farmacias ya activadas, con auditoría (patrón 016). **SQL mostrado a Andre antes de ejecutarlo.**
- **F071-FR-008** (P2): Horario semanal por día (apertura, cierre o «Cerrado»), en hora de Lima, con versión y auditoría. Se publica en la búsqueda y el mapa públicos.
- **F071-FR-009** (P2): Acceso visible a «Mi perfil» desde «Mi cuenta», sin cambiar sus reglas.
- **F071-FR-010**: Aislamiento: Alfa nunca lee ni propone por Beta. El revisor de plataforma no obtiene acceso a inventario, reservas, personal ni documentos. Cero `BYPASSRLS` en roles de aplicación; sin permisos globales implícitos.
- **F071-FR-011**: Migraciones nuevas y aditivas. No se editan las migraciones de F07 ni de F02.5 ya aprobadas ni sus hashes. Las pruebas corren en bases TEST efímeras. La DEMO solo se migra con la aprobación de Andre.
- **F071-FR-012**: US$0. Se reutiliza el proveedor de mapa ya revisado en F07, sin servicios nuevos de pago ni geocodificador externo.

### Cambios de RLS y permisos que exige (resumen; el detalle irá en el plan)
1. **Capacidad de plataforma nueva** para revisar ubicaciones. Puede ir en la tabla de capacidades F025, que hoy limita sus códigos, o en una tabla propia de F07.1; se decide en el plan.
2. **Políticas nuevas en `f07.ubicacion_propuesta`** para ese revisor: leer solo las propuestas pendientes con sus campos públicos y registrar la decisión. También en la publicación de la ubicación verificada. Las políticas actuales de F07 (revisión dentro de la farmacia) no se modifican.
3. **Política de alta** de `GEO_LOCATION_PROPOSE` para el ejecutor de activación (como la 016) y reparación.
4. **Tabla nueva de horario** con RLS por farmacia (escritura con permiso de perfil) y lectura pública solo de lo publicable.

### Riesgos
- **Revisor de plataforma con alcance entre farmacias:** es el mayor riesgo. Se mitiga con políticas limitadas a columnas públicas y propuestas pendientes, matriz Alfa/Beta y prueba de que no ve datos privados.
- **Autoaprobación:** se bloquea en la base de datos (quien propone ≠ quien revisa; el revisor no puede ser miembro de la farmacia), no solo en la pantalla.
- **Ubicación del dispositivo:** es un dato sensible. Una sola lectura, con permiso, sin guardar nada más que la propuesta.
- **Coordenadas falsas:** las mitiga la revisión humana; la verificación sigue siendo referencial.
- **Proveedor de teselas del mapa:** condiciones de uso y disponibilidad ya señaladas en F07; nada nuevo de pago.
- **Toca lo aprobado de F07:** solo de forma aditiva, con regresión completa de F07 antes de integrar.

### Key Entities
- **Propuesta de ubicación** (existe en F07): dirección publicable, ciudad, coordenadas, estado, quién propuso y quién revisó, fechas y motivo.
- **Concesión de revisión de plataforma** (nueva): quién, código, aprobación y estado.
- **Horario de atención** (nuevo): farmacia, día, apertura, cierre, cerrado y versión.

## Success Criteria *(mandatory)*
- **F071-SC-001**: El dueño de una farmacia recién aprobada edita el contacto y propone una ubicación en menos de 3 minutos, sin ayuda técnica.
- **F071-SC-002**: Matriz de seguridad al 100 %: cero lecturas cruzadas Alfa/Beta, cero autoaprobaciones, el revisor de plataforma no ve datos privados, y trabajador y cliente son rechazados.
- **F071-SC-003**: Una ubicación aprobada aparece en el mapa público y una rechazada no cambia lo publicado.
- **F071-SC-004** (P2): El horario se ve en la búsqueda y el mapa en escritorio y celular, con accesibilidad de F08.
- **F071-SC-005**: Regresión de F07, F02.5, F01.1, F03 y F08 sin cambios de comportamiento.

## Decisiones para *clarify* (recomendación primero)
- **D-01 · Dónde guardar la capacidad de revisión:** (A, recomendada) tabla propia de F07.1 con el mismo patrón de aprobación y auditoría; no toca la restricción de la tabla F025. (B) Ampliar la tabla F025, lo que cambia una restricción aprobada.
- **D-02 · Revisión por farmacia de F07 (`GEO_LOCATION_REVIEW`):** (A, recomendada) se conserva sin cambios, pero sin asignarla en F02.5. (B) Retirarla.
- **D-03 · Horario:** (A, recomendada) un tramo por día y «Cerrado». (B) Varios tramos por día (p. ej. cerrado al mediodía).
- **D-04 · Propuesta pendiente y nueva propuesta:** (A, recomendada) la nueva reemplaza a la pendiente, que queda «Reemplazada» en el historial. (B) Bloquear hasta que se revise.
- **D-05 · Acceso a «Mi perfil»:** (A, recomendada) enlace «Mi perfil» en «Mi cuenta» que abre una página propia (`/mi-perfil`). (B) Dejarlo en `/identity`, abierto por defecto.

## Relación con T057 (F02.5)
- T057 es la demostración de cinco farmacias dadas de alta desde la pantalla. Hoy esas farmacias quedan sin ubicación verificada y no salen en el mapa, aunque sí en la búsqueda. Mientras este incremento no esté integrado, nadie puede publicarlas.
- **Recomendación A:** hacer T057 ya, sin el mapa, y registrar «ubicación en mapa pendiente de F07.1» como omisión conocida. La aceptación de F02.5 no depende de F07.
- **Alternativa B:** esperar a F07.1 para incluir las ubicaciones. Retrasa T057 y la spec 020.

## Fuera de alcance
- Desactivar o suspender farmacias (F025-FR-026).
- Documentos o RUC reales.
- Geocodificador externo y proveedores de pago.
- Cambios a la spec 020.
- Declarar MEJ-006 completa.

## Assumptions
- TEST y DEMO con datos ficticios.
- El revisor de plataforma es el de F02.5, con una concesión adicional explícita.
- El mapa usa el proveedor ya revisado en F07.
