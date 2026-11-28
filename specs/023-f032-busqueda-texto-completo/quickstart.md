# Quickstart — F03.2 (cómo comprobarlo)

## En la copia temporal (3001/5174)
1. Abrir `http://127.0.0.1:5174/search`.
2. Buscar y comprobar:
   - «paracetamol 500 mg tabletas x 10» → solo esa presentación (en las farmacias que la tengan).
   - «paracetamol 500» → las dos de 500 mg; no la de 1 g ni el jarabe.
   - «amoxicilina capsulas» → solo cápsulas.
   - «ibuprofeno 400mg» e «IBUPROFENO 400 MG» → lo mismo.
   - «acido acetilsalicilico» → el ácido acetilsalicílico.
   - «paracetamol 750 mg» → paracetamoles con el aviso «No encontramos esa presentación exacta; estas son otras disponibles».
   - «tabletas» y «500 mg» → ayuda «Escribe también el nombre del medicamento, por ejemplo: paracetamol 500 mg».
   - «xyzol 500 mg» → estado vacío de siempre.
3. Escribir «para» y elegir cada sugerencia: ninguna da 0.
4. Probar «Más barato», «Más cercano» y el mapa con una búsqueda exacta.

## Pruebas automáticas
- `npm --prefix backend test -- f032` y `npm --prefix frontend test -- f032`.
- Regresión completa de backend y frontend, `check`, contrato y rutas OpenAPI.
