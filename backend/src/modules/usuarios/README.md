# Usuarios y roles — límite de F01

F01 pertenece al módulo histórico **Usuarios y roles**. Aquí se ubicarán identidad global, contraseña protegida, sesión, membresía usuario–farmacia, rol, delegación, autorización y auditoría mínima. Ya contiene tipos de dominio, puertos, migraciones de prueba, adaptador transaccional y lectura/selección de farmacias propias; todavía no contiene rutas HTTP de F01 ni autenticación completa.

Las capas previstas son `domain` (reglas sin Express ni SQL), `application` (casos de uso y puertos), `infrastructure` (adaptadores PostgreSQL, transacciones y Argon2id) y `presentation` (HTTP, validación y DTO). Las dependencias apuntan hacia el dominio. El acceso a otros módulos usará contratos públicos; conocer `farmacia_id` nunca prueba autorización. El adaptador verifica una sesión opaca vigente y la membresía activa antes de fijar el contexto tenant de una transacción; el caso de uso lee y selecciona solo farmacias propias activas. Esta pieza aún no está conectada a HTTP.

**Farmacias** conserva el alta y gestión de establecimientos; F01 solo necesita una referencia mínima y su estado para autorizar membresías. **Administración** conserva sus responsabilidades de plataforma; F01 no crea permisos globales genéricos. **Medicamentos**, **Búsqueda**, **Inventario** y **Reservas** no reciben lógica de negocio en F01. El servicio **Notificaciones** continúa como proceso independiente. **FarmaFind AI** permanece como ampliación informativa futura, fuera de los siete módulos históricos.

La administración delegada de membresías de terceros está bloqueada por EXC-01/ROL-01 hasta ratificación y definición aprobadas; las concesiones globales e iniciales, por GLO-01/BOOT-01. Este README no levanta esas puertas ni declara funcionalidad implementada.
