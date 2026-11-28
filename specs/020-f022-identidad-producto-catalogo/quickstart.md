# Verificación guiada (copia temporal 3001/5174; nunca `farmafind_f01_test` ni los puertos de la DEMO)
1. Encender la copia con `node scripts/copy/start-copy.mjs .cache/f022-copy`.
2. Como farmacia Alfa, importar un archivo ficticio con el mismo producto de dos laboratorios y una fila «caja x 30»: entran como productos distintos; solo es duplicado lo que repite la identidad o el código.
3. «Proponer los pendientes»: elegir la forma de la fila «caja x 30» y completar el principio activo si falta.
4. Como revisor con segundo factor, en `/admin/catalogo/propuestas`:
   - filtrar por farmacia, laboratorio y forma;
   - revisar la muestra y aprobar la selección;
   - rechazar una propuesta con motivo y vincular otra.
5. Como farmacia Beta, proponer un producto ya aprobado: queda «ya existe» solo, sin ver nada de Alfa.
6. Reimportar en Alfa: la vista previa anuncia «Se reemplazarán N productos sin laboratorio»; confirmar.
7. Buscar en público: cada producto de Alfa aparece una sola vez, con laboratorio, marca y forma.
8. En el asistente: «¿Hay algo más barato que …?» con la fila «caja x 30» ofrece alternativas de la misma forma.
