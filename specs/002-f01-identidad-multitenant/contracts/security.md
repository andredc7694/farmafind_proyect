# F01 — Contrato de autorización, sesión y límites de datos

**Estado actualizado 2026-11-12:** endpoints de identidad/membresías propias, sesiones y políticas base se implementaron y probaron localmente con PostgreSQL ficticio; la concesión/revocación local de `TRABAJADOR` está aprobada por EXC-01/ROL-01 e implementada y probada en PostgreSQL local ficticio; F01 no está aceptada. GLO-01 bloquea la concesión global y BOOT-01 solo permite diseño. La evidencia real consta en [implementation-evidence.md](../implementation-evidence.md). Rige [spec.md](../spec.md) FR005–019 y Constitución VII–VIII, XIII, XX.

## Matriz mínima de decisiones

| Actor y contexto | Acción F01 | Resultado diseñado |
|---|---|---|
| Visitante | Registro propio, solicitud de protección CSRF, login | Permitido con validación y control de abuso; no crea membresía. |
| Cliente autenticado | Perfil/sesiones propios, membresías propias y selección entre las activas | Permitido; no puede ver credenciales ni gestionar membresías. |
| Personal con membresía activa A | Seleccionar A, consultar sus permisos efectivos | Permitido según rol; sin `membership.manage` no concede roles/delegaciones. |
| Dueño de A con permiso local explícito | Conceder/revocar `TRABAJADOR` a **otra persona** en A | EXC-01/ROL-01 aprobadas; operación local verificada con HTTP y RLS reales. Nunca sobre B, sí mismo, dueño/admin, delegaciones de negocio o privilegios globales. |
| Administrador autorizado de A con permiso local explícito | Conceder/revocar `TRABAJADOR` a **otra persona** en A | Exige membresía activa A y permiso local; operación local verificada con HTTP y RLS reales. No concede roles iguales/superiores ni actúa sobre B o sí mismo. |
| Admin plataforma con permiso global específico | Ninguna concesión global en este incremento | GLO-01 no autoriza una ruta global; BOOT-01 solo permite diseñar el alta inicial. El título no da acceso a inventario ni a todas las membresías. |
| Sesión expirada/revocada, membresía suspendida/revocada o farmacia inactiva | Cualquier operación privada dependiente de ella | Denegada aunque el navegador conserve un valor anterior. |

Los nombres de capacidades son **propuestas técnicas**, no nuevas autoridades históricas. EXC-01 y el catálogo ROL-01 (`TRABAJADOR` únicamente) fueron aprobados expresamente el 2026-11-12; la frase histórica del maestro capítulo 27 permanece intacta y trazada en [authorization-decisions.md](../authorization-decisions.md). GLO-01 mantiene bloqueada toda concesión global, y BOOT-01 no autoriza ejecutar un alta real. Ningún flujo público crea privilegios iniciales. La delegación futura de aceptación de reserva no implementa reservas en F01.

## Secuencia y barreras

1. Autenticar sesión vigente y estado de usuario mediante almacenamiento oficial; un cookie o ID no basta si el estado fue revocado.
2. Para ámbito farmacia, verificar membresía activa del actor, estado de farmacia, rol y delegación sobre el recurso. La elección de farmacia es una solicitud, no prueba de permiso.
3. Abrir transacción con el mismo cliente del pool; fijar actor verificado localmente, leer solo membresías propias autorizadas; fijar tenant **validado** localmente a esa transacción antes de cualquier consulta o cambio privado.
4. Evaluar autorización de caso de uso y dejar que RLS aplique `USING` y `WITH CHECK` a filas. Una denegación o fallo revierte, limpia contexto y produce un evento de auditoría mínimo cuando corresponda.
5. El rol runtime de negocio no es propietario/superusuario/BYPASSRLS. La administración global requiere permiso y política específicos, sin atajos generales. Las operaciones de autenticación previas al tenant usan acceso global acotado a usuario/sesión; no exponen filas privadas de farmacia.

La ausencia de contexto, el `farmacia_id` ajeno y el filtro HTTP omitido deben fallar; probar SQL directo confirma que la segunda barrera existe. La respuesta pública de una farmacia futura se construirá con proyección autorizada, no desactivando RLS ni exponiendo identidades/membresías.

## Sesión, navegador y errores

- Sesión opaca propuesta en cookie HttpOnly de host; token bruto nunca en respuesta JSON, `localStorage`, logs o caché de búsqueda. El backend conserva huella/estado de sesión para expiración y revocación.
- Cookie `Secure` y transporte HTTPS obligatorios en despliegue. Excepción HTTP solo para loopback local bajo perfil explícito; no usarla para aceptación de producción. SameSite y CORS dependen de dominio final; ninguna configuración permite `*` con credenciales.
- Token CSRF ligado a sesión/pre-sesión y validación de Origin en mutaciones, incluidos login, logout y gestión de membresías. Los mensajes de login incorrecto, cuenta inactiva y cuenta inexistente no deben distinguir esos casos.
- API diferencia 400 entrada inválida, 401 falta de sesión, 403 permiso insuficiente, 404 recurso no visible, 409 conflicto no sensible y 429 abuso limitado. Para identificadores ajenos, 403 o 404 son válidos si no se revela existencia; el contrato específico fija una respuesta consistente.
- Auditoría registra actor o referencia limitada, acción, ámbito, recurso técnico, resultado, fecha y correlación. Sanitizar email/IP y errores; no guardar contraseña, token, cookie, `DATABASE_URL` ni payload privado bruto. El acceso a auditoría requiere permiso específico.

## Evidencia exigida

Pruebas positivas y negativas sobre dos farmacias ficticias: registro único/duplicado, login, logout y revocación; cliente sin membresía, actor con A y B, personal sin delegación, dueño/admin de A sobre B, autoelevación, admin global sin permiso, cambio de rol concurrente, sesión vencida, CSRF/Origin, abuso, ausencia de contexto tenant, SQL directo como rol app, reutilización del pool y rollback. Para cada caso registrar revisión, entorno, comando, esperado, obtenido y ausencia de secretos. La aceptación exige PostgreSQL real y navegador en entorno oficialmente compatible; ningún mock valida RLS.
