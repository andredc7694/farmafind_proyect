# Implementation Plan: F08.1 — Experiencia integrada por actor

**Branch**: `feat/f081-experiencia-integrada` | **Date**: 2026-11-24 | **Spec**: [spec.md](spec.md) (aprobada 2026-11-24; D-01..D-04 = A, ver [approval.md](approval.md))

## Summary

Casi todo es **presentación sobre contratos que ya existen**. Se añade lo mínimo en el backend: tres lecturas nuevas y de solo lectura (sugerencias públicas, resumen de reservas, resumen de inventario). No hay migraciones. El resto es interfaz: un modelo de navegación por actor, un panel de farmacia que compone los componentes existentes, tema claro/oscuro/sistema con contraste verificado, búsqueda unificada con sugerencias y filtros, elección del punto a mano, y una burbuja de chat flotante sobre F06.1 mock.

## Technical Context

**Language/Version**: TypeScript 5 / Node 24.17; React + Vite JSX. **Dependencias nuevas**: ninguna (el contraste se calcula con una función propia; no se añade axe ni librerías de UI).
**Storage**: sin migraciones. Tema: campo `tema` ya existente en `perfil_usuario` (F01.1) + `localStorage` para visitantes. Sin datos personales nuevos.
**Testing**: Vitest (dominio/navegación/contraste/clientes), jsdom (componentes), supertest + PostgreSQL TEST (resúmenes con RLS Alfa/Beta, sugerencias sin filtrar privado, fallback sin Redis), Playwright Linux al final (cinco actores, teclado, 360 px).
**Constraints**: US$0; sin geocodificación ni LLM de pago; F06.1 mock; solo TEST; el backend autoriza cada acción.

## Constitution Check

| Principio | Cumplimiento |
|---|---|
| Multi-tenant / RLS | Resúmenes por farmacia con el contexto transaccional y la capacidad de cada módulo (`reservation.read`, `inventory.read`); sugerencias solo de la proyección pública F03. |
| Clean Architecture | Lecturas nuevas dentro de su módulo (`busqueda`, `reservas`, `inventario`), sin imports cruzados; la composición de la vista ocurre en el frontend. |
| Seguridad por servidor | El menú oculta por presentación; cada ruta privada se prueba directamente contra el servidor. |
| Costos | Nada de pago; el mapa de OpenStreetMap ya aprobado en F07 sigue cargándose solo tras clic informado. |

## Architecture decisions

1. **Navegación como función pura** `navigationFor({session, memberships, canReview})` → secciones por actor; sin estado de seguridad en el navegador. El panel de farmacia (`/farmacias/panel`) compone `StaffAdmin`, `InventoryView`, `PharmacyReservations` (cola e historial de F04.1), `LocationAdmin` y la configuración, cada uno por capacidad; no se toca `IdentityApp`.
2. **Resumen = dos lecturas pequeñas**, una por módulo dueño del dato: `GET /farmacias/{id}/reservas/resumen` (capacidad `reservation.read`) y `GET /farmacias/{id}/inventario/resumen` (capacidad `inventory.read`). La interfaz pide solo las que sus capacidades permiten. Así no se otorga ninguna visibilidad nueva ni se cruzan módulos.
3. **Sugerencias públicas** `GET /busquedas/sugerencias?q=` reutiliza `f03.search_public_offers` (ya limitado a ofertas públicas) y devuelve hasta 8 textos distintos (nombre/principio y concentración/presentación). No hay función SQL nueva; mismo límite de tasa que la búsqueda.
4. **Tema**: `data-theme` en `<html>` más tokens oscuros y `prefers-color-scheme`; selector en la cabecera; con sesión se lee/escribe `tema` por `/me/profile` (F01.1), sin sesión en `localStorage`. Contraste AA (≥ 4.5:1 texto, ≥ 3:1 controles) comprobado por una prueba que calcula la razón de cada par de tokens en ambos temas.
5. **Búsqueda unificada**: se reorganiza `PublicSearch` (combobox accesible, filtros plegables, lista/mapa, ubicación puntual con consentimiento o punto elegido a mano en el mapa), manteniendo el contrato `GET /busquedas`. «Farmacias con ofertas comparables» y «estado de filtros» salen de los resultados y de la URL, sin endpoints nuevos.
6. **Elección del punto** (`PointPicker`): clic o teclado sobre el mapa de F07; se reutiliza en el alta de ubicación del propietario y como «mi ubicación» de la búsqueda; la posición no se guarda como rastro.
7. **Burbuja de chat** (`ChatBubble`) en `AppShell` para páginas públicas, sobre `conversation-client` (F06.1 mock); minimizable, foco gestionado, contexto conservado en memoria; preguntas sugeridas por reglas locales.
8. **Fuera**: MEJ-011, sugerencias 3/4/11, proveedor externo (spec FR-017).

## Project Structure

```text
specs/016-f081-experiencia-integrada/   spec, plan, research, data-model, contracts/, quickstart, tasks, evidence, ...
backend/src/modules/busqueda/{application/suggest-public.ts, presentation/public-suggest-router.ts}
backend/src/modules/reservas/{application/attention-summary.ts (extiende AttentionCenter)}
backend/src/modules/inventario/{application/stock-summary.ts, presentation (ruta de resumen)}
frontend/src/app/{navigation.js, AppShell.jsx, ThemeSwitcher.jsx, theme.js, ChatBubble.jsx}
frontend/src/pharmacies/{PharmacyPanel.jsx, PharmacySummary.jsx}
frontend/src/search/{PublicSearch.jsx, SuggestBox.jsx, search-client.js, comparable.js}
frontend/src/geolocation/PointPicker.jsx
frontend/src/design/{tokens.css, contrast.js}
backend/tests/{busqueda,reservations,inventory}/f081-*.test.ts · frontend/tests/f081/*.test.jsx · frontend/e2e/f081-*.spec.js
scripts/f081/ (E2E y DEMO)
```

## Fases de entrega (lotes)

1. **Tema y navegación (base)**: tokens oscuros, controlador de tema, selector, sincronización con el perfil, prueba de contraste, modelo de navegación por actor y menú.
2. **Paneles y resúmenes (US1)**: dos lecturas de resumen con RLS, `PharmacyPanel` y `PharmacySummary`, matriz de rutas directas y Alfa/Beta.
3. **Búsqueda unificada (US2)**: sugerencias públicas, interfaz de búsqueda, filtros, lista/mapa, ubicación, comparables; regresión F03 con y sin Redis.
4. **Ubicación y chat (US4–US5)**: `PointPicker` y su uso, farmacias cercanas sin mapa, burbuja de chat, preguntas sugeridas y pruebas de no mutación.
5. **Cierre**: accesibilidad E2E (teclado, 360 px), cinco recorridos de actor, regresión completa, DEMO, trazabilidad, *analyze/converge* y `acceptance.md`.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| La interfaz muestra acciones sin permiso | Cada ruta se prueba directo contra el servidor; el menú es solo presentación. |
| El resumen filtra datos de otra farmacia o stock a quien no corresponde | Una lectura por capacidad y por módulo, contexto transaccional, prueba Alfa/Beta con conexión reutilizada. |
| Las sugerencias exponen catálogo no público | Salen de la proyección pública F03 (solo ofertas visibles); prueba de que un medicamento sin oferta pública no aparece. |
| Contraste insuficiente en el tema oscuro | Prueba automática de razones de contraste sobre los tokens. |
| Regresiones visuales/estructurales en pantallas existentes | Se conserva el contrato de cada componente; regresión completa de frontend y E2E existentes. |
| Alcance grande | Lotes por prioridad; lo diferido está declarado (FR-017) y trazado. |
