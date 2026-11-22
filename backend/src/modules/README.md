# Límites de los módulos del núcleo

Esta ruta reserva las responsabilidades históricas de **Usuarios y roles** (`usuarios`), **Farmacias** (`farmacias`), **Medicamentos** (`medicamentos`), **Búsqueda** (`busqueda`), **Inventario** (`inventario`), **Reservas** (`reservas`) y **Administración** (`administracion`). En F00 no existen carpetas funcionales, casos de uso ni rutas de negocio para esos módulos.

Al activar cada módulo en una funcionalidad futura, organizar sus capas `domain`, `application`, `presentation` e `infrastructure`. Las dependencias apuntan hacia el dominio y las abstracciones internas; la presentación y la infraestructura implementan contratos, y el acceso entre módulos utiliza interfaces públicas de `contracts`. El controlador `/health` pertenece al bootstrap técnico, fuera del dominio. El servicio de Notificaciones mantiene proceso y configuración independientes.

**FarmaFind AI** (`asistente-ia`) es una ampliación informativa futura, separada de los siete módulos. No se crea proveedor, mock ejecutable, lógica de diagnóstico, prescripción, dosis, recomendación médica o inventario inventado en F00.

En F01, solo `usuarios` contiene tipos, puertos, migraciones y adaptador de transacción para identidad y aislamiento. No se añadió negocio a los otros seis módulos ni se incorporó Notificaciones al monolito. FarmaFind AI sigue fuera de F01.
