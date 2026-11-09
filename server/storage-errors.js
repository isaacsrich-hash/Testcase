// Safe, fixed diagnostics: never return a database driver's raw message, which
// can contain connection details or credentials.
export class StorageConfigurationError extends Error {
 constructor(message){super(message);this.code='DB_CONFIG';}
}
const problem=(code,error)=>({code,error:`${error} (${code})`});
export function storageProblem(error){
 const code=String(error?.code||'');
 if(error instanceof StorageConfigurationError)return problem('DB_CONFIG',error.message);
 if(['28P01','28000'].includes(code)||(code==='XX000'&&/tenant or user not found/i.test(error?.message||'')))return problem('DB_LOGIN','The database login was rejected. The host needs to check the Supabase password and pooler connection, then redeploy.');
 if(['42P01','3F000','42703'].includes(code))return problem('DB_TABLES','The game tables are not ready in this database. Run the complete Supabase setup SQL, then reload.');
 if(code==='42501')return problem('DB_ACCESS','The database login cannot access the game tables. The host needs to check the Supabase database user and permissions.');
 if(['SELF_SIGNED_CERT_IN_CHAIN','DEPTH_ZERO_SELF_SIGNED_CERT','UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','CERT_HAS_EXPIRED','ERR_TLS_CERT_ALTNAME_INVALID'].includes(code)||code.startsWith('ERR_OSSL_'))return {...problem('DB_CERTIFICATE','The database certificate could not be verified. The host needs to check the saved Supabase CA certificate, then redeploy.'),reason:code};
 if(['ENOTFOUND','EAI_AGAIN','ECONNREFUSED','ECONNRESET','ETIMEDOUT','08006','08001','57P01'].includes(code)||/timeout.*connect|connect.*timeout|connection terminated/i.test(error?.message||''))return problem('DB_CONNECTION','The database could not be reached. Check that the Supabase project is active and the connection uses the Transaction pooler.');
 if(['53300','53400'].includes(code))return problem('DB_BUSY','The database has reached its connection limit. Please wait a moment and try again.');
 return null;
}
