# F01.2 — Converge
Sin diferencias contra la spec. D-01=A (solo capacidades ya delegables) y D-02=A (historial por `reservation.read`; el E2E muestra «Historial» al trabajador con esa capacidad). Observación: `STAFF_DELEGABLE_CAPABILITIES` ya impide delegar `membership.manage`; aun si una fila existiera, las funciones SQL la rechazan para TRABAJADOR (probado).
Cierra el hallazgo H-1 de F08.1.
