# Evidencias F00

Este índice conserva la trazabilidad del bootstrap y distingue evidencia técnica de aceptación humana. Los reportes completos permanecen en `artifacts/f00/`, ignorado por Git; solo se publica el resumen redactado. No se publican perfiles `.env.local`, credenciales ni logs crudos.

| ID | Contenido exigido | Estado de cierre técnico |
|---|---|---|
| E-F00-01 | Revisión, hashes, Windows, Node/npm y paquetes. | Satisfecho en A/B sobre la candidata `b160c6a`. |
| E-F00-02 | Configuración válida/inválida con datos ficticios. | Satisfecho en ambas preparaciones. |
| E-F00-03 | Build, sintaxis, tipos y arquitectura. | Satisfecho en ambas preparaciones. |
| E-F00-04 | Contrato HTTP API/Notificaciones. | Satisfecho en ambas preparaciones. |
| E-F00-05 | Playwright, UI real y captura técnica. | Satisfecho en contenedor Linux oficial, 1/1 por preparación. |
| E-F00-06 | Procesos, colisión, reinicio y limpieza. | Satisfecho en ambas preparaciones. |
| E-F00-07 | Preparación A limpia con comandos y resultados. | `F00-A-2026-11-17T18-51-19.916Z`, `overall=passed`. |
| E-F00-08 | Preparación B limpia y comparación. | `F00-B-2026-11-17T18-53-12.890Z`; comparación `acceptance=passed`. |
| E-F00-09 | Revisión humana y correspondencia histórica/docente. | Decisión expresa del 2026-11-17 registrada en [human-review.md](human-review.md); T058 cerrada. |

Cada reporte contiene comandos, directorio, inicio/fin, códigos de salida, versiones, resultados, hashes y limpieza. El soporte oficial de Playwright se atribuye al contenedor Linux, no a Windows 10. Un cambio posterior en fuente o lockfile obliga a repetir A/B antes de reutilizar esta evidencia.
