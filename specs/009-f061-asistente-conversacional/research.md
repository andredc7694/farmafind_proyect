# Investigación técnica F06.1 — decisiones propuestas

**Fecha:** 2026-11-17. **Estado:** diseño documental, pendiente de aprobación del plan. Fuente principal: Documento Maestro v3.0, Parte A, A5, IA31-01–IA31-10; Constitution v1.2.0, III/XIX; F06 aprobado.

## Continuidad conversacional

**Decisión propuesta:** conservar como máximo 6 turnos por conversación y expirar el contexto tras 15 minutos de inactividad. El cliente guarda un identificador opaco solo en memoria; el servidor guarda contexto mínimo en memoria, lo vincula al origen técnico, limita entradas y permite eliminación inmediata. No hay tabla, cookie, localStorage ni envío a terceros. Los turnos clínicos personales rechazados no se incorporan al contexto.

**Razón:** permite preguntas de seguimiento observables con retención corta y prueba de borrado. **Alternativas:** historial PostgreSQL (retención y privacidad adicionales), contexto sin estado enviado íntegro por el cliente (más exposición y tamaño). El almacenamiento en memoria por proceso limita el alcance a TEST/DEMO; escalado distribuido necesitará diseño separado.

## Consumo y abuso

**Decisión propuesta:** conservar los límites F06 ya existentes: 500 caracteres, cuerpo 4 KiB, 30 solicitudes/minuto/origen, máximo 3 consultas públicas por respuesta y 20 resultados. Aplicar la cuota antes de cualquier proveedor o herramienta. El límite de contexto es adicional, no reemplaza el de F06.

**Razón:** evita degradar controles aprobados y mantiene regresión. **Alternativas:** Redis para la cuota, diferido por añadir dependencia operativa no necesaria en esta ampliación local. Una cuota distribuida requiere decisión de despliegue propia.

## Contrato y proveedor

**Decisión propuesta:** añadir `POST /api/v1/asistente/conversaciones` y `POST /api/v1/asistente/conversaciones/descartar` en contrato F06.1, manteniendo sin cambios `POST /api/v1/asistente/consultar` de F06. El caso de uso depende de puertos para clasificar, buscar fuentes revisadas y consultar F03; el `MockAIProvider` sigue siendo el único proveedor activo. Un adaptador Gemini es candidato de diseño, sin dependencia, clave, llamadas ni selección automática. Otros adaptadores requerirán evaluación equivalente.

**Razón:** evita romper clientes y separa el nuevo comportamiento. **Alternativas:** extender el cuerpo antiguo, con riesgo de alterar un contrato aceptado; activar proveedor real, prohibido sin aprobación de términos, datos, costo y consentimiento.

## Fuentes farmacéuticas

**Decisión propuesta:** un registro de contenido debe contener autoridad, jurisdicción, URL/ID, versión, fecha, vigencia, permiso de reutilización, afirmaciones permitidas, revisor profesional y aprobación. No usar contenido sin todos los campos y revisión. DIGEMID y referencias oficiales son candidatas; que una ficha sea pública no prueba permiso de reutilización ni revisión profesional de este producto. Hasta acreditar el corpus, el mock solo puede ofrecer ayuda genérica, búsqueda F03 y abstención, sin orientación farmacológica real sobre molestias.

**Razón:** IA31-02/03/06/10 exigen grounding, autorización y revisión. **Alternativas:** texto libre de modelo o scraping automático, descartados por falta de trazabilidad y riesgo clínico.

## Seguridad y privacidad

**Decisión propuesta:** política clínica determinista previa a herramientas, fuentes tratadas como datos no confiables, allowlist F03 de solo lectura, sin SQL ni acceso a repositorios privados. Métricas agregadas sin consultas/respuestas/PII; errores sin detalles internos. Consentimiento y política de terceros no se presumen: cualquier proveedor externo queda bloqueado hasta aprobación independiente.

**Razón:** conserva F01/RLS y los límites F06. **Alternativas:** confiar en instrucciones del proveedor, descartado porque no constituyen control verificable.

## Preguntas para aprobar el plan

1. Ratificar o ajustar 6 turnos y 15 minutos de inactividad para el modo local. Son parámetros propuestos, no aceptados por aprobar la spec.
2. El uso de fichas oficiales concretas requiere verificar licencia y revisión profesional; ninguna se considera aprobada por este plan.
3. Proveedor externo, política de consentimiento, retención en un eventual despliegue distribuido y presupuesto necesitan autorización separada antes de activación.
