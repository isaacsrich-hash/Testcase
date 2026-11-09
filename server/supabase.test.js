import test from 'node:test';import assert from 'node:assert/strict';
import pg from 'pg';
import {supabasePoolOptions} from './supabase.js';
const certificate='-----BEGIN CERTIFICATE-----\nTEST CONFIGURATION ONLY\n-----END CERTIFICATE-----';
test('Supabase configuration requires credentials and a root certificate without leaking values',()=>{
 assert.throws(()=>supabasePoolOptions({}),/SUPABASE_DATABASE_URL/);
 assert.throws(()=>supabasePoolOptions({SUPABASE_DATABASE_URL:'postgresql://user:[YOUR-PASSWORD]@pooler.example.com:6543/postgres'}),/SUPABASE_DATABASE_PASSWORD/);
 assert.throws(()=>supabasePoolOptions({SUPABASE_DATABASE_URL:'postgresql://user:password@pooler.example.com:6543/postgres'}),/SUPABASE_DATABASE_CA/);
});
test('Supabase options encode raw password and enforce verified TLS over URL flags',()=>{
 const password='spaces @:#/?%&';
 const options=supabasePoolOptions({SUPABASE_DATABASE_URL:'postgresql://postgres.project:[YOUR-PASSWORD]@pooler.example.com:6543/postgres?ssl=0&sslmode=disable&sslrootcert=bad',SUPABASE_DATABASE_PASSWORD:password,SUPABASE_DATABASE_CA:certificate});
 const url=new URL(options.connectionString);
 assert.equal(decodeURIComponent(url.password),password);assert.equal(url.port,'6543');assert.equal(url.searchParams.has('sslmode'),false);assert.equal(url.searchParams.has('sslrootcert'),false);
 assert.equal(url.searchParams.has('ssl'),false);assert.equal(new pg.Client(options).connectionParameters.ssl.rejectUnauthorized,true);assert.equal(options.ssl.rejectUnauthorized,true);assert.equal(options.ssl.ca,certificate);assert.equal(options.max,2);
});
