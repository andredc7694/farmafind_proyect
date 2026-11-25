# F08.1 — Analyze / Converge (diferencias contra la spec)

| # | Hallazgo | Tratamiento |
|---|---|---|
| H-1 | **Trabajadores con permisos delegados (F01.1) no ven cifras**: F02/F04 exigen rol DUENO/ADMINISTRADOR y el servidor las deniega. La pantalla lo dice con honestidad y no inventa números. | **Decisión de Andre (2026-11-24): opción A como incremento aparte**, después de cerrar F08.1, con SDD completo (spec, plan y tasks para su aprobación): ampliar F02/F04 para honrar la delegación explícita y vigente del trabajador, con pruebas RLS Alfa/Beta. **Mientras tanto queda la situación actual (C)**. Documentado en `demo-guide.md` y `ESTADO.md` (pendientes). |
| H-2 | El resumen de inventario deniega con **404** (no 403) para no revelar la farmacia. | Contrato corregido (`experience.openapi.yaml`); el de reservas sigue en 403. |
| H-3 | El conmutador lista/mapa es un enlace a `/mapa?q=`, no un estado interno. | Aceptable; conserva el término. |
| H-4 | «Importar» e «Inventario» muestran la misma vista `InventoryView` filtrada por capacidades. | Aceptable (decisión menor, reversible). |
| H-5 | Fuera de alcance por D-01/D-02: MEJ-011 y sugerencias 3/4/11. | Sin cambios; diferidas. |

Sin contradicciones abiertas entre spec, plan, tasks y código. Sin migraciones ni datos nuevos persistidos (FR-014).
