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
  console.error('Kindred database initialization failed:',e.code||e.name);
  return {statusCode:503,headers:{'content-type':'application/json','cache-control':'no-store'},body:JSON.stringify({error:'Game storage is not connected. Complete the Supabase setup in the project instructions, then redeploy.'})};
 }
};
