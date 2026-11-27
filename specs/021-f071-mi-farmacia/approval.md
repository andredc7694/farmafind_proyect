# F07.1 — Aprobaciones

## 2026-11-26 · Spec aprobada
- **Andre: «apruebo»** la spec `spec.md` de «Mi farmacia: datos, ubicación y horario» (F07.1; parte de MEJ-006 y RF21, sin declarar MEJ-006 completa).
- Andre no respondió por separado las decisiones D-01 a D-05 ni la opción de T057. **Se aplican las recomendaciones (A en todas)** y quedan señaladas en el plan para que las confirme al aprobarlo: D-01 tabla propia de F07.1; D-02 se conserva la revisión por farmacia de F07, sin asignarla; D-03 un tramo por día y «Cerrado»; D-04 la propuesta nueva reemplaza a la pendiente; D-05 página propia «Mi perfil»; T057 opción A (hacerla ya, con el mapa como omisión pendiente de F07.1).
- Condiciones vigentes: no tocar la DEMO ni lo aprobado de F07 hasta aprobar spec **y plan**. El SQL de `GEO_LOCATION_PROPOSE` se muestra antes de ejecutarlo. F02.5 sigue SIN ACEPTAR (T057 y T063 sin marcar). Spec 020 en opción A.

## 2026-11-26 · Plan y SQL f025/017 aprobados
- **Andre aprueba el plan** de F07.1 y el SQL `f025/017_owner_location_test.sql` (hash `CC87C9880E82DAC6796F11A0755FA8E880ED45CB68EECF35A93C6FCE7F131B9A`, verificado por él contra el archivo de la rama). **Confirma D-01, D-02, D-03, D-04 y D-05 en opción A, y T057 en opción A.**
- Hash de la 017 registrado en `migrate-f025.ts` tras esta aprobación. **No se edita ninguna migración ni hash aprobado** (solo se añade la línea de la 017).
- Condiciones:
  - Antes de escribir o aplicar `f07/007` y `f07/008`, mostrar el SQL completo (funciones SECURITY DEFINER, políticas nuevas y matriz de pruebas que demuestre que el revisor no lee inventario, reservas, personal, contacto ni documentos). Si exige tocar políticas de F07 o la restricción de F025: detenerse y avisar.
  - Generar `tasks.md` y detenerse en su aprobación.
  - Mientras Andre hace T057: no apagar, reiniciar ni modificar su DEMO, ni correr pruebas en sus puertos. Un único reinicio al final, con todo el SQL aprobado.
- La spec 020 usará `f025/018`. F02.5 sigue SIN ACEPTAR (T057 y T063 sin marcar).

## 2026-11-26 · Tasks aprobadas
- **Andre: «apruebo»** `tasks.md` (19 tareas). Se empieza por T001 y T002 (SQL para revisión, sin puertos).

## 2026-11-26 · SQL f07/007 y f07/008 aprobados
- **Andre aprueba** `007_platform_location_review.sql` (`6D7E0C11…3BB0F9`) y `008_opening_hours.sql` (`0A6EB089…26D2EBF`), tal como están en `89943f2`.
- Condiciones:
  - confirmar en qué bases se ejecutan y que no tocan `farmafind_f01_test`;
  - copiarlos sin cambios y registrar sus hashes si existe una lista;
  - verificar que el administrador de la DEMO tiene `ADMINISTRADOR_PLATAFORMA`;
  - el guion de concesión (T018) queda pendiente de su autorización expresa, con el comando y la aprobación que registra;
  - añadir a la matriz la comprobación explícita de columnas visibles;
  - avanzar con servidor y pantalla sin usar los puertos de la DEMO, sin apagarla ni reiniciarla, y avisar antes del único reinicio final.

## 2026-11-26 · Enmienda «sugerencia de dirección y ubicación» aprobada
- **Andre: «Apruebo la enmienda, opción A»** (User-Agent genérico «FarmaFind-DEMO/0.1 (proyecto local de pruebas)», sin su correo ni su GitHub).
- Precisiones de Andre:
  - solo cubre la sugerencia del formulario de F07.1 y no amplía la geocodificación externa a otras partes;
  - debe decir qué decisión previa de F07 y de F07.1 modifica y por qué;
  - interruptor encendido en TEST y DEMO y apagado por defecto en despliegues reales hasta F09;
  - listar los datos que salen hacia OpenStreetMap, que no se guardan en registros, y los límites;
  - FR-013 a FR-016, T020 a T025 y decisión registrada;
  - pruebas simuladas y resultado en la copia temporal, sin tocar la DEMO ni su Redis.

## 2026-11-26 · T024 conforme
- Andre: «doy conforme la mejora del formulario de dirección y ubicación». Pide además el historial en «Revisar ubicaciones» (propuesta de enmienda en `enmienda-historial-propuesta.md`, pendiente de su aprobación).

## 2026-11-26 · Enmienda del historial aprobada
- **Andre: «si»** a la enmienda F071-FR-017/018, D-06 A («Tú» / «Otro revisor de FarmaFind», sin correos) y el SQL `f07/009` (hash `21B8A3F6…45BF`). Debe probarse con datos simulados y mostrarse en la copia temporal, sin tocar la DEMO.
