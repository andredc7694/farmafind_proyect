$ErrorActionPreference = 'Stop'
$repository = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$manifest = Join-Path $repository '.cache/f025-docker/processes.manual.local.json'
if (-not (Test-Path -LiteralPath $manifest)) { throw 'No hay procesos de DEMO registrados; no se detendra nada.' }
$state = Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json
if ($state.kind -ne 'F025_MANUAL_DEMO_PROCESSES') { throw 'Registro de procesos invalido.' }
foreach ($entry in @(@{pid=$state.apiPid; marker='demo-api.mjs'},
                    @{pid=$state.webPid; marker='vite.js'})) {
  $running = Get-Process -Id $entry.pid -ErrorAction SilentlyContinue
  if (-not $running) { continue }
  $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($entry.pid)" -ErrorAction SilentlyContinue
  if ($process -and $process.CommandLine -like "*$($entry.marker)*") {
    Stop-Process -Id $entry.pid -ErrorAction Stop
  } else {
    throw "PID $($entry.pid) ya no corresponde a la DEMO; no se detendra. Revisa el proceso manualmente."
  }
}
Set-Location -LiteralPath $repository
if ($state.redisStarted) {
  docker compose -f compose.f03-search.yaml stop redis
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo detener Redis TEST.' }
}
if ($state.postgresStarted) {
  docker compose -f compose.f025-postgres.yaml stop postgres
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo detener PostgreSQL TEST.' }
}
Remove-Item -LiteralPath $manifest
Write-Output 'Procesos propios detenidos. Bases y volumenes conservados; servicios previos intactos.'
