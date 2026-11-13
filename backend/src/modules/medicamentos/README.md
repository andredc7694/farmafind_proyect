# Medicamentos — F02

El catálogo común conserva nombre, concentración, presentación y clasificación. F02 solo habilita consulta interna acotada y referencias ficticias de prueba. CAT-01/GLO-01 bloquean la edición operativa global. El dominio no depende de Express, PostgreSQL ni de Inventario; otros módulos acceden por contratos públicos.

Capas previstas: `domain`, `application`, `infrastructure` y `presentation`. La información de stock y precio pertenece exclusivamente a Inventario y nunca al catálogo global. La proyección pública de búsqueda se especificará en F03.
