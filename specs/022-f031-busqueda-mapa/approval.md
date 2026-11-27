# Aprobaciones F03.1 — Búsqueda simplificada y mapa

## 2026-11-26 · Pedido de Andre
- Pide simplificar «Buscar medicamentos» y agregar un mapa interactivo (partes 1 y 2, reglas 12 a 15), en su propia rama creada desde `main` `264469c` y siguiendo SDD.
- No se programa antes de su aprobación.
- Si algo choca con lo aprobado, se prepara una enmienda o una spec nueva para su aprobación.

## Pendiente (resuelto el 2026-11-26)
- Aprobación de `spec.md` y decisiones D-01 a D-08.

## 2026-11-26 · Spec aprobada
- Andre: «Apruebo la spec de F03.1 (commit 8d6869b) con las ocho decisiones en A (D-01 a D-08)».
- Condiciones:
  - `farmacia.ubicacion` lleva coordenadas solo de farmacias con ubicación verificada, igual que F07. No se publica ninguna otra farmacia ni ningún dato nuevo.
  - Si la ubicación no está verificada, el campo va en `null` y la lista muestra la dirección en texto.
  - Se actualizan el contrato OpenAPI y el validador de la caché.
  - Hay que probar que las entradas viejas de la caché se descartan sin error.
- Siguiente: plan y tasks para su aprobación antes de programar. No tocar la DEMO.

## 2026-11-26 · Plan y tasks aprobados
- Andre: «Apruebo plan y tasks de F03.1 (commit 250ac70). Puedes empezar a programar».
- Pide explicar cómo decide la API que F07 está activa y dejar anotado el valor necesario para la DEMO. En T016, mostrar en la copia 3001/5174 con credenciales ficticias y el recorrido exacto. No tocar la DEMO, su base ni su Redis.

## 2026-11-26 · Revisión de Andre en la copia (antes de aceptar)
- Pide:
  - limitar «¿Dónde buscas?» a los 16 distritos de Huamanga, con el resto del Perú desactivado por configuración y sin duplicados;
  - filtrar al escribir, sin tildes;
  - abrir el mapa centrado en Huamanga;
  - alinear la casilla.
- Si la lista es compartida con «Mi farmacia», quiere conocer antes el efecto y que no se cambie allí sin su aprobación. Si algo contradice la spec, enmienda antes.
- Hecho, sin contradecir la spec: filtro al escribir, centro en Huamanga y casilla alineada.
- **Pendiente de aprobación:** enmienda E-01 (`enmienda-lugares-huamanga.md`), opción A recomendada.
