# F02.5 — demostración manual TEST en Windows 10

**Estado comprobado el 2026-11-22:** la DEMO está disponible en http://127.0.0.1:5173/. La base manual F02.5 es distinta de `farmafind_f01_test`: conserva **HUAMANFAR aprobada y cero filas de inventario**. El arranque aplicó las migraciones TEST 014–015 al slot manual sin borrar sus datos. T046, T057 y T063 siguen pendientes de tus acciones y aceptación.

## Arranque, cuentas y archivos

Desde PowerShell en la raíz del repositorio:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/f025/demo-run.ps1
```

Abre **http://127.0.0.1:5173/**. El script comprueba PostgreSQL TEST, Redis, API, frontend y CSRF. Si falla, consulta los mensajes y los logs privados de `.cache/f025-docker/`; no cierres procesos desconocidos ni reinicies la base. La DEMO no necesita el proceso F05 para este recorrido y no acredita entrega visual de avisos.

La cuenta de **revisor de plataforma TEST** está solo en `.cache/f025-docker/credentials.manual.local.json`. Ábrela localmente; nunca copies su contenido a Git, capturas o chat. Para HUAMANFAR usa la cuenta solicitante que ya creaste. Crea cuatro cuentas normales ficticias más para solicitar las otras farmacias y una cuenta normal de cliente para reservar. El revisor no es propietario ni tiene acceso general a inventarios.

Los cinco CSV ya preparados están en:

| Farmacia de destino | Archivo local ignorado por Git | Precio | Stock |
|---|---|---:|---:|
| HUAMANFAR | `.cache/f025-docker/imports/farmacia-01.csv` | S/ 10.00 | 4 |
| Farmacia Alfa TEST | `.cache/f025-docker/imports/farmacia-02.csv` | S/ 11.00 | 5 |
| Farmacia Beta TEST | `.cache/f025-docker/imports/farmacia-03.csv` | S/ 12.00 | 6 |
| Farmacia Gamma TEST | `.cache/f025-docker/imports/farmacia-04.csv` | S/ 13.00 | 7 |
| Farmacia Delta TEST | `.cache/f025-docker/imports/farmacia-05.csv` | S/ 14.00 | 8 |

Cada CSV contiene una fila ficticia y la referencia exacta del catálogo TEST, con encabezado `nombre,concentracion,presentacion,clasificacion,precio,cantidad`; no incluye `farmacia_id`. La interfaz descarga una plantilla CSV y admite CSV/XLSX. MEJ-001 no está implementada. Si cambia la base manual, comprueba la referencia antes de importar con `(Get-Content .cache/f025-docker/catalog-fixture.manual.local.json | ConvertFrom-Json).name`.

## Recorrido que debes hacer en Chrome

En cada paso registra fecha, cuenta ficticia, resultado y una captura **sin contraseñas, cookies ni tokens**.

| Paso | URL / cuenta | Acción | Resultado esperado | Si falla |
|---|---|---|---|---|
| 1 | `/search`, sin sesión | Abre **Buscar medicamentos** y busca la referencia TEST. | La búsqueda pública responde; HUAMANFAR aún no ofrece inventario. | Comprueba `http://127.0.0.1:3000/health`. |
| 2 | `/identity`, solicitante de HUAMANFAR | Inicia sesión; abre **Mis solicitudes** en `/farmacias/solicitar`. | HUAMANFAR figura **APROBADA**. No dupliques la solicitud. | Confirma que usas la cuenta solicitante. |
| 3 | `/farmacias/panel`, propietario de HUAMANFAR | Selecciona la farmacia; abre inventario, pulsa **Importar inventario**, carga `farmacia-01.csv` y pulsa **Preparar vista previa**. | Una fila, cero incidencias, S/ 10.00 y stock 4. | Compara encabezado y nombre del producto; no confirmes con errores. |
| 4 | Mismo panel / propietario | Pulsa **Confirmar archivo completo** y abre inventario e historial. | Producto y movimiento propios persistidos. | Guarda código y mensaje; no repitas la confirmación a ciegas. |
| 5 | `/farmacias/solicitar`, cuatro cuentas normales nuevas | Registra solicitudes ficticias distintas para Alfa, Beta, Gamma y Delta; guarda borrador, envía y abre **Mis solicitudes**. | Cada una queda **PENDIENTE**. | Corrige solo la solicitud afectada; conserva los datos previos. |
| 6 | `/admin/farmacias/solicitudes`, revisor TEST | En **Revisar solicitudes**, abre cada una, registra motivo de al menos ocho caracteres, pulsa **INICIAR REVISIÓN** y luego **APROBAR**. | Cuatro decisiones auditadas y cuatro farmacias activadas. | Si no aparece el panel, confirma la cuenta del revisor; no cambies estados por SQL. |
| 7 | `/farmacias/panel`, cada nuevo propietario | Cierra sesión entre cuentas. Selecciona su farmacia y repite vista previa y confirmación con CSV 02, 03, 04 o 05. | Cinco inventarios con precios y existencias distintos. | Comprueba aprobación y cuenta solicitante original. |
| 8 | `/search`, sin sesión | Busca la referencia TEST y compara las ofertas. | Cinco ofertas publicables; ningún dato interno. | Revisa importación y estado activo de la farmacia faltante. |
| 9 | `/reservations`, cliente normal | Desde una oferta pulsa **Solicitar reserva**, inicia sesión si se solicita y completa el flujo. | Reserva visible para cliente y farmacia correspondiente. | Guarda código/mensaje; comprueba sesión y selección. |
| 10 | `/farmacias/panel`, propietarios y revisor | Prueba rutas privadas de otra farmacia cambiando selección o identificador. | Inventario, reservas y trabajadores ajenos denegados. | **Cualquier acceso cruzado es crítico:** detén la prueba y repórtalo. |

Para probar rechazo, crea una **sexta solicitud TEST** y recházala con motivo; no cuenta entre las cinco activas. No utilices datos reales. El formulario no acredita habilitación legal o sanitaria.

Registra por farmacia: cuenta, estado de solicitud, decisión, CSV, vista previa, confirmación, precio, stock, oferta, reserva y denegación ajena. Las pruebas automatizadas no reemplazan estas acciones. **No se deben marcar T046/T057 ni aprobar T063 antes de completar y revisar tu recorrido.**

Para detener solo lo iniciado por la DEMO, conservando bases y volúmenes:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/f025/demo-stop.ps1
```

La evidencia técnica reciente incluye 46/46 comprobaciones PostgreSQL RLS, 33/33 comandos de solicitudes y 18/18 pruebas F04. El Playwright Linux previo utilizó un slot técnico separado; no representa tu demostración personal.
