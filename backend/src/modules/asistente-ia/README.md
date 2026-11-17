# F06 — Asistente IA informativo

Módulo complementario público y sin estado persistente. `domain` contiene límites clínicos y DTO; `application` orquesta el proveedor y herramientas; `infrastructure` ofrece el mock determinista y el adaptador de lectura F03; `presentation` expone el único endpoint público.

El módulo no diagnostica, prescribe, recomienda dosis ni consulta datos privados. Solo fundamenta respuestas con proyecciones públicas F03. No contiene SDK, credencial ni llamada de red a proveedores de IA.
