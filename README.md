# FarmaFind — F00 Bootstrap

Este repositorio (`andredc7694/farmafind_proyect`) es el espacio oficial de desarrollo SDD. `andredc7694/PROYEC_FARMAFIND` conserva la documentación histórica. Rigen la [Constitución v1.1.0](.specify/memory/constitution.md), la [especificación F00](specs/001-f00-bootstrap-proyecto/spec.md), el [plan aprobado](specs/001-f00-bootstrap-proyecto/plan.md) y las [tareas](specs/001-f00-bootstrap-proyecto/tasks.md).

El incremento técnico actual prepara frontend React/Vite/JSX, API Express/TypeScript y Notificaciones como proceso Express/TypeScript independiente. Solo existen una pantalla técnica y dos endpoints `/health`. Los siete módulos históricos (Usuarios y roles, Farmacias, Medicamentos, Búsqueda, Inventario, Reservas y Administración) y FarmaFind AI conservan sus responsabilidades futuras. PostgreSQL con RLS, Redis Cache-Aside, Transactional Outbox, Docker y AWS son etapas posteriores; no están operativos.

## Requisitos locales

Windows 10, PowerShell 5.1, Node.js 24.17.0 y npm 11.13.0 son las referencias observadas. VS Code, Codex y Spec Kit forman parte del flujo de desarrollo. Trabajar en `feat/sdd-aws-multitenant` u otra rama distinta de `main`. No usar credenciales reales ni datos personales.

Los cuatro manifiestos privados usan npm workspaces y versiones exactas. Tras clonar, ejecutar `npm.cmd ci` para instalar el árbol congelado en `package-lock.json`. Los ejemplos `.env.example` contienen valores ficticios; crear `.env.local` en cada workspace con esos valores técnicos si no existen. No compartir los perfiles locales. El arranque no requiere Docker, PostgreSQL, Redis, AWS ni proveedores externos.

## Arranque y controles

Abrir tres terminales PowerShell desde la raíz del repositorio:

```powershell
npm.cmd run dev:web
npm.cmd run dev:api
npm.cmd run dev:notifications
```

La pantalla técnica se sirve en `http://127.0.0.1:5173/`, la API en `http://127.0.0.1:3000/health` y Notificaciones en `http://127.0.0.1:3001/health`. Cada servicio se detiene desde su propia terminal con Ctrl+C.

```powershell
npm.cmd run check
npm.cmd run check:config
npm.cmd run test:base
npm.cmd run build
npm.cmd run verify:local -- --preparation A
```

`verify:local` usa Vite preview en `127.0.0.1:4173`, registra el resultado y los logs de procesos propios en `artifacts/f00/` (ignorado por Git), y comprueba sintaxis/tipos, configuración, pruebas, compilación, respuestas HTTP, reinicios independientes y limpieza. Un resultado `local=passed` deja `overall=pending` y `acceptance=pending`.

Se realizaron dos preparaciones **locales** limpias e independientes A/B de una candidata común; su comparación está en [local-review.md](docs/evidencias/f00/local-review.md). Playwright sigue obligatorio para comprobar el montaje real de React en un Windows oficialmente compatible; no se ha ejecutado ni aprobado en Windows 10. Las dos preparaciones **completas** A/B siguen pendientes. F00 aún no cumple la aceptación completa. RC04 y las ADR complementarias siguen pendientes de formalización documental.

No se autorizan funcionalidades de negocio, cambios directos en `main`, commits, push, despliegues o recursos AWS en este incremento.
