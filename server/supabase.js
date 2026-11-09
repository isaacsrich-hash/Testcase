import pg from 'pg';
import {getCACertificates} from 'node:tls';
import {SUPABASE_ROOT_CA} from './supabase-ca.js';
import {StorageConfigurationError} from './storage-errors.js';
// Only the server reads these variables. Never use VITE_ prefixes for them.
export function supabasePoolOptions(environment=process.env){
 let value=environment.SUPABASE_DATABASE_URL?.trim();
 if(!value)throw new StorageConfigurationError('Set SUPABASE_DATABASE_URL in Netlify environment variables.');
 if(/\[YOUR-PASSWORD\]|%5BYOUR-PASSWORD%5D/i.test(value)){
  if(!environment.SUPABASE_DATABASE_PASSWORD)throw new StorageConfigurationError('Set SUPABASE_DATABASE_PASSWORD in Netlify environment variables.');
  value=value.replace(/\[YOUR-PASSWORD\]|%5BYOUR-PASSWORD%5D/i,()=>encodeURIComponent(environment.SUPABASE_DATABASE_PASSWORD));
 }
 let url;try{url=new URL(value);}catch{throw new StorageConfigurationError('Copy the Transaction pooler connection string from Supabase.');}
 if(environment.SUPABASE_DATABASE_PASSWORD)url.password=encodeURIComponent(environment.SUPABASE_DATABASE_PASSWORD);
 if(!['postgres:','postgresql:'].includes(url.protocol)||!url.hostname||!url.password)throw new StorageConfigurationError('Copy the complete Supabase Transaction pooler connection string.');
 // node-postgres otherwise lets connection-string SSL parameters replace the
 // verified TLS configuration below. Always enforce encryption + server trust.
 for(const key of ['ssl','sslmode','sslcert','sslkey','sslrootcert','uselibpqcompat'])url.searchParams.delete(key);
 // Supabase's shared pooler may use a public CA. Explicit `ca` replaces
 // Node's trust store, so add the verified provider root instead of discarding the
 // standard roots. Hostname and certificate verification remain enabled.
 // The old manually pasted SUPABASE_DATABASE_CA is no longer read or used.
 const trustedRoots=[...new Set([...getCACertificates('default'),SUPABASE_ROOT_CA])];
 return {connectionString:url.toString(),ssl:{ca:trustedRoots,rejectUnauthorized:true},max:2,connectionTimeoutMillis:10000,idleTimeoutMillis:10000,allowExitOnIdle:true};
}
export function createSupabasePool(){return new pg.Pool(supabasePoolOptions());}
