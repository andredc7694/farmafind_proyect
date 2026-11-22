param([switch]$StopDataServices)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Set-Location $root
$file = Join-Path $root '.cache/manual-demo/processes.local.json'
if (Test-Path $file) {
  $records = Get-Content -LiteralPath $file -Raw | ConvertFrom-Json
  foreach ($item in $records) {
    $process = Get-Process -Id $item.pid -ErrorAction SilentlyContinue
    if ($process -and $process.StartTime.ToUniversalTime().ToString('o') -eq $item.startTimeUtc) {
      Stop-Process -Id $item.pid
      Write-Host "Detenido: $($item.name)"
    }
  }
  Remove-Item -LiteralPath $file
}
if ($StopDataServices) {
  $dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
  $docker = if ($dockerCommand) { $dockerCommand.Source } else { Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin/docker.exe' }
  & $docker compose -f compose.f03-search.yaml stop redis
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo detener Redis.' }
  & $docker compose -f compose.f01-postgres.yaml stop postgres
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo detener PostgreSQL.' }
}
Write-Host 'DEMO detenida sin borrar bases ni volúmenes.'
