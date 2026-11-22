# Notificaciones F05

El módulo publica hechos F04 confirmados después del commit. Dominio y aplicación no dependen
de Express, PostgreSQL ni HTTP. Infraestructura implementa reclamos Outbox y transporte.
La entrega ocurre en el proceso independiente `notifications`; no se envían mensajes reales.
