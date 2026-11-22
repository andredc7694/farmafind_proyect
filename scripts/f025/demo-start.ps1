$ErrorActionPreference = 'Stop'
$repository = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$previousSlot = $env:F025_DEMO_SLOT
try {
  Set-Location -LiteralPath $repository
  docker info --format '{{.OSType}} {{.ServerVersion}}'
  if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop Linux no está disponible.' }
  docker compose -f compose.f025-postgres.yaml up -d --wait --wait-timeout 120 postgres
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar solo PostgreSQL F02.5 TEST.' }
  npm run build -w @farmafind/backend
  if ($LASTEXITCODE -ne 0) { throw 'Falló la compilación backend.' }
  $env:F025_DEMO_SLOT = ''
  node scripts/f025/prepare.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Fallo la preparacion de la base tecnica TEST.' }
  node scripts/f025/verify-rls.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Fallo el aislamiento PostgreSQL TEST.' }
  node scripts/f025/verify-application-commands.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Fallo el flujo SQL de solicitudes TEST.' }
  node scripts/f025/check-f04-rls.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Fallo la regresion F04 RLS TEST.' }
  $env:F025_DEMO_SLOT = 'manual'
  node scripts/f025/prepare.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Falló la preparación de la base manual TEST.' }
  node scripts/f025/demo-prepare.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Falló la provisión del revisor TEST.' }
  node scripts/f025/catalog-fixture.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Fallo la referencia de catalogo ficticia TEST.' }
  node scripts/f025/export-test-approval.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Falló el expediente TEST.' }
  Write-Output 'F02.5 DEMO manual preparada. Base separada; se conservan las farmacias e inventarios que el usuario ya haya creado. No se precargan establecimientos.'
  Write-Output 'API: $env:F025_DEMO_SLOT="manual"; node scripts/f025/demo-serve.mjs'
  Write-Output 'Frontend: npm run dev:web'
  Write-Output 'Credenciales privadas: .cache/f025-docker/credentials.manual.local.json'
} finally {
  $env:F025_DEMO_SLOT = $previousSlot
}
