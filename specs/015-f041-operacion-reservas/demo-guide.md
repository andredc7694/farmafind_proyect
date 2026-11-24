# F04.1 — Guía de revisión humana (DEMO local, datos ficticios)

Base TEST efímera (nunca `farmafind_f01_test`), dos farmacias (Alfa y Beta) con 200 unidades de un medicamento ficticio cada una. Las cuentas y claves te las entrega Claude en el mensaje de entrega (no están en el repositorio).

- **Dirección:** http://127.0.0.1:5173/reservations
- **Cliente (para reservar):** usa esta dirección con los datos de la oferta: `http://127.0.0.1:5173/reservations?pharmacyId=<id de Alfa>&medicationId=<id del medicamento>` (te los entrego en el mensaje).

## Recorridos (≈10 min)
1. **Reservar con preferencia (cliente).** Entra con el cliente en la dirección con datos de oferta. Elige «En unos 60 minutos» (o «En una franja de hoy…» con horas de hoy). Lee el aviso: «es solo una orientación; no es una cita y no cambia el vencimiento». Pulsa «Solicitar reserva»: debe verse en «Mis reservas» como PENDIENTE con «Preferencia estimada…».
2. **Cola que se actualiza sola (propietario Alfa).** En otra ventana (o navegador privado) entra con el propietario Alfa → «Farmacia Alfa». Debe verse la reserva sin recargar (hasta 30 s) con su preferencia y el tiempo que falta. Mientras miras, el cliente crea otra y aparece sola.
3. **Confirmar.** Pulsa «Confirmar»: pasa a CONFIRMADA y muestra cuándo vence (confirmación + plazo de la farmacia, 4 h por defecto). La preferencia **no** cambia ese vencimiento; cambiar el plazo después no altera las ya confirmadas.
4. **Corte de red.** Desconecta la red o pon «sin conexión» en las herramientas del navegador: aparece «Sin conexión: se reintentará sola». Al volver la conexión la lista se pone al día sin duplicados y sin ejecutar nada por sí sola.
5. **Entregar / cancelar.** Entrega una confirmada; el cliente cancela una pendiente.
6. **Historial y CSV.** Pestaña «Historial»: filtra por estado y fechas, «Cargar más». «Descargar CSV»: abre el archivo; no debe tener nombre ni correo del cliente (solo un código corto).
7. **Aislamiento.** Entra con el propietario Beta → «Farmacia Beta»: no ve nada de Alfa.

## Qué debes decidir
Si lo visto cumple la spec (F041-FR-001–014, SC-001–006): **ACEPTO**, **ACEPTO CON OBSERVACIONES** o **RECHAZO**. También puedes cambiar D-01/D-02/D-03 (ver approval.md).
