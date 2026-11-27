# Trazabilidad F07.1

| Requisito | Tareas | Código principal | Pruebas |
|---|---|---|---|
| FR-001/002 | T008 | `frontend/src/pharmacies/MyPharmacy.jsx` | `frontend/tests/f071/mi-farmacia.test.jsx` |
| FR-003/006 | T004, T005, T008 | `farmacias/application/location-status.ts`, `LocationAdmin.jsx` | `backend/tests/geolocation/f071-server.test.ts`, E2E T015 |
| FR-004 | T006, T022, T023 | `domain/pharmacy-location.ts`, `PointPicker.jsx`, `peru-cities.js` | `f071-server`, `sugerencias.test.jsx`, matriz 16 |
| FR-005 | T001, T004, T009, T018 | `f07/007`, `platform-location-review.ts`, `platform-locations-router.ts`, `LocationReview.jsx`, `scripts/f07/grant-platform-location-review.mjs` | `scripts/f07/verify-f071-matrix.mjs` (1–15 y 22) |
| FR-007 | T012 | `f025/017_owner_location_test.sql` | `scripts/f025/verify-application-commands.mjs` |
| FR-008 | T002, T007, T010 | `f07/008`, `manage-opening-hours.ts`, `redis-opening-hours-cache.ts`, `OpeningHours.jsx` | matriz 17–20, E2E |
| FR-009 | T011 | `identity/ProfilePage.jsx` | `mi-farmacia.test.jsx`, E2E |
| FR-010/011 | T001–T003, T017 | f07/007–009, f025/017 | matriz, H1–H8, `f071-migrations.test.ts` |
| FR-012–016 | T020–T025 | `address-suggestions.ts`, `nominatim-geocoder.ts`, `address-suggestions-router.ts` | `f071-suggestions.test.ts`, `sugerencias.test.jsx` |
| FR-017/018 | T026–T031 | `f07/009`, `platform-location-repository.ts`, `LocationReview.jsx` | `f071-history.test.ts`, `historial.test.jsx`, H1–H8 |
