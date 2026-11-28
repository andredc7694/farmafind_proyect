# Research — F06.2

## R-01 · Por qué no entiende frases naturales
- `MockConversationProvider.classify` exige palabras como «precio», «busca», «cuesta» o «dónde hay» (regex `SEARCH`), o un nombre suelto de ≤ 4 palabras. «¿En qué farmacia el ibuprofeno está más barato?» no cumple ninguna → `ASK_TERM`/`HELP`.
- `medicineTerm` solo recorta palabras de relleno de los extremos: deja «ibuprofeno está más barato» si no recorta el medio.

## R-02 · Encontrar el medicamento sin SQL (D-02 A)
- La búsqueda F03.2 (`f03.search_public_offers_terms`) ya devuelve ofertas cuyo nombre o principio activo contiene alguna palabra. Quitando antes las palabras de pregunta, se toman los nombres y principios activos de las ofertas devueltas que aparecen **completos** en la frase limpia (comparación por palabras enteras), prefiriendo el más largo.

## R-03 · «¿Quisiste decir…?» sin SQL (D-03 A)
- Palabras desconocidas de ≥ 5 letras: búsqueda F03.2 con su prefijo de 5 letras (y de 4 si no hay); de los nombres devueltos se elige el de menor distancia Damerau-Levenshtein (≤ 2). «ibuprofemo» → prefijo «ibupr» → «ibuprofeno» (distancia 1). «amoxisilina» → «amoxi» → «amoxicilina» (distancia 1).
- Límite conocido: un error en las primeras letras («ivuprofeno») no se recupera.

## R-04 · Forma farmacéutica (ajuste D-04)
- El catálogo real de la DEMO usa «caja x 30» o «frasco 120 ml»: la forma no consta. Por regla de Andre, esas filas no se ofrecen como alternativa.
- Formas reconocidas por palabra (singular, sin tildes): tableta/comprimido/gragea, cápsula, jarabe, suspensión, solución, gotas, crema, gel, ungüento/pomada, inyectable/ampolla, supositorio, óvulo, polvo/sobre, parche, spray/inhalador.

## R-05 · Emergencias (D-08)
- Verificado el 2026-11-27 en gob.pe: SAMU 106 (Minsa; gratuito, cualquier operador, 24 h; https://www.gob.pe/1013-solicitar-atencion-medica-en-caso-de-emergencia-samu), Policía 105 (https://www.gob.pe/institucion/pnp/contacto-y-numeros-de-emergencias), Bomberos 116 (CGBVP).

## R-06 · Memoria sin servidor (D-01 A)
- Hoy `InMemoryConversationStore` guarda 15 min / 6 turnos en el servidor. Con `contexto` enviado por la página, el servidor no guarda nada y recargar borra la conversación. El `contexto` solo contiene parámetros de búsqueda públicos, validados como cualquier consulta: no da acceso a nada nuevo.

## R-07 · Horario «abierta ahora»
- `f07.list_public_pharmacies(ciudad)` (farmacias activas por ciudad) y `ReadPublicOpeningHours` (horario público con caché). Hora de Lima (UTC-5, sin horario de verano).
