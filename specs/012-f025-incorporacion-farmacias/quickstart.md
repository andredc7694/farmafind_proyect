# F02.5 — Guía de validación futura y demostración manual

**Estado:** procedimiento de aceptación propuesto. F02.5 aún no está implementado; estas acciones no se han ejecutado ni constituyen evidencia. No ejecutar migraciones sobre `farmafind_f01_test`.

## Preparación segura cuando exista código aprobado

1. Confirmar rama F02.5, cambios locales preservados, aprobaciones formales de spec/plan y resolución normativa del orden F02.5 antes de F09. Verificar que la base destino sea **nueva y efímera**, con nombre TEST permitido; comprobar roles sin SUPERUSER/BYPASSRLS y migraciones F01–F07.
2. Revisar las migraciones F02.5, aplicarlas solo a TEST y ejecutar controles de esquema, RLS, FORCE RLS y grants. Provisionar **una sola vez** el revisor global TEST mediante BOOT-01 offline autorizado y expediente ignorado por Git; asignar capacidades F02.5 mediante expediente offline específico. Nunca usar ese mecanismo en base persistente.
3. Arrancar una sola API integrada, frontend React, PostgreSQL TEST, Redis TEST y Notificaciones local conforme a la guía operacional que produzca la implementación. No arrancar servidores duplicados ni publicar puertos de datos. Las URL/comandos exactos se registrarán tras verificarlos; no se inventan aquí.

## Recorrido humano de cinco establecimientos

1. Como visitante, buscar y comparar sin iniciar sesión.
2. Registrar cinco cuentas ficticias normales y, desde cada una, elegir «Registrar mi farmacia», guardar/enviar una solicitud distinta. Verificar que ninguna recibe panel antes de aprobación.
3. Como revisor global TEST, revisar cada solicitud desde el panel, observar/rechazar una solicitud de prueba y aprobar cinco solicitudes válidas con motivo. Confirmar que se crearon cinco farmacias y cinco membresías de dueño, no inventarios.
4. Como cada dueño, seleccionar su farmacia, descargar plantilla CSV, cargar un archivo pequeño con precios/stock diferentes, revisar errores por fila y confirmar. Probar también XLSX con el contrato F02 real. No precargar inventario mediante script.
5. Como Alfa, manipular URL, cuerpo, cabecera, IDs y archivo para acceder a Beta: esperar denegación en inventario, importaciones, reservas, trabajadores, ubicación y documentos. Repetir con rol runtime SQL y con Beta→Alfa; comprobar cambio de tenant y revocación.
6. En ventana pública, comparar ofertas publicables de las cinco farmacias, probar cercanía solo con ubicaciones DEMO autorizadas; iniciar sesión cuando se solicite reserva y verificar revalidación de disponibilidad. Confirmar/gestionar la reserva únicamente en su farmacia según F04.
7. Revisar auditoría y notificaciones locales sin correo/SMS. Registrar resultados, capturas depuradas, versión, entorno, fecha y limitaciones. Detener procesos F02.5 sin borrar volúmenes ni tocar la base persistente.

## Comprobaciones automáticas previstas

Unitarias de estados/deduplicación; API y contratos OpenAPI; PostgreSQL RLS Alfa/Beta y roles; concurrencia de aprobación/importación; CSV/XLSX y protección de archivos; Redis/fallback; regresión F00–F08; TypeScript/build; `npm audit`; Playwright en entorno oficialmente compatible; `git diff --check` y revisión de secretos. Cada resultado se registrará como **ejecutado, fallido u omitido con motivo**. No marcar tareas ni criterios como aprobados por este documento.
