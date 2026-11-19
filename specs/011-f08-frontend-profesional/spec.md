# F08 — Frontend profesional completo

**Rama:** `feat/f08-frontend-profesional`

**Fecha:** 2026-11-18

**Estado:** especificación y plan aprobados por el responsable el 2026-11-18; tareas técnicas F08 verificadas, aceptación final pendiente.
**Fuentes:** Constitution v1.2.0, Documento Maestro v3.0 §A7 y §A3, contratos y aceptaciones F00–F07, ADR-ROADMAP-V3-001 y rúbrica de 16 criterios. F08-LEGACY-SCALE designa el antiguo incremento de escalabilidad, hoy F10.

## Alcance

Unificar las vistas React existentes en una experiencia en español, orientada a tareas y conectada a los contratos vigentes. F08 cambia presentación y navegación; no modifica reglas de dominio, permisos, respuestas de API ni datos persistentes. La geolocalización F07 continúa limitada a TEST/DEMO y el contenido farmacológico F06.1 sujeto a revisión profesional continúa bloqueado.

## Historias y escenarios de aceptación

### H1 — Orientación y acceso público (P1)

Una persona llega a Inicio y puede buscar, comparar, localizar farmacias por ciudad y abrir el asistente informativo sin asumir datos existentes.

1. **Dado** un entorno sin ofertas, **cuando** abre Inicio y busca, **entonces** encuentra navegación clara, resultados vacíos honestos y vías de continuación.
2. **Dada** una oferta pública TEST, **cuando** busca, filtra, ordena o compara, **entonces** ve solo precio, disponibilidad referencial y fecha suministrados por F03.
3. **Dado** permiso de ubicación denegado, **cuando** usa farmacias cercanas, **entonces** puede continuar mediante ciudad o entrada manual; el mapa voluntario no bloquea la lista.

### H2 — Cuenta y contexto autorizado (P1)

Una persona puede registrarse, iniciar/cerrar sesión, consultar perfil y escoger únicamente farmacias vinculadas.

1. **Dada** una cuenta ficticia, **cuando** inicia sesión, **entonces** se muestra el perfil y las membresías devueltas por F01; elegir otra farmacia exige autorización del backend.
2. **Dada** una sesión expirada o revocada, **cuando** abre una vista protegida, **entonces** se retiran datos privados de pantalla y se ofrece volver a iniciar sesión.
3. **Dada** una cuenta sin membresía, **cuando** abre el panel, **entonces** no ve información privada ni acciones administrativas.

### H3 — Trabajo en farmacia (P1)

Un trabajador autorizado usa catálogo, inventario, importación y reservas de su farmacia activa, con validaciones y confirmación de acciones sensibles.

1. **Dada** una membresía activa con capacidad aplicable, **cuando** consulta y actualiza mediante los contratos F02/F04, **entonces** obtiene confirmación y estado actualizado sin recalcular stock o vencimientos en React.
2. **Dada** una membresía de Alfa, **cuando** intenta acceder a Beta mediante URL o cambio de contexto, **entonces** no se presentan datos privados ni se habilita una operación; el backend rechaza la petición.
3. **Dado** un conflicto, stock insuficiente o permiso revocado, **cuando** intenta operar, **entonces** ve un mensaje accesible y conserva una ruta segura para reintentar o volver.

### H4 — Reservas personales (P1)

Una persona autenticada consulta, crea y cancela sus reservas conforme a F04; la farmacia autorizada confirma, registra falta física o entrega cuando el contrato lo permite.

1. **Dada** una oferta pública, **cuando** crea una reserva, **entonces** se muestra estado y vencimiento exacto devueltos por la API.
2. **Dada** una reserva expirada o sin stock, **cuando** intenta una transición prohibida, **entonces** la interfaz refleja la denegación sin afirmar entrega ni cambiar inventario localmente.

### H5 — Asistente informativo (P2)

Una persona consulta FarmaFind AI y distingue mensajes, fuentes, errores y límites del proveedor determinista.

1. **Dada** una consulta pública autorizada, **cuando** conversa, **entonces** ve respuesta, referencias disponibles y aviso de disponibilidad referencial.
2. **Dada** una consulta clínica personalizada o contenido no validado, **cuando** conversa, **entonces** ve rechazo comprensible sin consejo individual ni contenido inventado.
3. **Dado** un fallo, **cuando** el servicio responde con error, **entonces** hay recuperación comprensible y la búsqueda convencional continúa disponible.

### H6 — Operación de ubicación TEST (P2)

Un actor F07 con capacidad explícita puede proponer o revisar una ubicación de su farmacia mediante la interfaz existente, con estado, evidencia y errores claros.

1. **Dado** un actor sin capacidad GEO, **cuando** visita la vista, **entonces** no ve controles operativos y el backend sigue denegando la acción.
2. **Dados** proponente y revisor distintos de Alfa TEST, **cuando** completan el flujo, **entonces** se publica solo la ubicación autorizada y Beta permanece aislada.

### H7 — Experiencia transversal (P1)

La navegación, formularios, estados y componentes funcionan en móvil, tableta y escritorio con teclado y mensajes accesibles.

1. **Dadas** las rutas públicas y protegidas existentes, **cuando** se recorren en los tres tamaños, **entonces** no hay rutas rotas, solapamientos que impidan operar ni acciones solo dependientes del mouse.
2. **Dado** un error de red o carga lenta, **cuando** espera o reintenta, **entonces** el estado se anuncia, conserva el contexto no sensible y no comunica éxito ficticio.

## Casos límite y restricciones

- F05 solo dispone de un contrato interno para eventos; F08 no expone una bandeja ni llama a ese endpoint desde el navegador. Los estados de reserva F04 son la única información visible hasta que exista un contrato de lectura aprobado.
- GLO-01 y BOOT-01 permanecen solo en TEST efímero; ningún control F08 habilita privilegios persistentes. Administración delegada y GEO muestran únicamente capacidades F01 verificadas.
- F07 ofrece lista aunque fallen teselas; no activa un proveedor de mapa productivo ni seguimiento continuo.
- Gemini real y contenido farmacológico pendiente de revisión profesional no se muestran como activos.
- Vacíos, 401/403/404/409/429/503, sesión expirada, membresía revocada y dos farmacias deben tener comportamiento verificable sin fuga de datos.

## Requisitos verificables

- **F08-FR-001:** Inicio debe enlazar rutas funcionales aprobadas y explicar el propósito sin estadísticas, ofertas o testimonios inventados.
- **F08-FR-002:** La navegación debe distinguir público, persona autenticada y membresía/capacidad de farmacia; no sustituye autorización de servidor.
- **F08-FR-003:** Debe haber lenguaje visual reutilizable para tipografía, color, espaciado, componentes, foco, errores, vacíos y carga.
- **F08-FR-004:** Todas las vistas y mensajes nuevos deben estar en español y funcionar en móvil, tableta y escritorio.
- **F08-FR-005:** Formularios deben tener etiquetas, validación comprensible, estado de envío y errores accesibles, sin mostrar secretos.
- **F08-FR-006:** Inicio, búsqueda, comparación y detalle público deben utilizar solo las respuestas vigentes F03 y distinguir disponibilidad referencial.
- **F08-FR-007:** Búsqueda debe conservar filtros, orden y paginación autorizados, con estado vacío y recuperación de error.
- **F08-FR-008:** Lista/mapa F07 deben conservar consentimiento puntual, radio, ciudad/manual, atribución y alternativa sin teselas; solo TEST/DEMO.
- **F08-FR-009:** Registro, acceso, cierre, perfil, sesión expirada y selección de farmacia deben respetar F01 y borrar datos privados de la vista cuando cese la sesión.
- **F08-FR-010:** Vistas de farmacia deben mostrar catálogo, inventario, movimientos, importaciones y formularios solo según contrato/capacidad F02.
- **F08-FR-011:** Reservas propias y de farmacia deben usar F04 para creación, consulta, cancelación, confirmación, falta física, entrega y configuración autorizada.
- **F08-FR-012:** El vencimiento y estado de reserva deben mostrarse según la API; React no debe decidir transiciones ni recalcular expiración.
- **F08-FR-013:** Estados F05 visibles deben limitarse a lo que F04/F05 expongan mediante contratos públicos aprobados; no debe crearse bandeja ficticia.
- **F08-FR-014:** Asistente F06/F06.1 debe mostrar conversación temporal autorizada, fuentes, fallback y límites clínicos sin activar Gemini.
- **F08-FR-015:** Acciones de membresía y ubicación deben requerir farmacia activa y capacidad explícita; URL o `farmacia_id` no concede acceso.
- **F08-FR-016:** Ninguna ruta ni respuesta debe exponer datos privados de otra farmacia; probarlo con Alfa/Beta TEST y RLS real.
- **F08-FR-017:** Errores HTTP, fallos de red y carga lenta deben distinguirse de éxito, incluir reintento seguro cuando corresponda y evitar filtración de detalles sensibles.
- **F08-FR-018:** Deben existir recorridos de teclado, semántica, foco visible, contraste y mensajes anunciables con WCAG 2.2 AA como objetivo de evaluación.
- **F08-FR-019:** Deben existir pruebas unitarias de componentes, contratos HTTP, permisos, E2E y responsive en entorno compatible usando solo datos TEST aislados.
- **F08-FR-020:** Los cambios no deben modificar reglas de negocio, APIs aprobadas, base persistente, Constitution ni infraestructura de pago.

## Criterios de éxito medibles

- **F08-SC-001:** El 100 % de rutas públicas y protegidas aprobadas tiene entrada navegable, destino correcto y estado vacío/error comprobado.
- **F08-SC-002:** El 100 % de flujos principales H1–H6 se completa en navegador TEST o queda documentado como bloqueado por un contrato inexistente, sin simular éxito.
- **F08-SC-003:** El 100 % de acciones protegidas probadas con cuentas Alfa/Beta sin permiso es denegado sin datos cruzados; la autoridad de servidor/RLS permanece intacta.
- **F08-SC-004:** El 100 % de pantallas evaluadas en 360 px, 768 px y 1280 px conserva contenido y acciones utilizables sin desplazamiento horizontal bloqueante.
- **F08-SC-005:** El 100 % de tareas principales evaluadas es operable por teclado y las comprobaciones automáticas de accesibilidad no muestran violaciones críticas/serias; limitaciones de revisión humana se registran.
- **F08-SC-006:** El 100 % de datos comerciales, inventario, reservas y ubicaciones mostrados procede de respuestas aprobadas o fixtures rotulados DEMO; ningún valor se inventa en React.
- **F08-SC-007:** La regresión afectada F00–F07, compilación, contratos y auditoría de dependencias registran resultados reales; ningún fallo obligatorio se omite para aceptar F08.
- **F08-SC-008:** Ningún secreto, dato personal real o proveedor externo no autorizado aparece en el bundle, evidencias o cambios Git revisados.

## Trazabilidad inicial

| Alcance F08 | Fuente principal | Evidencia de aceptación prevista |
| --- | --- | --- |
| H1; FR-001/006/007 | Maestro v3 §A7; F03 | Búsqueda/comparación y vacío en navegador TEST |
| H2; FR-009/015/016 | Maestro v3 §A7; F01 | Sesión, membresía Alfa/Beta y denegación RLS |
| H3; FR-010/015/016 | Maestro v3 §A7; F02 | Inventario/importación por rol y farmacia |
| H4; FR-011/012/013 | Maestro v3 §A7; F04/F05 | Reserva y estados reales, sin bandeja inventada |
| H5; FR-014 | Maestro v3 §A7; F06/F06.1 | Conversación y negativos clínicos con mock |
| H6; FR-008/015 | Maestro v3 §A6–A7; F07 | Consentimiento y propuesta/revisión TEST |
| H7; FR-002–005/017–020 | Maestro v3 §A7; Constitution IV/VIII/XIII | Responsive, teclado, seguridad y regresión |

Los 16 criterios docentes permanecen trazados en Constitution y evidencias históricas; F08 aporta evidencia de interfaz, SDD, integración, seguridad y pruebas sin asignar puntajes ni afirmar aprobación de la rúbrica.

## Aclaraciones de alcance registradas

1. Las funciones F05 visibles se limitan a estados contractuales ya accesibles; una bandeja requiere un futuro contrato aprobado.
2. Las capacidades GEO de F07 son solo TEST/DEMO. La aceptación F07 no autoriza concederlas en base persistente ni abrir el mapa a uso productivo.
3. F08 conserva las reglas F01–F07 y no inicia F09/F10, Gemini real ni contenido farmacológico pendiente de validación profesional.

**Aprobación humana:** especificación y plan F08 aprobados conjuntamente por el responsable del proyecto en esta conversación el 2026-11-18 (respuesta «sí»). Esta aprobación habilita tareas y ejecución dentro del alcance descrito; la aceptación final de F08 permanece pendiente de evidencias y revisión humana.
