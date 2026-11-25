# F08.1 — Guía de revisión humana (DEMO local, datos ficticios)

Base TEST efímera (nunca `farmafind_f01_test`), dos farmacias (Alfa y Beta), cinco ofertas públicas y seis cuentas ficticias. Las cuentas y claves te las entrega Claude en el mensaje de entrega (no están en el repositorio). Todo funciona sin conexión a internet salvo las imágenes del mapa, que solo se piden si pulsas «Mostrar el mapa».

- **Dirección:** http://127.0.0.1:5173/

## Recorridos (≈20 min)
1. **Visitante (sin iniciar sesión).** Menú: Inicio, Buscar medicamentos, Farmacias cercanas, Registrar mi farmacia, FarmaFind AI y Mi cuenta (nada de reservas ni paneles). Cambia el **Tema** (arriba a la derecha) a Oscuro: se aplica al instante y se recuerda al recargar.
2. **Búsqueda.** «Buscar medicamentos»: escribe «para»; aparecen sugerencias (↓ y Enter con teclado). Elegir una sugerencia **no** busca; pulsa «Buscar». Verás ofertas con precio, fecha de revisión y «También en: …» (comparables). Prueba «Filtros de precio y orden» (se pliegan), el orden y «Recordar estos filtros» (solo guarda precio y orden en tu navegador). «Escribir mi ubicación a mano» permite ordenar por «Cercanía» sin GPS.
3. **Mapa/farmacias cercanas.** «Ver farmacias en el mapa» (o «Farmacias cercanas»): funciona por ciudad sin mapa; el mapa pide un clic informado.
4. **Chat flotante.** Botón «Preguntar a FarmaFind AI» (abajo a la derecha): las preguntas sugeridas solo **rellenan** el campo; tú envías. Respuesta informativa (modo de prueba, sin modelo externo). Esc lo minimiza y conserva la conversación.
5. **Cliente.** Inicia sesión (Mi cuenta): ves «Mis reservas», **no** ves paneles de farmacia. Cambia el tema a Oscuro y cierra sesión; en otro navegador/ventana privada vuelve a entrar: el tema oscuro llega solo (viaja con tu perfil).
6. **Propietario Alfa.** «Panel de farmacia»: ocho secciones en este orden: Resumen, Farmacia y ubicación, Inventario, Importar, Reservas, Historial, Personal y Configuración. «Resumen» muestra cifras **solo de Alfa**. En «Farmacia y ubicación»: «Usar mi ubicación una vez» (el navegador pregunta) o escribir latitud/longitud; el mapa solo si pulsas «Mostrar el mapa…»; hay que marcar la confirmación de la dirección para enviar.
7. **Trabajador.** Ve el panel con solo «Resumen» e «Inventario». **Hallazgo abierto:** el servidor no le entrega las cifras (F02/F04 solo atienden a propietarios/administradores) y la pantalla lo dice. Decisión de Andre (2026-11-24): opción A como incremento aparte (spec propia); por ahora se queda así (C). Ver `convergence.md`.
8. **Revisor.** Ve «Ubicación de farmacia»; no ve personal, reservas ni inventario.
9. **Propietario Beta.** Ve solo Beta; si escribes a mano una dirección de Alfa en la API, el servidor la deniega.
10. **Teclado y móvil.** Navega con Tab (foco visible y ordenado, «Saltar al contenido» primero) y reduce la ventana a ~360 px: no debe haber desplazamiento horizontal.

## Qué debes decidir
Si lo visto cumple la spec (F081-FR-001–017, SC-001–008): **ACEPTO**, **ACEPTO CON OBSERVACIONES** o **RECHAZO**. El hallazgo H-1 (trabajadores) ya está decidido: incremento aparte, ver `convergence.md`.
