# Quickstart previsto: F06

Este procedimiento fue ejecutado para el cierre técnico provisional del 2026-11-16.

```powershell
npm.cmd run test:f06:unit
npm.cmd run test:f06:api
npm.cmd run test:f06:security
npm.cmd run test:f06:load
npm.cmd run verify:f06:integration
npm.cmd run test:f06:fallback
npm.cmd run check
npm.cmd run build
npm.cmd run test:base
npm.cmd audit --audit-level=low
```

La demostración usará datos ficticios F03 y `MockAIProvider`. No necesita clave, red externa,
AWS, Docker adicional ni proveedor pagado. Si se ejecuta la integración Redis/PostgreSQL,
reutilizará los contenedores locales existentes y conservará sus volúmenes.

## Recorrido previsto

1. Abrir la ruta pública del asistente.
2. Consultar un producto ficticio y revisar fuentes y aviso referencial.
3. Comparar ofertas públicas sin interpretar equivalencia terapéutica.
4. Consultar un producto inexistente y verificar ausencia explícita.
5. Solicitar dosis o sustitución y verificar límite clínico.
6. Superar la cuota y verificar 429 antes de herramientas.

Resultados observados: 32 pruebas F06, integración real PostgreSQL/Redis, fallback a
PostgreSQL con Redis detenido y 100 consultas concurrentes satisfactorias. La aceptación
permanece pendiente de revisión humana.
