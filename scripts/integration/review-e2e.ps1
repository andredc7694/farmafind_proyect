# Revision integrada: E2E Linux de las suites existentes (una a una) -> docs/evidencias/integration/review-2026-11/e2e.txt
Set-Location (Join-Path $PSScriptRoot '..\..')
$log = 'docs/evidencias/integration/review-2026-11/e2e.txt'
"Revision integrada - E2E ($(Get-Date -Format s))" | Out-File -Encoding utf8 $log
docker start farmafind-f01-postgres-postgres-1 farmafind-f03-search-redis-1 | Out-Null; Start-Sleep 8
$env:F01_TEST_DATABASE_URL = (node -e "import('./scripts/f01/fixture-admin-url.mjs').then(m=>console.log(m.fixtureAdminUrl()))")
foreach ($s in 'f01','f011','f02','f021','f03','f04','f041','f061','f08','f081') {
  "== e2e $s" | Out-File -Append -Encoding utf8 $log
  $o = node "scripts/$s/run-browser-linux.mjs" 2>&1 | Out-String
  $m = ($o -split "`n") | Select-String -Pattern '\d+ passed|\d+ failed|\d+ skipped|Error:|no such|ECONN' | Select-Object -First 6
  foreach ($l in $m) { $l.ToString().Trim() | Out-File -Append -Encoding utf8 $log }
}
"== END" | Out-File -Append -Encoding utf8 $log
