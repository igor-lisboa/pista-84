import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicConfig} from '../src/config.js';

test('public config accepts zero, ignores unrelated secrets and validates balances',()=>{
 assert.deepEqual(publicConfig({PISTA84_COINS:'10000',DB_TOKEN:'private'}),{coins:10000});
 assert.deepEqual(publicConfig({PISTA84_COINS:'0'}),{coins:0});
 assert.deepEqual(publicConfig({PISTA84_COINS:''},{coins:12}),{coins:null});
 assert.deepEqual(publicConfig({},{coins:12}),{coins:12});
 for(const value of ['-1','NaN','Infinity','2.5','9007199254740992'])assert.throws(()=>publicConfig({PISTA84_COINS:value}),/PISTA84_COINS/);
});
