# Aprobaciones F06.2 — Asistente FarmaFind AI mejorado

## 2026-11-27 · Pedido de Andre
- Panel más grande e interactivo en computadora (burbuja en celular sin tapar botones); preguntas rápidas; frases naturales con la limpieza de F03.2 (precio, cercanía con el distrito de la búsqueda, horario F07.1, genérico o marca por principio activo); tarjetas compactas (3) con «Ver todas en Buscar medicamentos» y mensaje claro sin resultados; aclaraciones con botones; «¿Quisiste decir…?» sin servicios ni librerías nuevas sin consultar; memoria solo mientras está abierto; contexto de pantalla; seguridad visible (dosis, diagnóstico y síntomas → químico farmacéutico; emergencias con el número oficial del Perú verificado).
- Reglas: solo datos públicos; sin cambiar las reglas de publicación de F03; si hace falta SQL, contrato o caché, presentarlo con su hash; proveedor en MOCK, sin Gemini ni pago; accesible con teclado; copia temporal 3001/5174 con datos ficticios; no tocar la DEMO.
- Registrar como pendientes de segunda etapa: «mis reservas» con sesión, asistente para dueños y trabajadores, botones «útil / no útil». Hecho en `ESTADO.md`.

## Pendiente (resuelto el 2026-11-27)
- Aprobación de `spec.md` y de las decisiones D-01 a D-10.

## 2026-11-27 · Spec aprobada
- Andre: «Apruebo la spec del asistente mejorado (F06.2, commit 69ef164) con las diez decisiones en A (D-01 a D-10)», con ajustes:
  - **D-04:** solo productos con el mismo principio activo, la misma concentración **y la misma forma farmacéutica**; si la forma no está clara en el catálogo, no se muestra como alternativa. Aviso «Consulta al químico farmacéutico antes de cambiar de producto»; nunca «es equivalente» ni «puedes reemplazarlo»; etiqueta «Mismo principio activo y concentración», no «genérico».
  - **D-08:** el aviso de emergencia aparece antes que cualquier otra respuesta y no se mezcla con tarjetas de productos.
  - **D-06:** el panel en computadora no debe tapar los resultados de forma que no se puedan usar; si los tapa, se minimiza con un clic y recuerda estar minimizado durante la visita.
- Siguiente: plan y tasks para su aprobación antes de programar. No tocar la DEMO.

## Pendiente
- Aprobación de `plan.md` y `tasks.md` (sin SQL).
