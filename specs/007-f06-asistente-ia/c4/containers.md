# C4 F06 — Contenedores y componentes

```mermaid
C4Container
  title FarmaFind F06 - Contenedores
  Person(visitor, "Visitante")
  Container(spa, "SPA web", "React + Vite", "Formulario y respuesta informativa")
  Container(api, "API", "Express + TypeScript", "Monolito modular")
  ContainerDb(postgres, "PostgreSQL", "Fuente oficial", "Proyección pública F03")
  Container(redis, "Redis", "Cache-Aside F03", "Datos públicos derivados")
  Container(notifications, "Notificaciones", "Proceso independiente", "Sin participación en F06")
  Rel(visitor, spa, "Usa")
  Rel(spa, api, "POST /api/v1/asistente/consultar", "HTTPS/JSON")
  Rel(api, postgres, "Herramientas públicas F03", "SQL parametrizado")
  Rel(api, redis, "Reutiliza búsqueda F03", "Cache-Aside")
```

Dentro de API, `AIQueryOrchestrator` depende de `AIProvider` y `PublicKnowledgeTools`.
`MockAIProvider` implementa el primer puerto; las herramientas adaptan casos F03 de solo
lectura. No hay conexión desde F06 a tablas privadas ni a proveedores externos.
