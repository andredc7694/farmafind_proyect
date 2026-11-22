# Reservas (F04)

Modulo Clean Architecture para solicitar, consultar, confirmar, cancelar, entregar y expirar reservas.
El dominio no depende de Express ni PostgreSQL; aplicacion coordina puertos; infraestructura contiene
persistencia y transacciones; presentacion valida HTTP. F04 conserva Inventario F02 como fuente de
disponibilidad, escribe Outbox sin publicar eventos y no implementa pagos, F05, GLO-01 ni BOOT-01.
