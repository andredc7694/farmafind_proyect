$env:F01_TEST_DATABASE_URL = (node -e "import('./scripts/f01/fixture-admin-url.mjs').then(m=>console.log(m.fixtureAdminUrl()))")
foreach($c in 'f04 unit','f04 api'){ $p=$c.Split(' '); "== $c"; node ("scripts/{0}/check.mjs" -f $p[0]) $p[1] 2>&1 | Select-String -Pattern 'Test Files|Tests |FAIL|×' | Select-Object -First 5 }
"== f04 rls"; node scripts/f025/check-f04-rls.mjs 2>&1 | Select-String -Pattern 'Test Files|Tests |FAIL|×' | Select-Object -First 5
"== f05 rls"; node scripts/f05/check.mjs rls 2>&1 | Select-String -Pattern 'Test Files|Tests |FAIL|×' | Select-Object -First 4
"== check"; npm run check 2>&1 | Select-Object -Last 1
"== build"; npm run build 2>&1 | Select-Object -Last 1
"== contracts"; npm run verify:contracts 2>&1 | Select-Object -Last 1
"== contracts f041"; npm run verify:contracts:f041 2>&1 | Select-Object -Last 1
"== frontend"; node node_modules/vitest/vitest.mjs run frontend/tests/ --exclude "**/*.spec.js" 2>&1 | Select-String -Pattern 'Test Files|Tests |FAIL|×' | Select-Object -First 5
"== END1"
