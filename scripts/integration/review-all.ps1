# Revision integrada TEST/DEMO: regresion por capas.
# Uso: powershell -NoProfile -File scripts/integration/review-all.ps1 [-Stage f01|all]
param([string]$Stage = 'all')
Set-Location (Join-Path $PSScriptRoot '..\..')
$out = 'docs/evidencias/integration/review-2026-11'; New-Item -ItemType Directory -Force $out | Out-Null
$log = Join-Path $out 'regression.txt'
function Say($t) { $t | Out-File -Append -Encoding utf8 $log }
"Revision integrada - regresion ($(Get-Date -Format s))" | Out-File -Encoding utf8 $log
function Run($label, [scriptblock]$cmd) {
  Say "== $label"
  $lines = & $cmd 2>&1 | Select-String -Pattern 'Test Files|Tests |FAIL|×|Contrato|Contratos|built in|check F03|archivos JS|error' | Select-Object -First 8
  foreach ($l in $lines) { Say ($l.ToString().Trim()) }
}
docker start farmafind-f01-postgres-postgres-1 farmafind-f03-search-redis-1 | Out-Null; Start-Sleep 8
$env:F01_TEST_DATABASE_URL = (node -e "import('./scripts/f01/fixture-admin-url.mjs').then(m=>console.log(m.fixtureAdminUrl()))")
foreach ($c in 'f00 all','f01 unit','f01 api','f01 rls','f02 unit','f02 rls','f03 unit','f03 integration','f03 rls','f04 unit','f04 api','f05 unit','f05 api','f06 unit','f06 api','f06 integration','f061 unit','f061 api','f061 integration','f07 unit','f07 api','f07 rls') {
  $p = $c.Split(' '); Run $c { node ("scripts/{0}/check.mjs" -f $p[0]) $p[1] }
}
Run 'f021-rls' { node node_modules/vitest/vitest.mjs run backend/tests/inventory/f021-rls.test.ts }
Run 'check' { npm run check }
Run 'build' { npm run build }
foreach ($c in 'verify:contracts','verify:contracts:f011','verify:contracts:f041','verify:contracts:f081') { Run $c { npm run $c } }
Run 'frontend' { node node_modules/vitest/vitest.mjs run frontend/tests/ --exclude "**/*.spec.js" }
docker stop farmafind-f01-postgres-postgres-1 | Out-Null; docker start farmafind-f025-postgres-postgres-1 | Out-Null; Start-Sleep 10
Run 'f04 rls (cluster F025)' { node scripts/f025/check-f04-rls.mjs }
docker stop farmafind-f025-postgres-postgres-1 farmafind-f03-search-redis-1 | Out-Null
Say '== END'
