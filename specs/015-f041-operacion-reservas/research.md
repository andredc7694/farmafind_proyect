# Research — F04.1

## D-R1 · ¿Dónde guardar la preferencia?
- **Decisión**: tabla `f04.preferencia_recogida`, 1:1 con `f04.reserva`, inmutable (solo `SELECT`/`INSERT`).
- **Por qué**: `f04.reserva` tiene un CHECK de coherencia estado/vencimientos y la política del worker de expiración la actualiza con permisos mínimos; añadir una columna obligaría a revisar ambos y la función `reserve_stock` (crítica para AC05). Una tabla aparte no toca el camino de stock.
- **Alternativa descartada**: columna `preferencia` en `reserva` + cambio de `reserve_stock` (riesgo sobre concurrencia 10/100).

## D-R2 · «Dentro de horario» (D-01 = A)
- No existe horario de atención en ningún esquema (`horario` no aparece en migraciones ni specs). Crearlo sería un incremento propio.
- Regla adoptada: la preferencia debe caber en `[creación, creación + plazo_recogida]`. Como el vencimiento real = `confirmación + plazo` y la confirmación ocurre después de la creación, cabe siempre y **no amplía** F04-TIME-01.
- Una franja es un par `inicio/fin` con duración 15–120 min dentro de esa ventana; los minutos (30/60/120) deben ser ≤ plazo×60.

## D-R3 · Actualización automática (D-03 = A)
- Sondeo cada 30 s (`setTimeout` encadenado, no `setInterval`, para no apilar peticiones), pausa si la pestaña está oculta (`document.visibilityState`), reintento con espera 30→60→120 s tras fallos y reanudación al volver la conexión (`online`).
- El cliente reemplaza su lista por la instantánea del servidor (`generatedAt` monótono: descarta respuestas más viejas que la ya aplicada). Eso garantiza cero duplicados y cero acciones.
- Eventos en tiempo real (SSE/WebSocket) quedan fuera: exigirían infraestructura nueva y control de conexiones por farmacia.

## D-R4 · Exportación (D-02 = A)
- CSV UTF-8 con BOM para Excel; columnas: código (primeros 8 caracteres del UUID), estado, medicamento, cantidad, creada, confirmada, vence, cerrada, motivo, preferencia. Sin nombre, correo ni teléfono del cliente.
- Tope 5000 filas con `X-Export-Truncated: true`. Neutralización de fórmulas (`'` delante de `= + - @ \t \r`).
- Capacidad: `reservation.read` (no se crea un permiso nuevo; los permisos de F04 se conservan).

## D-R5 · Paginación del historial
- Cursor opaco base64url de `(creado_en, id)` con orden descendente; índice existente `reserva_cola_idx` y `reserva_propietario_fecha_idx` no cubren exactamente: se añade `reserva_historial_idx (farmacia_id, creado_en DESC, id) WHERE estado IN ('ENTREGADA','CANCELADA','EXPIRADA')`.

## D-R6 · Nombre del medicamento en la cola
- Se une `f02.medicamento` (catálogo, lectura permitida al rol runtime) para mostrar nombre/concentración; si el rol no pudiera leerlo, se muestra el identificador y se registra como hallazgo. (Se verifica en el lote 1.)

## D-R7 · Qué no se toca
`f04.reserve_stock`, `f04.close_reservation_stock`, worker de expiración, Outbox y políticas existentes de `f04.reserva`.
