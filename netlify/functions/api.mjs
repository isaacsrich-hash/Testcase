import {storageProblem} from '../../server/storage-errors.js';
import {createSupabasePool} from '../../server/supabase.js';
import {createNetlifyHandler} from '../../server/netlify-handler.js';
import {createPostgresStore} from '../../server/store.js';
// Netlify serves the app and Function; Supabase stores all production data.
// There is no fallback to ephemeral Function storage or Netlify Database.
let handle;
export const handler=async(event,context)=>{
 try {
  handle??=createNetlifyHandler(createPostgresStore(createSupabasePool()));
  return await handle(event,context);
 }catch(e){
  const issue=storageProblem(e)||{code:'DB_UNAVAILABLE',error:'Game storage is unavailable. Ask the host to check the game service. (DB_UNAVAILABLE)'};
  console.error('Spite n Malice storage initialization failed:',issue.code);
  return {statusCode:503,headers:{'content-type':'application/json','cache-control':'no-store'},body:JSON.stringify(issue)};
 }
};
