$ErrorActionPreference='Continue'
$env:F01_TEST_DATABASE_URL = (node -e "import('./scripts/f01/fixture-admin-url.mjs').then(m=>console.log(m.fixtureAdminUrl()))")
foreach($c in 'f01 unit','f01 api','f01 rls','f02 unit','f02 rls','f03 unit','f03 rls','f04 unit','f04 api','f04 rls','f05 unit','f05 api','f05 rls'){
  $p=$c.Split(' '); "== $c"
  node ("scripts/{0}/check.mjs" -f $p[0]) $p[1] 2>&1 | Select-String -Pattern 'Test Files|Tests |FAIL|×|Error:' | Select-Object -First 6
}
"== check"; npm run check 2>&1 | Select-Object -Last 1
"== build"; npm run build 2>&1 | Select-Object -Last 1
"== contracts"; npm run verify:contracts 2>&1 | Select-Object -Last 1
"== contracts f011"; npm run verify:contracts:f011 2>&1 | Select-Object -Last 1
"== frontend"; node node_modules/vitest/vitest.mjs run frontend/tests/ --exclude "**/*.spec.js" 2>&1 | Select-String -Pattern 'Test Files|Tests |FAIL|×' | Select-Object -First 6
"== f021-rls"; node node_modules/vitest/vitest.mjs run backend/tests/inventory/f021-rls.test.ts 2>&1 | Select-String -Pattern 'Test Files|Tests |FAIL|×' | Select-Object -First 4
"== END"
