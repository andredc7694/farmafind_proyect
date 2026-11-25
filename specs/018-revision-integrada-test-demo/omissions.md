# Omisiones, riesgos y pendientes (revisión integrada, 2026-11-24)

No se declara producción ni puntaje docente. Lo siguiente queda **abierto o no ejecutado**:

| # | Tema | Estado | Quién decide |
|---|---|---|---|
| 1 | F02.5: T046, T057, T063 y F025-RF23 | Pendientes humanos; F02.5 **no aceptada** (D-02 = A) | Andre |
| 2 | MEJ-011 (asistente de solicitud) y sugerencias 3/4/11 | Fuera hasta cerrar F02.5 (D-03 = A) | Andre |
| 3 | F06.1 T030/T044 (sin fuente clínica con revisor); F08 sin declarar aceptada | Pendientes | Andre |
| 4 | `f05:rls` y `f061 integration` aislados | No reejecutados (base marcada / requiere servidor TEST); el chat F06.1 sí se cubre en E2E | — |
| 5 | E2E heredado `f04` | No reproducible: su fixture persistente devuelve 404 en el centro de atención; el comportamiento está cubierto por `f041` 4/4 y por `integrated-flow`. Reconstruir esa fixture | Claude (pequeño, opcional) |
| 6 | Fixtures TEST persistentes anteriores a F01.1 (F01 demo, F02, F03, F04, F07) | Se les aplicaron las migraciones pendientes (solo bases marcadas TEST, nunca `farmafind_f01_test`); la F01-demo recibió también F02/F03/F04 al ser migrada con el mismo asistente | — |
| 7 | Pruebas sensibles a carga del equipo | E2E con Argon2id intermitentes si el equipo está ocupado (se amplió el expect de f011 a 20 s) | — |
| 8 | CI/CD (criterio 12) | No existe pipeline de GitHub Actions; solo controles locales | Andre (alcance) |
| 9 | DNS/CDN y AWS (criterio 10, F09) | No realizado; F09 solo manual y con autorización expresa de costos | Andre |
| 10 | Correo/SMS, proveedor de IA real, contenido farmacológico real | No habilitados (simulador de archivo y `MockAIProvider`) | Andre |
| 11 | Excepción SEC-EXC-DEV-2026-001 (dependencias de desarrollo) | Vence **2026-12-17**; revisar antes | Andre |
| 12 | `SECURITY DEFINER` con propietario capaz de escribir tablas FORCE RLS | Válido en TEST; revisar (Gate 6) antes de cualquier base persistente | Andre |
| 13 | Informe final del curso | No redactado; esta carpeta sirve de insumo | Andre |
