# Búsqueda (F03)

Módulo público de consulta referencial. La capa de dominio valida y ordena; aplicación coordina repositorio y Cache-Aside; infraestructura accede a la proyección PostgreSQL y Redis; presentación expone solo contratos públicos.

No crea reservas, no confirma stock, no requiere sesión y no expone cantidades, membresías ni datos personales. PostgreSQL sigue siendo la fuente oficial y Redis es derivado y descartable.
