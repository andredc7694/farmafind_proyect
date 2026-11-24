# F04.1 — Registro de aprobaciones

## Aprobación de spec.md
**Fecha:** 2026-11-24. **Responsable:** Andre. **Fuente:** mensaje «apruebo» tras la entrega de la spec (commit `3562b8b`). **Alcance:** spec.md tal como se presentó (4 historias, 14 FR, 6 SC).

## Decisiones D-01, D-02 y D-03
Andre aprobó la spec sin elegir A/B/C. Por su regla de trabajo continuo («decisiones que se resuelvan con tu recomendación; regístralas para revisión»), **Claude aplicó sus recomendaciones A/A/A** y las deja registradas aquí y en `ESTADO.md` para que Andre las revise o cambie cuando quiera (cambiarlas es barato mientras no se implemente el lote afectado):
- **D-01 = A**: sin horario semanal; la preferencia (30/60/120 min o una franja) debe caber dentro del plazo de recogida configurado de la farmacia, contado desde la creación (como el vencimiento real nunca es anterior a ese límite, siempre cabe).
- **D-02 = A**: exportación CSV del historial de la farmacia activa, con filtros de estado y fechas, sin datos personales del cliente (solo un código de reserva).
- **D-03 = A**: actualización automática por consulta periódica cada 30 s, tolerante a cortes de red.

## Aprobación de plan.md y tasks.md
**Fecha:** 2026-11-24. **Responsable:** Andre. **Fuente:** mensaje «apruebo» tras la entrega del plan y las 19 tareas (commit `3af0133`). **Alcance:** plan.md, research.md, data-model.md, contrato `reservations-ops.openapi.yaml`, quickstart.md y tasks.md. Autoriza implementar por lotes hasta la aceptación humana.

## Aceptación humana de F04.1 (T019)
**Fecha:** 2026-11-24. **Responsable:** Andre. **Fuente:** mensaje «acepto» tras la entrega de la DEMO. Decisión: ACEPTO. Confirma D-01/D-02/D-03 = A y autoriza abrir y fusionar el PR con merge commit (regla permanente).
