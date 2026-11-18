# F06 — Asistente IA informativo

Módulo complementario público y sin estado persistente. `domain` contiene límites clínicos y DTO; `application` orquesta el proveedor y herramientas; `infrastructure` ofrece el mock determinista y el adaptador de lectura F03; `presentation` expone el único endpoint público.

El módulo no diagnostica, prescribe, recomienda dosis ni consulta datos privados. Solo fundamenta respuestas con proyecciones públicas F03. La composición activa no contiene credenciales ni llama a proveedores de IA; existe un adaptador Gemini inactivo y probado con transporte simulado, sin SDK ni clave real.

## Ampliación F06.1 (implementación TEST/DEMO verificada, aceptación pendiente)

`POST /api/v1/asistente/consultar` conserva íntegro el contrato F06. La API integrada se compone en `backend/src/identity-app.ts`; `backend/src/main.ts` solo sirve el arranque básico F00. F06.1 agrega rutas independientes bajo `/api/v1/asistente/conversaciones` según `specs/009-f061-asistente-conversacional/contracts/conversation.openapi.yaml`. Su contexto es efímero y no concede autorización a datos privados. Las fichas farmacéuticas reales y cualquier proveedor de IA externo permanecen deshabilitados hasta aprobaciones específicas.

En F06.1 la composición siempre selecciona `MockConversationProvider`. Una clave `GEMINI_API_KEY` accidental no cambia esa selección; `FARMAFIND_AI_PROVIDER=gemini` se rechaza para el asistente y F03 sigue funcionando. React no puede seleccionar proveedores mediante el cuerpo HTTP. El ejecutor de prueba real Gemini está desarmado en código y requiere una decisión futura para reactivarlo. No se afirma que la facturación de una cuenta externa esté desactivada.
