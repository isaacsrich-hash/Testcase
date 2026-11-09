import test from 'node:test';import assert from 'node:assert/strict';
import pg from 'pg';
import {X509Certificate} from 'node:crypto';
import {SUPABASE_ROOT_CA} from './supabase-ca.js';
import {supabasePoolOptions} from './supabase.js';
const certificate=SUPABASE_ROOT_CA;
test('Supabase configuration requires credentials without leaking values',()=>{
 assert.throws(()=>supabasePoolOptions({}),/SUPABASE_DATABASE_URL/);
 assert.throws(()=>supabasePoolOptions({SUPABASE_DATABASE_URL:'postgresql://user:[YOUR-PASSWORD]@pooler.example.com:6543/postgres'}),/SUPABASE_DATABASE_PASSWORD/);
 assert.equal(supabasePoolOptions({SUPABASE_DATABASE_URL:'postgresql://user:password@pooler.example.com:6543/postgres'}).ssl.rejectUnauthorized,true);
});
test('Supabase options encode raw password and enforce verified TLS over URL flags',()=>{
 const password='spaces @:#/?%&';
 const options=supabasePoolOptions({SUPABASE_DATABASE_URL:'postgresql://postgres.project:[YOUR-PASSWORD]@pooler.example.com:6543/postgres?ssl=0&sslmode=disable&sslrootcert=bad',SUPABASE_DATABASE_PASSWORD:password,SUPABASE_DATABASE_CA:certificate});
 const url=new URL(options.connectionString);
 assert.equal(decodeURIComponent(url.password),password);assert.equal(url.port,'6543');assert.equal(url.searchParams.has('sslmode'),false);assert.equal(url.searchParams.has('sslrootcert'),false);
 assert.equal(url.searchParams.has('ssl'),false);assert.equal(new pg.Client(options).connectionParameters.ssl.rejectUnauthorized,true);assert.equal(options.ssl.rejectUnauthorized,true);assert.ok(options.ssl.ca.includes(certificate));assert.ok(options.ssl.ca.length>1);assert.equal(options.max,2);
});
test('saved password overrides an inline placeholder or stale copied password',()=>{
 for(const value of ['postgresql://user:%5BYOUR-PASSWORD%5D@pooler.example.com:6543/postgres','postgresql://user:old-value@pooler.example.com:6543/postgres']){
  const options=supabasePoolOptions({SUPABASE_DATABASE_URL:'  '+value+'  ',SUPABASE_DATABASE_PASSWORD:'current@password',SUPABASE_DATABASE_CA:certificate});
  assert.equal(decodeURIComponent(new URL(options.connectionString).password),'current@password');
 }
});

test('bundled Supabase root is the authentic, valid provider CA',()=>{
 const root=new X509Certificate(SUPABASE_ROOT_CA);
 assert.equal(root.ca,true);assert.equal(root.verify(root.publicKey),true);
 assert.match(root.subject,/Supabase Root 2021 CA/);
 assert.equal(root.fingerprint256,'80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA');
 assert.ok(Date.now()>Date.parse(root.validFrom)&&Date.now()<Date.parse(root.validTo));
});
test('legacy certificate text is not used to change verified trust',()=>{
 const options=supabasePoolOptions({SUPABASE_DATABASE_URL:'postgresql://user:password@pooler.example.com:6543/postgres',SUPABASE_DATABASE_CA:'not a valid certificate'});
 assert.equal(options.ssl.rejectUnauthorized,true);
 assert.ok(options.ssl.ca.includes(SUPABASE_ROOT_CA));
 assert.equal(options.ssl.ca.some(ca=>ca.includes('not a valid certificate')),false);
});
