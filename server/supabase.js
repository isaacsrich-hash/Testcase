import pg from 'pg';
import {X509Certificate} from 'node:crypto';
import {getCACertificates} from 'node:tls';
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
 const ca=environment.SUPABASE_DATABASE_CA?.replace(/\\n/g,'\n').trim();
 if(!ca?.includes('-----BEGIN CERTIFICATE-----')||!ca.includes('-----END CERTIFICATE-----'))throw new StorageConfigurationError('Set SUPABASE_DATABASE_CA to the downloaded Supabase server root certificate.');
 try{new X509Certificate(ca);}catch{throw new StorageConfigurationError('The saved certificate is not valid certificate text. Copy the complete downloaded .crt file into SUPABASE_DATABASE_CA, then redeploy.');}
 // node-postgres otherwise lets connection-string SSL parameters replace the
 // verified TLS configuration below. Always enforce encryption + server trust.
 for(const key of ['ssl','sslmode','sslcert','sslkey','sslrootcert','uselibpqcompat'])url.searchParams.delete(key);
 // Supabase's shared pooler may use a public CA. Explicit `ca` replaces
 // Node's trust store, so add the project root instead of discarding the
 // standard roots. Hostname and certificate verification remain enabled.
 const trustedRoots=[...new Set([...getCACertificates('default'),ca])];
 return {connectionString:url.toString(),ssl:{ca:trustedRoots,rejectUnauthorized:true},max:2,connectionTimeoutMillis:10000,idleTimeoutMillis:10000,allowExitOnIdle:true};
}
export function createSupabasePool(){return new pg.Pool(supabasePoolOptions());}
