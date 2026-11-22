param()
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Set-Location $root
$private = Join-Path $root '.cache/manual-demo'
New-Item -ItemType Directory -Path $private -Force | Out-Null
$dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
$docker = if ($dockerCommand) { $dockerCommand.Source } else { Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin/docker.exe' }
if (-not (Test-Path $docker)) { throw 'Docker CLI no disponible. Inicia Docker Desktop y vuelve a ejecutar.' }
$node = (Get-Command node -ErrorAction Stop).Source
function Test-Port([int]$port) {
  $client = [System.Net.Sockets.TcpClient]::new()
  try { $client.Connect('127.0.0.1', $port); return $true }
  catch { return $false }
  finally { $client.Dispose() }
}
foreach ($port in @(3000, 3001, 5173)) {
  if (Test-Port $port) { throw "El puerto $port ya está ocupado. Detén solo el proceso conocido antes de iniciar la DEMO." }
}
& $docker info --format '{{.ServerVersion}}' *> $null
if ($LASTEXITCODE -ne 0) {
  $desktop = Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/Docker Desktop.exe'
  if (-not (Test-Path $desktop)) { throw 'Inicia Docker Desktop antes de ejecutar la DEMO.' }
  Start-Process -FilePath $desktop -WindowStyle Hidden
  $ready = $false
  for ($i = 0; $i -lt 25; $i++) {
    Start-Sleep -Seconds 2
    & $docker info --format '{{.ServerVersion}}' *> $null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
  }
  if (-not $ready) { throw 'Docker Desktop no quedó disponible.' }
}
& $docker compose -f compose.f01-postgres.yaml up -d --wait postgres
if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL local no inició.' }
& $docker compose -f compose.f03-search.yaml up -d --wait redis
if ($LASTEXITCODE -ne 0) { throw 'Redis local no inició.' }
npm run build --workspace @farmafind/backend
if ($LASTEXITCODE -ne 0) { throw 'Falló la compilación del backend.' }
npm run build --workspace @farmafind/notifications
if ($LASTEXITCODE -ne 0) { throw 'Falló la compilación de Notificaciones.' }
if (-not (Test-Path (Join-Path $private 'state.local.json'))) {
  & $node scripts/demo/prepare.mjs prepare
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo preparar la base DEMO.' }
}
& $node scripts/demo/prepare.mjs verify
if ($LASTEXITCODE -ne 0) { throw 'La base DEMO no pasó la verificación.' }
$processes = @()
foreach ($service in @(
  @{ name='api'; working=$root; args=@('scripts/demo/serve.mjs') },
  @{ name='notifications'; working=$root; args=@('scripts/demo/notifications.mjs') },
  @{ name='web'; working=(Join-Path $root 'frontend'); args=@('../node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort') }
)) {
  $started = Start-Process -FilePath $node -ArgumentList $service.args -WorkingDirectory $service.working `
    -WindowStyle Hidden -RedirectStandardOutput (Join-Path $private "$($service.name).out.log") `
    -RedirectStandardError (Join-Path $private "$($service.name).err.log") -PassThru
  $processes += @{ name=$service.name; pid=$started.Id; startTimeUtc=$started.StartTime.ToUniversalTime().ToString('o') }
}
$processFile = Join-Path $private 'processes.local.json'
$processes | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $processFile -Encoding utf8
$checks = @('http://127.0.0.1:3000/health','http://127.0.0.1:3001/health','http://127.0.0.1:5173/')
foreach ($url in $checks) {
  $passed = $false
  for ($i = 0; $i -lt 15; $i++) {
    try { $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -eq 200) { $passed = $true; break } }
    catch { Start-Sleep -Seconds 1 }
  }
  if (-not $passed) { throw "El servicio no respondió: $url. Revisa los logs locales en $private." }
}
Write-Host 'FarmaFind DEMO lista: http://127.0.0.1:5173/'
Write-Host 'Credenciales: .cache/manual-demo/credentials.local.json (archivo privado).'
Write-Host 'Detener aplicaciones: powershell -ExecutionPolicy Bypass -File scripts/demo/stop.ps1'
