import pg from 'pg';
// Only the server reads these variables. Never use VITE_ prefixes for them.
export function supabasePoolOptions(environment=process.env){
 let value=environment.SUPABASE_DATABASE_URL;
 if(!value)throw Error('Set SUPABASE_DATABASE_URL in Netlify environment variables.');
 if(value.includes('[YOUR-PASSWORD]')){
  if(!environment.SUPABASE_DATABASE_PASSWORD)throw Error('Set SUPABASE_DATABASE_PASSWORD in Netlify environment variables.');
  value=value.replace('[YOUR-PASSWORD]',encodeURIComponent(environment.SUPABASE_DATABASE_PASSWORD));
 }
 let url;try{url=new URL(value);}catch{throw Error('Copy the Transaction pooler connection string from Supabase.');}
 if(!['postgres:','postgresql:'].includes(url.protocol)||!url.hostname||!url.password)throw Error('Copy the complete Supabase Transaction pooler connection string.');
 const ca=environment.SUPABASE_DATABASE_CA?.replace(/\\n/g,'\n').trim();
 if(!ca?.includes('-----BEGIN CERTIFICATE-----')||!ca.includes('-----END CERTIFICATE-----'))throw Error('Set SUPABASE_DATABASE_CA to the downloaded Supabase server root certificate.');
 // node-postgres otherwise lets connection-string SSL parameters replace the
 // verified TLS configuration below. Always enforce encryption + server trust.
 for(const key of ['ssl','sslmode','sslcert','sslkey','sslrootcert','uselibpqcompat'])url.searchParams.delete(key);
 return {connectionString:url.toString(),ssl:{ca,rejectUnauthorized:true},max:2,connectionTimeoutMillis:10000,idleTimeoutMillis:10000,allowExitOnIdle:true};
}
export function createSupabasePool(){return new pg.Pool(supabasePoolOptions());}
