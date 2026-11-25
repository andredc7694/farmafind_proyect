# Revisión integrada — Guía de DEMO (datos ficticios, TEST efímera)
Dirección: http://127.0.0.1:5173/ · Dos farmacias (Alfa y Beta), 5 ofertas públicas, 6 cuentas (credenciales en el mensaje de entrega, no en el repositorio).
Recorrido sugerido (~25 min), un actor por vez (usa ventanas privadas distintas):
1. **Visitante**: menú público, tema claro/oscuro/sistema, búsqueda «paracetamol» con sugerencias y comparables (precio, fecha de revisión, sin stock privado), farmacias cercanas por ciudad, chat flotante (modo de prueba).
2. **Cliente**: «Mis reservas»; reserva en Alfa (con preferencia de recogida) y revisa que no ve paneles de farmacia.
3. **Trabajador de Alfa** (permisos delegados: inventario y reservas): panel con Resumen, Inventario, Reservas e Historial; confirma la reserva. No ve Personal; no puede entregar (sin `reservation.deliver`).
4. **Dueño de Alfa**: ocho secciones; entrega la reserva; Historial y «Descargar CSV» (sin datos del cliente); Personal y Configuración.
5. **Dueño de Beta**: solo ve Beta; nada de Alfa (pruébalo escribiendo la ruta de Alfa).
6. **Revisor**: solo «Ubicación de farmacia».
7. **Accesibilidad**: Tab (foco visible, «Saltar al contenido»), ventana de ~360 px sin desplazamiento horizontal, tema oscuro.
Resultados técnicos de apoyo: `docs/evidencias/integration/review-2026-11/`; matrices y omisiones en esta carpeta (`matrix-mej.md`, `matrix-rubrica.md`, `omissions.md`).
Decide: **ACEPTO / ACEPTO CON OBSERVACIONES / RECHAZO** la revisión integrada (no equivale a declarar producción ni puntaje docente).
