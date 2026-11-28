# Quickstart F03.1 (copia temporal 3001/5174, datos ficticios)

La copia temporal usa datos ficticios: 4 farmacias activas. Tres tienen la ubicación verificada (en Ayacucho) y una no. Todas ofrecen «paracetamol» a precios distintos.

1. Abre http://localhost:5174/search, escribe «paracetamol» y pulsa Buscar.
   - Debe aparecer «Sin ubicación · Elegir» y los resultados ordenados por precio.
2. Pulsa «Elegir» → escribe «Ayacucho» → elige el lugar.
   - Debe aparecer «Cerca de: Ayacucho (aproximado) · Cambiar», con la distancia y el orden «Más cercano».
3. Abre «Filtros»: ahí están el precio mínimo y el máximo, «Recordar filtros» y otros órdenes.
4. Pulsa «Mapa».
   - Debes ver el aviso de privacidad, 3 marcadores con su precio y el círculo de tu punto.
   - La farmacia sin verificar no está en el mapa. En la lista aparece con «Ubicación no verificada».
5. Toca un marcador.
   - Debe abrirse una tarjeta con «Reservar» y la farmacia debe quedar resaltada en la lista. Elige otra en la lista: se resalta en el mapa.
6. Usa solo el teclado: Tab hasta los marcadores, Enter para abrir la tarjeta y Escape para cerrar el diálogo.
7. A 390 px: se ve la lista o el mapa, uno a la vez.
