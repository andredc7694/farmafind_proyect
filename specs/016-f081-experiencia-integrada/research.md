# Research — F08.1

## D-R1 · Sin migraciones
Las funciones de la spec son presentación o lecturas sobre datos que existen: `tema` ya está en `f01.perfil_usuario` (F01.1, `GET/PATCH /me/profile`), la búsqueda ya admite precio y orden por cercanía (`GET /busquedas`), y los datos del resumen están en `f04.reserva` y `f02.inventario` (RLS existente).

## D-R2 · Resumen por capacidad y por módulo
`can_reservation_action` exige rol DUENO/ADMINISTRADOR con la delegación; el inventario tiene su propia verificación (`inventory.read`). Un único resumen mezclaría ambas capacidades y cruzaría módulos; se divide en dos lecturas pequeñas y el panel pide solo las que el actor puede ver.

## D-R3 · Sugerencias sin función SQL nueva
`f03.search_public_offers(term, min, max, limit)` ya devuelve solo ofertas públicas (SECURITY DEFINER con RLS de proyección). Las sugerencias se derivan de sus filas (nombre comercial, principio activo, «concentración presentación»), sin duplicados y con tope de 8. Un medicamento sin oferta pública jamás aparece.

## D-R4 · Tema y contraste
Variables CSS por tema (`:root` claro, `[data-theme='dark']`, `prefers-color-scheme` cuando `data-theme='system'`/ausente). La razón de contraste WCAG se calcula con una función propia (`contrast.js`) y se verifica por pares de tokens en ambos temas (texto ≥ 4.5:1, bordes/controles ≥ 3:1).

## D-R5 · Persistencia del tema
Con sesión: `PATCH /me/profile {theme}` (ya validado en F01.1). Sin sesión: `localStorage['ff-theme']` (solo CLARO/OSCURO/SISTEMA, sin datos personales); si el almacenamiento falla, tema del sistema. Al iniciar sesión, el valor del perfil gana y se refleja en el navegador.

## D-R6 · Ubicación puntual y a mano
GPS con `navigator.geolocation.getCurrentPosition` una sola vez tras un clic de consentimiento; no se usa `watchPosition` ni se guarda. A mano: clic/teclado en el mapa de F07 (OpenStreetMap solo tras clic informado); sin mapa, se pide ciudad como en `NearbyPharmacies`.

## D-R7 · Burbuja de chat
Se reutiliza `conversation-client` (F06.1 mock). La burbuja guarda la conversación solo en memoria de la pestaña; el panel usa `role="dialog"` no modal, foco al abrir y retorno al botón al cerrar; no cubre el contenido principal (anclada a la esquina, con tamaño máximo y reducible).

## D-R8 · Sugerencias por tipo (spec D-02)
1 y 2: endpoint público de sugerencias. 5: catálogo F02 ya autenticado (importador). 8: comparables derivados de los resultados. 9: estado de filtros en la URL. 10: preguntas sugeridas por reglas locales. 12: preferencias (tema, «recordar filtros») con consentimiento. 6 y 7: ya en F02.1. 3, 4 y 11: diferidas.
