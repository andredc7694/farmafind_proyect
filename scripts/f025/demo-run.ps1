$ErrorActionPreference = 'Stop'
$repository = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$local = Join-Path $repository '.cache/f025-docker'
$manifest = Join-Path $local 'processes.manual.local.json'

function Test-LocalPort([int]$port) {
  $client = [System.Net.Sockets.TcpClient]::new()
  try { $client.Connect('127.0.0.1', $port); return $true }
  catch { return $false }
  finally { $client.Dispose() }
}

function Wait-Http([string]$url) {
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try {
      $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
      if ($response.StatusCode -eq 200) { return }
    } catch { Start-Sleep -Seconds 1 }
  }
  throw "No responde correctamente: $url. Revisa los logs privados en .cache/f025-docker/."
}

Set-Location -LiteralPath $repository
if (Test-Path -LiteralPath $manifest) {
  throw 'La DEMO ya tiene un registro de procesos. Usa demo-stop.ps1 o revisa el estado antes de reiniciarla.'
}
foreach ($port in 3000, 5173) {
  if (Test-LocalPort $port) { throw "Puerto local $port ocupado; no se detendra ningun proceso ajeno." }
}
if (-not (Test-Path -LiteralPath (Join-Path $repository '.cache/f03-docker/redis-password.txt'))) {
  throw 'Falta el secreto local de Redis F03; prepara el entorno TEST antes de iniciar la DEMO.'
}

$postgresWasRunning = @(docker ps --filter 'name=farmafind-f025-postgres-postgres-1' --format '{{.Names}}') -contains 'farmafind-f025-postgres-postgres-1'
if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop Linux no responde.' }
$redisWasRunning = @(docker ps --filter 'name=farmafind-f03-search-redis-1' --format '{{.Names}}') -contains 'farmafind-f03-search-redis-1'
if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar el estado de Redis TEST.' }

& (Join-Path $PSScriptRoot 'demo-start.ps1')
if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { throw 'Fallo la preparacion TEST de F02.5.' }
docker compose -f compose.f03-search.yaml up -d --wait --wait-timeout 90 redis
if ($LASTEXITCODE -ne 0) { throw 'Redis TEST no alcanzo el estado healthy.' }

$node = (Get-Command node -ErrorAction Stop).Source
$api = Start-Process -FilePath $node -ArgumentList 'scripts/f025/demo-api.mjs' -WorkingDirectory $repository `
  -RedirectStandardOutput (Join-Path $local 'api.manual.log') -RedirectStandardError (Join-Path $local 'api.manual.error.log') `
  -WindowStyle Hidden -PassThru
$web = Start-Process -FilePath $node -ArgumentList @((Join-Path $repository 'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5173','--strictPort') `
  -WorkingDirectory (Join-Path $repository 'frontend') -RedirectStandardOutput (Join-Path $local 'web.manual.log') `
  -RedirectStandardError (Join-Path $local 'web.manual.error.log') -WindowStyle Hidden -PassThru

@{ kind='F025_MANUAL_DEMO_PROCESSES'; apiPid=$api.Id; webPid=$web.Id;
  postgresStarted=(-not $postgresWasRunning); redisStarted=(-not $redisWasRunning) } |
  ConvertTo-Json | Set-Content -LiteralPath $manifest -Encoding utf8
Wait-Http 'http://127.0.0.1:3000/health'
Wait-Http 'http://127.0.0.1:5173/'
Wait-Http 'http://127.0.0.1:5173/api/v1/auth/csrf'
Write-Output 'DEMO TEST conectada: http://127.0.0.1:5173/'
Write-Output 'Revisor TEST: .cache/f025-docker/credentials.manual.local.json (consultar solo localmente).'
Write-Output 'Parada exclusiva: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/f025/demo-stop.ps1'
