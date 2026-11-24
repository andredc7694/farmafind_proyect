docker stop farmafind-f025-postgres-postgres-1 | Out-Null
docker start farmafind-f01-postgres-postgres-1 | Out-Null; Start-Sleep 10
$env:F01_TEST_DATABASE_URL = (node -e "import('./scripts/f01/fixture-admin-url.mjs').then(m=>console.log(m.fixtureAdminUrl()))")
foreach($c in 'f01 unit','f01 api','f01 rls','f02 unit','f02 rls','f03 unit','f03 rls','f05 unit','f05 api'){
  $p=$c.Split(' '); "== $c"
  node ("scripts/{0}/check.mjs" -f $p[0]) $p[1] 2>&1 | Select-String -Pattern 'Test Files|Tests |FAIL|×' | Select-Object -First 5
}
"== END2"
