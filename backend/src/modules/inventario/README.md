# Inventario — F02

Inventario administra precio referencial, cantidad física registrada, compromisos, fecha de revisión, movimientos e importaciones por farmacia. Las operaciones requieren sesión F01, membresía vigente, farmacia activa, rol y capacidad explícita. PostgreSQL RLS aplica segunda barrera de lectura y escritura. La importación confirma el archivo entero o ninguna fila.

Capas previstas: `domain`, `application`, `infrastructure` y `presentation`; las dependencias apuntan a dominio/puertos. Farmacias conserva alta y estado del establecimiento; Usuarios y roles conserva sesiones/membresías; Reservas conserva compromisos y Outbox en F04; Notificaciones permanece independiente. Ni Redis, ni búsqueda pública, ni IA forman parte de F02.
