# Guía de validación propuesta — F06.1

**Estado:** plan documental aprobado; los comandos F06.1 no existen todavía y ninguna prueba F06.1 se ha ejecutado. Esta guía describe las comprobaciones que deberá permitir la implementación dentro de un alcance de código autorizado.

## Prerrequisitos

- Rama F06.1, Node.js 24.17.0 y npm 11.13.0, dependencias existentes del repositorio.
- Para integración F03/RLS/Redis: bases y servicios locales TEST autorizados, con datos ficticios y sin tocar bases persistentes. Ningún proveedor IA externo ni AWS.
- Corpus de aceptación ficticio con fuentes y revisiones simuladas para pruebas; contenido real sobre molestias solo tras licencia comprobada y aprobación profesional documentada.
- Navegador en entorno oficialmente compatible para cualquier prueba Playwright que sea obligatoria; no declarar aceptada una prueba omitida.

## Recorridos exigidos una vez implementado

1. Ejecutar `npm run check`, `npm run build`, `npm run check:f06` y `npm run verify:contracts`; conservar versiones, comandos y resultados reales.
2. Ejecutar la futura suite F06.1 unitaria/API: primera consulta, al menos una pregunta de seguimiento, 6 turnos, expiración a 15 min con reloj controlado, borrado inmediato y negativa clínica. La suite y su comando **deberán crearse en implementación**; no se afirma que existan ahora.
3. Verificar HTTP de `POST /api/v1/asistente/conversaciones` y `/descartar` según [OpenAPI](contracts/conversation.openapi.yaml): éxito, 400, 413, 422, 429, 503 y ausencia de datos privados. Confirmar que `POST /api/v1/asistente/consultar` conserva el contrato F06.
4. Con TEST PostgreSQL/Redis, contrastar ofertas F03 públicas y cero resultados; apagar Redis solo en entorno de prueba para comprobar fallback. Confirmar RLS Alfa/Beta con rol runtime y que F06.1 nunca lee repositorios privados.
5. Repetir batería de 30 diálogos, solicitudes clínicas y prompt injection; inspeccionar las citas de cada afirmación y las métricas sin texto sensible. La orientación por molestias permanece TEST/DEMO hasta revisión profesional real.
6. Verificar interfaz en español, estados de espera/error/cuota, citas accesibles, eliminación de contexto y alternativa de búsqueda. Registrar capturas sin datos personales reales.

## Criterio de salida documental

El plan aprobado permite preparar tareas. El código aún requiere una instrucción de implementación dentro del alcance aprobado. La aceptación técnica requiere evidencias reales para los 11 criterios de éxito. La exposición a usuarios reales exige además corpus autorizado, revisión profesional y decisiones separadas sobre proveedor externo/privacidad si se pretende activarlo.
