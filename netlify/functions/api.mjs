import {getDatabase} from '@netlify/database';
import {createNetlifyHandler} from '../../server/netlify-handler.js';
import {createPostgresStore} from '../../server/store.js';
// No local filesystem fallback: function storage is ephemeral. All production
// requests use Netlify Database, which survives function restarts and deploys.
let handle;
export const handler=async(event,context)=>{
 try {
  handle??=createNetlifyHandler(createPostgresStore(getDatabase().pool));
  return await handle(event,context);
 }catch(e){
  console.error('Kindred database initialization failed:',e.code||e.name);
  return {statusCode:503,headers:{'content-type':'application/json','cache-control':'no-store'},body:JSON.stringify({error:'Game storage is not connected. Enable Netlify Database for this site and redeploy.'})};
 }
};
