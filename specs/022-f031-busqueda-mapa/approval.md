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
