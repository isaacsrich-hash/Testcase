import test from 'node:test';import assert from 'node:assert/strict';
import {storageProblem} from './storage-errors.js';
import {createNetlifyHandler} from './netlify-handler.js';
test('storage diagnostics distinguish failures without returning raw driver messages',async()=>{
 const sensitive='postgresql://private-user:private-password@private-host/postgres';
 for(const [code,expected] of [['28P01','DB_LOGIN'],['42P01','DB_TABLES'],['42501','DB_ACCESS'],['SELF_SIGNED_CERT_IN_CHAIN','DB_CERTIFICATE'],['ETIMEDOUT','DB_CONNECTION']]){
  const failure=Object.assign(Error(sensitive),{code});
  assert.equal(storageProblem(failure).code,expected);
  const handler=createNetlifyHandler({transaction:async()=>{throw failure;}});
  const r=await handler({httpMethod:'GET',path:'/api/health',headers:{}},{});
  assert.equal(r.statusCode,503);assert.equal(JSON.parse(r.body).code,expected);
  assert.equal(r.body.includes('private-password'),false);assert.equal(r.body.includes('private-host'),false);
 }
});
