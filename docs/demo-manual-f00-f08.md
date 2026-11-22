# FarmaFind: DEMO manual local F00–F08

La DEMO usa una base PostgreSQL TEST independiente de `farmafind_f01_test`, datos ficticios y un único backend F01–F07. No ejecuta BOOT-01, GLO-01, Gemini ni recursos externos de pago. La creación inicial de farmacias y membresías administrativas es exclusiva del fixture TEST; el registro público crea solo clientes.

## Inicio en Windows 10

Desde la raíz del repositorio, con Node.js/npm instalados:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/demo/start.ps1
```

El comando inicia Docker Desktop si hace falta, PostgreSQL y Redis locales, compila los componentes e inicia API, Notificaciones locales y frontend. Si la base DEMO no existe, la crea una sola vez; los siguientes arranques reutilizan esa base y conservan los cambios manuales. Rechaza puertos 3000, 3001 y 5173 ocupados; no detiene procesos desconocidos. Si habías iniciado el lanzador F07 anterior, detén solo esos procesos conocidos antes de usar este comando.

Abrir **http://127.0.0.1:5173/**. La API está en `http://127.0.0.1:3000/health`; Notificaciones locales en `http://127.0.0.1:3001/health`. Redis escucha únicamente en `127.0.0.1:56379` y PostgreSQL en `127.0.0.1:55431`. La base principal conserva sus filas; la DEMO se identifica con un sufijo aleatorio y marca TEST.

Las cinco credenciales ficticias están únicamente en el archivo ignorado por Git `.cache/manual-demo/credentials.local.json`. Ábrelo localmente con `notepad .cache/manual-demo/credentials.local.json`; no lo copies a Git, capturas ni mensajes. Las claves de base de datos permanecen en `.cache` y nunca entran en React. Los nombres de cuenta son `cliente`, `adminAlfa`, `revisorAlfa`, `adminBeta` y `revisorBeta`. El administrador de plataforma no tiene cuenta DEMO: su procedimiento y permisos no constituyen un panel de alta de farmacias.

## Recorridos en Chrome

**Cliente:** abre `/identity`, inicia sesión con `cliente` o crea una cuenta nueva usando correo ficticio. Abre `/search`. Antes de importar inventario habrá un estado vacío; después busca `producto demo`. Abre `/mapa`, introduce `lima` y pulsa **Buscar farmacias**. El mapa externo es opcional y solo carga teselas tras consentimiento. Desde una oferta de `/search`, pulsa **Solicitar reserva** y confirma en `/reservations`. Una reserva necesita stock publicado, por lo que primero debe completarse la importación manual de la farmacia.

**Farmacia Alfa:** abre otra ventana de incógnito, inicia sesión en `/identity` con `adminAlfa`, pulsa **Farmacia Alfa DEMO** en el selector y abre `/inventory`. Allí están la revisión física, **Importar inventario**, la vista previa, **Confirmar archivo completo** y el historial. Descarga la plantilla CSV desde el enlace visible en esa sección, edítala localmente, selecciónala en **Archivo CSV o XLSX**, pulsa **Preparar vista previa**, revisa las incidencias y solo entonces pulsa **Confirmar archivo completo**. La confirmación aplica el archivo completo o nada. Después consulta el inventario y busca `producto demo` desde `/search`. En `/reservations`, vuelve a seleccionar Alfa para ver la cola, confirmar una reserva y marcar entrega según los permisos. La cuenta `adminBeta` permite comprobar que Alfa no accede a Beta. La ubicación de farmacia se gestiona en `/ubicacion`, con propuesta y revisión por cuentas distintas de la misma farmacia.

La plantilla descargable está en `frontend/public/plantilla-inventario-demo.csv`. Sus columnas reales son `nombre,concentracion,presentacion,clasificacion,precio,cantidad`; admite CSV UTF-8 y XLSX con una sola hoja. Las referencias deben coincidir con el catálogo TEST; no hay alta de catálogo desde el navegador. La plantilla contiene dos filas ficticias con precio y cantidad vacíos para que los completes antes de subirla. No se carga automáticamente. El importador limita tamaño, filas y contenido XLSX según F02. Si hay errores, la vista previa los muestra y bloquea la confirmación. Un archivo idéntico ya previsualizado produce `409`; modifica su contenido para iniciar una nueva vista previa.

**Notificaciones:** F05 entrega eventos solo localmente, sin correo/SMS/push ni bandeja visual. Tras crear o confirmar una reserva, el publicador DEMO procesa el Outbox. Consulta solo contadores sin datos privados con `node scripts/demo/status.mjs`. Las reservas vencidas requieren ejecutar el worker de expiración aprobado; el lanzador no lo ejecuta automáticamente.

**Asistente:** `/assistant/conversation` utiliza proveedor determinista DEMO y datos públicos de F03. Las consultas clínicas personalizadas se rechazan; no se activa Gemini.

**Administrador general:** no existe en el frontend un formulario de alta de farmacias ni panel de solicitudes/aprobaciones. La API F01 tiene operaciones globales TEST restringidas a asignaciones de rol, pero no se habilitan cuentas ni procedimientos privilegiados para esta DEMO. Crear farmacias y asignar administradores fuera del fixture exigiría una especificación y autorización independientes.

## Comprobación y parada

```powershell
node scripts/demo/smoke.mjs
node scripts/demo/status.mjs
powershell -ExecutionPolicy Bypass -File scripts/demo/stop.ps1
```

El apagado predeterminado detiene solo los tres procesos que lanzó la DEMO y conserva PostgreSQL/Redis y todos los datos. Si esos contenedores locales no los usa otro trabajo y deseas apagarlos también, ejecuta `powershell -ExecutionPolicy Bypass -File scripts/demo/stop.ps1 -StopDataServices`. Ese parámetro no borra bases ni volúmenes. No uses `docker compose down -v`.

La comprobación automatizada Chrome está en `scripts/demo/browser-smoke.mjs`; usa Chrome instalado localmente y realiza inicio de sesión, selección de farmacia, vista previa CSV sin confirmar, búsqueda vacía, mapa y pantallas de reservas. La prueba en Chrome real del usuario y la importación confirmada manualmente siguen siendo pasos de uso; no se presumen por la prueba automatizada.
