import assert from 'node:assert/strict';
import {localStateName} from './demo-slot.mjs';

assert.equal(localStateName('state.local.json','manual'),'state.manual.local.json');
assert.equal(localStateName('demo.local.json','manual'),'demo.manual.local.json');
assert.equal(localStateName('credentials.local.json','manual'),'credentials.manual.local.json');
assert.equal(localStateName('catalog-fixture.local.json','manual'),'catalog-fixture.manual.local.json');
assert.equal(localStateName('catalog-fixture.local.json',''),'catalog-fixture.local.json');
assert.equal(localStateName('state.local.json',''),'state.local.json');
assert.throws(()=>localStateName('state.local.json','../persistente'));
assert.throws(()=>localStateName('postgres-password.txt','manual'));
console.log('F02.5 manual slot: 8/8 verificaciones estáticas.');
